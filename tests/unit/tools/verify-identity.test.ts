import { describe, expect, it, beforeEach, vi } from "vitest";

// Mock @/lib/supabase/admin BEFORE importing the handler.
const insertedEvents: unknown[] = [];

const userRow = { id: "user-1", name: "Maya Rodriguez" };
const policyRow = { id: "pol-1", policy_number: "ACME-AUTO-1001", kind: "auto" };

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => makeStubAdmin(),
}));

function makeStubAdmin() {
  const builder = (table: string) => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => {
          if (table === "users") return { data: userRow };
          if (table === "policies")
            return { data: { holder_user_id: userRow.id } };
          return { data: null };
        },
        lte: () => ({
          gte: async () => ({ data: [policyRow] }),
        }),
      }),
    }),
    insert: async (row: unknown) => {
      if (table === "events") insertedEvents.push(row);
      return { data: null };
    },
  });
  return { from: (t: string) => builder(t) };
}

// Now import the module under test.
const handlerMod = await import("@/lib/tools/handlers/verify-identity");

describe("verify_identity", () => {
  beforeEach(() => {
    insertedEvents.length = 0;
  });

  const ctx = {
    caller: { claim_id: "claim-1", user_id: "user-1" },
    claim: {
      id: "claim-1",
      user_id: "user-1",
      kind: "auto" as const,
      stage: "greeting",
    },
  };

  it("verifies a matching full name", async () => {
    const res = await handlerMod.default.run(
      {
        full_name: "Maya Rodriguez",
        dob_or_last4_ssn: "1234",
      },
      ctx,
    );
    expect(res.verified).toBe(true);
    expect(res.candidate_policies).toEqual([policyRow]);
    expect(insertedEvents.length).toBe(1);
  });

  it("trusts any name the caller provides (session-pinned, name is audit-only)", async () => {
    const res = await handlerMod.default.run(
      { full_name: "Wrong Person", dob_or_last4_ssn: "0000" },
      ctx,
    );
    expect(res.verified).toBe(true);
    expect(res.candidate_policies).toEqual([policyRow]);
  });
});
