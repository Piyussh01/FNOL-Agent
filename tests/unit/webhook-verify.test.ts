import { describe, expect, it, beforeEach } from "vitest";
import { createHmac } from "node:crypto";
import { verifyTavusSignature } from "@/lib/tavus/webhook-verify";

describe("verifyTavusSignature", () => {
  const SECRET = "test-secret-test-secret-test-secret-12";
  const body = JSON.stringify({ event_type: "test", conversation_id: "x" });

  beforeEach(() => {
    process.env.TAVUS_WEBHOOK_SECRET = SECRET;
  });

  it("accepts a valid signature", () => {
    const sig = createHmac("sha256", SECRET).update(body).digest("hex");
    expect(verifyTavusSignature(body, sig)).toEqual({ ok: true });
  });

  it("accepts a valid signature with sha256= prefix", () => {
    const sig =
      "sha256=" + createHmac("sha256", SECRET).update(body).digest("hex");
    expect(verifyTavusSignature(body, sig)).toEqual({ ok: true });
  });

  it("rejects a tampered body", () => {
    const sig = createHmac("sha256", SECRET).update(body).digest("hex");
    expect(verifyTavusSignature(body + "x", sig)).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  it("rejects a missing header", () => {
    expect(verifyTavusSignature(body, null)).toEqual({
      ok: false,
      reason: "missing_header",
    });
  });

  it("reports no_secret when env missing", () => {
    delete process.env.TAVUS_WEBHOOK_SECRET;
    const sig = createHmac("sha256", SECRET).update(body).digest("hex");
    expect(verifyTavusSignature(body, sig)).toEqual({
      ok: false,
      reason: "no_secret",
    });
  });

  it("rejects length-mismatched signatures", () => {
    expect(verifyTavusSignature(body, "abc")).toEqual({
      ok: false,
      reason: "length_mismatch",
    });
  });
});
