import Image from "next/image";
import Link from "next/link";
import { Video } from "lucide-react";
import AlchemyLogo from "@/components/AlchemyLogo";
import HouseCarIllustration from "@/components/HouseCarIllustration";
import HouseFigureIllustration from "@/components/HouseFigureIllustration";

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-white">
      <header>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8 sm:py-6">
          <AlchemyLogo className="h-9 w-auto text-acme-900 sm:h-12" />
        </div>
      </header>

      <section className="relative mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-20 lg:py-28">
        <HouseCarIllustration
          className="pointer-events-none absolute bottom-0 left-[-180px] hidden h-72 w-auto text-zinc-300 lg:block xl:left-[-120px]"
        />
        <HouseFigureIllustration
          className="pointer-events-none absolute bottom-0 right-[-180px] hidden h-72 w-auto text-zinc-300 lg:block xl:right-[-120px]"
        />

        <div className="relative grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <h1 className="font-display text-[2.5rem] font-normal italic leading-[1.02] tracking-tight text-acme-900 sm:text-6xl lg:text-7xl">
              File a claim, face&#8209;to&#8209;face.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-acme-700 sm:mt-8 sm:text-lg">
              Sam is our AI claims advocate. Talk by video or chat — we&apos;ll verify your
              policy, look at the damage, and book what you need.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:gap-4">
              <Link href="/claim/new" className="btn-primary w-full sm:w-auto" data-testid="file-claim-cta">
                File a claim
              </Link>
              <Link href="/claims/latest" className="btn-secondary w-full sm:w-auto">
                Check claim status
              </Link>
            </div>
            <p className="mt-5 text-xs text-acme-700 sm:mt-6">
              In an emergency, call 911. Sam is not a substitute for emergency services.
            </p>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-2xl border border-acme-100 bg-acme-50 shadow-sm animate-float will-change-transform">
              <div className="flex items-center gap-2 border-b border-acme-100 bg-white px-4 py-2 text-[10px] font-semibold tracking-wide text-acme-700 sm:text-xs">
                <span className="h-2 w-2 rounded-sm bg-acme-600 animate-soft-pulse" aria-hidden />
                FACE&#8209;TO&#8209;FACE VIDEO
              </div>
              <div className="relative aspect-[4/3] w-full bg-acme-100">
                <Image
                  src="/sam.png"
                  alt="Sam, your AI claims advocate"
                  fill
                  priority
                  sizes="(min-width: 1024px) 480px, 100vw"
                  className="object-cover"
                />
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-acme-100 bg-white px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-acme-900">
                  <Video className="h-4 w-4 text-acme-600" aria-hidden />
                  Speak with Sam
                </div>
                <p className="text-xs text-acme-700">Online · responds instantly</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer>
        <div className="mx-auto max-w-6xl px-5 py-6 text-xs text-acme-700 sm:px-8">
          © Alchemy Insurance · This is a demo. No coverage represented here is real.
        </div>
      </footer>
    </main>
  );
}
