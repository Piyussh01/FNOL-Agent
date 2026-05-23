import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/magic-link";
import { log } from "@/lib/observability/logger";

const Body = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});

// Records a web-push subscription. We log only — wiring a real push provider
// (e.g. VAPID + web-push) is M14 cleanup. The service worker fires on
// receipt regardless.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  log.info("push_subscribed", { user_id: user.id, endpoint: parsed.data.endpoint });
  return NextResponse.json({ ok: true });
}
