import type { AdjusterScheduler } from "./types";
import { code, latency, pick } from "./_rand";

const ADJUSTERS = [
  "Devon Mitchell",
  "Priya Shah",
  "Marcus Lee",
  "Elena Ruiz",
  "Cameron Park",
] as const;

export const mockAdjusterScheduler: AdjusterScheduler = {
  async schedule(input) {
    await latency();
    // Pick a time inside the requested window. If the window is invalid,
    // fall back to "tomorrow at 10am local".
    const start = new Date(input.preferred_window_start);
    const end = new Date(input.preferred_window_end);
    let scheduled: Date;
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start) {
      const mid = (start.getTime() + end.getTime()) / 2;
      scheduled = new Date(mid);
    } else {
      const t = new Date();
      t.setDate(t.getDate() + 1);
      t.setHours(10, 0, 0, 0);
      scheduled = t;
    }
    return {
      adjuster_name: pick(ADJUSTERS),
      scheduled_for: scheduled.toISOString(),
      confirmation_code: code("ADJ", 6),
    };
  },
};
