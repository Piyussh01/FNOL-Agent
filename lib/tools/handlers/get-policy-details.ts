import { z } from "zod";
import { registerTool } from "../registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { logToolEvent } from "./_events";

// Demo-friendly inputs: the agent may pass a UUID, a policy_number like
// "ACME-AUTO-1001", a kind ("auto"/"home"/"renters"), or nothing at all.
// We resolve to one of the caller's active policies, preferring matches in
// that order. No field is required.
const Input = z.object({
  policy_id: z.string().optional(),
  policy_number: z.string().optional(),
  kind: z.enum(["auto", "home", "renters"]).optional(),
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  description:
    "Return policy summary, deductibles, and prior claim count. All inputs optional — pass policy_id, policy_number, kind, or nothing and the caller's policy will be resolved.",
  inputSchema: Input,
  async run(input, ctx) {
    const admin = createAdminClient();

    type PolicyRow = {
      id: string;
      policy_number: string;
      kind: "auto" | "home" | "renters";
      state: string;
      coverage_json: Record<string, unknown> | null;
      active_from: string;
      active_to: string;
      holder_user_id: string;
    };

    const cols =
      "id, policy_number, kind, state, coverage_json, active_from, active_to, holder_user_id";

    // Try the most-specific lookup first, fall back as needed. All scoped to
    // the authenticated caller's policies.
    let policy: PolicyRow | null = null;

    if (input.policy_id && UUID_RE.test(input.policy_id)) {
      const { data } = await admin
        .from("policies")
        .select(cols)
        .eq("holder_user_id", ctx.caller.user_id)
        .eq("id", input.policy_id)
        .maybeSingle();
      policy = data as PolicyRow | null;
    }
    if (!policy && input.policy_number) {
      const { data } = await admin
        .from("policies")
        .select(cols)
        .eq("holder_user_id", ctx.caller.user_id)
        .ilike("policy_number", input.policy_number)
        .maybeSingle();
      policy = data as PolicyRow | null;
    }
    if (!policy && input.kind) {
      const { data } = await admin
        .from("policies")
        .select(cols)
        .eq("holder_user_id", ctx.caller.user_id)
        .eq("kind", input.kind)
        .order("active_to", { ascending: false })
        .limit(1)
        .maybeSingle();
      policy = data as PolicyRow | null;
    }
    if (!policy) {
      const { data } = await admin
        .from("policies")
        .select(cols)
        .eq("holder_user_id", ctx.caller.user_id)
        .order("active_to", { ascending: false })
        .limit(1)
        .maybeSingle();
      policy = data as PolicyRow | null;
    }

    if (!policy) {
      throw new Error("policy_not_found");
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
