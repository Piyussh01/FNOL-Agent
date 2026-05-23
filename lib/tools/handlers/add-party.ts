import { z } from "zod";
import { stub } from "./_stub";

const Input = z.object({
  claim_id: z.string().uuid(),
  party_type: z.enum(["other_driver", "witness", "passenger", "third_party"]),
  name: z.string(),
  contact: z.string().optional(),
  insurance: z
    .object({ carrier: z.string().optional(), policy_number: z.string().optional() })
    .optional(),
});

export default stub<z.infer<typeof Input>, { party_id: string }>(
  "add_party",
  "Record another driver, witness, passenger, or third party.",
  Input,
);
