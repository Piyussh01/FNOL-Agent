import type { TowProvider } from "./types";
import { code, latency, pick } from "./_rand";

const VENDORS = [
  { name: "AAA Tow", phone: "+18006633647" },
  { name: "Hook'em Up Towing", phone: "+14155551205" },
  { name: "Bay Area Rapid Tow", phone: "+15105552323" },
] as const;

export const mockTowProvider: TowProvider = {
  async dispatch(_input) {
    await latency();
    const v = pick(VENDORS);
    return {
      vendor: v.name,
      eta_minutes: 20 + Math.floor(Math.random() * 30),
      confirmation_code: code("TOW", 6),
      dispatch_phone: v.phone,
    };
  },
};
