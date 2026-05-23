import { z } from "zod";
import { registerTool } from "../registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { mockAdjusterScheduler } from "@/lib/partners/adjuster";
import { logToolEvent } from "./_events";
import { advanceClaim } from "@/lib/claims/advance";

const Input = z.object({
  claim_id: z.string().uuid(),
  preferred_window_start: z.string(),
  preferred_window_end: z.string(),
  channel: z.enum(["phone", "video"]),
});

type Output = {
  adjuster_name: string;
  scheduled_for: string;
  confirmation_code: string;
};

export default registerTool<z.infer<typeof Input>, Output>({
  name: "schedule_adjuster_callback",
  description: "Book an adjuster callback.",
  inputSchema: Input,
  async run(input, ctx) {
    const result = await mockAdjusterScheduler.schedule(input);
    const admin = createAdminClient();
    await admin.from("tasks").insert({
      claim_id: input.claim_id,
      kind: "adjuster_callback",
      status: "scheduled",
      partner_ref: result.confirmation_code,
      scheduled_for: result.scheduled_for,
      payload_json: {
        adjuster_name: result.adjuster_name,
        channel: input.channel,
      },
    });
    await logToolEvent("schedule_adjuster_callback", { claim_id: ctx.claim.id }, result);
    await advanceClaim(input.claim_id);
    return result;
  },
});
