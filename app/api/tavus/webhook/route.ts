import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/observability/logger";
import { getTool, loadAllTools } from "@/lib/tools/registry";
import { verifyToolJwt } from "@/lib/auth/tool-jwt";
import { logToolError } from "@/lib/tools/handlers/_events";
import { getClaimSnapshot } from "@/lib/claims/snapshot";

let toolsLoaded = false;
async function ensureToolsLoaded() {
  if (!toolsLoaded) {
    await loadAllTools();
    toolsLoaded = true;
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TavusEvent = {
  event_type?: string;
  conversation_id?: string;
  message_type?: string;
  properties?: Record<string, unknown>;
  data?: Record<string, unknown>;
  // Tool-call payloads come through here in M4+.
};

export async function POST(req: NextRequest) {
  const raw = await req.text();

  let event: TavusEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const admin = createAdminClient();
  const conversationId = event.conversation_id ?? null;

  // Look up the session this webhook is for (so events get claim_id stamped).
  let sessionRow: { id: string; claim_id: string | null } | null = null;
  if (conversationId) {
    const { data } = await admin
      .from("sessions")
      .select("id, claim_id")
      .eq("tavus_conversation_id", conversationId)
      .maybeSingle();
    sessionRow = data;
  }

  const eventType =
    event.event_type ?? event.message_type ?? "tavus.unknown";

  // Persist every webhook event for audit.
  await admin.from("events").insert({
    claim_id: sessionRow?.claim_id ?? null,
    session_id: sessionRow?.id ?? null,
    type: `tavus.${eventType}`,
    payload_json: event as object,
  });

  // Stage updates we care about right now (M3). Tool dispatch is M4.
  switch (eventType) {
    case "system.session_start":
    case "conversation.started": {
      if (sessionRow) {
        await admin
          .from("sessions")
          .update({ started_at: new Date().toISOString() })
          .eq("id", sessionRow.id);
      }
      break;
    }
    case "system.session_end":
    case "conversation.ended": {
      if (sessionRow) {
        const recording =
          (event.data?.recording_url as string | undefined) ??
          (event.properties?.recording_url as string | undefined);
        await admin
          .from("sessions")
          .update({
            ended_at: new Date().toISOString(),
            recording_url: recording ?? null,
          })
          .eq("id", sessionRow.id);
      }
      break;
    }
    case "conversation.perception_tool_call":
    case "conversation.tool_call": {
      await ensureToolsLoaded();
      const result = await dispatchToolCall(event, sessionRow);
      return NextResponse.json(result);
    }
    case "conversation.perception_analysis":
    case "conversation.perception": {
      await handlePerception(event, sessionRow);
      break;
    }
    case "conversation.utterance":
    case "conversation.user_utterance":
    case "conversation.replica_utterance":
    case "application.transcription_ready": {
      // Persist spoken turns into the messages table so the claim snapshot
      // can surface recent dialogue back to Sam. Without this, Sam's
      // working memory of what was said in-call is whatever the in-Tavus
      // LLM happens to remember — which is exactly the "you forgot I
      // said 16th and Mission" failure mode.
      await persistUtterance(event, sessionRow);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ ok: true });
}

// Tavus tool_call payload shape (best-effort across versions):
//   { event_type: "conversation.tool_call",
//     conversation_id: "...",
//     properties: { tool_call_id, name, arguments: object|string,
//                   conversational_context?: string },
//     data?: similar }
async function dispatchToolCall(
  event: TavusEvent,
  sessionRow: { id: string; claim_id: string | null } | null,
): Promise<unknown> {
  const props = (event.properties ?? event.data ?? {}) as Record<string, unknown>;
  const name = (props.name ?? props.tool_name) as string | undefined;
  const argsRaw = (props.arguments ?? props.args) as
    | Record<string, unknown>
    | string
    | undefined;
  const toolCallId = (props.tool_call_id ?? props.id) as string | undefined;

  if (!name) {
    return { error: "missing_tool_name" };
  }
  const tool = getTool(name);
  if (!tool) {
    return { error: `unknown_tool:${name}` };
  }

  const args =
    typeof argsRaw === "string" ? safeJson(argsRaw) : (argsRaw ?? {});

  // Tavus carries our JWT in the conversational_context string we set at
  // conversation create.
  const ctxStr =
    (props.conversational_context as string | undefined) ??
    (event.data?.conversational_context as string | undefined) ??
    null;
  const ctxObj = ctxStr ? safeJson(ctxStr) : {};
  const token =
    (args as Record<string, unknown>).tool_jwt ??
    (ctxObj as Record<string, unknown>).tool_jwt;
  if (typeof token !== "string") {
    return { tool_call_id: toolCallId, error: "missing_tool_jwt" };
  }

  let claims;
  try {
    claims = await verifyToolJwt(token);
  } catch (err) {
    return { tool_call_id: toolCallId, error: `bad_token:${(err as Error).message}` };
  }

  const admin = createAdminClient();
  const { data: claim } = await admin
    .from("claims")
    .select("id, user_id, kind, stage")
    .eq("id", claims.claim_id)
    .maybeSingle();

  if (!claim || claim.user_id !== claims.user_id) {
    return { tool_call_id: toolCallId, error: "unauthorized" };
  }

  const parsed = tool.inputSchema.safeParse({ ...args, tool_jwt: undefined });
  if (!parsed.success) {
    return {
      tool_call_id: toolCallId,
      error: "invalid_input",
      issues: parsed.error.issues,
    };
  }

  try {
    const result = await tool.run(parsed.data, { caller: claims, claim });
    // Echo the post-tool claim snapshot back to Sam so the model's working
    // memory stays in sync with ground truth. This is what stops Sam from
    // asking "where did it happen?" after the user already said
    // "16th and Mission" — because that location is now in the snapshot
    // attached to every tool result.
    const snapshot = await safeSnapshot(claim.id);
    return { tool_call_id: toolCallId, result, known_state: snapshot };
  } catch (err) {
    await logToolError(tool.name, { claim_id: claim.id, session_id: sessionRow?.id }, err);
    const snapshot = await safeSnapshot(claim.id);
    return {
      tool_call_id: toolCallId,
      error: (err as Error).message,
      known_state: snapshot,
    };
  }
}

async function safeSnapshot(claimId: string) {
  try {
    return await getClaimSnapshot(claimId);
  } catch {
    return null;
  }
}

// Tavus utterance event shapes vary across versions / event names. We look
// in a handful of likely places for { role, text } and persist whatever we
// find. Role mapping: "user" stays user; anything that looks like the
// replica (sam / replica / assistant / agent) becomes assistant.
async function persistUtterance(
  event: TavusEvent,
  sessionRow: { id: string; claim_id: string | null } | null,
): Promise<void> {
  if (!sessionRow?.claim_id) return;

  const props = (event.properties ?? event.data ?? {}) as Record<string, unknown>;

  const roleRaw =
    (props.role as string | undefined) ??
    (props.speaker as string | undefined) ??
    (props.participant as string | undefined) ??
    (event.event_type?.includes("user") ? "user" : null) ??
    (event.event_type?.includes("replica") ? "assistant" : null);

  const content =
    (props.text as string | undefined) ??
    (props.utterance as string | undefined) ??
    (props.transcript as string | undefined) ??
    (props.content as string | undefined) ??
    null;

  if (!content || content.trim().length === 0) return;

  const role: "user" | "assistant" =
    typeof roleRaw === "string" &&
    /user|caller|human|participant/i.test(roleRaw)
      ? "user"
      : "assistant";

  const admin = createAdminClient();
  await admin.from("messages").insert({
    claim_id: sessionRow.claim_id,
    session_id: sessionRow.id,
    role,
    channel: "video",
    content: content.slice(0, 4000),
  });
}

// Raven perception events: surface distress / unsafe-environment signals.
// We look for a numeric distress score in the payload. Threshold from
// guardrails.json is 0.7.
const DISTRESS_THRESHOLD = 0.7;

async function handlePerception(
  event: TavusEvent,
  sessionRow: { id: string; claim_id: string | null } | null,
) {
  const props = (event.properties ?? event.data ?? {}) as Record<string, unknown>;
  const score = extractDistressScore(props);

  if (score !== null && score >= DISTRESS_THRESHOLD && sessionRow) {
    const admin = createAdminClient();
    await admin.from("sessions").update({ distress_flagged: true }).eq("id", sessionRow.id);
    await admin.from("events").insert({
      claim_id: sessionRow.claim_id,
      session_id: sessionRow.id,
      type: "distress_flag",
      payload_json: { score, raw: props },
    });
    log.warn("distress_flag", { session_id: sessionRow.id, score });
  }
}

function extractDistressScore(props: Record<string, unknown>): number | null {
  const candidates = [
    props.distress_score,
    props.distress,
    (props.emotion as Record<string, unknown> | undefined)?.distress,
    (props.scores as Record<string, unknown> | undefined)?.distress,
  ];
  for (const c of candidates) {
    if (typeof c === "number" && c >= 0 && c <= 1) return c;
  }
  return null;
}

function safeJson(s: string): Record<string, unknown> {
  try {
    const v = JSON.parse(s);
    return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
