import { z } from "zod";
import { registerTool } from "../registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notifications/resend";
import { mintToolJwt } from "@/lib/auth/tool-jwt";
import { logToolEvent } from "./_events";

const Input = z.object({
  claim_id: z.string().uuid(),
  photo_kinds: z.array(z.string()).min(1),
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
  description: "Generate signed upload URLs and email the caller a link.",
  inputSchema: Input,
  async run(input, ctx) {
    const admin = createAdminClient();

    // Ensure bucket exists. Idempotent best-effort; ignore "already exists".
    try {
      await admin.storage.createBucket(BUCKET, { public: false });
    } catch {
      // ignored
    }

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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const photoToken = await mintToolJwt(
      { claim_id: ctx.claim.id, user_id: ctx.caller.user_id, session_id: ctx.caller.session_id },
      60 * 60,
    );
    const link = `${appUrl}/claim/${ctx.claim.id}/photos?token=${encodeURIComponent(photoToken)}`;

    const { data: user } = await admin
      .from("users")
      .select("email, preferred_lang")
      .eq("id", ctx.caller.user_id)
      .single();

    const lang = user?.preferred_lang === "es" ? "es" : "en";
    const body =
      lang === "es"
        ? `Acme: tu agente Sam te pide unas fotos del daño. Abre este enlace para tomarlas: ${link} (válido 1 hora).`
        : `Acme: Sam asked for a few photos of the damage. Open this link to take them: ${link} (good for 1 hour).`;

    let linkSent = false;
    if (user?.email) {
      const r = await sendEmail({
        to: user.email,
        subject: lang === "es" ? "Fotos para tu reclamo Acme" : "Photos for your Acme claim",
        html: `<p>${body}</p><p><a href="${link}">${link}</a></p>`,
        text: `${body}\n\n${link}`,
      });
      linkSent = r.ok;
    }

    await logToolEvent("request_photo_upload", { claim_id: ctx.claim.id }, {
      photo_kinds: input.photo_kinds,
      link_sent: linkSent,
    });

    return { upload_urls: urls, link_sent: linkSent };
  },
});
