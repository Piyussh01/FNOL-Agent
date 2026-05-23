import { z } from "zod";
import { stub } from "./_stub";

const Input = z.object({ claim_id: z.string().uuid() });

export default stub<
  z.infer<typeof Input>,
  { low_usd: number; high_usd: number; basis: string; disclaimer: string }
>("estimate_claim_value", "Derive a low/high payout estimate range.", Input);
