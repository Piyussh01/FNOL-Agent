import { redirect } from "next/navigation";
import Link from "next/link";
import { Shield, CheckCircle2, Clock, Camera, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/magic-link";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOOL_LABELS: Record<string, string> = {
  start_claim: "Opened your claim",
  verify_identity: "Verified your identity",
  get_policy_details: "Looked up your policy",
  validate_coverage: "Confirmed your coverage",
  record_incident_details: "Recorded what happened",
  add_party: "Added another party",
  request_photo_upload: "Requested photos of the damage",
  analyze_photos: "Reviewed your photos",
  find_nearby_repair_shops: "Found nearby repair shops",
  estimate_claim_value: "Estimated the repair range",
  dispatch_tow: "Dispatched a tow truck",
  book_rental: "Booked a rental car",
  schedule_adjuster_callback: "Scheduled an adjuster callback",
  file_emergency: "Filed an emergency report",
  escalate_to_human: "Looped in a human agent",
  submit_claim: "Submitted your claim",
  send_summary: "Sent you a summary",
};

const STAGE_LABELS: Record<string, string> = {
  greeting: "Started the conversation",
  identifying: "Identifying you",
  verifying: "Verifying your policy",
  intake: "Gathering details",
  coverage_check: "Checking coverage",
  photos: "Reviewing photos",
  assessing: "Assessing damage",
  booking: "Booking services",
  reviewing: "Final review",
  submitted: "Claim submitted",
  escalated: "Escalated to a human",
  closed: "Claim closed",
};

type TimelineItem = { at: string; label: string };

