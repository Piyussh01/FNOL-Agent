import { redirect } from "next/navigation";
import Link from "next/link";
import { Shield, CheckCircle2, Clock } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/magic-link";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const { data: tasks } = await admin
    .from("tasks")
    .select("kind, partner_ref, status, scheduled_for, payload_json")
    .eq("claim_id", claim.id);

  const submitted = claim.stage === "submitted" || claim.status === "submitted";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/" className="mb-6 inline-flex items-center gap-2 text-acme-700">
        <Shield className="h-5 w-5 text-acme-600" aria-hidden />
        <span className="font-bold">Acme Insurance</span>
      </Link>

      <div className="rounded-2xl border border-acme-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          {submitted ? (
            <CheckCircle2 className="h-7 w-7 text-emerald-600" aria-hidden />
          ) : (
            <Clock className="h-7 w-7 text-acme-600" aria-hidden />
          )}
          <div>
            <h1 className="text-2xl font-bold">
              {submitted ? "Claim submitted" : "Claim in progress"}
            </h1>
            <p className="text-sm text-acme-700">
              {claim.claim_number} · {claim.kind} · stage: {claim.stage}
            </p>
          </div>
        </div>

        {claim.estimate_range_low_usd && claim.estimate_range_high_usd ? (
          <div className="mt-6 rounded-lg bg-acme-50 p-4">
            <p className="text-sm font-semibold text-acme-700">Estimate range</p>
            <p className="text-2xl font-bold">
              ${claim.estimate_range_low_usd.toLocaleString()} – $
              {claim.estimate_range_high_usd.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-acme-700">
              Subject to adjuster review.
            </p>
          </div>
        ) : null}

        <div className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-acme-700">
            Booked services
          </h2>
          {tasks && tasks.length > 0 ? (
            <ul className="mt-3 divide-y divide-acme-100 rounded-lg border border-acme-100">
              {tasks.map((t, i) => (
                <li key={i} className="flex items-center justify-between gap-3 p-3 text-sm">
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

        {claim.incident_at && (
          <div className="mt-6 text-sm text-acme-700">
            <p>
              <span className="font-semibold">Incident:</span>{" "}
              {new Date(claim.incident_at).toLocaleString()}
              {claim.location_label ? ` · ${claim.location_label}` : ""}
            </p>
          </div>
        )}

        <p className="mt-8 text-sm">
          An adjuster will reach out within 24–48 business hours. You&apos;ll
          get a text and email when they do.
        </p>
      </div>
    </main>
  );
}
