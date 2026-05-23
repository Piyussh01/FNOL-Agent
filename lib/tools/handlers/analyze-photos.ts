import { z } from "zod";
import { stub } from "./_stub";

const Input = z.object({ claim_id: z.string().uuid() });

export default stub<
  z.infer<typeof Input>,
  {
    analyzed_count: number;
    synthesis: string;
    severity: string;
    repair_range_usd: [number, number];
    parts_or_areas: string[];
    drivable_likely?: boolean;
  }
>("analyze_photos", "Synthesize Claude Vision analyses.", Input);
