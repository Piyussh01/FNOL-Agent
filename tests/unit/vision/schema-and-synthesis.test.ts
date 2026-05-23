import { describe, expect, it } from "vitest";
import {
  VisionResultSchema,
  emptyVisionResult,
} from "@/lib/vision/schema";
import { parseVisionJson, synthesize } from "@/lib/vision/claude";

describe("VisionResultSchema", () => {
  it("accepts a well-formed result", () => {
    const ok = VisionResultSchema.parse({
      severity: "moderate",
      parts_affected: ["rear_bumper"],
      estimated_repair_range_usd: [1500, 2500],
      drivable_likely: true,
      habitable_likely: null,
      notes: "Rear bumper dent + scratched paint.",
    });
    expect(ok.severity).toBe("moderate");
  });

  it("rejects an invalid severity", () => {
    const bad = VisionResultSchema.safeParse({
      severity: "huge",
      parts_affected: [],
      estimated_repair_range_usd: [0, 0],
      drivable_likely: null,
      habitable_likely: null,
      notes: "n/a",
    });
    expect(bad.success).toBe(false);
  });
});

describe("parseVisionJson", () => {
  it("parses raw JSON", () => {
    const raw = JSON.stringify({
      severity: "cosmetic",
      parts_affected: [],
      estimated_repair_range_usd: [0, 100],
      drivable_likely: true,
      habitable_likely: null,
      notes: "nothing major",
    });
    const r = parseVisionJson(raw, "auto");
    expect(r.severity).toBe("cosmetic");
    expect(r.habitable_likely).toBeNull();
  });

  it("strips code fences", () => {
    const raw = '```json\n{"severity":"severe","parts_affected":["roof"],"estimated_repair_range_usd":[10000,20000],"drivable_likely":null,"habitable_likely":false,"notes":"fire damage"}\n```';
    const r = parseVisionJson(raw, "home");
    expect(r.severity).toBe("severe");
    expect(r.drivable_likely).toBeNull();
    expect(r.habitable_likely).toBe(false);
  });

  it("falls back gracefully on garbage", () => {
    const r = parseVisionJson("hello world", "auto");
    expect(r.severity).toBe("cosmetic");
    expect(r.notes).toMatch(/Could not parse/);
  });

  it("forces auto results to null habitable_likely", () => {
    const raw = JSON.stringify({
      severity: "moderate",
      parts_affected: ["fender"],
      estimated_repair_range_usd: [500, 1000],
      drivable_likely: true,
      habitable_likely: true,
      notes: "x",
    });
    const r = parseVisionJson(raw, "auto");
    expect(r.habitable_likely).toBeNull();
  });
});

describe("synthesize", () => {
  it("returns empty on no inputs", () => {
    const s = synthesize([]);
    expect(s.severity).toBe("cosmetic");
    expect(s.repair_range_usd).toEqual([0, 0]);
  });

  it("picks the worst severity across results", () => {
    const s = synthesize([
      {
        severity: "moderate",
        parts_affected: ["fender"],
        estimated_repair_range_usd: [800, 1200],
        drivable_likely: true,
        habitable_likely: null,
        notes: "fender bent",
      },
      {
        severity: "severe",
        parts_affected: ["frame"],
        estimated_repair_range_usd: [4000, 6000],
        drivable_likely: false,
        habitable_likely: null,
        notes: "frame intrusion",
      },
    ]);
    expect(s.severity).toBe("severe");
    expect(s.repair_range_usd).toEqual([4800, 7200]);
    expect(s.drivable_likely).toBe(false);
    expect(s.parts_or_areas.sort()).toEqual(["fender", "frame"]);
  });
});

describe("emptyVisionResult", () => {
  it("matches the schema", () => {
    const v = emptyVisionResult("no damage");
    expect(VisionResultSchema.safeParse(v).success).toBe(true);
  });
});
