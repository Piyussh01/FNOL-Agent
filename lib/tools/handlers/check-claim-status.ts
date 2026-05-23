import { z } from "zod";
import { registerTool } from "../registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { logToolEvent } from "./_events";

const Input = z.object({ claim_id_or_number: z.string().min(1) });

type Output = {
  stage: string;
  status: string;
  last_event_at: string;
  next_step_description: string;
};

const NEXT_STEP: Record<string, string> = {
  greeting: "Confirm your identity to begin.",
  identifying: "Sam needs to verify your name and policy.",
  verifying: "Verifying policy coverage.",
  intake: "Gathering the facts of the incident.",
  coverage_check: "Confirming the peril is covered.",
  photos: "Waiting on photos of the damage.",
  assessing: "Reviewing the photos.",
  booking: "Booking tow, rental, or adjuster as needed.",
  reviewing: "Reviewing the summary before submission.",
  submitted: "An adjuster will reach out within 24-48 business hours.",
  escalated: "A human supervisor will follow up.",
  closed: "This claim is closed.",
};

export default registerTool<z.infer<typeof Input>, Output>({
  name: "check_claim_status",
  description: "Look up a claim's current stage and next step.",
  inputSchema: Input,
  async run(input, ctx) {
    const admin = createAdminClient();
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        input.claim_id_or_number,
      );
    const query = admin
      .from("claims")
      .select("id, stage, status, updated_at, user_id");
    const { data: claim } = isUuid
      ? await query.eq("id", input.claim_id_or_number).maybeSingle()
      : await query.eq("claim_number", input.claim_id_or_number).maybeSingle();

    if (!claim) throw new Error("claim_not_found");
    if (claim.user_id !== ctx.caller.user_id) throw new Error("unauthorized");

    await logToolEvent("check_claim_status", { claim_id: claim.id }, {
      stage: claim.stage,
    });

    return {
      stage: claim.stage,
      status: claim.status,
      last_event_at: claim.updated_at,
      next_step_description: NEXT_STEP[claim.stage] ?? "—",
    };
  },
});
