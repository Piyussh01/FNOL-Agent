import { z } from "zod";
import { registerTool } from "../registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { logToolEvent } from "./_events";
import { capture } from "@/lib/observability/posthog";

const Input = z.object({
  claim_id: z.string().uuid(),
  reason: z.string().min(1),
  urgency: z.enum(["low", "medium", "high"]),
});

type Output = {
  ticket_id: string;
  scheduled_callback_at: string;
};

function callbackTimeFor(urgency: "low" | "medium" | "high"): Date {
  const t = new Date();
  if (urgency === "high") t.setMinutes(t.getMinutes() + 15);
  else if (urgency === "medium") t.setHours(t.getHours() + 2);
  else t.setHours(t.getHours() + 24);
  return t;
}

export default registerTool<z.infer<typeof Input>, Output>({
  name: "escalate_to_human",
  description: "Hand off to a human supervisor.",
  inputSchema: Input,
  async run(input, ctx) {
    const admin = createAdminClient();
    const callbackAt = callbackTimeFor(input.urgency);

    const { data, error } = await admin
      .from("tasks")
      .insert({
        claim_id: input.claim_id,
        kind: "human_callback",
        status: "scheduled",
        partner_ref: `ESC-${Date.now().toString(36).toUpperCase()}`,
        scheduled_for: callbackAt.toISOString(),
        payload_json: { reason: input.reason, urgency: input.urgency },
      })
      .select("id, partner_ref")
      .single();
    if (error || !data) throw new Error("escalation_insert_failed");

    await admin
      .from("claims")
      .update({ stage: "escalated", status: "escalated" })
      .eq("id", input.claim_id);

    await admin.from("events").insert({
      claim_id: input.claim_id,
      type: "escalation",
      payload_json: { reason: input.reason, urgency: input.urgency, ticket_id: data.id },
    });

    await logToolEvent("escalate_to_human", { claim_id: input.claim_id }, {
      urgency: input.urgency,
    });
    await capture("escalated", ctx.caller.user_id, {
      claim_id: input.claim_id,
      urgency: input.urgency,
      reason: input.reason,
    });

    return {
      ticket_id: data.partner_ref ?? data.id,
      scheduled_callback_at: callbackAt.toISOString(),
    };
  },
});
