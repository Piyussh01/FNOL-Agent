import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/magic-link";
import { createAdminClient } from "@/lib/supabase/admin";
import { mintToolJwt, verifyToolJwt } from "@/lib/auth/tool-jwt";
import { anthropic, CHAT_MODEL } from "@/lib/anthropic/client";
import { anthropicToolsFromRegistry } from "@/lib/tools/anthropic-tools";
import { getTool, loadAllTools } from "@/lib/tools/registry";
import { loadPersonaPrompt } from "@/lib/tavus/persona";
import { logToolError } from "@/lib/tools/handlers/_events";
import { log } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  claim_id: z.string().uuid(),
  message: z.string().min(1),
});

let toolsLoaded = false;
async function ensureToolsLoaded() {
  if (!toolsLoaded) {
    await loadAllTools();
    toolsLoaded = true;
  }
}

export async function POST(req: NextRequest) {
  await ensureToolsLoaded();

  const user = await getCurrentUser();
  if (!user || !user.id) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const { claim_id, message } = parsed.data;

  const admin = createAdminClient();
  const { data: claim } = await admin
    .from("claims")
    .select("id, user_id, kind, stage")
    .eq("id", claim_id)
    .maybeSingle();
  if (!claim || claim.user_id !== user.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }

  // Find or open the chat session for this claim.
  const { data: existing } = await admin
    .from("sessions")
    .select("id")
    .eq("claim_id", claim.id)
    .eq("modality", "chat")
    .is("ended_at", null)
    .maybeSingle();
  let sessionId = existing?.id;
  if (!sessionId) {
    const { data: s } = await admin
      .from("sessions")
      .insert({ claim_id: claim.id, user_id: user.id, modality: "chat" })
      .select("id")
      .single();
    sessionId = s?.id;
  }

  // Mint a tool JWT scoped to this turn (60s is enough for inline dispatch).
  const toolJwt = await mintToolJwt(
    { claim_id: claim.id, user_id: user.id, session_id: sessionId },
    60,
  );
  void toolJwt;

  // Persist the user's message.
  await admin.from("messages").insert({
    claim_id: claim.id,
    session_id: sessionId,
    role: "user",
    channel: "chat",
    content: message,
  });

  // Pull recent history for context.
  const { data: history } = await admin
    .from("messages")
    .select("role, content, tool_calls_json, created_at")
    .eq("claim_id", claim.id)
    .order("created_at", { ascending: true })
    .limit(40);

  const systemPrompt =
    loadPersonaPrompt(user.preferred_lang === "es" ? "es" : "en") +
    `\n\n# Runtime context\n` +
    `Caller claim_id: ${claim.id}\n` +
    `Caller user_id: ${user.id}\n` +
    `Stage: ${claim.stage}\n` +
    `Kind: ${claim.kind}\n` +
    `Channel: chat (no video).`;

  type Msg = import("@anthropic-ai/sdk").Anthropic.Messages.MessageParam;
  const messages: Msg[] = (history ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content ?? "",
    }));

  const client = anthropic();
  const tools = anthropicToolsFromRegistry();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(obj: unknown) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      }

      try {
        // We may need to loop on tool_use → tool_result.
        let turn = 0;
        const MAX_TURNS = 8;
        const localMessages = [...messages];

        while (turn < MAX_TURNS) {
          turn++;
          const resp = await client.messages.create({
            model: CHAT_MODEL,
            max_tokens: 1024,
            system: systemPrompt,
            tools,
            messages: localMessages,
          });

          let assistantText = "";
          const toolUses: Array<{
            id: string;
            name: string;
            input: Record<string, unknown>;
          }> = [];

          for (const block of resp.content) {
            if (block.type === "text") {
              assistantText += block.text;
              send({ type: "text", delta: block.text });
            } else if (block.type === "tool_use") {
              toolUses.push({
                id: block.id,
                name: block.name,
                input: (block.input ?? {}) as Record<string, unknown>,
              });
              send({ type: "tool_use", name: block.name });
            }
          }

          // Save the assistant message (text portion).
          if (assistantText) {
            await admin.from("messages").insert({
              claim_id: claim.id,
              session_id: sessionId,
              role: "assistant",
              channel: "chat",
              content: assistantText,
            });
            localMessages.push({ role: "assistant", content: assistantText });
          }

          // No tool use → done.
          if (toolUses.length === 0 || resp.stop_reason !== "tool_use") {
            break;
          }

          // Execute tools sequentially and produce tool_result blocks for the
          // next turn.
          const toolResults: Array<{
            type: "tool_result";
            tool_use_id: string;
            content: string;
            is_error?: boolean;
          }> = [];
          for (const tu of toolUses) {
            const handler = getTool(tu.name);
            if (!handler) {
              toolResults.push({
                type: "tool_result",
                tool_use_id: tu.id,
                content: JSON.stringify({ error: "unknown_tool" }),
                is_error: true,
              });
              continue;
            }
            const validated = handler.inputSchema.safeParse(tu.input);
            if (!validated.success) {
              toolResults.push({
                type: "tool_result",
                tool_use_id: tu.id,
                content: JSON.stringify({
                  error: "invalid_input",
                  issues: validated.error.issues,
                }),
                is_error: true,
              });
              continue;
            }
            try {
              const result = await handler.run(validated.data, {
                caller: { claim_id: claim.id, user_id: user.id!, session_id: sessionId },
                claim,
              });
              toolResults.push({
                type: "tool_result",
                tool_use_id: tu.id,
                content: JSON.stringify(result),
              });
              send({ type: "tool_result", name: tu.name, result });
            } catch (err) {
              await logToolError(tu.name, { claim_id: claim.id, session_id: sessionId }, err);
              toolResults.push({
                type: "tool_result",
                tool_use_id: tu.id,
                content: JSON.stringify({ error: (err as Error).message }),
                is_error: true,
              });
              send({ type: "tool_error", name: tu.name, message: (err as Error).message });
            }
          }

          localMessages.push(
            { role: "assistant", content: resp.content } as Msg,
            { role: "user", content: toolResults } as Msg,
          );
        }

        send({ type: "done" });
        controller.close();
      } catch (err) {
        log.error("chat_stream_failed", { error: (err as Error).message });
        send({ type: "error", message: (err as Error).message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}

// Verify the JWT on incoming tool dispatches if delivered out-of-band.
// Currently chat dispatches inline; kept for future use.
export { verifyToolJwt };
