import { describe, expect, it } from "vitest";
import {
  canEnter,
  deriveObjectives,
  nextStage,
  objectivesFor,
  progress,
  type Objective,
  type Stage,
} from "@/lib/claims/state-machine";

function setOf<T extends string>(...xs: T[]): Set<T> {
  return new Set(xs);
}

describe("state machine — pure transitions", () => {
  it("advances greeting → identifying unconditionally", () => {
    // identifying has no entry requirements — we're just acknowledging
    // the caller wants to file something.
    expect(canEnter("identifying", setOf())).toBe(true);
    expect(nextStage("greeting", setOf())).toBe("identifying");
  });

  it("advances to verifying only with policy_verified", () => {
    expect(nextStage("identifying", setOf())).toBe("identifying");
    expect(nextStage("identifying", setOf("policy_verified"))).toBe("verifying");
  });

  it("advances to coverage_check with policy_verified + incident_when", () => {
    expect(nextStage("intake", setOf("policy_verified"))).toBe("intake");
    expect(
      nextStage("intake", setOf("policy_verified", "incident_when")),
    ).toBe("coverage_check");
  });

  it("advances to assessing once photos_uploaded", () => {
    expect(
      nextStage(
        "photos",
        setOf("policy_verified", "incident_when", "photos_uploaded"),
      ),
    ).toBe("assessing");
  });

  it("only advances one stage per call", () => {
    const all = setOf<Objective>(
      "policy_verified",
      "incident_when",
      "incident_where",
      "photos_uploaded",
      "next_steps_booked",
    );
    expect(nextStage("greeting", all)).toBe("identifying");
    expect(nextStage("identifying", all)).toBe("verifying");
    expect(nextStage("verifying", all)).toBe("intake");
  });

  it("terminal stages stay put", () => {
    expect(nextStage("submitted", setOf())).toBe("submitted");
    expect(nextStage("escalated", setOf("policy_verified"))).toBe("escalated");
    expect(nextStage("closed", setOf("policy_verified"))).toBe("closed");
  });

  it("submitted requires next_steps_booked", () => {
    const without = setOf<Objective>(
      "policy_verified",
      "incident_when",
      "photos_uploaded",
    );
    expect(nextStage("reviewing", without)).toBe("reviewing");

    const with_ = setOf<Objective>(
      "policy_verified",
      "incident_when",
      "photos_uploaded",
      "next_steps_booked",
    );
    expect(nextStage("reviewing", with_)).toBe("submitted");
  });
});

describe("objectivesFor + progress", () => {
  it("returns the right objectives per kind", () => {
    expect(objectivesFor("auto")).toContain("incident_when");
    expect(objectivesFor("home")).toContain("peril_identified");
    expect(objectivesFor("renters")).toContain("peril_identified");
  });

  it("progress is 0 to 1", () => {
    expect(progress("auto", setOf())).toBe(0);
    expect(
      progress("auto", new Set(objectivesFor("auto"))),
    ).toBeGreaterThanOrEqual(1);
  });
});

describe("deriveObjectives", () => {
  it("marks policy_verified when policy_id present", () => {
    const o = deriveObjectives({
      policy_id: "p",
      incident_at: null,
      location_label: null,
      details_json: {},
      kind: "auto",
      photos_uploaded_count: 0,
      tasks_booked_count: 0,
      parties_count: 0,
    });
    expect(o.has("policy_verified")).toBe(true);
    expect(o.has("incident_when")).toBe(false);
  });

  it("derives auto-specific objectives from details", () => {
    const o = deriveObjectives({
      policy_id: "p",
      incident_at: "2026-05-22T20:00:00Z",
      location_label: "Mission St & 24th",
      details_json: { at_fault: "self", injuries: { reported: false }, drivable: true },
      kind: "auto",
      photos_uploaded_count: 2,
      tasks_booked_count: 1,
      parties_count: 0,
    });
    expect(o.has("at_fault")).toBe(true);
    expect(o.has("injuries_screen")).toBe(true);
    expect(o.has("drivable")).toBe(true);
    expect(o.has("other_parties")).toBe(true); // self-at-fault counts
    expect(o.has("photos_uploaded")).toBe(true);
    expect(o.has("next_steps_booked")).toBe(true);
  });

  it("derives renters inventory_collected only when inventory non-empty", () => {
    const empty = deriveObjectives({
      policy_id: "p",
      incident_at: "x",
      location_label: "x",
      details_json: { peril: "theft", inventory: [] },
      kind: "renters",
      photos_uploaded_count: 0,
      tasks_booked_count: 0,
      parties_count: 0,
    });
    expect(empty.has("inventory_collected")).toBe(false);

    const full = deriveObjectives({
      policy_id: "p",
      incident_at: "x",
      location_label: "x",
      details_json: { peril: "theft", inventory: [{ item: "tv", approx_value_usd: 500 }] },
      kind: "renters",
      photos_uploaded_count: 0,
      tasks_booked_count: 0,
      parties_count: 0,
    });
    expect(full.has("inventory_collected")).toBe(true);
  });
});

describe("full happy-path drive", () => {
  it("auto claim walks greeting → submitted given enough objectives", () => {
    let stage: Stage = "greeting";
    const completed = setOf<Objective>(
      "policy_verified",
      "incident_when",
      "incident_where",
      "at_fault",
      "injuries_screen",
      "other_parties",
      "drivable",
      "photos_uploaded",
      "next_steps_booked",
    );
    const visited: Stage[] = [stage];
    for (let i = 0; i < 12; i++) {
      const next = nextStage(stage, completed);
      if (next === stage) break;
      stage = next;
      visited.push(stage);
    }
    expect(visited[visited.length - 1]).toBe("submitted");
    expect(visited).toContain("photos");
    expect(visited).toContain("booking");
  });
});
