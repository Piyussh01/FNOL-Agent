import { createClient } from "@/lib/supabase/server";

export async function sendMagicLink(email: string, redirectPath = "/claim/new") {
  const supabase = createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${appUrl}/callback?next=${encodeURIComponent(redirectPath)}`,
    },
  });

  if (error) {
    return { ok: false as const, error: error.message };
  }
  return { ok: true as const };
}

export async function getCurrentUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: row } = await supabase
    .from("users")
    .select("id, name, email, phone, preferred_lang")
    .eq("auth_id", user.id)
    .maybeSingle();

  return row ? { authId: user.id, ...row } : { authId: user.id, id: null };
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
}
