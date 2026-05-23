import { z } from "zod";
import { stub } from "./_stub";

const Input = z.object({
  claim_id: z.string().uuid(),
  incident_at: z.string(),
  location: z
    .object({ lat: z.number().optional(), lng: z.number().optional(), label: z.string() })
    .optional(),
  description: z.string(),
  details: z.record(z.unknown()),
});

export default stub<z.infer<typeof Input>, { ok: true; stage: string }>(
  "record_incident_details",
  "Persist incident facts to the claim.",
  Input,
);
