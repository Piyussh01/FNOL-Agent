import { z } from "zod";
import { stub } from "./_stub";

const Input = z.object({
  claim_id: z.string().uuid(),
  channels: z.array(z.enum(["sms", "email"])).min(1),
});

export default stub<
  z.infer<typeof Input>,
  { sent: boolean; channels_used: string[] }
>("send_summary", "Send the post-submission summary.", Input);
