import { z } from "zod";

export const VisionResultSchema = z.object({
  severity: z.enum(["cosmetic", "moderate", "severe", "total_loss"]),
  parts_affected: z.array(z.string()),
  estimated_repair_range_usd: z.tuple([
    z.number().int().nonnegative(),
    z.number().int().nonnegative(),
  ]),
  drivable_likely: z.boolean().nullable(),
  habitable_likely: z.boolean().nullable(),
  notes: z.string().min(1),
});

export type VisionResult = z.infer<typeof VisionResultSchema>;

export function emptyVisionResult(notes: string): VisionResult {
  return {
    severity: "cosmetic",
    parts_affected: [],
    estimated_repair_range_usd: [0, 0],
    drivable_likely: null,
    habitable_likely: null,
    notes,
  };
}
