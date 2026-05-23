import { z } from "zod";

// Per-claim-kind details JSON shape. Validated server-side by
// record_incident_details. The persona collects these fields one at a time
// via tool_calls — never as a JSON blob.

export const AutoDetailsSchema = z.object({
  at_fault: z.enum(["self", "other", "unclear"]).optional(),
  drivable: z.boolean().optional(),
  injuries: z
    .object({
      reported: z.boolean(),
      details: z.string().optional(),
    })
    .optional(),
  police_report_number: z.string().optional(),
  vehicle_id: z.string().uuid().optional(),
  speed_at_impact_mph: z.number().int().min(0).max(200).optional(),
  weather: z.string().optional(),
});

export const HomeDetailsSchema = z.object({
  peril: z.enum([
    "fire",
    "smoke",
    "wind",
    "hail",
    "water_sudden",
    "lightning",
    "theft",
    "vandalism",
    "falling_object",
    "other",
  ]),
  habitable: z.boolean().optional(),
  mitigation_taken: z.string().optional(),
  affected_areas: z.array(z.string()).optional(),
  property_id: z.string().uuid().optional(),
  source_identified: z.string().optional(),
});

export const RentersDetailsSchema = z.object({
  peril: z.enum([
    "fire",
    "smoke",
    "theft",
    "vandalism",
    "water_sudden",
    "other",
  ]),
  habitable: z.boolean().optional(),
  police_report_number: z.string().optional(),
  inventory: z
    .array(
      z.object({
        item: z.string(),
        approx_value_usd: z.number().int().nonnegative(),
        proof: z.string().optional(),
      }),
    )
    .optional(),
});

export type ClaimKind = "auto" | "home" | "renters";

export function schemaFor(kind: ClaimKind) {
  switch (kind) {
    case "auto":
      return AutoDetailsSchema;
    case "home":
      return HomeDetailsSchema;
    case "renters":
      return RentersDetailsSchema;
  }
}

export function validateDetails(kind: ClaimKind, details: unknown) {
  return schemaFor(kind).safeParse(details);
}
