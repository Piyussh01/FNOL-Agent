import { z } from "zod";
import { registerTool } from "../registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { VisionResultSchema } from "@/lib/vision/schema";
import { synthesize } from "@/lib/vision/claude";
import { logToolEvent } from "./_events";

const Input = z.object({ claim_id: z.string().uuid() });

type Output = {
  low_usd: number;
  high_usd: number;
  basis: string;
  disclaimer: string;
};

const DISCLAIMER =
  "Estimate range only; final payout depends on adjuster inspection, policy limits, and applicable deductible.";

export default registerTool<z.infer<typeof Input>, Output>({
  name: "estimate_claim_value",
  description: "Derive a low/high payout estimate range.",
  inputSchema: Input,
  async run(input, ctx) {
    const admin = createAdminClient();

    const { data: claim } = await admin
      .from("claims")
      .select("policy_id, kind, details_json")
      .eq("id", input.claim_id)
      .single();
    if (!claim) throw new Error("claim_not_found");

    const { data: photos } = await admin
      .from("photos")
      .select("vision_json")
      .eq("claim_id", input.claim_id);

    const results = (photos ?? [])
      .map((p) => VisionResultSchema.safeParse(p.vision_json))
      .filter((r) => r.success)
      .map((r) => r.data);

    const s = synthesize(results);
    let low = s.repair_range_usd[0];
    let high = s.repair_range_usd[1];

    // Demo fallback: if no photos were analyzed, use a kind-based typical
    // mid-severity range so the conversation isn't blocked on a vision
    // pipeline that wasn't exercised.
    if (results.length === 0 || (low === 0 && high === 0)) {
      const fallback: Record<string, [number, number]> = {
        auto: [2000, 5000],
        home: [5000, 15000],
        renters: [1500, 4000],
      };
      const [fl, fh] = fallback[claim.kind as keyof typeof fallback] ?? [1000, 3000];
      low = fl;
      high = fh;
    }

    // Apply policy limits + deductible if known.
    let deductible = 0;
    let limitCap = Number.POSITIVE_INFINITY;
    if (claim.policy_id) {
      const { data: policy } = await admin
        .from("policies")
        .select("coverage_json")
        .eq("id", claim.policy_id)
        .single();
      const coverage = (policy?.coverage_json ?? {}) as Record<string, unknown>;
      const deductibles = (coverage.deductibles ?? {}) as Record<string, number>;
      const limits = (coverage.limits ?? {}) as Record<string, number>;
      deductible =
        deductibles.collision ?? deductibles.all_peril ?? deductibles.comprehensive ?? 0;
      const limitKey =
        claim.kind === "auto"
          ? "liability_property"
          : claim.kind === "home"
            ? "dwelling"
            : "personal_property";
      limitCap = limits[limitKey] ?? Number.POSITIVE_INFINITY;
    }

    low = Math.max(0, low - deductible);
    high = Math.max(0, high - deductible);
    if (limitCap !== Number.POSITIVE_INFINITY) {
      low = Math.min(low, limitCap);
      high = Math.min(high, limitCap);
    }

    // Persist estimate on the claim.
    await admin
      .from("claims")
      .update({
        estimate_range_low_usd: low,
        estimate_range_high_usd: high,
      })
      .eq("id", input.claim_id);

    const basis =
      results.length > 0
        ? `${results.length} photo${results.length === 1 ? "" : "s"} analyzed; deductible $${deductible.toLocaleString()} applied.`
        : `Typical ${claim.kind} mid-severity range; deductible $${deductible.toLocaleString()} applied. Photos would narrow this range.`;

    await logToolEvent("estimate_claim_value", { claim_id: input.claim_id }, {
      low,
      high,
      photos: results.length,
    });

    return { low_usd: low, high_usd: high, basis, disclaimer: DISCLAIMER };
  },
});
