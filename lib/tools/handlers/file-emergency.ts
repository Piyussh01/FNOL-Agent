import { z } from "zod";
import { stub } from "./_stub";

const Input = z.object({
  claim_id: z.string().uuid(),
  situation: z.string(),
});

export default stub<
  z.infer<typeof Input>,
  { message: string; emergency_resources: string[] }
>("file_emergency", "Surface emergency resources.", Input);
