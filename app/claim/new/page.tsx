import { getCurrentUser } from "@/lib/auth/magic-link";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Car, Home, Package } from "lucide-react";
import AlchemyLogo from "@/components/AlchemyLogo";

export default async function NewClaimPage() {
  const user = await getCurrentUser();
  if (!user || !user.id) {
    redirect("/login?next=/claim/new");
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-6 sm:py-12">
      <Link href="/" className="mb-8 inline-flex items-center">
        <AlchemyLogo className="h-9 w-auto text-acme-900 sm:h-10" />
      </Link>

      <h1 className="text-2xl font-bold sm:text-3xl">Let&apos;s file your claim</h1>
      <p className="mt-2 text-sm text-acme-700 sm:text-base">
        Pick how you&apos;d like to talk to Sam. You can switch modes any time.
      </p>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wide text-acme-700 sm:mt-10 sm:text-sm">
        What happened?
      </h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ClaimKindCard kind="auto" icon={<Car className="h-5 w-5" aria-hidden />} label="Auto" />
        <ClaimKindCard kind="home" icon={<Home className="h-5 w-5" aria-hidden />} label="Home" />
        <ClaimKindCard kind="renters" icon={<Package className="h-5 w-5" aria-hidden />} label="Renters" />
      </div>

      <p className="mt-10 text-xs text-acme-700">
        In an emergency, call 911. Sam is not a substitute for emergency services.
      </p>
      </div>
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
