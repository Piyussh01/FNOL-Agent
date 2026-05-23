import { redirect } from "next/navigation";
import Link from "next/link";
import { Shield } from "lucide-react";
import { verifyToolJwt } from "@/lib/auth/tool-jwt";
import { getCurrentUser } from "@/lib/auth/magic-link";
import { createAdminClient } from "@/lib/supabase/admin";
import PhotoCapture from "@/components/claim/PhotoCapture";

const DEFAULT_KINDS_BY_CLAIM: Record<string, string[]> = {
  auto: ["four_corners", "license_plate", "damage_closeup"],
  home: ["property_overview", "damage_closeup", "interior"],
  renters: ["interior", "inventory_item", "damage_closeup"],
};

export default async function PhotosPage({
  params,
  searchParams,
}: {
  params: { claimId: string };
  searchParams: { token?: string };
}) {
  let userId: string | null = null;

  if (searchParams.token) {
    try {
      const claims = await verifyToolJwt(searchParams.token);
      if (claims.claim_id === params.claimId) {
        userId = claims.user_id;
      }
    } catch {
      // fall through to session auth
    }
  }

  if (!userId) {
    const user = await getCurrentUser();
    if (!user || !user.id) {
      redirect(`/login?next=/claim/${params.claimId}/photos`);
    }
    userId = user.id;
  }

  const admin = createAdminClient();
  const { data: claim } = await admin
    .from("claims")
    .select("id, user_id, kind, claim_number, stage")
    .eq("id", params.claimId)
    .maybeSingle();

  if (!claim || claim.user_id !== userId) {
    redirect("/claim/new");
  }

  const kinds = DEFAULT_KINDS_BY_CLAIM[claim.kind] ?? ["damage_closeup"];

  // Pre-mint signed URLs so the page can render without an extra round-trip.
  const slots: { kind: string; signed_url: string; storage_path: string; expires_at: string }[] = [];
  for (const kind of kinds) {
    const photoId = crypto.randomUUID();
    const storage_path = `${claim.id}/${kind}/${photoId}.jpg`;
    const { data } = await admin.storage
      .from("claim-photos")
      .createSignedUploadUrl(storage_path);
    if (data) {
      slots.push({
        kind,
        signed_url: data.signedUrl,
        storage_path,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <Link href="/" className="mb-6 inline-flex items-center gap-2 text-acme-700">
        <Shield className="h-5 w-5 text-acme-600" aria-hidden />
        <span className="font-bold">Acme Insurance</span>
      </Link>
      <h1 className="text-2xl font-bold">Photos for claim {claim.claim_number}</h1>
      <p className="mt-2 text-sm text-acme-700">
        Take each photo using your camera. Sam will pick these up automatically
        once you&apos;re done.
      </p>
      <div className="mt-6">
        <PhotoCapture slots={slots} claimId={claim.id} />
      </div>
      <p className="mt-8 text-xs text-acme-700">
        Links expire one hour after Sam sent them. If a link expires, ask Sam
        to send a new one.
      </p>
    </main>
  );
}
