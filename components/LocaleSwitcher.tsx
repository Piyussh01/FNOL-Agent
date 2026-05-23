"use client";

import { useTransition } from "react";

export default function LocaleSwitcher({ current }: { current: "en" | "es" }) {
  const [pending, start] = useTransition();

  function setLocale(next: "en" | "es") {
    if (next === current) return;
    start(async () => {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale: next }),
      });
      window.location.reload();
    });
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-acme-200 bg-white p-1 text-xs">
      <button
        onClick={() => setLocale("en")}
        disabled={pending}
        className={`rounded-full px-3 py-1 ${current === "en" ? "bg-acme-600 text-white" : "text-acme-700"}`}
      >
        EN
      </button>
      <button
        onClick={() => setLocale("es")}
        disabled={pending}
        className={`rounded-full px-3 py-1 ${current === "es" ? "bg-acme-600 text-white" : "text-acme-700"}`}
      >
        ES
      </button>
    </div>
  );
}
