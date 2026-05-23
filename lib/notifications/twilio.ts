import { log } from "@/lib/observability/logger";

export type SmsPayload = {
  to: string;
  body: string;
};

export async function sendSms(payload: SmsPayload): Promise<{ ok: boolean; sid?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!sid || !token || !from) {
    log.info("sms_dry_run", { to: payload.to, body: payload.body, reason: "missing_twilio_creds" });
    return { ok: true };
  }

  // Lazy import keeps the Twilio SDK out of edge bundles where unused.
  const { default: Twilio } = await import("twilio");
  const client = Twilio(sid, token);
  try {
    const msg = await client.messages.create({
      to: payload.to,
      from,
      body: payload.body,
    });
    log.info("sms_sent", { to: payload.to, sid: msg.sid });
    return { ok: true, sid: msg.sid };
  } catch (err) {
    log.error("sms_failed", { error: (err as Error).message, to: payload.to });
    return { ok: false };
  }
}
