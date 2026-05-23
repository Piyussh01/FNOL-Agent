import type { Metadata, Viewport } from "next";
import { Fraunces } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "900"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: "Alchemy Insurance — File a claim",
  description:
    "Alchemy Insurance: file a first notice of loss claim with Sam, our AI claims advocate. Video or chat, 24/7.",
  manifest: "/manifest.json",
  applicationName: "Alchemy FNOL",
  appleWebApp: {
    capable: true,
    title: "Alchemy FNOL",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#FF0083",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={fraunces.variable}>
      <body className="min-h-screen bg-acme-50 text-acme-900">
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
