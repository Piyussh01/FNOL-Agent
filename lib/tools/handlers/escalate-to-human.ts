import { z } from "zod";
import { stub } from "./_stub";

const Input = z.object({
  claim_id: z.string().uuid(),
  reason: z.string(),
  urgency: z.enum(["low", "medium", "high"]),
});

export default stub<
  z.infer<typeof Input>,
  { ticket_id: string; scheduled_callback_at: string }
>("escalate_to_human", "Hand off to a human supervisor.", Input);
