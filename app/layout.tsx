import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";

export const metadata: Metadata = {
  title: "Acme Insurance — File a claim",
  description:
    "Acme Insurance: file a first notice of loss claim with Sam, our AI claims advocate. Video or chat, 24/7.",
  manifest: "/manifest.json",
  applicationName: "Acme FNOL",
  appleWebApp: {
    capable: true,
    title: "Acme FNOL",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#2d4878",
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
    <html lang="en">
      <body className="min-h-screen bg-acme-50 text-acme-900">
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
