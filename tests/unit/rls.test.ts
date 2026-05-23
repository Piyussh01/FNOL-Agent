import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Contract test for 0002_rls.sql. Asserts every table is enabled for RLS and
// that owner-scoped policies exist. Cheap, runs without a Supabase instance.
// A full integration test (real Postgres + RLS bypass attempts) is part of
// M17's hardening pass.
describe("RLS migration", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase", "migrations", "0002_rls.sql"),
    "utf-8",
  );

  const tables = [
    "users",
    "policies",
    "vehicles",
    "properties",
    "claims",
    "claim_parties",
    "photos",
    "sessions",
    "messages",
    "events",
    "tasks",
    "repair_shops",
  ];

  for (const t of tables) {
    it(`enables RLS on ${t}`, () => {
      const re = new RegExp(`alter table\\s+${t}\\s+enable row level security`, "i");
      expect(sql).toMatch(re);
    });
  }

  it("defines a current_user_id() helper", () => {
    expect(sql).toMatch(/create or replace function public\.current_user_id\(\)/);
    expect(sql).toMatch(/from users where auth_id = auth\.uid\(\)/);
  });

  it("claims are owner-scoped for select", () => {
    expect(sql).toMatch(/policy claims_select_owner/);
    expect(sql).toMatch(/user_id = public\.current_user_id\(\)/);
  });

  it("photos require parent claim ownership for insert", () => {
    expect(sql).toMatch(/policy photos_insert_via_claim/);
  });

  it("events have no select policy for authenticated (service role only reads)", () => {
    expect(sql).not.toMatch(/create policy events_select/);
    expect(sql).toMatch(/policy events_insert_via_claim/);
  });
});
