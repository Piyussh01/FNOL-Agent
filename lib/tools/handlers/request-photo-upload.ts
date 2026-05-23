import { z } from "zod";
import { registerTool } from "../registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSms } from "@/lib/notifications/twilio";
import { sendEmail } from "@/lib/notifications/resend";
import { mintToolJwt } from "@/lib/auth/tool-jwt";
import { logToolEvent } from "./_events";

const Input = z.object({
  claim_id: z.string().uuid(),
  photo_kinds: z.array(z.string()).min(1),
  send_via: z.enum(["sms", "email", "both"]),
});

type UploadUrl = {
  kind: string;
  signed_url: string;
  storage_path: string;
  expires_at: string;
};

type Output = {
  upload_urls: UploadUrl[];
  link_sent: boolean;
};

const BUCKET = "claim-photos";

export default registerTool<z.infer<typeof Input>, Output>({
  name: "request_photo_upload",
  description: "Generate signed upload URLs and notify the caller.",
  inputSchema: Input,
  async run(input, ctx) {
    const admin = createAdminClient();

    // Ensure bucket exists. Idempotent best-effort; ignore "already exists".
    try {
      await admin.storage.createBucket(BUCKET, { public: false });
    } catch {
      // ignored
    }

    // Generate one signed upload URL per photo kind.
    const urls: UploadUrl[] = [];
    for (const kind of input.photo_kinds) {
      const photoId = crypto.randomUUID();
      const storagePath = `${ctx.claim.id}/${kind}/${photoId}.jpg`;
      const { data, error } = await admin.storage
        .from(BUCKET)
        .createSignedUploadUrl(storagePath);
      if (error || !data) {
        throw new Error(`signed_url_failed: ${error?.message ?? "unknown"}`);
      }
      urls.push({
        kind,
        signed_url: data.signedUrl,
        storage_path: storagePath,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
    }

    // Deep-link to the in-app photo page (which authenticates the user and
    // POSTs the signed URLs back). We pass a short-lived JWT so the link
    // works even if the magic-link session expired.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const photoToken = await mintToolJwt(
      { claim_id: ctx.claim.id, user_id: ctx.caller.user_id, session_id: ctx.caller.session_id },
      60 * 60,
    );
    const link = `${appUrl}/claim/${ctx.claim.id}/photos?token=${encodeURIComponent(photoToken)}`;

    // Look up caller phone + email.
    const { data: user } = await admin
      .from("users")
      .select("phone, email, preferred_lang")
      .eq("id", ctx.caller.user_id)
      .single();

    const lang = user?.preferred_lang === "es" ? "es" : "en";
    const smsBody =
      lang === "es"
        ? `Acme: tu agente Sam te pide unas fotos del daño. Abre este enlace para tomarlas: ${link} (válido 1 hora).`
        : `Acme: Sam asked for a few photos of the damage. Open this link to take them: ${link} (good for 1 hour).`;

    let linkSent = false;
    if ((input.send_via === "sms" || input.send_via === "both") && user?.phone) {
      const r = await sendSms({ to: user.phone, body: smsBody });
      linkSent = linkSent || r.ok;
    }
    if ((input.send_via === "email" || input.send_via === "both") && user?.email) {
      const r = await sendEmail({
        to: user.email,
        subject: lang === "es" ? "Fotos para tu reclamo Acme" : "Photos for your Acme claim",
        html: `<p>${smsBody}</p><p><a href="${link}">${link}</a></p>`,
        text: `${smsBody}\n\n${link}`,
      });
      linkSent = linkSent || r.ok;
    }

    await logToolEvent("request_photo_upload", { claim_id: ctx.claim.id }, {
      photo_kinds: input.photo_kinds,
      send_via: input.send_via,
      link_sent: linkSent,
    });

    return { upload_urls: urls, link_sent: linkSent };
  },
});
