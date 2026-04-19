import { describe, expect, it } from "vitest";
import { scoreDriversForLoad } from "./dispatch-engine";
import type { DispatchDriver, Load } from "./types";

const load: Load = {
  id: "LD-4812",
  origin: { lat: 32.7767, lng: -96.797, name: "Dallas, TX" },
  destination: { lat: 29.7604, lng: -95.3698, name: "Houston, TX" },
  commodity: "Retail",
  equipment: "Dry Van 53",
  weight: 42000,
  rate: 2280,
  miles: 243,
  pickupWindow: { start: new Date().toISOString(), end: new Date().toISOString() },
  deliveryWindow: { start: new Date().toISOString(), end: new Date().toISOString() },
  shipper: "Lone Star Retail",
  receiver: "Houston South DC",
  status: "pending",
};

const drivers: DispatchDriver[] = [
  {
    driverId: 2001,
    firstName: "Sanjay",
    lastName: "Patel",
    terminal: "Dallas",
    currentLat: 32.79,
    currentLng: -96.81,
    currentCity: "Dallas, TX",
    hosRemaining: 11.2,
    hosDriveRemaining: 11.2,
    status: "AVAILABLE",
    readiness: "immediate",
    truckType: "Dry Van 53",
    costPerMile: 1.72,
    maintenanceScore: 92,
    currentFuelPercent: 82,
    mpgLoaded: 6.8,
  },
  {
    driverId: 2002,
    firstName: "Marcus",
    lastName: "Reed",
    terminal: "Fort Worth",
    currentLat: 32.75,
    currentLng: -97.33,
    currentCity: "Fort Worth, TX",
    hosRemaining: 10,
    hosDriveRemaining: 10,
    status: "AVAILABLE",
    readiness: "immediate",
    truckType: "Reefer 53",
    costPerMile: 1.81,
    maintenanceScore: 90,
    currentFuelPercent: 68,
    mpgLoaded: 6.1,
    downstreamDependencyIds: ["tomorrow-reefer-surge"],
  },
];

describe("scoreDriversForLoad", () => {
  it("prefers the closer equipment-compatible driver with no tomorrow conflict", () => {
    const result = scoreDriversForLoad(load, drivers);
    expect(result.bestDriver?.driver.driverId).toBe(2001);
    expect(result.bestDriver?.score).toBeGreaterThan(result.rankedDrivers[1].score);
    expect(result.bestDriver?.components?.length).toBe(9);
  });

  it("accounts for route context when scoring", () => {
    const result = scoreDriversForLoad(load, drivers, { miles: 260, minutes: 300, tolls: 24 });
    expect(result.bestDriver).not.toBeNull();
    expect(result.rankedDrivers[0].estimatedCost).toBeGreaterThan(0);
  });
});
