import { z } from "zod";
import { registerTool } from "../registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { logToolEvent } from "./_events";

const Input = z.object({
  claim_id: z.string().uuid(),
  user_confirmed: z.boolean(),
});

type Output = {
  submitted: boolean;
  claim_number: string;
  expected_adjuster_contact_by: string;
};

export default registerTool<z.infer<typeof Input>, Output>({
  name: "submit_claim",
  description: "Submit the claim after user confirmation.",
  inputSchema: Input,
  async run(input, ctx) {
    if (!input.user_confirmed) {
      throw new Error("user_not_confirmed");
    }
    const admin = createAdminClient();
    const now = new Date();
    const expected = new Date(now);
    // 48 business hours ≈ 2-3 calendar days; we cite "within 48 business hours."
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

    return {
      submitted: true,
      claim_number: data.claim_number,
      expected_adjuster_contact_by: expected.toISOString(),
    };
  },
});
