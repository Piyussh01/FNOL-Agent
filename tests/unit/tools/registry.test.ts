import { describe, expect, it, beforeAll } from "vitest";
import { loadAllTools, listTools, getTool } from "@/lib/tools/registry";
import { tavusTools } from "@/lib/tavus/tools-schema";

beforeAll(async () => {
  await loadAllTools();
});

describe("tool registry parity with Tavus schema", () => {
  it("every Tavus-declared tool has a registered handler", () => {
    for (const t of tavusTools) {
      const name = t.function.name;
      const handler = getTool(name);
      expect(handler, `missing handler: ${name}`).toBeDefined();
    }
  });

  it("every registered handler exists in the Tavus schema", () => {
    const tavusNames = new Set(tavusTools.map((t) => t.function.name));
    for (const h of listTools()) {
      expect(tavusNames.has(h.name), `extra handler: ${h.name}`).toBe(true);
    }
  });

  it("registers the full tool set", () => {
    // 18 original action tools + 1 read-only working-memory tool
    // (get_claim_snapshot) for agentic recall.
    expect(listTools()).toHaveLength(19);
  });
});
