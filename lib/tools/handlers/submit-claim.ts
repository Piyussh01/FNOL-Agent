import { z } from "zod";
import { registerTool, getTool } from "../registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { logToolEvent } from "./_events";
import { capture } from "@/lib/observability/posthog";

const Input = z.object({
  claim_id: z.string().uuid(),
  user_confirmed: z.boolean(),
});

type Output = {
  submitted: boolean;
  claim_number: string;
  expected_adjuster_contact_by: string;
  email_sent: boolean;
};

export default registerTool<z.infer<typeof Input>, Output>({
  name: "submit_claim",
  description: "Submit the claim after user confirmation. Auto-sends the summary email — do not call send_summary separately.",
  inputSchema: Input,
  async run(input, ctx) {
    if (!input.user_confirmed) {
      throw new Error("user_not_confirmed");
    }
    const admin = createAdminClient();
    const now = new Date();
    const expected = new Date(now);
    expected.setHours(expected.getHours() + 48);

    const { data, error } = await admin
      .from("claims")
      .update({
        stage: "submitted",
        status: "submitted",
        submitted_at: now.toISOString(),
      })
      .eq("id", input.claim_id)
      .select("claim_number")
      .single();
    if (error || !data) throw new Error("submit_failed");

    await logToolEvent("submit_claim", { claim_id: input.claim_id }, {
      claim_number: data.claim_number,
    });
    await capture("claim_submitted", ctx.caller.user_id, {
      claim_id: input.claim_id,
      claim_number: data.claim_number,
    });

    let emailSent = false;
    const sendSummary = getTool("send_summary");
    if (sendSummary) {
      try {
        const r = (await sendSummary.run({ claim_id: input.claim_id }, ctx)) as {
          sent?: boolean;
        };
        emailSent = r?.sent === true;
      } catch {
        emailSent = false;
      }
    }

    return {
      submitted: true,
      claim_number: data.claim_number,
      expected_adjuster_contact_by: expected.toISOString(),
      email_sent: emailSent,
    };
  },
});
