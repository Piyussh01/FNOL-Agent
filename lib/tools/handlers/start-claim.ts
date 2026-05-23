import { z } from "zod";
import { registerTool } from "../registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { logToolEvent } from "./_events";

const Input = z.object({
  policy_id: z.string().uuid(),
  kind: z.enum(["auto", "home", "renters"]),
  incident_at: z.string().optional(),
});

type Output = { claim_id: string; claim_number: string };

// start_claim either (a) attaches policy + kind to the open claim that was
// pre-created at conversation start, or (b) opens a brand-new one. The
// pre-created claim is the common path because /api/conversations/create
// already opened one. We re-use it if it's still in 'greeting' or
// 'identifying' stage.
export default registerTool<z.infer<typeof Input>, Output>({
  name: "start_claim",
  description: "Open or attach to a claim row. Returns claim_id + number.",
  inputSchema: Input,
  async run(input, ctx) {
    const admin = createAdminClient();

    // Sanity-check policy ownership.
    const { data: policy } = await admin
      .from("policies")
      .select("id, kind, holder_user_id")
      .eq("id", input.policy_id)
      .maybeSingle();
    if (!policy) throw new Error("policy_not_found");
    if (policy.holder_user_id !== ctx.caller.user_id) {
      throw new Error("unauthorized");
    }
    if (policy.kind !== input.kind) {
      throw new Error("kind_mismatch_with_policy");
    }

    // Re-use the open in-progress claim from this conversation.
    let claimId = ctx.claim.id;
    if (
      ctx.claim.stage === "greeting" ||
      ctx.claim.stage === "identifying" ||
      ctx.claim.stage === "verifying"
    ) {
      const update: Record<string, unknown> = {
        policy_id: input.policy_id,
        kind: input.kind,
        stage: "intake",
      };
      if (input.incident_at) update.incident_at = input.incident_at;
      await admin.from("claims").update(update).eq("id", claimId);
    } else {
      // Existing claim is past intake — open a new one rather than corrupt
      // state.
      const { data: created, error } = await admin
        .from("claims")
        .insert({
          user_id: ctx.caller.user_id,
          policy_id: input.policy_id,
          kind: input.kind,
          stage: "intake",
          incident_at: input.incident_at,
        })
        .select("id, claim_number")
        .single();
      if (error || !created) throw new Error("claim_insert_failed");
      claimId = created.id;
    }

    const { data: row } = await admin
      .from("claims")
      .select("claim_number")
      .eq("id", claimId)
      .single();

    await logToolEvent("start_claim", { claim_id: claimId }, {
      kind: input.kind,
      policy_id: input.policy_id,
    });

    return { claim_id: claimId, claim_number: row?.claim_number ?? "" };
  },
});
