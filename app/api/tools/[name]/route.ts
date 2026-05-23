import { NextResponse, type NextRequest } from "next/server";
import { verifyToolJwt } from "@/lib/auth/tool-jwt";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTool, loadAllTools } from "@/lib/tools/registry";
import { logToolError } from "@/lib/tools/handlers/_events";
import { log } from "@/lib/observability/logger";

export const runtime = "nodejs";

let loaded = false;
async function ensureLoaded() {
  if (!loaded) {
    await loadAllTools();
    loaded = true;
  }
}

function readToken(req: NextRequest, bodyJwt?: string): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  if (bodyJwt) return bodyJwt;
  return null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { name: string } },
) {
  await ensureLoaded();
  const tool = getTool(params.name);
  if (!tool) {
    return NextResponse.json({ error: "unknown_tool" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const tokenFromBody =
    typeof body.tool_jwt === "string" ? (body.tool_jwt as string) : undefined;
  const token = readToken(req, tokenFromBody);
  if (!token) {
    return NextResponse.json({ error: "missing_token" }, { status: 401 });
  }

  let claims;
  try {
    claims = await verifyToolJwt(token);
  } catch (err) {
    log.warn("jwt_verify_failed", { error: (err as Error).message });
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  // Resolve claim, verify caller owns it (defense in depth — service role bypasses RLS).
  const admin = createAdminClient();
  const { data: claim } = await admin
    .from("claims")
    .select("id, user_id, kind, stage")
    .eq("id", claims.claim_id)
    .maybeSingle();

  if (!claim || claim.user_id !== claims.user_id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }

  // Strip tool_jwt from input before validation.
  const { tool_jwt: _strip, ...rawInput } = body;
  void _strip;
  const parsed = tool.inputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await tool.run(parsed.data, {
      caller: claims,
      claim,
    });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    await logToolError(tool.name, { claim_id: claim.id }, err);
    log.error("tool_failed", { tool: tool.name, error: (err as Error).message });
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
