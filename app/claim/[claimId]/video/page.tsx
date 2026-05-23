import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import AlchemyLogo from "@/components/AlchemyLogo";
import ClaimVideoSession from "@/components/claim/ClaimVideoSession";
import ModalitySwitcher from "@/components/claim/ModalitySwitcher";
import { getCurrentUser } from "@/lib/auth/magic-link";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function VideoClaimPage({
  params,
  searchParams,
}: {
  params: { claimId: string };
  searchParams: { error?: string };
}) {
  const user = await getCurrentUser();
  if (!user || !user.id) {
    redirect(`/login?next=/claim/${params.claimId}/video`);
  }

  const admin = createAdminClient();
  const { data: claim } = await admin
    .from("claims")
    .select("id, user_id, claim_number, kind, stage")
    .eq("id", params.claimId)
    .maybeSingle();

  if (!claim || claim.user_id !== user.id) {
    redirect("/claim/new");
  }

  const cookieStore = cookies();
  const conversationUrl = cookieStore.get("tavus_conversation_url")?.value ?? null;

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-4 py-6">
      <Link href="/" className="mb-4 inline-flex items-center gap-2 text-acme-900">
        <AlchemyLogo className="h-9 w-auto sm:h-10" />
      </Link>

      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">Talking to Sam</h1>
        <div className="flex items-center gap-3">
          <p className="text-sm text-acme-700">
            Claim {claim.claim_number} · {claim.kind}
          </p>
          <ModalitySwitcher claimId={claim.id} current="video" />
        </div>
      </div>

      {searchParams.error && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {searchParams.error === "no_persona_configured"
            ? "Sam isn't fully set up yet — run scripts/setup-tavus-persona.ts and fill in TAVUS_PERSONA_ID_EN."
            : "Couldn't reach Sam. Refresh to retry."}
        </div>
      )}

      <ClaimVideoSession conversationUrl={conversationUrl} claimNumber={claim.claim_number} />

      <p className="mt-6 text-xs text-acme-700">
        Sam may slow down or pause if you sound shaken. You can always say
        &quot;I need a human&quot; — Sam will route you to a supervisor.
      </p>
      </div>
    </main>
  );
}
