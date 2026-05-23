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

export type CurrentUser = {
  authId: string;
  id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  preferred_lang: "en" | "es";
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
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

  if (!row) {
    return {
      authId: user.id,
      id: null,
      name: null,
      email: user.email ?? null,
      phone: null,
      preferred_lang: "en",
    };
  }
  return {
    authId: user.id,
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    preferred_lang: row.preferred_lang === "es" ? "es" : "en",
  };
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
}
