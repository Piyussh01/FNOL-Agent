import { describe, expect, it, vi } from "vitest";

const policy = {
  holder_user_id: "user-1",
  kind: "auto",
  coverage_json: {
    deductibles: { collision: 500, comprehensive: 250 },
    limits: { liability_property: 100000 },
    perils: { collision: true, theft: true, fire: false },
  },
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: policy }),
        }),
      }),
      insert: async () => ({ data: null }),
    }),
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
    const res = await mod.default.run(
      { policy_id: "00000000-0000-0000-0000-000000000001", claim_kind: "auto", peril: "collision" },
      ctx,
    );
    expect(res.covered).toBe(true);
    expect(res.deductible_usd).toBe(500);
    expect(res.notes).toMatch(/Subject to adjuster review/);
  });

  it("flags an uncovered peril", async () => {
    const res = await mod.default.run(
      { policy_id: "00000000-0000-0000-0000-000000000001", claim_kind: "auto", peril: "fire" },
      ctx,
    );
    expect(res.covered).toBe(false);
    expect(res.notes).toMatch(/not listed as a covered peril/);
  });
});
