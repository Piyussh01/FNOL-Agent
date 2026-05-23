// Claim state machine. Pure functions; no I/O.
//
// Stages flow strictly in order. Each stage has a list of objectives (from
// persona/objectives.json) that must be satisfied before the stage can
// advance. `nextStage` is called from tool handlers after every mutating
// operation to decide whether the claim should move forward.

export type Stage =
  | "greeting"
  | "identifying"
  | "verifying"
  | "intake"
  | "coverage_check"
  | "photos"
  | "assessing"
  | "booking"
  | "reviewing"
  | "submitted"
  | "escalated"
  | "closed";

export type Kind = "auto" | "home" | "renters";

export type Objective =
  | "policy_verified"
  | "incident_when"
  | "incident_where"
  | "at_fault"
  | "injuries_screen"
  | "other_parties"
  | "drivable"
  | "peril_identified"
  | "property_verified"
  | "habitable"
  | "mitigation_taken"
  | "inventory_collected"
  | "police_report_if_theft"
  | "photos_uploaded"
  | "next_steps_booked";

// Order is significant: this is the canonical forward progression.
const SEQUENCE: Stage[] = [
  "greeting",
  "identifying",
  "verifying",
  "intake",
  "coverage_check",
  "photos",
  "assessing",
  "booking",
  "reviewing",
  "submitted",
];

const STAGE_ENTRY_REQUIREMENTS: Record<Stage, Objective[]> = {
  greeting: [],
  identifying: [],
  verifying: ["policy_verified"],
  intake: ["policy_verified"],
  coverage_check: ["policy_verified", "incident_when"],
  photos: ["policy_verified", "incident_when"],
  assessing: ["policy_verified", "photos_uploaded"],
  booking: ["policy_verified"],
  reviewing: ["policy_verified", "photos_uploaded"],
  submitted: ["policy_verified", "next_steps_booked"],
  escalated: [],
  closed: [],
};

const KIND_REQUIRED_OBJECTIVES: Record<Kind, Objective[]> = {
  auto: [
    "policy_verified",
    "incident_when",
    "incident_where",
    "at_fault",
    "injuries_screen",
    "other_parties",
    "drivable",
    "photos_uploaded",
    "next_steps_booked",
  ],
  home: [
    "policy_verified",
    "incident_when",
    "peril_identified",
    "property_verified",
    "habitable",
    "mitigation_taken",
    "photos_uploaded",
    "next_steps_booked",
  ],
  renters: [
    "policy_verified",
    "incident_when",
    "peril_identified",
    "property_verified",
    "inventory_collected",
    "photos_uploaded",
    "next_steps_booked",
  ],
};

export function objectivesFor(kind: Kind): Objective[] {
  return KIND_REQUIRED_OBJECTIVES[kind];
}

export function canEnter(stage: Stage, completed: Set<Objective>): boolean {
  return STAGE_ENTRY_REQUIREMENTS[stage].every((o) => completed.has(o));
}

// Advance one step at a time. Never skip stages. Terminal stages stay put.
export function nextStage(
  current: Stage,
  completed: Set<Objective>,
): Stage {
  if (current === "submitted" || current === "escalated" || current === "closed") {
    return current;
  }
  const idx = SEQUENCE.indexOf(current);
  if (idx < 0 || idx >= SEQUENCE.length - 1) return current;
  const candidate = SEQUENCE[idx + 1];
  return canEnter(candidate, completed) ? candidate : current;
}

// Derive objectives from claim state. Used after each tool write to decide
// whether to advance the stage.
export function deriveObjectives(claim: {
  policy_id: string | null;
  incident_at: string | null;
  location_label: string | null;
  details_json: Record<string, unknown>;
  kind: Kind;
  photos_uploaded_count: number;
  tasks_booked_count: number;
  parties_count: number;
}): Set<Objective> {
  const done = new Set<Objective>();
  if (claim.policy_id) done.add("policy_verified");
  if (claim.incident_at) done.add("incident_when");
  if (claim.location_label) done.add("incident_where");

  const d = claim.details_json ?? {};
  if (claim.kind === "auto") {
    if ("at_fault" in d) done.add("at_fault");
    if ("injuries" in d) done.add("injuries_screen");
    if ("drivable" in d) done.add("drivable");
    if (claim.parties_count > 0 || ("at_fault" in d && d["at_fault"] === "self"))
      done.add("other_parties");
  }
  if (claim.kind === "home" || claim.kind === "renters") {
    if ("peril" in d) done.add("peril_identified");
    if ("property_id" in d || claim.location_label)
      done.add("property_verified");
    if (claim.kind === "home" && "habitable" in d) done.add("habitable");
    if (claim.kind === "home" && "mitigation_taken" in d)
      done.add("mitigation_taken");
    if (claim.kind === "renters" && Array.isArray(d.inventory) && d.inventory.length > 0)
      done.add("inventory_collected");
  }
  if (claim.photos_uploaded_count > 0) done.add("photos_uploaded");
  if (claim.tasks_booked_count > 0) done.add("next_steps_booked");

  return done;
}

export function progress(kind: Kind, completed: Set<Objective>): number {
  const required = KIND_REQUIRED_OBJECTIVES[kind];
  if (required.length === 0) return 1;
  const hit = required.filter((o) => completed.has(o)).length;
  return hit / required.length;
}
