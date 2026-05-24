// Claim snapshot — "what do we already know about this claim, right now?"
//
// This is the agent's working memory. It's read from ground truth (Postgres)
// and echoed back to Sam after every tool call (via the Tavus webhook and
// the chat-stream dispatcher) so the model cannot "forget" facts the user
// already gave. Also exposed as a dedicated `get_claim_snapshot` tool for
// explicit memory refresh mid-call.
//
// All the human-facing prose lives in `humanSummary` so the LLM gets a
// pre-translated sentence and is less tempted to recite raw field names.

import { createAdminClient } from "@/lib/supabase/admin";
import { deriveObjectives, type Kind, type Objective } from "./state-machine";

export type Booking = {
  kind: "tow" | "rental" | "repair" | "adjuster_callback" | "inspection" | "emergency" | "human_callback";
  status: string;
  scheduled_for: string | null;
  partner_ref: string | null;
};

export type DialogueLine = {
  role: "user" | "assistant" | "tool";
  content: string;
  at: string;
};

export type ClaimSnapshot = {
  claim_kind: Kind;
  stage: string;

  facts_on_file: {
    incident_when: string | null;
    incident_where: string | null;
    peril: string | null;
    description: string | null;
    at_fault: string | null;
    drivable: boolean | null;
    injuries_reported: boolean | null;
    habitable: boolean | null;
    mitigation_taken: string | null;
    police_report_number: string | null;
    inventory_count: number;
  };

  parties_on_file: Array<{
    party_type: string | null;
    name: string | null;
    contact: string | null;
  }>;

  bookings_on_file: Booking[];

  photos_count: number;

  estimate: {
    min_usd: number;
    max_usd: number;
  } | null;

  // What's missing before the claim can be submitted, in priority order.
  // Sam should pick from this list to choose the next thing to ask about.
  still_needed: Array<{
    objective: Objective;
    why_it_matters: string;
  }>;

  // Last ~12 lines of dialogue so Sam can ground responses in what was
  // actually said — guards against repeated questions like "where did the
  // accident happen?" after the user already said "16th and Mission."
  recent_dialogue: DialogueLine[];

  // Pre-translated human summary. Sam should prefer to read FROM this
  // (or paraphrase it) rather than reading individual field names aloud.
  human_summary: string;
};

const OBJECTIVE_DESCRIPTIONS: Record<Objective, string> = {
  policy_verified: "the policy is confirmed",
  incident_when: "when the incident happened",
  incident_where: "where it happened (street, intersection, or address)",
  at_fault: "who was at fault (auto only)",
  injuries_screen: "whether anyone was hurt",
  other_parties: "any other driver / witnesses",
  drivable: "whether the car is drivable",
  peril_identified: "what kind of damage (fire, water, theft, wind, etc.)",
  property_verified: "the property address on file",
  habitable: "whether the home is still livable",
  mitigation_taken: "what steps were taken to stop further damage",
  inventory_collected: "what items were lost or damaged",
  police_report_if_theft: "the police report number (theft only)",
  photos_uploaded: "photos of the damage (optional in demo)",
  next_steps_booked: "tow / rental / repair / adjuster scheduling",
};

// Per-kind: which gaps are blocking submission vs nice-to-have.
function blockingGaps(kind: Kind, completed: Set<Objective>): Objective[] {
  const required: Record<Kind, Objective[]> = {
    auto: ["policy_verified", "incident_when", "next_steps_booked"],
    home: ["policy_verified", "incident_when", "peril_identified", "next_steps_booked"],
    renters: ["policy_verified", "incident_when", "peril_identified", "next_steps_booked"],
  };
  return required[kind].filter((o) => !completed.has(o));
}

