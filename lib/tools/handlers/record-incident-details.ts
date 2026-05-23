import { z } from "zod";
import { registerTool } from "../registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateDetails } from "@/lib/claims/details-schema";
import { advanceClaim } from "@/lib/claims/advance";
import { logToolEvent } from "./_events";

const Input = z.object({
  claim_id: z.string().uuid(),
  incident_at: z.string(),
  location: z
    .object({
      lat: z.number().optional(),
      lng: z.number().optional(),
      label: z.string(),
    })
    .optional(),
  description: z.string(),
  details: z.record(z.unknown()),
});

type Output = { ok: true; stage: string };

export default registerTool<z.infer<typeof Input>, Output>({
  name: "record_incident_details",
  description: "Persist incident facts to the claim.",
  inputSchema: Input,
  async run(input, ctx) {
    const admin = createAdminClient();

    // Per-kind schema validation.
    const result = validateDetails(ctx.claim.kind, input.details);
    if (!result.success) {
      throw new Error(
        `details_validation_failed: ${result.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}`,
      );
    }

    // Merge with any prior details_json — calls can be incremental.
    const { data: existing } = await admin
      .from("claims")
      .select("details_json")
      .eq("id", input.claim_id)
      .single();

    const merged = {
      ...((existing?.details_json as Record<string, unknown>) ?? {}),
      ...result.data,
      description: input.description,
    };

    const update: Record<string, unknown> = {
      incident_at: input.incident_at,
      details_json: merged,
    };
    if (input.location?.label) update.location_label = input.location.label;
    if (
      typeof input.location?.lat === "number" &&
      typeof input.location?.lng === "number"
    ) {
      update.location = `SRID=4326;POINT(${input.location.lng} ${input.location.lat})`;
    }

    await admin.from("claims").update(update).eq("id", input.claim_id);

    // Also record a message so the conversation transcript reflects it.
    await admin.from("messages").insert({
      claim_id: input.claim_id,
      role: "tool",
      channel: "video",
      content: input.description,
      tool_calls_json: { tool: "record_incident_details", details: merged },
    });

    await logToolEvent("record_incident_details", { claim_id: input.claim_id }, {
      kind: ctx.claim.kind,
    });

    const stage = await advanceClaim(input.claim_id);
    return { ok: true, stage };
  },
});
