import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/magic-link";
import { verifyToolJwt } from "@/lib/auth/tool-jwt";
import { createAdminClient } from "@/lib/supabase/admin";

const Body = z.object({
  kind: z.string().min(1),
  storage_path: z.string().min(1),
});

// Called by PhotoCapture.tsx after the client PUTs an image to Storage.
// Inserts a `photos` row so the vision pipeline (M7) can pick it up.
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const claimId = searchParams.get("claim_id");
  if (!claimId) {
    return NextResponse.json({ error: "missing_claim_id" }, { status: 400 });
  }

  let userId: string | null = null;
  const tokenHeader = req.headers.get("x-photo-token");
  if (tokenHeader) {
    try {
      const claims = await verifyToolJwt(tokenHeader);
      if (claims.claim_id === claimId) userId = claims.user_id;
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
    .eq("id", claimId)
    .maybeSingle();
  if (!claim || claim.user_id !== userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }
  if (!parsed.data.storage_path.startsWith(`${claimId}/`)) {
    return NextResponse.json({ error: "path_mismatch" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("photos")
    .insert({
      claim_id: claimId,
      storage_path: parsed.data.storage_path,
      kind: parsed.data.kind,
    })
    .select("id")
    .single();
  if (error || !data) {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  await admin.from("events").insert({
    claim_id: claimId,
    type: "photo_uploaded",
    payload_json: { photo_id: data.id, kind: parsed.data.kind },
  });

  return NextResponse.json({ ok: true, photo_id: data.id });
}
