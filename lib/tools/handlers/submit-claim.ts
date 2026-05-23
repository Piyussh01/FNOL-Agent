import { z } from "zod";
import { stub } from "./_stub";

const Input = z.object({
  claim_id: z.string().uuid(),
  user_confirmed: z.boolean(),
});

export default stub<
  z.infer<typeof Input>,
  { submitted: boolean; claim_number: string; expected_adjuster_contact_by: string }
>("submit_claim", "Submit the claim after user confirmation.", Input);
