import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("schema migration 0001_init.sql", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase", "migrations", "0001_init.sql"),
    "utf-8",
  );

  it("enables postgis + pgcrypto", () => {
    expect(sql).toMatch(/create extension if not exists postgis/);
    expect(sql).toMatch(/create extension if not exists pgcrypto/);
  });

  it("defines all required enums", () => {
    for (const t of [
      "claim_kind",
      "claim_stage",
      "session_modality",
      "message_role",
      "task_kind",
      "task_status",
    ]) {
      expect(sql).toMatch(new RegExp(`create type ${t} as enum`));
    }
  });

  it("claims.claim_number is generated with CL- prefix via trigger", () => {
    expect(sql).toMatch(/set_claim_number/);
    expect(sql).toMatch(/'CL-' \|\|/);
    expect(sql).toMatch(/claims_set_claim_number/);
  });

  it("uses PostGIS geography(point,4326) for spatial columns", () => {
    expect(sql.match(/geography\(point, 4326\)/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("has updated_at trigger on claims", () => {
    expect(sql).toMatch(/create trigger claims_set_updated_at/);
  });

  it("logs stage changes via trigger", () => {
    expect(sql).toMatch(/create trigger claims_log_stage_change/);
    expect(sql).toMatch(/'stage_change'/);
  });

  it("auto-creates users row on new auth.users", () => {
    expect(sql).toMatch(/handle_new_auth_user/);
    expect(sql).toMatch(/on_auth_user_created/);
  });
});
