import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/magic-link";
import { createAdminClient } from "@/lib/supabase/admin";
import { mintToolJwt } from "@/lib/auth/tool-jwt";
import { tavus } from "@/lib/tavus/client";
import { personaIdFor, type Locale } from "@/lib/tavus/persona";
import { log } from "@/lib/observability/logger";

const InputSchema = z.object({
  kind: z.enum(["auto", "home", "renters"]),
  modality: z.enum(["video", "chat"]).default("video"),
  resume_from_claim_id: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.id) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let parsed: z.infer<typeof InputSchema>;
  try {
    const contentType = req.headers.get("content-type") ?? "";
    const body = contentType.includes("application/json")
      ? await req.json()
      : Object.fromEntries(await req.formData());
    parsed = InputSchema.parse(body);
  } catch (err) {
    return NextResponse.json(
      { error: "invalid_input", detail: (err as Error).message },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const cookieLocale = req.cookies.get("fnol_locale")?.value;
  const locale: Locale =
    cookieLocale === "es" || user.preferred_lang === "es" ? "es" : "en";

  // 1. Pre-resolve the user's policy for the kind they clicked. Trigger 0009
  //    guarantees every account has an auto/home/renters row, so this
  //    succeeds for any signed-in email. Pre-attaching skips three
  //    round-trip tool calls (verify_identity / get_policy_details /
  //    start_claim) at the top of the conversation.
  const { data: prePolicy } = await admin
    .from("policies")
    .select("id, policy_number, coverage_json")
    .eq("holder_user_id", user.id)
    .eq("kind", parsed.kind)
    .order("active_to", { ascending: false })
    .limit(1)
    .maybeSingle();

  const policyId = prePolicy?.id ?? null;
  const policyNumber = prePolicy?.policy_number ?? null;
  const coverage =
    (prePolicy?.coverage_json as Record<string, unknown> | null) ?? null;
  const deductibles = (coverage?.deductibles ?? {}) as Record<string, number>;

  // 2. Resume or create claim row. New claims land directly at `intake` with
  //    policy already attached — no Verify-stage round trip needed.
  let claimId: string;
  let claimNumber: string | null = null;
  if (parsed.resume_from_claim_id) {
    const { data, error } = await admin
      .from("claims")
      .select("id, user_id, claim_number")
      .eq("id", parsed.resume_from_claim_id)
      .maybeSingle();
    if (error || !data || data.user_id !== user.id) {
      return NextResponse.json({ error: "claim_not_found" }, { status: 404 });
    }
    claimId = data.id;
    claimNumber = data.claim_number;
  } else {
    const { data, error } = await admin
      .from("claims")
      .insert({
        user_id: user.id,
        kind: parsed.kind,
        stage: policyId ? "intake" : "greeting",
        policy_id: policyId,
      })
      .select("id, claim_number")
      .single();
    if (error || !data) {
      log.error("claim_insert_failed", { error });
      return NextResponse.json({ error: "claim_create_failed" }, { status: 500 });
    }
    claimId = data.id;
    claimNumber = data.claim_number;
  }

  // 1b. Memory recall: any open claims (excluding the one we just made)?
  const { data: openClaims } = await admin
    .from("claims")
    .select("id, claim_number, kind, stage, updated_at")
    .eq("user_id", user.id)
    .not("stage", "in", "(submitted,closed)")
    .neq("id", claimId)
    .order("updated_at", { ascending: false })
    .limit(3);

  const memoryHint =
    openClaims && openClaims.length > 0
      ? `Returning user. They have ${openClaims.length} open claim(s): ${openClaims
          .map((c) => `${c.claim_number} (${c.kind}, stage=${c.stage})`)
          .join("; ")}. Offer to resume one of these before starting fresh.`
      : `First-time or no open claims for this user.`;

  // 2. Open a session row.
  const { data: session, error: sessionError } = await admin
    .from("sessions")
    .insert({
      claim_id: claimId,
      user_id: user.id,
      modality: parsed.modality,
    })
    .select("id")
    .single();
  if (sessionError || !session) {
    log.error("session_insert_failed", { error: sessionError });
    return NextResponse.json({ error: "session_create_failed" }, { status: 500 });
  }

  // 3. Mint a tool JWT to pass into Tavus's conversational_context so it
  //    comes back to us with every tool-call webhook.
  const token = await mintToolJwt({
    claim_id: claimId,
    user_id: user.id,
    session_id: session.id,
  });

  // 4. Chat modality returns early; the chat route handles its own setup.
  if (parsed.modality === "chat") {
    return NextResponse.redirect(
      new URL(`/claim/${claimId}/chat`, req.url),
      303,
    );
  }

  // 5. Create the Tavus conversation.
  const personaId = personaIdFor(locale);
  if (!personaId) {
    log.warn("no_persona_id", { locale });
    return NextResponse.redirect(
      new URL(
        `/claim/${claimId}/video?error=no_persona_configured`,
        req.url,
      ),
      303,
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;

  try {
    const conv = await tavus.createConversation({
      persona_id: personaId,
      conversation_name: `claim:${claimId}`,
      conversational_context: JSON.stringify({
        claim_id: claimId,
        claim_number: claimNumber,
        claim_kind: parsed.kind,
        user_id: user.id,
        user_name: user.name,
        user_first_name: (user.name ?? "").split(/\s+/)[0] || null,
        policy_id: policyId,
        policy_number: policyNumber,
        deductibles,
        tool_jwt: token,
        locale,
        memory_hint: memoryHint,
        fast_path:
          "Identity is already verified by session. Policy is already attached to the claim. Skip verify_identity, get_policy_details, and start_claim — go straight to acknowledging the incident and asking what happened.",
      }),
      callback_url: `${appUrl}/api/tavus/webhook`,
      properties: {
        max_call_duration: 1800,
        participant_left_timeout: 60,
        enable_recording: true,
      },
    });

    await admin
      .from("sessions")
      .update({ tavus_conversation_id: conv.conversation_id })
      .eq("id", session.id);

    await admin.from("events").insert({
      claim_id: claimId,
      session_id: session.id,
      type: "session_started",
      payload_json: { modality: parsed.modality, conversation_id: conv.conversation_id },
    });

    // Cookie passes conversation URL to the page.
    const res = NextResponse.redirect(
      new URL(`/claim/${claimId}/video`, req.url),
      303,
    );
    res.cookies.set("tavus_conversation_url", conv.conversation_url, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 30,
      path: "/",
    });
    return res;
  } catch (err) {
    log.error("tavus_create_failed", { error: (err as Error).message });
    return NextResponse.redirect(
      new URL(`/claim/${claimId}/video?error=tavus_failed`, req.url),
      303,
    );
  }
}
