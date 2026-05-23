// Adapter: turn our internal tool registry into Anthropic's tool-use schema.
// Lets chat mode and video mode share the same Zod schemas.

import type Anthropic from "@anthropic-ai/sdk";
import { listTools } from "./registry";
import { tavusTools } from "@/lib/tavus/tools-schema";

type AnthropicTool = Anthropic.Messages.Tool;

// We reuse the JSON schemas from tavusTools (single source of truth) and
// pair them by name with our registered handlers.
export function anthropicToolsFromRegistry(): AnthropicTool[] {
  const byName = new Map(listTools().map((h) => [h.name, h]));
  const tools: AnthropicTool[] = [];
  for (const t of tavusTools) {
    const name = t.function.name;
    if (!byName.has(name)) continue;
    tools.push({
      name,
      description: t.function.description,
      input_schema: {
        type: "object",
        properties: t.function.parameters.properties as Record<string, unknown>,
        required: t.function.parameters.required,
      } as AnthropicTool["input_schema"],
    });
  }
  return tools;
}
