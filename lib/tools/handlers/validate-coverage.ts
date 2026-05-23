import { z } from "zod";
import { registerTool } from "../registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { logToolEvent } from "./_events";

const Input = z.object({
  policy_id: z.string().uuid(),
  claim_kind: z.enum(["auto", "home", "renters"]),
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
    const { data: policy } = await admin
      .from("policies")
      .select("coverage_json, kind, holder_user_id")
      .eq("id", input.policy_id)
      .maybeSingle();
    if (!policy) throw new Error("policy_not_found");
    if (policy.holder_user_id !== ctx.caller.user_id) {
      throw new Error("unauthorized");
    }

    const coverage = (policy.coverage_json ?? {}) as Record<string, unknown>;
    const perils = (coverage.perils ?? {}) as Record<string, boolean>;
    const deductibles = (coverage.deductibles ?? {}) as Record<string, number>;
    const limits = (coverage.limits ?? {}) as Record<string, number>;

    const covered = perils[input.peril] === true;
    const dKey = deductibleKeyFor(input.claim_kind, input.peril);
    const deductible =
      deductibles[dKey] ?? deductibles.all_peril ?? deductibles.collision ?? 0;
    const limitKey = relevantLimitKey(input.claim_kind, input.peril);
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
