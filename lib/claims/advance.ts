import { createAdminClient } from "@/lib/supabase/admin";
import {
  deriveObjectives,
  nextStage,
  type Kind,
  type Stage,
} from "./state-machine";

// I/O-bound wrapper: gather claim state from DB, derive objectives, advance.
// Returns the new stage (which may equal the current stage).
export async function advanceClaim(claimId: string): Promise<Stage> {
  const admin = createAdminClient();

  const { data: claim } = await admin
    .from("claims")
    .select(
      "id, kind, stage, policy_id, incident_at, location_label, details_json",
    )
    .eq("id", claimId)
    .single();

  if (!claim) throw new Error("claim_not_found");

  const [{ count: photoCount }, { count: taskCount }, { count: partyCount }] =
    await Promise.all([
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
    ]);

  const completed = deriveObjectives({
    policy_id: claim.policy_id,
    incident_at: claim.incident_at,
    location_label: claim.location_label,
    details_json: (claim.details_json ?? {}) as Record<string, unknown>,
    kind: claim.kind as Kind,
    photos_uploaded_count: photoCount ?? 0,
    tasks_booked_count: taskCount ?? 0,
    parties_count: partyCount ?? 0,
  });

  const target = nextStage(claim.stage as Stage, completed);
  if (target !== claim.stage) {
    await admin.from("claims").update({ stage: target }).eq("id", claim.id);
  }
  return target;
}
