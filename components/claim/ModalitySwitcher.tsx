"use client";

import { Video, MessageSquare } from "lucide-react";
import { useTransition } from "react";

export default function ModalitySwitcher({
  claimId,
  current,
}: {
  claimId: string;
  current: "video" | "chat";
}) {
  const [pending, start] = useTransition();

  function go(target: "video" | "chat") {
    if (target === current) return;
    start(async () => {
      if (target === "chat") {
        window.location.href = `/claim/${claimId}/chat`;
        return;
      }
      // Switch to video: spin up a new Tavus conversation that resumes context.
      const form = new FormData();
      form.append("kind", "auto"); // placeholder; server reads claim's actual kind
      form.append("modality", "video");
      form.append("resume_from_claim_id", claimId);
      const res = await fetch("/api/conversations/create", {
        method: "POST",
        body: form,
        redirect: "manual",
      });
      // The endpoint replies 303 → /claim/{id}/video.
      if (res.type === "opaqueredirect" || res.status === 303) {
        window.location.href = `/claim/${claimId}/video`;
      }
    });
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-acme-200 bg-white p-1 text-xs">
      <button
        onClick={() => go("video")}
        disabled={pending}
        className={`flex items-center gap-1 rounded-full px-3 py-1 ${
          current === "video" ? "bg-acme-600 text-white" : "text-acme-700"
        }`}
      >
        <Video className="h-3 w-3" aria-hidden />
        Video
      </button>
      <button
        onClick={() => go("chat")}
        disabled={pending}
        className={`flex items-center gap-1 rounded-full px-3 py-1 ${
          current === "chat" ? "bg-acme-600 text-white" : "text-acme-700"
        }`}
      >
        <MessageSquare className="h-3 w-3" aria-hidden />
        Chat
      </button>
    </div>
  );
}
