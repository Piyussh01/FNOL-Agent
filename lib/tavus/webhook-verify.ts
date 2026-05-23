import { createHmac, timingSafeEqual } from "node:crypto";

// Tavus signs webhook payloads via HMAC-SHA256 in the `x-tavus-signature` (or
// `tavus-signature`) header. The shared secret is TAVUS_WEBHOOK_SECRET.
//
// If the secret is unset (local/dev), `verifyTavusSignature` returns
// { ok: false, reason: 'no_secret' } — callers should reject in prod and may
// allow in dev. We don't allow dev-bypass silently.
export function verifyTavusSignature(
  rawBody: string,
  signatureHeader: string | null,
): { ok: true } | { ok: false; reason: string } {
  const secret = process.env.TAVUS_WEBHOOK_SECRET;
  if (!secret) return { ok: false, reason: "no_secret" };
  if (!signatureHeader) return { ok: false, reason: "missing_header" };

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = signatureHeader.replace(/^sha256=/i, "").trim();

  if (expected.length !== provided.length) {
    return { ok: false, reason: "length_mismatch" };
  }
  const eq = timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(provided, "hex"),
  );
  return eq ? { ok: true } : { ok: false, reason: "bad_signature" };
}
