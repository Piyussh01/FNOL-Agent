import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { VisionResultSchema, emptyVisionResult, type VisionResult } from "./schema";
import { AUTO_VISION_PROMPT } from "./prompts/auto";
import { HOME_VISION_PROMPT } from "./prompts/home";
import { RENTERS_VISION_PROMPT } from "./prompts/renters";
import { log } from "@/lib/observability/logger";

const MODEL = "claude-sonnet-4-6";

function client(): Anthropic {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
    defaultHeaders: process.env.HELICONE_API_KEY
      ? { "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}` }
      : undefined,
  });
}

function promptFor(kind: "auto" | "home" | "renters"): string {
  switch (kind) {
    case "auto":
      return AUTO_VISION_PROMPT;
    case "home":
      return HOME_VISION_PROMPT;
    case "renters":
      return RENTERS_VISION_PROMPT;
  }
}

export async function analyzeImage(
  imageBytes: Uint8Array | Buffer,
  mediaType: "image/jpeg" | "image/png" | "image/webp",
  kind: "auto" | "home" | "renters",
): Promise<VisionResult> {
  const c = client();
  const base64 = Buffer.from(imageBytes).toString("base64");

  try {
    const resp = await c.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: promptFor(kind),
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: "Analyze this image and return the JSON described in the system prompt." },
          ],
        },
      ],
    });

    const textBlock = resp.content.find((b) => b.type === "text");
    const raw = textBlock && textBlock.type === "text" ? textBlock.text : "";
    return parseVisionJson(raw, kind);
  } catch (err) {
    log.error("vision_call_failed", { error: (err as Error).message });
    return emptyVisionResult("Vision analysis unavailable for this photo.");
  }
}

export function parseVisionJson(raw: string, kind: "auto" | "home" | "renters"): VisionResult {
  // Strip code fences if Claude ignored instructions.
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/, "")
    .replace(/```\s*$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    log.warn("vision_json_unparseable", { raw_preview: cleaned.slice(0, 200) });
    return emptyVisionResult("Could not parse vision output.");
  }

  const result = VisionResultSchema.safeParse(parsed);
  if (!result.success) {
    log.warn("vision_schema_mismatch", { issues: result.error.issues });
    return emptyVisionResult("Vision output did not match the expected shape.");
  }

  // Enforce kind-specific null semantics.
  const v = result.data;
  if (kind === "auto") v.habitable_likely = null;
  if (kind === "home") v.drivable_likely = null;
  if (kind === "renters") {
    v.drivable_likely = null;
    v.habitable_likely = null;
  }
  return v;
}

// Synthesizes a single human-readable summary across many photos.
export function synthesize(results: VisionResult[]): {
  severity: VisionResult["severity"];
  parts_or_areas: string[];
  repair_range_usd: [number, number];
  drivable_likely: boolean | null;
  habitable_likely: boolean | null;
  notes: string;
} {
  if (results.length === 0) {
    return {
      severity: "cosmetic",
      parts_or_areas: [],
      repair_range_usd: [0, 0],
      drivable_likely: null,
      habitable_likely: null,
      notes: "No photos analyzed yet.",
    };
  }

  const sevOrder = { cosmetic: 0, moderate: 1, severe: 2, total_loss: 3 } as const;
  let worst: VisionResult["severity"] = "cosmetic";
  let low = 0;
  let high = 0;
  const parts = new Set<string>();
  let drivable: boolean | null = null;
  let habitable: boolean | null = null;
  const noteFragments: string[] = [];

  for (const r of results) {
    if (sevOrder[r.severity] > sevOrder[worst]) worst = r.severity;
    low += r.estimated_repair_range_usd[0];
    high += r.estimated_repair_range_usd[1];
    for (const p of r.parts_affected) parts.add(p);
    if (r.drivable_likely === false) drivable = false;
    else if (r.drivable_likely === true && drivable === null) drivable = true;
    if (r.habitable_likely === false) habitable = false;
    else if (r.habitable_likely === true && habitable === null) habitable = true;
    if (r.notes) noteFragments.push(r.notes);
  }

  return {
    severity: worst,
    parts_or_areas: Array.from(parts),
    repair_range_usd: [low, high],
    drivable_likely: drivable,
    habitable_likely: habitable,
    notes: noteFragments.join(" "),
  };
}

// Exported for unit tests.
export { VisionResultSchema };
export const __VISION_MODEL__ = MODEL;
export { z };
