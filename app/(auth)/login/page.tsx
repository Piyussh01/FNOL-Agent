import { sendMagicLink } from "@/lib/auth/magic-link";
import { redirect } from "next/navigation";
import { Shield, Mail } from "lucide-react";
import Link from "next/link";

async function loginAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = String(formData.get("next") ?? "/claim/new");
  if (!email || !email.includes("@")) {
    redirect(`/login?error=invalid_email&next=${encodeURIComponent(next)}`);
  }
  const res = await sendMagicLink(email, next);
  if (!res.ok) {
    redirect(`/login?error=${encodeURIComponent(res.error)}&next=${encodeURIComponent(next)}`);
  }
  redirect(`/login?sent=1&email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: { sent?: string; email?: string; error?: string; next?: string };
}) {
  const sent = searchParams.sent === "1";
  const next = searchParams.next ?? "/claim/new";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-12">
      <Link href="/" className="mb-8 inline-flex items-center gap-2 text-acme-700">
        <Shield className="h-5 w-5 text-acme-600" aria-hidden />
        <span className="font-bold">Acme Insurance</span>
      </Link>

      <div className="rounded-2xl border border-acme-100 bg-white p-8 shadow-sm">
        {sent ? (
          <>
            <Mail className="mb-3 h-8 w-8 text-acme-600" aria-hidden />
            <h1 className="text-2xl font-bold">Check your email</h1>
            <p className="mt-2 text-sm text-acme-700">
              We sent a sign-in link to{" "}
              <span className="font-semibold">{searchParams.email}</span>. It expires in
              10 minutes.
            </p>
            <p className="mt-6 text-xs text-acme-700">
              Wrong email?{" "}
              <Link href={`/login?next=${encodeURIComponent(next)}`} className="underline">
                Try again
              </Link>
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold">Sign in to file a claim</h1>
            <p className="mt-2 text-sm text-acme-700">
              No password needed — we&apos;ll email you a one-tap link.
            </p>
            <form action={loginAction} className="mt-6 space-y-3">
              <input type="hidden" name="next" value={next} />
              <label className="block text-sm font-semibold" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="w-full rounded-md border border-acme-200 px-3 py-2 outline-none focus:ring-2 focus:ring-acme-600"
                placeholder="you@example.com"
              />
              {searchParams.error && (
                <p className="text-sm text-red-600">{searchParams.error}</p>
              )}
              <button type="submit" className="btn-primary w-full">
                Send sign-in link
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
