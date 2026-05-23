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

  it("registers exactly 18 tools", () => {
    expect(listTools()).toHaveLength(18);
  });
});
