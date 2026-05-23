"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";

export default function ClaimVideoSession({
  conversationUrl,
  claimNumber,
}: {
  conversationUrl: string | null;
  claimNumber: string | null;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!conversationUrl) {
      setError("Conversation URL is missing — refresh to try again.");
    }
  }, [conversationUrl]);

  if (error) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" aria-hidden />
          <span className="font-semibold">Trouble starting Sam</span>
        </div>
        <p className="mt-2 text-sm">{error}</p>
      </div>
    );
  }

  if (!conversationUrl) {
    return (
      <div className="aspect-video w-full animate-pulse rounded-lg bg-acme-100" />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-acme-100 bg-black shadow-lg">
      {claimNumber && (
        <div className="flex items-center justify-between bg-acme-900 px-4 py-2 text-xs text-white">
          <span>Claim {claimNumber}</span>
          <span className="opacity-70">Recording for quality + claims review</span>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={conversationUrl}
        title="Sam — Acme Insurance"
        allow="camera; microphone; autoplay; fullscreen; display-capture"
        className="block aspect-video w-full"
      />
    </div>
  );
}
