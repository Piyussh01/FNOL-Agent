import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("persona files", () => {
  it("sam.en.md covers required sections", () => {
    const src = readFileSync(join(process.cwd(), "persona", "sam.en.md"), "utf-8");
    expect(src).toMatch(/## Identity/i);
    expect(src).toMatch(/## Tone rules/i);
    expect(src).toMatch(/## Conversational arc/i);
    expect(src).toMatch(/## Tool discipline/i);
    expect(src).toMatch(/## Hand-off triggers/i);
    expect(src).toMatch(/## Closing/i);
    expect(src).toMatch(/file_emergency/);
    expect(src).toMatch(/Raven/);
  });

  it("sam.es.md covers required sections in Spanish", () => {
    const src = readFileSync(join(process.cwd(), "persona", "sam.es.md"), "utf-8");
    expect(src).toMatch(/## Identidad/i);
    expect(src).toMatch(/## Reglas de tono/i);
    expect(src).toMatch(/## Arco conversacional/i);
    expect(src).toMatch(/file_emergency/);
  });

  it("objectives.json has all three claim kinds with non-empty arrays", () => {
    const obj = JSON.parse(
      readFileSync(join(process.cwd(), "persona", "objectives.json"), "utf-8"),
    );
    for (const k of ["auto", "home", "renters"]) {
      expect(Array.isArray(obj[k])).toBe(true);
      expect(obj[k].length).toBeGreaterThan(0);
    }
  });

  it("guardrails.json has required sections", () => {
    const g = JSON.parse(
      readFileSync(join(process.cwd(), "persona", "guardrails.json"), "utf-8"),
    );
    expect(Array.isArray(g.never)).toBe(true);
    expect(Array.isArray(g.always_escalate_on)).toBe(true);
    expect(typeof g.raven_distress_threshold).toBe("number");
    expect(g.raven_distress_threshold).toBeLessThanOrEqual(1);
    expect(g.raven_distress_threshold).toBeGreaterThan(0);
  });
});

describe("tavus tools schema", () => {
  it("registers all 18 tools required by the spec", async () => {
    const { tavusTools } = await import("@/lib/tavus/tools-schema");
    const names = tavusTools.map((t) => t.function.name).sort();
    expect(names).toEqual(
      [
        "add_party",
        "analyze_photos",
        "book_rental",
        "check_claim_status",
        "dispatch_tow",
        "escalate_to_human",
        "estimate_claim_value",
        "file_emergency",
        "find_nearby_repair_shops",
        "get_policy_details",
        "record_incident_details",
        "request_photo_upload",
        "schedule_adjuster_callback",
        "send_summary",
        "start_claim",
        "submit_claim",
        "validate_coverage",
        "verify_identity",
      ].sort(),
    );
  });

  it("each tool function has a description and parameters object", async () => {
    const { tavusTools } = await import("@/lib/tavus/tools-schema");
    for (const t of tavusTools) {
      expect(t.function.name).toMatch(/^[a-z_]+$/);
      expect(t.function.description.length).toBeGreaterThan(10);
      expect(t.function.parameters.type).toBe("object");
    }
  });
});
