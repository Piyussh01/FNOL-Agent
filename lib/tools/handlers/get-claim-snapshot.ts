import { z } from "zod";
import { registerTool } from "../registry";
import { getClaimSnapshot, type ClaimSnapshot } from "@/lib/claims/snapshot";
import { logToolEvent } from "./_events";

// Read-only "what do we already know about this claim" lookup. Sam can call
// this whenever it's uncertain about prior facts (or after a longer pause)
// to refresh working memory. Every other tool result already echoes the
// snapshot via the dispatcher, so calling this should be rare in practice.

const Input = z.object({
  claim_id: z.string().uuid().optional(),
});

export default registerTool<z.infer<typeof Input>, ClaimSnapshot>({
  name: "get_claim_snapshot",
  description:
    "Return the full known state of this claim (facts on file, parties, bookings, photos, estimate, what's still needed, recent dialogue). Read this BEFORE asking the user for anything you might already have on file. Never read field names aloud — use human_summary or paraphrase.",
  inputSchema: Input,
  async run(input, ctx) {
    const claimId = input.claim_id ?? ctx.claim.id;
    const snap = await getClaimSnapshot(claimId);
    await logToolEvent("get_claim_snapshot", { claim_id: claimId }, {
      stage: snap.stage,
      still_needed: snap.still_needed.map((s) => s.objective),
    });
    return snap;
  },
});
