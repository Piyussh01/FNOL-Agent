import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Smoke test: landing page source must include the "File a claim" CTA + the
// data-testid Playwright uses. This is a cheap source-level check so M0 can
// pass before Playwright is wired up properly in M11.
describe("landing page", () => {
  const src = readFileSync(
    join(process.cwd(), "app", "page.tsx"),
    "utf-8",
  );

  it('renders the "File a claim" CTA', () => {
    expect(src).toContain("File a claim");
  });

  it("links the CTA to /claim/new", () => {
    expect(src).toMatch(/href=["']\/claim\/new["']/);
  });

  it("includes the Playwright test id", () => {
    expect(src).toContain('data-testid="file-claim-cta"');
  });
});
