"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// PKCE fix: initiate signInWithOtp from the BROWSER. The browser client
// (via @supabase/ssr's createBrowserClient) writes the code verifier into
// the same cookie store the server callback reads via createServerClient.
// Server-action initiation puts the verifier into a cookie context the
// /callback route can't see, so exchangeCodeForSession then errors with
// "PKCE code verifier not found in storage."
export default function LoginForm({
  next,
  initialError,
}: {
  next: string;
  initialError?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes("@")) {
      setError("Please enter a valid email.");
      return;
    }
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
    const redirectTo = `${appUrl}/callback?next=${encodeURIComponent(next)}`;

    const { error: err } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: redirectTo },
    });

    if (err) {
      setError(err.message);
      setBusy(false);
      return;
    }
    router.push(
      `/login?sent=1&email=${encodeURIComponent(trimmed)}&next=${encodeURIComponent(next)}`,
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-3">
      <label className="block text-sm font-semibold" htmlFor="email">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-md border border-acme-200 px-3 py-2 outline-none focus:ring-2 focus:ring-acme-600"
        placeholder="you@example.com"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? "Sending…" : "Send sign-in link"}
      </button>
    </form>
  );
}