export default async function SummaryPage({
  params,
}: {
  params: { claimId: string };
}) {
  const user = await getCurrentUser();
  if (!user || !user.id) {
    redirect(`/login?next=/claim/${params.claimId}/summary`);
  }
  const admin = createAdminClient();
  const { data: claim } = await admin
    .from("claims")
    .select(
      "id, user_id, claim_number, kind, stage, status, incident_at, location_label, estimate_range_low_usd, estimate_range_high_usd, submitted_at, details_json",
    )
    .eq("id", params.claimId)
    .maybeSingle();

  if (!claim || claim.user_id !== user.id) {
    redirect("/claim/new");
  }

  const [{ data: tasks }, { data: events }, { data: parties }, { data: photos }] =
    await Promise.all([
      admin
        .from("tasks")
        .select("kind, partner_ref, status, scheduled_for, payload_json")
        .eq("claim_id", claim.id),
      admin
        .from("events")
        .select("type, payload_json, created_at")
        .eq("claim_id", claim.id)
        .in("type", ["tool_call", "stage_change"])
        .order("created_at", { ascending: true }),
      admin
        .from("claim_parties")
        .select("party_type, name, contact")
        .eq("claim_id", claim.id),
      admin
        .from("photos")
        .select("kind, uploaded_at, vision_json")
        .eq("claim_id", claim.id)
        .order("uploaded_at", { ascending: true }),
    ]);

  const submitted = claim.stage === "submitted" || claim.status === "submitted";
  const description =
    (claim.details_json as Record<string, unknown> | null)?.description as
      | string
      | undefined;

  const timeline: TimelineItem[] = (events ?? [])
    .map((e): TimelineItem | null => {
      const payload = (e.payload_json ?? {}) as Record<string, unknown>;
      if (e.type === "tool_call") {
        const toolName = String(payload.tool ?? "");
        const label = TOOL_LABELS[toolName];
        if (!label) return null;
        return { at: e.created_at, label };
      }
      if (e.type === "stage_change") {
        const to = String(payload.to ?? "");
        const label = STAGE_LABELS[to];
        if (!label) return null;
        return { at: e.created_at, label };
      }
      return null;
    })
    .filter((x): x is TimelineItem => x !== null);

  // Collapse identical labels that fire repeatedly within a short window
  // (e.g., record_incident_details called incrementally).
  const dedupedTimeline = timeline.filter(
    (item, i) => i === 0 || item.label !== timeline[i - 1].label,
  );

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 sm:px-6 sm:py-10">
      <Link href="/" className="mb-6 inline-flex items-center gap-2 text-acme-700">
        <Shield className="h-5 w-5 text-acme-600" aria-hidden />
        <span className="font-bold">Alchemy Insurance</span>
      </Link>

      <div className="rounded-2xl border border-acme-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          {submitted ? (
            <CheckCircle2 className="mt-1 h-7 w-7 flex-none text-emerald-600" aria-hidden />
          ) : (
            <Clock className="mt-1 h-7 w-7 flex-none text-acme-600" aria-hidden />
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-bold sm:text-2xl">
              {submitted ? "Claim submitted" : "Claim in progress"}
            </h1>
            <p className="mt-1 break-words text-sm text-acme-700">
              {claim.claim_number} · {claim.kind} · stage: {claim.stage}
            </p>
          </div>
        </div>

        {description && (
          <div className="mt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-acme-700">
              What you told Sam
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-acme-900">
              {description}
            </p>
          </div>
        )}

        {claim.incident_at && (
          <div className="mt-6 rounded-lg bg-acme-50 p-4 text-sm text-acme-900">
            <p>
              <span className="font-semibold">Incident:</span>{" "}
              {new Date(claim.incident_at).toLocaleString()}
              {claim.location_label ? ` · ${claim.location_label}` : ""}
            </p>
          </div>
        )}

        {claim.estimate_range_low_usd && claim.estimate_range_high_usd ? (
          <div className="mt-6 rounded-lg bg-acme-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-acme-700">
              Estimate range
            </p>
            <p className="mt-1 text-2xl font-bold">
              ${claim.estimate_range_low_usd.toLocaleString()} – $
              {claim.estimate_range_high_usd.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-acme-700">Subject to adjuster review.</p>
          </div>
        ) : null}

        <div className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-acme-700">
            What Sam did for you
          </h2>
          {dedupedTimeline.length > 0 ? (
            <ol className="mt-3 space-y-2">
              {dedupedTimeline.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-acme-600" aria-hidden />
                  <span className="flex-1 text-acme-900">{item.label}</span>
                  <span className="flex-none text-xs text-acme-700">
                    {new Date(item.at).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-acme-700">
              Sam hasn&apos;t completed any actions yet.
            </p>
          )}
        </div>

        <div className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-acme-700">
            Booked services
          </h2>
          {tasks && tasks.length > 0 ? (
            <ul className="mt-3 divide-y divide-acme-100 rounded-lg border border-acme-100">
              {tasks.map((t, i) => (
                <li
                  key={i}
                  className="flex flex-col gap-1 p-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                >
                  <span className="font-semibold capitalize">
                    {t.kind.replace(/_/g, " ")}
                  </span>
                  <span className="text-acme-700">
                    {t.partner_ref}
                    {t.scheduled_for
                      ? ` · ${new Date(t.scheduled_for).toLocaleString()}`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-acme-700">No services booked yet.</p>
          )}
        </div>

        {parties && parties.length > 0 && (
          <div className="mt-6">
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-acme-700">
              <Users className="h-4 w-4" aria-hidden />
              Other parties
            </h2>
            <ul className="mt-3 space-y-1 text-sm text-acme-900">
              {parties.map((p, i) => (
                <li key={i}>
                  <span className="capitalize">
                    {p.party_type?.replace(/_/g, " ") ?? "Party"}
                  </span>
                  {p.name ? ` · ${p.name}` : ""}
                  {p.contact ? ` · ${p.contact}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}

        {photos && photos.length > 0 && (
          <div className="mt-6">
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-acme-700">
              <Camera className="h-4 w-4" aria-hidden />
              Photos shared ({photos.length})
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2 text-xs text-acme-700">
              {photos.map((p, i) => (
                <li
                  key={i}
                  className="rounded-full border border-acme-100 bg-acme-50 px-3 py-1 capitalize"
                >
                  {(p.kind ?? "photo").replace(/_/g, " ")}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-8 text-sm text-acme-700">
          {submitted
            ? "An adjuster will reach out within 24–48 business hours. You'll get a text and email when they do."
            : "Sam is still working on this claim. Come back any time to see updates."}
        </p>
      </div>
    </main>
  );
}
