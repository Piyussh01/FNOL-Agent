// PostHog server-side capture. No-op when key absent. Lazy fetch to avoid
// pulling the SDK into every cold-start.

import { log } from "./logger";

export type FunnelEvent =
  | "claim_started"
  | "identity_verified"
  | "coverage_checked"
  | "photos_uploaded"
  | "claim_submitted"
  | "escalated"
  | "emergency_flagged"
  | "distress_flagged";

export async function capture(
  event: FunnelEvent,
  distinctId: string,
  properties: Record<string, unknown> = {},
): Promise<void> {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) {
    log.info("posthog_dry_run", { event, distinctId, properties });
    return;
  }
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
  try {
    await fetch(`${host}/capture/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        event,
        distinct_id: distinctId,
        properties: { ...properties, $lib: "fnol-server" },
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (err) {
    log.warn("posthog_failed", { error: (err as Error).message });
  }
}
