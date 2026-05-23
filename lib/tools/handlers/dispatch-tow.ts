import { z } from "zod";
import { registerTool } from "../registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { mockTowProvider } from "@/lib/partners/tow";
import { sendSms } from "@/lib/notifications/twilio";
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

    // Send SMS confirmation if we have the user's phone.
    const { data: user } = await admin
      .from("users")
      .select("phone, preferred_lang")
      .eq("id", ctx.caller.user_id)
      .single();
    if (user?.phone) {
      const isEs = user.preferred_lang === "es";
      await sendSms({
        to: user.phone,
        body: isEs
          ? `Acme: grúa confirmada con ${result.vendor}, ETA ${result.eta_minutes} min. Confirmación ${result.confirmation_code}. Llamada de despacho: ${result.dispatch_phone}.`
          : `Acme: tow confirmed with ${result.vendor}, ETA ${result.eta_minutes} min. Confirmation ${result.confirmation_code}. Dispatch: ${result.dispatch_phone}.`,
      });
    }

    await logToolEvent("dispatch_tow", { claim_id: input.claim_id }, result);
    await advanceClaim(input.claim_id);
    return result;
  },
});
