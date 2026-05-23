"use client";

import { useState, useRef } from "react";
import { Camera, CheckCircle2, Loader2, AlertCircle } from "lucide-react";

type PhotoSlot = {
  kind: string;
  signed_url: string;
  storage_path: string;
  expires_at: string;
};

type Status = "idle" | "uploading" | "uploaded" | "error";

export default function PhotoCapture({
  slots,
  claimId,
}: {
  slots: PhotoSlot[];
  claimId: string;
}) {
  const [state, setState] = useState<Record<string, Status>>(
    Object.fromEntries(slots.map((s) => [s.kind, "idle" as const])),
  );
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function handleChange(slot: PhotoSlot, file: File) {
    setState((s) => ({ ...s, [slot.kind]: "uploading" }));
    try {
      const upload = await fetch(slot.signed_url, {
        method: "PUT",
        headers: { "content-type": file.type || "image/jpeg" },
        body: file,
      });
      if (!upload.ok) throw new Error(`upload_failed: ${upload.status}`);

      const finalize = await fetch(
        `/api/photos/finalize?claim_id=${encodeURIComponent(claimId)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kind: slot.kind,
            storage_path: slot.storage_path,
          }),
        },
      );
      if (!finalize.ok) throw new Error(`finalize_failed: ${finalize.status}`);

      setState((s) => ({ ...s, [slot.kind]: "uploaded" }));
    } catch (err) {
      console.error(err);
      setState((s) => ({ ...s, [slot.kind]: "error" }));
    }
  }

  return (
    <div className="space-y-3">
      {slots.map((slot) => {
        const status = state[slot.kind];
        return (
          <div
            key={slot.kind}
            className="flex items-center justify-between gap-3 rounded-lg border border-acme-200 bg-white p-4"
          >
            <div className="flex items-center gap-3">
              <Camera className="h-5 w-5 text-acme-600" aria-hidden />
              <div>
                <p className="font-semibold capitalize">
                  {slot.kind.replace(/_/g, " ")}
                </p>
                <p className="text-xs text-acme-700">
                  {status === "uploaded"
                    ? "Got it — thanks."
                    : status === "uploading"
                      ? "Uploading…"
                      : status === "error"
                        ? "Upload failed. Try again."
                        : "Tap to take the photo."}
                </p>
              </div>
            </div>
            <input
              ref={(el) => {
                inputRefs.current[slot.kind] = el;
              }}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleChange(slot, f);
              }}
            />
            <button
              type="button"
              onClick={() => inputRefs.current[slot.kind]?.click()}
              disabled={status === "uploading"}
              className="btn-secondary"
            >
              {status === "uploading" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : status === "uploaded" ? (
                <CheckCircle2 className="h-4 w-4" aria-hidden />
              ) : status === "error" ? (
                <AlertCircle className="h-4 w-4" aria-hidden />
              ) : (
                "Open camera"
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
