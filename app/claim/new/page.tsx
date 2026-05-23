import { getCurrentUser } from "@/lib/auth/magic-link";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Video, MessageSquare, Shield, Car, Home, Package } from "lucide-react";

export default async function NewClaimPage() {
  const user = await getCurrentUser();
  if (!user || !user.id) {
    redirect("/login?next=/claim/new");
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/" className="mb-8 inline-flex items-center gap-2 text-acme-700">
        <Shield className="h-5 w-5 text-acme-600" aria-hidden />
        <span className="font-bold">Acme Insurance</span>
      </Link>

      <h1 className="text-3xl font-bold">Let&apos;s file your claim</h1>
      <p className="mt-2 text-acme-700">
        Pick how you&apos;d like to talk to Sam. You can switch modes any time.
      </p>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-acme-700">
        What happened?
      </h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ClaimKindCard kind="auto" icon={<Car className="h-5 w-5" aria-hidden />} label="Auto" />
        <ClaimKindCard kind="home" icon={<Home className="h-5 w-5" aria-hidden />} label="Home" />
        <ClaimKindCard kind="renters" icon={<Package className="h-5 w-5" aria-hidden />} label="Renters" />
      </div>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-acme-700">
        How would you like to talk to Sam?
      </h2>
      <p className="mt-2 text-xs text-acme-700">
        Pick a kind above, then we&apos;ll route you to the right Sam.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-acme-200 bg-white p-4">
          <Video className="h-5 w-5 text-acme-600" aria-hidden />
          <p className="mt-3 font-semibold">Video</p>
          <p className="mt-1 text-sm text-acme-700">
            Face to face. Best when you can show damage on camera.
          </p>
        </div>
        <div className="rounded-xl border border-acme-200 bg-white p-4">
          <MessageSquare className="h-5 w-5 text-acme-600" aria-hidden />
          <p className="mt-3 font-semibold">Chat</p>
          <p className="mt-1 text-sm text-acme-700">
            Type instead. Good for quiet places or slow connections.
          </p>
        </div>
      </div>

      <p className="mt-10 text-xs text-acme-700">
        In an emergency, call 911. Sam is not a substitute for emergency services.
      </p>
    </main>
  );
}

function ClaimKindCard({
  kind,
  icon,
  label,
}: {
  kind: "auto" | "home" | "renters";
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <form action={`/api/conversations/create`} method="POST">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="modality" value="video" />
      <button
        type="submit"
        className="group flex h-full w-full flex-col items-start gap-3 rounded-xl border border-acme-200 bg-white p-4 text-left transition hover:border-acme-600 hover:shadow-sm"
        data-testid={`kind-${kind}`}
      >
        <span className="text-acme-600">{icon}</span>
        <span className="font-semibold">{label}</span>
        <span className="text-sm text-acme-700">Talk to Sam by video →</span>
      </button>
    </form>
  );
}
