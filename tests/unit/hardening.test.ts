import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Hardening guardrails: structural assertions that prevent regressions.

describe("hardening — RLS coverage", () => {
  const rlsSql = readFileSync(
    join(process.cwd(), "supabase", "migrations", "0002_rls.sql"),
    "utf-8",
  );
  const initSql = readFileSync(
    join(process.cwd(), "supabase", "migrations", "0001_init.sql"),
    "utf-8",
  );

  it("every CREATE TABLE has a corresponding ENABLE RLS", () => {
    const created = Array.from(initSql.matchAll(/create table (\w+)/gi)).map(
      (m) => m[1].toLowerCase(),
    );
    for (const t of created) {
      const re = new RegExp(`alter table\\s+${t}\\s+enable row level security`, "i");
      expect(rlsSql, `RLS missing on ${t}`).toMatch(re);
    }
  });
});

describe("hardening — no secrets committed", () => {
  it(".env.example does not embed any real-looking secret material", () => {
    const env = readFileSync(join(process.cwd(), ".env.example"), "utf-8");
    // Acceptable: blank values + the TOOL_JWT_SECRET hint.
    expect(env).not.toMatch(/sk-[A-Za-z0-9]{20,}/);
    expect(env).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}\./);
    expect(env).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY=ey/);
  });

  it("repo .gitignore covers .env.local family", () => {
    const ig = readFileSync(join(process.cwd(), ".gitignore"), "utf-8");
    expect(ig).toMatch(/\.env\*\.local/);
  });
});

describe("hardening — every tool handler exists", () => {
  it("18 handler files under lib/tools/handlers", () => {
    const dir = join(process.cwd(), "lib", "tools", "handlers");
    const files = readdirSync(dir).filter(
      (f) => f.endsWith(".ts") && !f.startsWith("_"),
    );
    // 18 named tools + start-claim is in the count
    expect(files.length).toBeGreaterThanOrEqual(18);
  });
});

describe("hardening — middleware is non-trivial", () => {
  it("middleware applies rate-limit logic", () => {
    const src = readFileSync(join(process.cwd(), "middleware.ts"), "utf-8");
    expect(src).toMatch(/rate_limited/);
    expect(src).toMatch(/ratelimit/);
  });
});

describe("hardening — webhook verifier exists", () => {
  it("verifyTavusSignature uses timingSafeEqual", () => {
    const src = readFileSync(
      join(process.cwd(), "lib", "tavus", "webhook-verify.ts"),
      "utf-8",
    );
    expect(src).toMatch(/timingSafeEqual/);
  });
});
