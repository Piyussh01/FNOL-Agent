import { z } from "zod";
import { stub } from "./_stub";

const Input = z.object({
  claim_id: z.string().uuid(),
  pickup_lat: z.number(),
  pickup_lng: z.number(),
  dropoff_preference: z.enum(["nearest_shop", "home", "specified"]).optional(),
});

export default stub<
  z.infer<typeof Input>,
  { vendor: string; eta_minutes: number; confirmation_code: string; dispatch_phone: string }
>("dispatch_tow", "Dispatch a mock tow partner.", Input);
