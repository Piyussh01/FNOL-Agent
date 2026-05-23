import { z } from "zod";
import { stub } from "./_stub";

const Input = z.object({
  policy_id: z.string().uuid(),
  kind: z.enum(["auto", "home", "renters"]),
  incident_at: z.string().optional(),
});
type Output = { claim_id: string; claim_number: string };

export default stub<z.infer<typeof Input>, Output>(
  "start_claim",
  "Open a new claim row.",
  Input,
);
