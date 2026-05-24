import { describe, expect, it, vi } from "vitest";

const POLICY_ID = "00000000-0000-0000-0000-000000000001";

const policy = {
  holder_user_id: "user-1",
  kind: "auto",
  coverage_json: {
    deductibles: { collision: 500, comprehensive: 250 },
    limits: { liability_property: 100000 },
    perils: { collision: true, theft: true, fire: false },
  },
};

// Tabular mock so we can return different rows depending on which table
// the handler queries (claims vs policies). The handler resolves policy_id
// from the authenticated claim, then fetches the full policy.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      if (table === "claims") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { policy_id: POLICY_ID } }),
            }),
          }),
          update: () => ({
            eq: () => ({ is: async () => ({ data: null }) }),
          }),
        };
      }
      if (table === "policies") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: policy }),
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: { id: POLICY_ID } }),
                }),
              }),
            }),
          }),
        };
      }
      // events / messages / anything else — no-op.
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null }) }),
        }),
        insert: async () => ({ data: null }),
      };
    },
  }),
}));

const mod = await import("@/lib/tools/handlers/validate-coverage");

const ctx = {
  caller: { claim_id: "c", user_id: "user-1" },
  claim: {
    id: "c",
    user_id: "user-1",
    kind: "auto" as const,
    stage: "intake",
  },
};

describe("validate_coverage", () => {
  it("confirms a covered peril with the right deductible", async () => {
    const res = await mod.default.run({ peril: "collision" }, ctx);
    expect(res.covered).toBe(true);
    expect(res.deductible_usd).toBe(500);
    expect(res.notes).toMatch(/Subject to adjuster review/);
  });

  it("flags an uncovered peril", async () => {
    const res = await mod.default.run({ peril: "fire" }, ctx);
    expect(res.covered).toBe(false);
    expect(res.notes).toMatch(/not listed as a covered peril/);
  });

  it("resolves the policy from the claim — caller doesn't need to pass policy_id or claim_kind", async () => {
    const res = await mod.default.run({ peril: "theft" }, ctx);
    expect(res.covered).toBe(true);
  });
});
