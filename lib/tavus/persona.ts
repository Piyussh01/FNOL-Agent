import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Locale = "en" | "es";

export function loadPersonaPrompt(locale: Locale): string {
  const file = locale === "es" ? "sam.es.md" : "sam.en.md";
  return readFileSync(join(process.cwd(), "persona", file), "utf-8");
}

export function loadObjectives(): Record<string, string[]> {
  return JSON.parse(
    readFileSync(join(process.cwd(), "persona", "objectives.json"), "utf-8"),
  );
}

export function loadGuardrails() {
  return JSON.parse(
    readFileSync(join(process.cwd(), "persona", "guardrails.json"), "utf-8"),
  );
}

export function loadKbDoc(name: "auto" | "home" | "renters" | "glossary"): string {
  return readFileSync(join(process.cwd(), "persona", "kb", `${name}.md`), "utf-8");
}

export function personaIdFor(locale: Locale): string | undefined {
  return locale === "es"
    ? process.env.TAVUS_PERSONA_ID_ES
    : process.env.TAVUS_PERSONA_ID_EN;
}
