import type { RentalProvider } from "./types";
import { code, latency, pick } from "./_rand";

const VENDORS = [
  "Enterprise",
  "Hertz",
  "Avis",
  "Budget",
] as const;

const RATES = {
  economy: 38,
  midsize: 55,
  suv: 85,
} as const;

export const mockRentalProvider: RentalProvider = {
  async book(input) {
    await latency();
    return {
      vendor: pick(VENDORS),
      location: "Nearest branch — confirmation will include exact address",
      confirmation_code: code("RNT", 8),
      daily_rate_usd: RATES[input.vehicle_class],
      covered_days: 30, // adjuster trims as needed
    };
  },
};
