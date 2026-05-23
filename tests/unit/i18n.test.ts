import { describe, expect, it } from "vitest";
import en from "@/lib/i18n/en.json";
import es from "@/lib/i18n/es.json";
import { t, pickLocale } from "@/lib/i18n/config";

describe("i18n", () => {
  it("EN and ES dictionaries share the same keys (parity)", () => {
    const ek = Object.keys(en).sort();
    const sk = Object.keys(es).sort();
    expect(ek).toEqual(sk);
  });

  it("falls back to EN if a key is missing in target locale", () => {
    expect(t("es", "landing.cta.file")).toBe("Reportar un reclamo");
    expect(t("en", "landing.cta.file")).toBe("File a claim");
  });

  it("pickLocale clamps unknown values to 'en'", () => {
    expect(pickLocale("en")).toBe("en");
    expect(pickLocale("es")).toBe("es");
    expect(pickLocale("fr")).toBe("en");
    expect(pickLocale(undefined)).toBe("en");
  });
});
