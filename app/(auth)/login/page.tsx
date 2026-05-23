import { Mail, Car, Home, Package } from "lucide-react";
import Link from "next/link";
import LoginForm from "@/components/LoginForm";

const DEMO_USERS = [
  {
    email: "maya@example.com",
    name: "Maya Rodriguez",
    blurb: "Auto policy — 2019 Honda Accord, 2020 Tesla Model 3 (CA)",
    icon: Car,
  },
  {
    email: "daniel@example.com",
    name: "Daniel Park",
    blurb: "Home + renters policies in San Francisco",
    icon: Home,
  },
  {
    email: "sofia@example.com",
    name: "Sofía García",
    blurb: "Auto + renters · Spanish-speaking",
    icon: Package,
  },
];

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

              <div className="mt-8 border-t border-acme-100 pt-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-acme-700">
                  Demo accounts — one-click sign-in
                </p>
                <ul className="mt-3 space-y-2">
                  {DEMO_USERS.map(({ email, name, blurb, icon: Icon }) => (
                    <li key={email}>
                      <Link
                        href={`/api/auth/dev-login?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`}
                        className="flex items-start gap-3 rounded-lg border border-acme-100 bg-white px-3 py-2 transition hover:border-acme-600 hover:shadow-sm"
                      >
                        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-acme-600" aria-hidden />
                        <span className="flex-1">
                          <span className="block text-sm font-semibold">{name}</span>
                          <span className="block text-xs text-acme-700">{blurb}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
