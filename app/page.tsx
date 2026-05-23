import Link from "next/link";
import { Shield, Video, MessageSquare, Camera, Clock } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-acme-100 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2 text-lg font-bold text-acme-900">
            <Shield className="h-6 w-6 text-acme-600" aria-hidden />
            Acme Insurance
          </div>
          <nav className="hidden gap-6 text-sm text-acme-700 md:flex">
            <a href="#how">How it works</a>
            <a href="#coverage">Coverage</a>
            <a href="#help">Help</a>
          </nav>
          <Link href="/login" className="text-sm font-semibold text-acme-700 hover:text-acme-900">
            Sign in
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-acme-600">
              First notice of loss
            </p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-acme-900 md:text-5xl">
              File your claim with{" "}
              <span className="text-acme-600">Sam</span> — face-to-face, anytime.
            </h1>
            <p className="mt-6 text-lg text-acme-700">
              Sam is our AI claims advocate. Talk to Sam by video or chat. We&apos;ll verify your policy,
              gather the facts, look at the damage, and book a tow, rental, and adjuster — usually in under
              fifteen minutes.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/claim/new" className="btn-primary" data-testid="file-claim-cta">
                File a claim
              </Link>
              <Link href="/login" className="btn-secondary">
                Check claim status
              </Link>
            </div>
            <p className="mt-4 text-xs text-acme-700">
              In an emergency, call 911. Sam is not a substitute for emergency services.
            </p>
          </div>

          <div className="rounded-2xl border border-acme-100 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3 border-b border-acme-100 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-acme-600 text-white">
                S
              </div>
              <div>
                <p className="font-semibold text-acme-900">Sam</p>
                <p className="text-xs text-acme-700">Claims advocate · Online</p>
              </div>
            </div>
            <ul className="mt-6 space-y-4 text-sm text-acme-900">
              <li className="flex items-start gap-3">
                <Video className="mt-0.5 h-5 w-5 flex-none text-acme-600" aria-hidden />
                <span>Face-to-face video, sub-second response times.</span>
              </li>
              <li className="flex items-start gap-3">
                <MessageSquare className="mt-0.5 h-5 w-5 flex-none text-acme-600" aria-hidden />
                <span>Switch to chat anytime — Sam remembers where you left off.</span>
              </li>
              <li className="flex items-start gap-3">
                <Camera className="mt-0.5 h-5 w-5 flex-none text-acme-600" aria-hidden />
                <span>Snap photos from your phone; we assess damage on the spot.</span>
              </li>
              <li className="flex items-start gap-3">
                <Clock className="mt-0.5 h-5 w-5 flex-none text-acme-600" aria-hidden />
                <span>Books tow, rental, and adjuster while you&apos;re still on the line.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section id="how" className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-2xl font-bold text-acme-900">How it works</h2>
          <ol className="mt-6 grid gap-6 md:grid-cols-4">
            {[
              ["1", "Sign in", "One-tap magic link to your email."],
              ["2", "Tell Sam what happened", "Auto, home, or renters — Sam adapts."],
              ["3", "Share photos", "We auto-assess damage with computer vision."],
              ["4", "We handle the rest", "Tow, rental, adjuster booked. You get a summary."],
            ].map(([n, t, d]) => (
              <li key={n} className="rounded-xl border border-acme-100 bg-acme-50 p-5">
                <div className="text-3xl font-bold text-acme-600">{n}</div>
                <p className="mt-2 font-semibold text-acme-900">{t}</p>
                <p className="mt-1 text-sm text-acme-700">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="border-t border-acme-100 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-8 text-xs text-acme-700">
          © Acme Insurance · This is a demo. No coverage represented here is real.
        </div>
      </footer>
    </main>
  );
}
