import { Mail } from "lucide-react";
import Link from "next/link";
import LoginForm from "@/components/LoginForm";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { sent?: string; email?: string; error?: string; next?: string };
}) {
  const sent = searchParams.sent === "1";
  const next = searchParams.next ?? "/claim/new";

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-12">
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
              <LoginForm next={next} initialError={searchParams.error} />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
