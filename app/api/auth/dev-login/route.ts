import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Demo-only one-click sign-in. Skips the magic-link email step for the three
// seeded policyholders. Locked to an allowlist so this can't be used to mint
// a session for an arbitrary email.
const DEMO_EMAILS = new Set([
  "maya@example.com",
  "daniel@example.com",
  "sofia@example.com",
]);

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const email = (searchParams.get("email") ?? "").trim().toLowerCase();
  const next = searchParams.get("next") ?? "/claim/new";

  if (!DEMO_EMAILS.has(email)) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("demo email not allowed")}`,
    );
  }

  const admin = createAdminClient();
  const redirectTo = `${origin}/callback?next=${encodeURIComponent(next)}`;

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });

  if (error || !data?.properties?.action_link) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error?.message ?? "dev_login_failed")}`,
    );
  }

  return NextResponse.redirect(data.properties.action_link);
}
