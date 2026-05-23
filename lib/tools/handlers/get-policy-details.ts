import { z } from "zod";
import { registerTool } from "../registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { logToolEvent } from "./_events";

const Input = z.object({
  policy_id: z.string().uuid(),
});

type Output = {
  policy_number: string;
  kind: "auto" | "home" | "renters";
  state: string;
  active: boolean;
  coverage_summary: string;
  deductibles: Record<string, number>;
  prior_claims_count: number;
};

function buildCoverageSummary(kind: string, c: Record<string, unknown>): string {
  if (kind === "auto") {
    const limits = c.limits as Record<string, number> | undefined;
    return [
      `Liability: $${(limits?.liability_bodily ?? 0).toLocaleString()} bodily / $${(limits?.liability_property ?? 0).toLocaleString()} property`,
      c.perils && (c.perils as Record<string, boolean>).collision
        ? "Collision included"
        : null,
      c.perils && (c.perils as Record<string, boolean>).comprehensive
        ? "Comprehensive included"
        : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (kind === "home" || kind === "renters") {
    const limits = c.limits as Record<string, number> | undefined;
    const parts: string[] = [];
    if (limits?.dwelling)
      parts.push(`Dwelling $${limits.dwelling.toLocaleString()}`);
    if (limits?.personal_property)
      parts.push(`Personal property $${limits.personal_property.toLocaleString()}`);
    if (limits?.liability)
      parts.push(`Liability $${limits.liability.toLocaleString()}`);
    return parts.join(" · ");
  }
  return "";
}

export default registerTool<z.infer<typeof Input>, Output>({
  name: "get_policy_details",
  description: "Return policy summary, deductibles, and prior claim count.",
  inputSchema: Input,
  async run(input, ctx) {
    const admin = createAdminClient();

    const { data: policy, error } = await admin
      .from("policies")
      .select("id, policy_number, kind, state, coverage_json, active_from, active_to, holder_user_id")
      .eq("id", input.policy_id)
      .maybeSingle();

    if (error || !policy) {
      throw new Error("policy_not_found");
    }
    if (policy.holder_user_id !== ctx.caller.user_id) {
      throw new Error("unauthorized");
    }

    const now = Date.now();
    const active =
      new Date(policy.active_from).getTime() <= now &&
      new Date(policy.active_to).getTime() >= now;

    const { count: priorCount } = await admin
      .from("claims")
      .select("id", { count: "exact", head: true })
      .eq("policy_id", policy.id)
      .neq("id", ctx.claim.id);

    const coverage = (policy.coverage_json ?? {}) as Record<string, unknown>;
    const deductibles =
      (coverage.deductibles as Record<string, number> | undefined) ?? {};

    await logToolEvent("get_policy_details", { claim_id: ctx.claim.id }, {
      policy_id: policy.id,
    });

    return {
      policy_number: policy.policy_number,
      kind: policy.kind,
      state: policy.state,
      active,
      coverage_summary: buildCoverageSummary(policy.kind, coverage),
      deductibles,
      prior_claims_count: priorCount ?? 0,
    };
  },
});
