import { describe, expect, it } from "vitest";
import { mockTowProvider } from "@/lib/partners/tow";
import { mockRentalProvider } from "@/lib/partners/rental";
import { mockAdjusterScheduler } from "@/lib/partners/adjuster";

describe("mock tow provider", () => {
  it("returns a vendor + ETA + confirmation", async () => {
    const r = await mockTowProvider.dispatch({
      claim_id: "c",
      pickup_lat: 37.77,
      pickup_lng: -122.42,
    });
    expect(r.vendor).toBeTruthy();
    expect(r.eta_minutes).toBeGreaterThanOrEqual(20);
    expect(r.eta_minutes).toBeLessThanOrEqual(50);
    expect(r.confirmation_code).toMatch(/^TOW-/);
    expect(r.dispatch_phone).toMatch(/^\+1/);
  });
});

describe("mock rental provider", () => {
  it("returns class-appropriate daily rates", async () => {
    const eco = await mockRentalProvider.book({
      claim_id: "c",
      pickup_lat: 0,
      pickup_lng: 0,
      start_date: new Date().toISOString(),
      vehicle_class: "economy",
    });
    const suv = await mockRentalProvider.book({
      claim_id: "c",
      pickup_lat: 0,
      pickup_lng: 0,
      start_date: new Date().toISOString(),
      vehicle_class: "suv",
    });
    expect(eco.daily_rate_usd).toBeLessThan(suv.daily_rate_usd);
    expect(eco.confirmation_code).toMatch(/^RNT-/);
    expect(eco.covered_days).toBeGreaterThan(0);
  });
});

describe("mock adjuster scheduler", () => {
  it("schedules within the requested window", async () => {
    const start = "2026-05-23T14:00:00Z";
    const end = "2026-05-23T16:00:00Z";
    const r = await mockAdjusterScheduler.schedule({
      claim_id: "c",
      preferred_window_start: start,
      preferred_window_end: end,
      channel: "phone",
    });
    expect(r.adjuster_name).toBeTruthy();
    expect(r.confirmation_code).toMatch(/^ADJ-/);
    const t = new Date(r.scheduled_for).getTime();
    expect(t).toBeGreaterThanOrEqual(new Date(start).getTime());
    expect(t).toBeLessThanOrEqual(new Date(end).getTime());
  });

  it("falls back to tomorrow 10am on invalid window", async () => {
    const r = await mockAdjusterScheduler.schedule({
      claim_id: "c",
      preferred_window_start: "invalid",
      preferred_window_end: "invalid",
      channel: "phone",
    });
    expect(r.confirmation_code).toMatch(/^ADJ-/);
    expect(new Date(r.scheduled_for).getTime()).toBeGreaterThan(Date.now());
  });
});
