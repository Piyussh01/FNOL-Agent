import { z } from "zod";
import { stub } from "./_stub";

const Input = z.object({
  claim_id: z.string().uuid(),
  pickup_lat: z.number(),
  pickup_lng: z.number(),
  start_date: z.string(),
  vehicle_class: z.enum(["economy", "midsize", "suv"]),
});

export default stub<
  z.infer<typeof Input>,
  {
    vendor: string;
    location: string;
    confirmation_code: string;
    daily_rate_usd: number;
    covered_days: number;
  }
>("book_rental", "Book a mock rental car.", Input);
