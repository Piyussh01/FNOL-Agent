import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Replay test: the persona's guardrails JSON enumerates emergency triggers.
// We assert that all the expected phrases appear in the always_escalate_on /
// emergency_keywords lists so the persona will always reach file_emergency
// for these scenarios.
describe("safety guardrails coverage", () => {
  const guardrails = JSON.parse(
    readFileSync(join(process.cwd(), "persona", "guardrails.json"), "utf-8"),
  ) as {
    always_escalate_on: string[];
    emergency_keywords: string[];
    raven_distress_threshold: number;
  };

  it.each([
    "injury",
    "fatality",
    "fire",
    "gas leak",
    "911",
    "lawsuit",
    "self-harm",
  ])("includes a guard for %s", (phrase) => {
    const haystack = guardrails.always_escalate_on.join(" | ").toLowerCase();
    expect(haystack).toContain(phrase);
  });

  it("lists explicit emergency keywords", () => {
    for (const k of ["911", "injured", "bleeding", "trapped", "gas leak"]) {
      expect(guardrails.emergency_keywords.join(" | ").toLowerCase()).toContain(
        k.toLowerCase(),
      );
    }
  });

  it("distress threshold is the documented 0.7", () => {
    expect(guardrails.raven_distress_threshold).toBe(0.7);
  });
});
