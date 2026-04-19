import { describe, expect, it } from "vitest";
import { createDemoDispatcherSnapshot, demoDrivers, demoLoads, demoRepairShops, demoVehicles } from "./reports-demo";

describe("reports demo seed", () => {
  it("covers the required minimum scenario counts", () => {
    expect(demoDrivers.length).toBeGreaterThanOrEqual(12);
    expect(demoVehicles.length).toBeGreaterThanOrEqual(24);
    expect(demoLoads.length).toBeGreaterThanOrEqual(18);
    expect(demoRepairShops.length).toBeGreaterThanOrEqual(25);
  });

  it("contains the named urgent and exception scenarios", () => {
    const snapshot = createDemoDispatcherSnapshot();
    expect(snapshot.loads.some((load) => load.id === "LD-4812")).toBe(true);
    expect(snapshot.drivers.some((driver) => driver.id === "drv-ramirez")).toBe(true);
    expect(snapshot.alerts.some((alert) => alert.type === "law_change")).toBe(true);
    expect(snapshot.detentions.some((detention) => detention.invoiceDraftReady && detention.minutes >= 120)).toBe(true);
    expect(snapshot.lastMileInsights.length).toBeGreaterThanOrEqual(5);
    expect(snapshot.documentCases.length).toBeGreaterThanOrEqual(15);
  });
});
