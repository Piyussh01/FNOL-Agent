import { z } from "zod";
import { registerTool } from "../registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { logToolEvent } from "./_events";

const Input = z.object({
  claim_id: z.string().uuid(),
  situation: z.string().min(1),
});

type Output = {
  message: string;
  emergency_resources: string[];
};

const RESOURCES = [
  "911 — emergencies, injuries, active fires",
  "Poison Control: 1-800-222-1222",
  "Roadside emergencies: stay in vehicle, hazards on, call 911 if blocking traffic",
  "Gas leak: leave the building immediately, call 911 from a safe distance, do NOT use light switches",
];

export default registerTool<z.infer<typeof Input>, Output>({
  name: "file_emergency",
  description: "Surface emergency resources and create an emergency task.",
  inputSchema: Input,
  async run(input, ctx) {
    const admin = createAdminClient();

    await admin.from("tasks").insert({
      claim_id: input.claim_id,
      kind: "emergency",
      status: "pending",
      partner_ref: `EM-${Date.now().toString(36).toUpperCase()}`,
      payload_json: { situation: input.situation },
    });

    await admin.from("events").insert({
      claim_id: input.claim_id,
      type: "emergency_flagged",
      payload_json: { situation: input.situation },
    });

    await logToolEvent("file_emergency", { claim_id: input.claim_id }, {
      situation: input.situation,
    });

    return {
      message:
        "If anyone is hurt, please call 911 right now. I'll stay with you and we can resume after.",
      emergency_resources: RESOURCES,
    };
  },
});
