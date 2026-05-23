import { z } from "zod";
import { registerTool } from "../registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { logToolEvent } from "./_events";

const Input = z.object({
  claim_id: z.string().uuid(),
  party_type: z.enum(["other_driver", "witness", "passenger", "third_party"]),
  name: z.string().min(1),
  contact: z.string().optional(),
  insurance: z
    .object({
      carrier: z.string().optional(),
      policy_number: z.string().optional(),
    })
    .optional(),
});

type Output = { party_id: string };

export default registerTool<z.infer<typeof Input>, Output>({
  name: "add_party",
  description: "Record another driver, witness, passenger, or third party.",
  inputSchema: Input,
  async run(input, ctx) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("claim_parties")
      .insert({
        claim_id: input.claim_id,
        party_type: input.party_type,
        name: input.name,
        contact: input.contact ?? null,
        insurance_json: input.insurance ?? null,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error("party_insert_failed");

    await logToolEvent("add_party", { claim_id: input.claim_id }, {
      party_type: input.party_type,
    });

    return { party_id: data.id };
  },
});
