import { redirect } from "next/navigation";
import Link from "next/link";
import { Shield } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/magic-link";
import { createAdminClient } from "@/lib/supabase/admin";
import ClaimChat from "@/components/claim/ClaimChat";
import ModalitySwitcher from "@/components/claim/ModalitySwitcher";

export default async function ChatClaimPage({
  params,
}: {
  params: { claimId: string };
}) {
  const user = await getCurrentUser();
  if (!user || !user.id) {
    redirect(`/login?next=/claim/${params.claimId}/chat`);
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

  const { data: msgs } = await admin
    .from("messages")
    .select("role, content")
    .eq("claim_id", claim.id)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: true });

  const initialMessages = (msgs ?? []).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content ?? "",
  }));

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-2 text-acme-700">
          <Shield className="h-5 w-5 text-acme-600" aria-hidden />
          <span className="font-bold">Acme Insurance</span>
        </Link>
        <ModalitySwitcher claimId={claim.id} current="chat" />
      </div>
      <h1 className="mb-1 text-xl font-bold">Chat with Sam</h1>
      <p className="mb-4 text-sm text-acme-700">
        Claim {claim.claim_number} · {claim.kind} · {claim.stage}
      </p>
      <ClaimChat claimId={claim.id} initialMessages={initialMessages} />
    </main>
  );
}
