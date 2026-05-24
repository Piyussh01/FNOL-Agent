import { z } from "zod";
import { registerTool } from "../registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { logToolEvent } from "./_events";

// policy_id and claim_kind are optional — if Sam doesn't pass them, we
// resolve from the authenticated claim. This keeps `policy_id` (an
// internal identifier the user must never hear) off the agent's required
// argument list, which is what was making coverage validation fail when
// the model "forgot" the policy_id from the initial context.
const Input = z.object({
  policy_id: z.string().uuid().optional(),
  claim_kind: z.enum(["auto", "home", "renters"]).optional(),
  peril: z.string().min(1),
});

type Output = {
  covered: boolean;
  deductible_usd: number;
  limit_usd: number;
  notes: string;
};

const DEDUCTIBLE_BY_PERIL: Record<string, Record<string, string>> = {
  auto: {
    collision: "collision",
    comprehensive: "comprehensive",
    vandalism: "comprehensive",
    theft: "comprehensive",
    weather: "comprehensive",
    fire: "comprehensive",
    glass: "comprehensive",
  },
  home: {
    wind: "wind_hail",
    hail: "wind_hail",
  },
  renters: {},
};

function deductibleKeyFor(kind: string, peril: string): string {
  return DEDUCTIBLE_BY_PERIL[kind]?.[peril] ?? "all_peril";
}

function relevantLimitKey(kind: string, peril: string): string {
  if (kind === "auto") return "liability_property";
  if (kind === "home") {
    if (["theft", "vandalism", "water_sudden"].includes(peril))
      return "personal_property";
    return "dwelling";
  }
  if (kind === "renters") return "personal_property";
  return "";
}

export default registerTool<z.infer<typeof Input>, Output>({
  name: "validate_coverage",
  description: "Check whether a peril is covered on a policy.",
  inputSchema: Input,
  async run(input, ctx) {
    const admin = createAdminClient();

    // Resolve policy_id from the claim if Sam didn't pass it. Every demo
    // user has all three policies auto-provisioned (auto/home/renters)
    // and the right one is pre-attached at claim creation, so the
    // claim.policy_id is the source of truth.
    let policyId = input.policy_id;
    if (!policyId) {
      const { data: claimRow } = await admin
        .from("claims")
        .select("policy_id")
        .eq("id", ctx.claim.id)
        .maybeSingle();
      policyId = claimRow?.policy_id ?? undefined;
    }
    // Final fallback: pull the user's policy of the matching kind directly.
    if (!policyId) {
      const { data: pol } = await admin
        .from("policies")
        .select("id")
        .eq("holder_user_id", ctx.caller.user_id)
        .eq("kind", ctx.claim.kind)
        .order("active_to", { ascending: false })
        .limit(1)
        .maybeSingle();
      policyId = pol?.id;
    }
    if (!policyId) throw new Error("no_policy_on_file");

    const { data: policy } = await admin
      .from("policies")
      .select("coverage_json, kind, holder_user_id")
      .eq("id", policyId)
      .maybeSingle();
    if (!policy) throw new Error("policy_not_found");
    if (policy.holder_user_id !== ctx.caller.user_id) {
      throw new Error("unauthorized");
    }

    // If Sam didn't pass claim_kind, take it from the claim.
    const claimKind = input.claim_kind ?? ctx.claim.kind;

    // Auto-attach this policy to the claim if it wasn't already, so all
    // downstream tools / the snapshot see policy_verified done.
    await admin
      .from("claims")
      .update({ policy_id: policyId })
      .eq("id", ctx.claim.id)
      .is("policy_id", null);

    const coverage = (policy.coverage_json ?? {}) as Record<string, unknown>;
    const perils = (coverage.perils ?? {}) as Record<string, boolean>;
    const deductibles = (coverage.deductibles ?? {}) as Record<string, number>;
    const limits = (coverage.limits ?? {}) as Record<string, number>;

    const covered = perils[input.peril] === true;
    const dKey = deductibleKeyFor(claimKind, input.peril);
    const deductible =
      deductibles[dKey] ?? deductibles.all_peril ?? deductibles.collision ?? 0;
    const limitKey = relevantLimitKey(claimKind, input.peril);
    const limit = limits[limitKey] ?? 0;

    const notes = covered
      ? `${input.peril} is a covered peril; deductible $${deductible.toLocaleString()} applies. Subject to adjuster review.`
      : `${input.peril} is not listed as a covered peril on this policy. We recommend confirming with a human supervisor.`;

    await logToolEvent("validate_coverage", { claim_id: ctx.claim.id }, {
      peril: input.peril,
      covered,
    });

    return {
      covered,
      deductible_usd: deductible,
      limit_usd: limit,
      notes,
    };
  },
});
