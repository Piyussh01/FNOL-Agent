import { z } from "zod";
import { registerTool } from "../registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { analyzeImage, synthesize } from "@/lib/vision/claude";
import { VisionResultSchema, type VisionResult } from "@/lib/vision/schema";
import { logToolEvent } from "./_events";
import { advanceClaim } from "@/lib/claims/advance";
import { log } from "@/lib/observability/logger";

const Input = z.object({ claim_id: z.string().uuid() });

type Output = {
  analyzed_count: number;
  synthesis: string;
  severity: VisionResult["severity"];
  repair_range_usd: [number, number];
  parts_or_areas: string[];
  drivable_likely?: boolean | null;
};

const WAIT_BUDGET_MS = 15_000;
const POLL_INTERVAL_MS = 1_000;

async function inlineAnalyze(
  claimId: string,
  kind: "auto" | "home" | "renters",
): Promise<void> {
  // Fallback path: if the Storage trigger / Edge Function hasn't run, analyze
  // here. Service-role only, so we can read storage directly.
  const admin = createAdminClient();
  const { data: pending } = await admin
    .from("photos")
    .select("id, storage_path")
    .eq("claim_id", claimId)
    .is("vision_json", null);
  if (!pending || pending.length === 0) return;

  await Promise.all(
    pending.map(async (p) => {
      const { data: file } = await admin.storage
        .from("claim-photos")
        .download(p.storage_path);
      if (!file) return;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await analyzeImage(bytes, "image/jpeg", kind);
      await admin
        .from("photos")
        .update({
          vision_json: result,
          analyzed_at: new Date().toISOString(),
        })
        .eq("id", p.id);
    }),
  );
}

export default registerTool<z.infer<typeof Input>, Output>({
  name: "analyze_photos",
  description: "Synthesize Claude Vision analyses across all photos.",
  inputSchema: Input,
  async run(input, ctx) {
    const admin = createAdminClient();

    // Best-effort: if any photos are missing vision_json, analyze them now
    // (the Edge Function may not be deployed in dev).
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        await inlineAnalyze(input.claim_id, ctx.claim.kind);
      } catch (err) {
        log.warn("inline_analyze_failed", { error: (err as Error).message });
      }
    }

    // Poll for completion of any in-flight analyses for up to 15s.
    const deadline = Date.now() + WAIT_BUDGET_MS;
    let unanalyzed = 1;
    let allRows: { vision_json: unknown }[] = [];
    while (Date.now() < deadline) {
      const { data: rows } = await admin
        .from("photos")
        .select("vision_json")
        .eq("claim_id", input.claim_id);
      allRows = rows ?? [];
      unanalyzed = allRows.filter((r) => r.vision_json === null).length;
      if (unanalyzed === 0 && allRows.length > 0) break;
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }

    const results: VisionResult[] = [];
    for (const r of allRows) {
      const parsed = VisionResultSchema.safeParse(r.vision_json);
      if (parsed.success) results.push(parsed.data);
    }

    const s = synthesize(results);
    const synthesisText = describeSynthesis(s, ctx.claim.kind);

    await logToolEvent("analyze_photos", { claim_id: input.claim_id }, {
      analyzed_count: results.length,
      severity: s.severity,
    });

    await advanceClaim(input.claim_id);

    return {
      analyzed_count: results.length,
      synthesis: synthesisText,
      severity: s.severity,
      repair_range_usd: s.repair_range_usd,
      parts_or_areas: s.parts_or_areas,
      drivable_likely:
        ctx.claim.kind === "auto" ? s.drivable_likely : undefined,
    };
  },
});

function describeSynthesis(
  s: {
    severity: VisionResult["severity"];
    parts_or_areas: string[];
    repair_range_usd: [number, number];
    drivable_likely: boolean | null;
    habitable_likely: boolean | null;
  },
  kind: "auto" | "home" | "renters",
): string {
  if (s.repair_range_usd[1] === 0 && s.parts_or_areas.length === 0) {
    return "Photos didn't show clear damage. May need a closer angle.";
  }
  const parts = s.parts_or_areas
    .slice(0, 4)
    .map((p) => p.replace(/_/g, " "))
    .join(", ");
  const [low, high] = s.repair_range_usd;
  const range = `$${low.toLocaleString()}–$${high.toLocaleString()}`;
  const sev = s.severity.replace("_", " ");
  const driv =
    kind === "auto" && s.drivable_likely === false
      ? " Looks unsafe to drive."
      : kind === "auto" && s.drivable_likely === true
        ? " Looks drivable."
        : "";
  const hab =
    kind !== "auto" && s.habitable_likely === false
      ? " Unit may be uninhabitable."
      : "";
  return `${parts ? `Affected: ${parts}. ` : ""}Severity: ${sev}. Estimated repair ${range}.${driv}${hab}`.trim();
}
