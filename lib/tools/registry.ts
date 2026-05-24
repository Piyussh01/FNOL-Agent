import { z } from "zod";
import type { ToolJwtClaims } from "@/lib/auth/tool-jwt";

// A tool handler:
//  1. Validates input via Zod.
//  2. Receives an *already-authenticated* caller context (the gateway verifies
//     the JWT and looks up the claim before dispatching here).
//  3. Performs business logic using the service-role admin client.
//  4. Writes an `events` row recording the tool_call.
//  5. Returns a JSON-serializable result.

export type ToolContext = {
  caller: ToolJwtClaims;
  claim: { id: string; user_id: string; kind: "auto" | "home" | "renters"; stage: string };
};

export type ToolHandler<Input, Output> = {
  name: string;
  description: string;
  inputSchema: z.ZodType<Input>;
  run: (input: Input, ctx: ToolContext) => Promise<Output>;
  // If true, the handler authorizes itself (skip claim ownership check).
  // Used for `verify_identity` which runs before a claim exists.
  preAuth?: boolean;
};

const handlers = new Map<string, ToolHandler<unknown, unknown>>();

export function registerTool<I, O>(handler: ToolHandler<I, O>) {
  handlers.set(handler.name, handler as ToolHandler<unknown, unknown>);
  return handler;
}

export function getTool(name: string): ToolHandler<unknown, unknown> | undefined {
  return handlers.get(name);
}

export function listTools(): ToolHandler<unknown, unknown>[] {
  return Array.from(handlers.values());
}

// Tools register themselves on import via this single barrel.
export async function loadAllTools() {
  await Promise.all([
    import("./handlers/verify-identity"),
    import("./handlers/get-policy-details"),
    import("./handlers/validate-coverage"),
    import("./handlers/start-claim"),
    import("./handlers/record-incident-details"),
    import("./handlers/add-party"),
    import("./handlers/request-photo-upload"),
    import("./handlers/analyze-photos"),
    import("./handlers/dispatch-tow"),
    import("./handlers/book-rental"),
    import("./handlers/find-nearby-repair-shops"),
    import("./handlers/schedule-adjuster-callback"),
    import("./handlers/estimate-claim-value"),
    import("./handlers/submit-claim"),
    import("./handlers/send-summary"),
    import("./handlers/check-claim-status"),
    import("./handlers/escalate-to-human"),
    import("./handlers/file-emergency"),
    import("./handlers/get-claim-snapshot"),
  ]);
}
