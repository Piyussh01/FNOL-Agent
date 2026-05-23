import { z } from "zod";
import { stub } from "./_stub";

const Input = z.object({
  claim_id: z.string().uuid(),
  preferred_window_start: z.string(),
  preferred_window_end: z.string(),
  channel: z.enum(["phone", "video"]),
});

export default stub<
  z.infer<typeof Input>,
  { adjuster_name: string; scheduled_for: string; confirmation_code: string }
>("schedule_adjuster_callback", "Book a mock adjuster callback.", Input);
