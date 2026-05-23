// Supabase Edge Function (Deno runtime).
// Triggered by a Storage webhook when a new object lands in the
// `claim-photos` bucket. Calls Anthropic Vision, persists the result to
// `photos.vision_json`.
//
// Deploy: `supabase functions deploy analyze-photos --no-verify-jwt`
// Configure a Storage webhook in the Supabase dashboard that POSTs
// INSERT/UPDATE events on storage.objects (bucket = claim-photos) to this
// function's URL.

// deno-lint-ignore-file no-explicit-any
// @ts-ignore — Deno types are not available in the Node TS compile context.
// They are present at runtime when deployed via `supabase functions deploy`.
declare const Deno: { env: { get(k: string): string | undefined } };

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

const AUTO_PROMPT = `You are an auto-damage assessment assistant for an insurance claim. Look at the photo and return STRICT JSON only — no prose, no markdown.

Output schema:
{"severity":"cosmetic"|"moderate"|"severe"|"total_loss","parts_affected":string[],"estimated_repair_range_usd":[int_low,int_high],"drivable_likely":true|false|null,"habitable_likely":null,"notes":string}

Rules:
- If no clear damage, severity="cosmetic", parts_affected=[], range [0,0], drivable_likely=null.
- Repair ranges should be realistic for US shops in 2026.
- drivable_likely=false for deployed airbags, fluid leaks, wheel/tire misalignment, severe frame damage, structural intrusion.
- Return JSON only.`;

const HOME_PROMPT = `You are a property-damage assessor for a homeowners insurance claim. Return STRICT JSON only.

Schema: {"severity":"cosmetic"|"moderate"|"severe"|"total_loss","parts_affected":string[],"estimated_repair_range_usd":[int_low,int_high],"drivable_likely":null,"habitable_likely":true|false|null,"notes":string}

Rules: If no clear damage, severity="cosmetic". habitable_likely=false for standing water, exposed structural elements, exposed wiring, fire char, missing exterior walls/roof. JSON only.`;

const RENTERS_PROMPT = `You are a personal-property loss assessor for a renters insurance claim. Return STRICT JSON only.

Schema: {"severity":"cosmetic"|"moderate"|"severe"|"total_loss","parts_affected":string[],"estimated_repair_range_usd":[int_low,int_high],"drivable_likely":null,"habitable_likely":null,"notes":string}

Rules: Use replacement cost. If items look stolen (empty drawers, broken locks), note that. JSON only.`;

function promptFor(kind: string): string {
  if (kind === "home") return HOME_PROMPT;
  if (kind === "renters") return RENTERS_PROMPT;
  return AUTO_PROMPT;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("method_not_allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;

  const body = await req.json().catch(() => null);
  const record = (body?.record ?? body) as
    | { name?: string; bucket_id?: string }
    | null;
  if (!record?.name || record.bucket_id !== "claim-photos") {
    return new Response(JSON.stringify({ skipped: true }), { status: 200 });
  }

  // Storage path = "<claim_id>/<kind>/<photo_id>.jpg"
  const [claimId] = record.name.split("/");
  if (!claimId) {
    return new Response(JSON.stringify({ error: "bad_path" }), { status: 400 });
  }

  // Fetch claim kind for prompt selection.
  const claimRes = await fetch(`${supabaseUrl}/rest/v1/claims?id=eq.${claimId}&select=kind`, {
    headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` },
  });
  const [claim] = (await claimRes.json()) as { kind: string }[];
  if (!claim) {
    return new Response(JSON.stringify({ error: "claim_not_found" }), { status: 404 });
  }

  // Locate the photos row by storage_path.
  const photoRes = await fetch(
    `${supabaseUrl}/rest/v1/photos?storage_path=eq.${encodeURIComponent(record.name)}&select=id`,
    { headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` } },
  );
  const [photo] = (await photoRes.json()) as { id: string }[];
  if (!photo) {
    return new Response(JSON.stringify({ error: "photo_row_not_found" }), { status: 404 });
  }

  // Download bytes via Storage HTTP API.
  const fileRes = await fetch(
    `${supabaseUrl}/storage/v1/object/claim-photos/${record.name}`,
    { headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` } },
  );
  if (!fileRes.ok) {
    return new Response(JSON.stringify({ error: "storage_fetch_failed" }), { status: 500 });
  }
  const buf = new Uint8Array(await fileRes.arrayBuffer());
  const b64 = btoa(String.fromCharCode(...buf));

  // Call Anthropic.
  const anthRes = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: promptFor(claim.kind),
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } },
            { type: "text", text: "Analyze this image. Return JSON only." },
          ],
        },
      ],
    }),
  });
  const anth = (await anthRes.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = anth.content?.find((c) => c.type === "text")?.text ?? "";
  const cleaned = text.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "").trim();

  let visionJson: any;
  try {
    visionJson = JSON.parse(cleaned);
  } catch {
    visionJson = {
      severity: "cosmetic",
      parts_affected: [],
      estimated_repair_range_usd: [0, 0],
      drivable_likely: null,
      habitable_likely: null,
      notes: "Could not parse vision output.",
    };
  }

  await fetch(`${supabaseUrl}/rest/v1/photos?id=eq.${photo.id}`, {
    method: "PATCH",
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json",
      prefer: "return=minimal",
    },
    body: JSON.stringify({
      vision_json: visionJson,
      analyzed_at: new Date().toISOString(),
    }),
  });

  return new Response(JSON.stringify({ ok: true, photo_id: photo.id }), {
    headers: { "content-type": "application/json" },
  });
}
