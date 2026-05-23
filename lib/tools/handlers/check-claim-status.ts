import { z } from "zod";
import { stub } from "./_stub";

const Input = z.object({ claim_id_or_number: z.string() });

export default stub<
  z.infer<typeof Input>,
  { stage: string; status: string; last_event_at: string; next_step_description: string }
>("check_claim_status", "Look up current claim status.", Input);