export async function getClaimSnapshot(claimId: string): Promise<ClaimSnapshot> {
  const admin = createAdminClient();

  const { data: claim } = await admin
    .from("claims")
    .select(
      "id, kind, stage, policy_id, incident_at, location_label, details_json, estimate_range_low_usd, estimate_range_high_usd",
    )
    .eq("id", claimId)
    .single();
  if (!claim) throw new Error("claim_not_found");

  const [
    { count: photoCount },
    { count: taskCount },
    { count: partyCount },
    { data: parties },
    { data: tasks },
    { data: msgs },
  ] = await Promise.all([
    admin
      .from("photos")
      .select("id", { count: "exact", head: true })
      .eq("claim_id", claimId),
    admin
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("claim_id", claimId),
    admin
      .from("claim_parties")
      .select("id", { count: "exact", head: true })
      .eq("claim_id", claimId),
    admin
      .from("claim_parties")
      .select("party_type, name, contact")
      .eq("claim_id", claimId)
      .limit(10),
    admin
      .from("tasks")
      .select("kind, status, scheduled_for, partner_ref")
      .eq("claim_id", claimId)
      .order("created_at", { ascending: true })
      .limit(20),
    admin
      .from("messages")
      .select("role, content, created_at")
      .eq("claim_id", claimId)
      .not("content", "is", null)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const kind = claim.kind as Kind;
  const details = (claim.details_json ?? {}) as Record<string, unknown>;

  const completed = deriveObjectives({
    policy_id: claim.policy_id,
    incident_at: claim.incident_at,
    location_label: claim.location_label,
    details_json: details,
    kind,
    photos_uploaded_count: photoCount ?? 0,
    tasks_booked_count: taskCount ?? 0,
    parties_count: partyCount ?? 0,
  });

  const stillNeededObjectives = blockingGaps(kind, completed);
  const still_needed = stillNeededObjectives.map((o) => ({
    objective: o,
    why_it_matters: OBJECTIVE_DESCRIPTIONS[o],
  }));

  const facts_on_file: ClaimSnapshot["facts_on_file"] = {
    incident_when: claim.incident_at ?? null,
    incident_where: claim.location_label ?? null,
    peril: (details.peril as string | undefined) ?? null,
    description: (details.description as string | undefined) ?? null,
    at_fault: (details.at_fault as string | undefined) ?? null,
    drivable:
      typeof details.drivable === "boolean" ? (details.drivable as boolean) : null,
    injuries_reported:
      details.injuries && typeof details.injuries === "object"
        ? ((details.injuries as { reported?: boolean }).reported ?? null)
        : null,
    habitable:
      typeof details.habitable === "boolean" ? (details.habitable as boolean) : null,
    mitigation_taken: (details.mitigation_taken as string | undefined) ?? null,
    police_report_number: (details.police_report_number as string | undefined) ?? null,
    inventory_count: Array.isArray(details.inventory)
      ? (details.inventory as unknown[]).length
      : 0,
  };

  const estimate =
    claim.estimate_range_low_usd != null && claim.estimate_range_high_usd != null
      ? {
          min_usd: claim.estimate_range_low_usd as number,
          max_usd: claim.estimate_range_high_usd as number,
        }
      : null;

  const recent_dialogue: DialogueLine[] = ((msgs ?? []) as Array<{
    role: string;
    content: string | null;
    created_at: string;
  }>)
    .filter((m) => m.content && m.content.trim().length > 0)
    .filter((m) => m.role === "user" || m.role === "assistant" || m.role === "tool")
    .map((m) => ({
      role: m.role as DialogueLine["role"],
      content: (m.content ?? "").slice(0, 400),
      at: m.created_at,
    }))
    .reverse();

  return {
    claim_kind: kind,
    stage: claim.stage as string,
    facts_on_file,
    parties_on_file: (parties ?? []) as ClaimSnapshot["parties_on_file"],
    bookings_on_file: ((tasks ?? []) as Booking[]).map((t) => ({
      kind: t.kind,
      status: t.status,
      scheduled_for: t.scheduled_for ?? null,
      partner_ref: t.partner_ref ?? null,
    })),
    photos_count: photoCount ?? 0,
    estimate,
    still_needed,
    recent_dialogue,
    human_summary: buildHumanSummary({
      kind,
      facts: facts_on_file,
      bookings: (tasks ?? []) as Booking[],
      estimate,
      partiesCount: partyCount ?? 0,
      photosCount: photoCount ?? 0,
      stillNeeded: stillNeededObjectives,
    }),
  };
}

function buildHumanSummary(args: {
  kind: Kind;
  facts: ClaimSnapshot["facts_on_file"];
  bookings: Booking[];
  estimate: ClaimSnapshot["estimate"];
  partiesCount: number;
  photosCount: number;
  stillNeeded: Objective[];
}): string {
  const { kind, facts, bookings, estimate, partiesCount, photosCount, stillNeeded } = args;
  const parts: string[] = [];

  parts.push(`This is a ${kind} claim.`);

  if (facts.incident_when) {
    parts.push(`Incident time on file: ${facts.incident_when}.`);
  }
  if (facts.incident_where) {
    parts.push(`Incident location on file: ${facts.incident_where}.`);
  }
  if (facts.peril) {
    parts.push(`Peril on file: ${facts.peril}.`);
  }
  if (facts.at_fault) {
    parts.push(`At-fault status: ${facts.at_fault}.`);
  }
  if (facts.drivable != null) {
    parts.push(`Drivable: ${facts.drivable ? "yes" : "no"}.`);
  }
  if (facts.injuries_reported != null) {
    parts.push(`Injuries reported: ${facts.injuries_reported ? "yes" : "no"}.`);
  }
  if (facts.habitable != null) {
    parts.push(`Home habitable: ${facts.habitable ? "yes" : "no"}.`);
  }
  if (facts.description) {
    parts.push(`Description on file: "${facts.description.slice(0, 200)}".`);
  }
  if (partiesCount > 0) {
    parts.push(`${partiesCount} other part${partiesCount === 1 ? "y" : "ies"} on file.`);
  }
  if (photosCount > 0) {
    parts.push(`${photosCount} photo${photosCount === 1 ? "" : "s"} uploaded.`);
  }
  if (bookings.length > 0) {
    const booked = bookings.map((b) => b.kind).join(", ");
    parts.push(`Already booked: ${booked}.`);
  }
  if (estimate) {
    parts.push(`Estimate on file: $${estimate.min_usd}–$${estimate.max_usd} (subject to adjuster review).`);
  }

  if (stillNeeded.length > 0) {
    const gaps = stillNeeded
      .map((o) => OBJECTIVE_DESCRIPTIONS[o])
      .join("; ");
    parts.push(`Still needed before submission: ${gaps}.`);
  } else {
    parts.push("All required facts are on file — ready to submit when the user confirms.");
  }

  return parts.join(" ");
}
