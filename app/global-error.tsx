"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html>
      <body>
        <main className="mx-auto max-w-xl px-6 py-20 text-center">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="mt-3 text-sm text-gray-600">
            We logged this and will look into it. If you&apos;re mid-claim, your progress is saved.
          </p>
          <a
            href="/"
            className="mt-6 inline-block rounded-md bg-blue-700 px-5 py-2 text-white"
          >
            Go home
          </a>
        </main>
      </body>
    </html>
  );
}
