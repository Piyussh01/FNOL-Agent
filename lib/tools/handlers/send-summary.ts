import { z } from "zod";
import { registerTool } from "../registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSms } from "@/lib/notifications/twilio";
import { sendEmail } from "@/lib/notifications/resend";
import { logToolEvent } from "./_events";

const Input = z.object({
  claim_id: z.string().uuid(),
  channels: z.array(z.enum(["sms", "email"])).min(1),
});

type Output = { sent: boolean; channels_used: string[] };

export default registerTool<z.infer<typeof Input>, Output>({
  name: "send_summary",
  description: "Send post-submission summary.",
  inputSchema: Input,
  async run(input, ctx) {
    const admin = createAdminClient();
    const [{ data: claim }, { data: user }, { data: tasks }] = await Promise.all([
      admin
        .from("claims")
        .select("claim_number, kind, estimate_range_low_usd, estimate_range_high_usd")
        .eq("id", input.claim_id)
        .single(),
      admin
        .from("users")
        .select("phone, email, name, preferred_lang")
        .eq("id", ctx.caller.user_id)
        .single(),
      admin
        .from("tasks")
        .select("kind, partner_ref, scheduled_for, payload_json")
        .eq("claim_id", input.claim_id),
    ]);

    if (!claim) throw new Error("claim_not_found");
    const isEs = user?.preferred_lang === "es";

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const summaryUrl = `${appUrl}/claim/${input.claim_id}/summary`;

    const estimateLine =
      claim.estimate_range_low_usd && claim.estimate_range_high_usd
        ? isEs
          ? `Estimación: $${claim.estimate_range_low_usd.toLocaleString()} – $${claim.estimate_range_high_usd.toLocaleString()} (sujeto a revisión del ajustador)`
          : `Estimate: $${claim.estimate_range_low_usd.toLocaleString()}–$${claim.estimate_range_high_usd.toLocaleString()} (subject to adjuster review)`
        : "";

    const bookings = (tasks ?? [])
      .map((t) =>
        isEs
          ? `• ${t.kind} · confirmación ${t.partner_ref}`
          : `• ${t.kind} · confirmation ${t.partner_ref}`,
      )
      .join("\n");

    const smsBody = isEs
      ? `Acme: tu reclamo ${claim.claim_number} fue enviado. ${estimateLine}\nResumen: ${summaryUrl}`
      : `Acme: claim ${claim.claim_number} submitted. ${estimateLine}\nSummary: ${summaryUrl}`;

    const emailHtml = `
<p>${isEs ? "Hola" : "Hi"} ${user?.name ?? ""},</p>
<p>${isEs ? "Tu reclamo está enviado." : "Your claim is submitted."}</p>
<ul>
  <li><strong>${isEs ? "Número" : "Claim"}:</strong> ${claim.claim_number}</li>
  <li><strong>${isEs ? "Tipo" : "Kind"}:</strong> ${claim.kind}</li>
  ${estimateLine ? `<li>${estimateLine}</li>` : ""}
</ul>
<p>${isEs ? "Servicios reservados:" : "Services booked:"}</p>
<pre>${bookings}</pre>
<p>${isEs ? "Un ajustador te contactará en 24–48 horas hábiles." : "An adjuster will reach out within 24–48 business hours."}</p>
<p><a href="${summaryUrl}">${isEs ? "Ver resumen completo" : "View full summary"}</a></p>
    `.trim();

    const used: string[] = [];
    if (input.channels.includes("sms") && user?.phone) {
      const r = await sendSms({ to: user.phone, body: smsBody });
      if (r.ok) used.push("sms");
    }
    if (input.channels.includes("email") && user?.email) {
      const r = await sendEmail({
        to: user.email,
        subject: isEs
          ? `Reclamo Acme ${claim.claim_number} enviado`
          : `Acme claim ${claim.claim_number} submitted`,
        html: emailHtml,
        text: `${smsBody}\n\n${bookings}`,
      });
      if (r.ok) used.push("email");
    }

    await logToolEvent("send_summary", { claim_id: input.claim_id }, { used });
    return { sent: used.length > 0, channels_used: used };
  },
});
