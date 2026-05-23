import { z } from "zod";
import { registerTool } from "../registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { mockTowProvider } from "@/lib/partners/tow";
import { sendEmail } from "@/lib/notifications/resend";
import { logToolEvent } from "./_events";
import { advanceClaim } from "@/lib/claims/advance";

const Input = z.object({
  claim_id: z.string().uuid(),
  pickup_lat: z.number(),
  pickup_lng: z.number(),
  dropoff_preference: z.enum(["nearest_shop", "home", "specified"]).optional(),
});

type Output = {
  vendor: string;
  eta_minutes: number;
  confirmation_code: string;
  dispatch_phone: string;
};

export default registerTool<z.infer<typeof Input>, Output>({
  name: "dispatch_tow",
  description: "Dispatch a tow truck.",
  inputSchema: Input,
  async run(input, ctx) {
    const admin = createAdminClient();
    const result = await mockTowProvider.dispatch(input);

    await admin.from("tasks").insert({
      claim_id: input.claim_id,
      kind: "tow",
      status: "scheduled",
      partner_ref: result.confirmation_code,
      scheduled_for: new Date(Date.now() + result.eta_minutes * 60 * 1000).toISOString(),
      payload_json: {
        vendor: result.vendor,
        pickup: { lat: input.pickup_lat, lng: input.pickup_lng },
        dropoff_preference: input.dropoff_preference ?? "nearest_shop",
        dispatch_phone: result.dispatch_phone,
      },
    });

    // Email confirmation to the caller.
    const { data: user } = await admin
      .from("users")
      .select("email, preferred_lang")
      .eq("id", ctx.caller.user_id)
      .single();
    if (user?.email) {
      const isEs = user.preferred_lang === "es";
      const subject = isEs
        ? `Acme: grúa confirmada (${result.confirmation_code})`
        : `Acme: tow confirmed (${result.confirmation_code})`;
      const body = isEs
        ? `Tu grúa está confirmada con ${result.vendor}. ETA ${result.eta_minutes} minutos. Línea de despacho: ${result.dispatch_phone}.`
        : `Your tow is confirmed with ${result.vendor}. ETA ${result.eta_minutes} minutes. Dispatch line: ${result.dispatch_phone}.`;
      await sendEmail({
        to: user.email,
        subject,
        html: `<p>${body}</p>`,
        text: body,
      });
    }

    await logToolEvent("dispatch_tow", { claim_id: input.claim_id }, result);
    await advanceClaim(input.claim_id);
    return result;
  },
});
