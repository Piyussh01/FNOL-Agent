export const SUPPORTED_LOCALES = ["en", "es"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

import en from "./en.json";
import es from "./es.json";

const dictionaries: Record<Locale, Record<string, string>> = { en, es };

export function t(locale: Locale, key: string, fallback?: string): string {
  return dictionaries[locale]?.[key] ?? dictionaries[DEFAULT_LOCALE][key] ?? fallback ?? key;
}

export function pickLocale(input: string | null | undefined): Locale {
  if (input === "es") return "es";
  return "en";
}
