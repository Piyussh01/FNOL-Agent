import type { z } from "zod";
import { registerTool, type ToolHandler } from "../registry";

// Used by modules M5+ that haven't yet replaced a stub with the real handler.
// The stub registers under the right name and returns not_implemented so
// dispatch never silently 404s.
export function stub<I, O>(
  name: string,
  description: string,
  inputSchema: z.ZodType<I>,
): ToolHandler<I, O> {
  return registerTool<I, O>({
    name,
    description,
    inputSchema,
    async run() {
      throw new Error(`tool ${name} is not implemented yet`);
    },
  });
}
