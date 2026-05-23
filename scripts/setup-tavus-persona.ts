#!/usr/bin/env bun
/**
 * One-shot setup for Sam (EN + ES) personas in Tavus.
 *
 * Usage:
 *   bun run scripts/setup-tavus-persona.ts
 *
 * Requires:
 *   TAVUS_API_KEY
 *   TAVUS_REPLICA_ID (optional — uses Tavus stock replica if absent)
 *
 * Side-effects:
 *   Prints persona IDs. You must paste these into .env.local as
 *   TAVUS_PERSONA_ID_EN and TAVUS_PERSONA_ID_ES.
 */

import { tavus } from "@/lib/tavus/client";
import {
  loadGuardrails,
  loadKbDoc,
  loadObjectives,
  loadPersonaPrompt,
  type Locale,
} from "@/lib/tavus/persona";
import { tavusTools } from "@/lib/tavus/tools-schema";

function buildContext(_locale: Locale): string {
  const objectives = loadObjectives();
  const guardrails = loadGuardrails();
  const kb = [
    `# Glossary\n\n${loadKbDoc("glossary")}`,
    `# Auto policy\n\n${loadKbDoc("auto")}`,
    `# Home policy\n\n${loadKbDoc("home")}`,
    `# Renters policy\n\n${loadKbDoc("renters")}`,
  ].join("\n\n---\n\n");

  return [
    "# Per-kind objectives checklist",
    "```json",
    JSON.stringify(objectives, null, 2),
    "```",
    "",
    "# Guardrails",
    "```json",
    JSON.stringify(guardrails, null, 2),
    "```",
    "",
    "# Knowledge base",
    "",
    kb,
  ].join("\n");
}

async function createOne(locale: Locale) {
  const systemPrompt = loadPersonaPrompt(locale);
  const context = buildContext(locale);

  const personaName = locale === "es" ? "Sam — Acme (ES)" : "Sam — Acme (EN)";

  const res = await tavus.createPersona({
    persona_name: personaName,
    system_prompt: systemPrompt,
    context,
    default_replica_id: process.env.TAVUS_REPLICA_ID,
    layers: {
      llm: {
        tools: tavusTools,
      },
      perception: {
        perception_model: "raven-0",
        ambient_awareness_queries: [
          "Does the user look distressed, panicked, or scared?",
          "Is there visible injury or damage in frame?",
          "Is the user in an unsafe location?",
        ],
      },
      stt: { stt_engine: "tavus-advanced", participant_pause_sensitivity: "medium" },
      tts: {
        tts_engine: "cartesia",
        api_key: process.env.CARTESIA_API_KEY,
        external_voice_id: locale === "es" ? undefined : undefined,
      },
    },
  });

  console.log(`✓ Persona created [${locale}]:`, res.persona_id);
  return res;
}

async function main() {
  if (!process.env.TAVUS_API_KEY) {
    console.error("✗ TAVUS_API_KEY is required.");
    process.exit(1);
  }

  const en = await createOne("en");
  const es = await createOne("es");

  console.log("\nAdd to .env.local:");
  console.log(`TAVUS_PERSONA_ID_EN=${en.persona_id}`);
  console.log(`TAVUS_PERSONA_ID_ES=${es.persona_id}`);
}

main().catch((err) => {
  console.error("✗ Setup failed:", err);
  process.exit(1);
});
