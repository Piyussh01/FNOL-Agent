import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/magic-link";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ClaimsLatestPage() {
  const user = await getCurrentUser();
  if (!user || !user.id) {
    redirect("/login?next=/claims/latest");
  }

  const admin = createAdminClient();
  const { data: claim } = await admin
    .from("claims")
    .select("id")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!claim) {
    redirect("/claim/new");
  }

  redirect(`/claim/${claim.id}/summary`);
}
