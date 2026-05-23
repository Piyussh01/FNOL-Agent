import { z } from "zod";
import { registerTool } from "../registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { mockRentalProvider } from "@/lib/partners/rental";
import { logToolEvent } from "./_events";
import { advanceClaim } from "@/lib/claims/advance";

const Input = z.object({
  claim_id: z.string().uuid(),
  pickup_lat: z.number(),
  pickup_lng: z.number(),
  start_date: z.string(),
  vehicle_class: z.enum(["economy", "midsize", "suv"]),
});

type Output = {
  vendor: string;
  location: string;
  confirmation_code: string;
  daily_rate_usd: number;
  covered_days: number;
};

export default registerTool<z.infer<typeof Input>, Output>({
  name: "book_rental",
  description: "Book a rental car.",
  inputSchema: Input,
  async run(input, ctx) {
    const result = await mockRentalProvider.book(input);
    const admin = createAdminClient();
    await admin.from("tasks").insert({
      claim_id: input.claim_id,
      kind: "rental",
      status: "scheduled",
      partner_ref: result.confirmation_code,
      scheduled_for: new Date(input.start_date).toISOString(),
      payload_json: result as unknown as object,
    });
    await logToolEvent("book_rental", { claim_id: input.claim_id }, result);
    await advanceClaim(input.claim_id);
    return result;
  },
});
