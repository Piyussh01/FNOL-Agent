import { createAdminClient } from "@/lib/supabase/admin";

export async function logToolEvent(
  toolName: string,
  ctx: { claim_id?: string | null; session_id?: string | null },
  payload: Record<string, unknown>,
) {
  const admin = createAdminClient();
  await admin.from("events").insert({
    claim_id: ctx.claim_id ?? null,
    session_id: ctx.session_id ?? null,
    type: "tool_call",
    payload_json: { tool: toolName, ...payload },
  });
}

export async function logToolError(
  toolName: string,
  ctx: { claim_id?: string | null; session_id?: string | null },
  error: unknown,
) {
  const admin = createAdminClient();
  await admin.from("events").insert({
    claim_id: ctx.claim_id ?? null,
    session_id: ctx.session_id ?? null,
    type: "tool_error",
    payload_json: {
      tool: toolName,
      error:
        error instanceof Error
          ? { message: error.message, name: error.name }
          : { message: String(error) },
    },
  });
}
