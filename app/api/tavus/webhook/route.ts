import { NextResponse, type NextRequest } from "next/server";
import { verifyTavusSignature } from "@/lib/tavus/webhook-verify";
import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/observability/logger";

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
  const sig =
    req.headers.get("x-tavus-signature") ?? req.headers.get("tavus-signature");

  // In dev (no secret), still log + 200 so we can develop. In prod the env
  // is present and we enforce.
  const isProd = process.env.NODE_ENV === "production";
  const sigCheck = verifyTavusSignature(raw, sig);
  if (!sigCheck.ok) {
    log.warn("webhook_signature_failed", { reason: sigCheck.reason });
    if (isProd || sigCheck.reason !== "no_secret") {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

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
      // Dispatched to /api/tools/[name] in M4. For now we record only.
      log.info("tool_call_received_m3_stub", { eventType });
      break;
    }
    default:
      // Other event types (utterance, perception, replica_joined, etc.)
      // are persisted but not acted on yet.
      break;
  }

  return NextResponse.json({ ok: true });
}
