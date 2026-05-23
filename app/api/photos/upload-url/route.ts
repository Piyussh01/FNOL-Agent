import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/magic-link";
import { verifyToolJwt } from "@/lib/auth/tool-jwt";
import { createAdminClient } from "@/lib/supabase/admin";

const Body = z.object({
  claim_id: z.string().uuid(),
  kind: z.string().min(1),
});

// Mints an upload URL for the photo capture page (when a user wants more
// than the pre-rendered slots). Authorizes via session OR signed token.
export async function POST(req: NextRequest) {
  let userId: string | null = null;
  const tokenHeader = req.headers.get("x-photo-token");
  if (tokenHeader) {
    try {
      const claims = await verifyToolJwt(tokenHeader);
      userId = claims.user_id;
    } catch {
      // fall through
    }
  }
  if (!userId) {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    userId = user.id;
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: claim } = await admin
    .from("claims")
    .select("id, user_id")
    .eq("id", parsed.data.claim_id)
    .maybeSingle();
  if (!claim || claim.user_id !== userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }

  const photoId = crypto.randomUUID();
  const path = `${claim.id}/${parsed.data.kind}/${photoId}.jpg`;
  const { data, error } = await admin.storage
    .from("claim-photos")
    .createSignedUploadUrl(path);
  if (error || !data) {
    return NextResponse.json({ error: "signed_url_failed" }, { status: 500 });
  }

  return NextResponse.json({
    storage_path: path,
    signed_url: data.signedUrl,
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
}
