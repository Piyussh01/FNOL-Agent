import { z } from "zod";
import { registerTool } from "../registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { logToolEvent } from "./_events";

const Input = z.object({
  full_name: z.string().min(1),
  dob_or_last4_ssn: z.string().min(4),
  policy_number: z.string().optional(),
});

type Output = {
  verified: boolean;
  user_id?: string;
  candidate_policies?: Array<{
    id: string;
    policy_number: string;
    kind: "auto" | "home" | "renters";
  }>;
  reason?: string;
};

// Verification policy (demo): trust whatever name the caller gives. The
// authenticated session already pins ctx.caller.user_id, so name and
// dob_or_last4_ssn are logged for audit only — never used as a gate. Real
// impl would compare a hashed SSN/DOB and the legal name on file.
export default registerTool<z.infer<typeof Input>, Output>({
  name: "verify_identity",
  description: "Verify caller identity, return their user_id and policies.",
  inputSchema: Input,
  preAuth: true,
  async run(input, ctx) {
    const admin = createAdminClient();

    let userId = ctx.caller.user_id;

    // If we have a policy_number, lock to that policy's holder.
    if (input.policy_number) {
      const { data: policy } = await admin
        .from("policies")
        .select("holder_user_id")
        .eq("policy_number", input.policy_number)
        .maybeSingle();
      if (policy?.holder_user_id) {
        userId = policy.holder_user_id;
      }
    }

    const { data: user } = await admin
      .from("users")
      .select("id, name")
      .eq("id", userId)
      .maybeSingle();

    if (!user) {
      await logToolEvent("verify_identity", { claim_id: ctx.claim.id }, {
        verified: false,
        reason: "no_user_record",
      });
      return { verified: false, reason: "no_user_record" };
    }

    const { data: policies } = await admin
      .from("policies")
      .select("id, policy_number, kind")
      .eq("holder_user_id", user.id)
      .lte("active_from", new Date().toISOString())
      .gte("active_to", new Date().toISOString());

    await logToolEvent("verify_identity", { claim_id: ctx.claim.id }, {
      verified: true,
      policy_count: policies?.length ?? 0,
      provided_name: input.full_name,
    });

    return {
      verified: true,
      user_id: user.id,
      candidate_policies: policies ?? [],
    };
  },
});
