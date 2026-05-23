import { log } from "@/lib/observability/logger";

export type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export async function sendEmail(payload: EmailPayload): Promise<{ ok: boolean; id?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!key || !from) {
    log.info("email_dry_run", { to: payload.to, subject: payload.subject, reason: "missing_resend_creds" });
    return { ok: true };
  }

  const { Resend } = await import("resend");
  const resend = new Resend(key);
  try {
    const { data, error } = await resend.emails.send({
      from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });
    if (error) {
      log.error("email_failed", { error: error.message, to: payload.to });
      return { ok: false };
    }
    log.info("email_sent", { to: payload.to, id: data?.id });
    return { ok: true, id: data?.id };
  } catch (err) {
    log.error("email_failed", { error: (err as Error).message, to: payload.to });
    return { ok: false };
  }
}
