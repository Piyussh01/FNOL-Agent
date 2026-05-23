import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/magic-link";
import { createAdminClient } from "@/lib/supabase/admin";

const Body = z.object({ locale: z.enum(["en", "es"]) });

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("fnol_locale", parsed.data.locale, {
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });

  // Persist on the user too if signed in.
  const user = await getCurrentUser();
  if (user?.id) {
    const admin = createAdminClient();
    await admin
      .from("users")
      .update({ preferred_lang: parsed.data.locale })
      .eq("id", user.id);
  }
  return res;
}
