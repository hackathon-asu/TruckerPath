import type {
  DispatchDriver,
  DispatchRecommendation,
  DriverReadinessBreakdown,
  Load,
  RankedDriver,
} from "./types";

const AVG_SPEED_MPH = 55;
const DEADHEAD_COST_PER_MILE = 1.5;

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function scoreComponent(
  key: DriverReadinessBreakdown["key"],
  label: string,
  weight: number,
  rawScore: number,
  explanation: string,
): DriverReadinessBreakdown {
  return {
    key,
    label,
    weight,
    rawScore: clamp(rawScore),
    weightedScore: Number(((clamp(rawScore) * weight) / 100).toFixed(2)),
    explanation,
  };
}

export function scoreDriversForLoad(
  load: Load,
  drivers: DispatchDriver[],
  routeContext?: { miles?: number; minutes?: number; tolls?: number },
): DispatchRecommendation {
  const routeMiles = routeContext?.miles ?? load.miles;
  const routeHours = (routeContext?.minutes ?? load.miles / AVG_SPEED_MPH * 60) / 60;
  const rankedDrivers: RankedDriver[] = drivers
    .filter((driver) => driver.status !== "IN_TRANSIT" && driver.breakdownStatus !== "confirmed")
    .map((driver) => {
      const deadheadMiles = haversine(driver.currentLat, driver.currentLng, load.origin.lat, load.origin.lng);
      const deadheadMinutes = (deadheadMiles / AVG_SPEED_MPH) * 60;
      const totalTripHours = routeHours + deadheadMiles / AVG_SPEED_MPH;
      const tripFeasible = driver.hosDriveRemaining >= totalTripHours * 0.85;
      const hosAfterTrip = Number(Math.max(0, driver.hosDriveRemaining - totalTripHours).toFixed(1));
      const equipmentFit = driver.truckType.toLowerCase().includes((load.equipment ?? "").split(" ")[0]?.toLowerCase?.() ?? "")
        ? 100
        : load.equipment
          ? 72
          : 88;
      const maintenanceScore = driver.maintenanceScore ?? 78;
      const fuelEconomics = clamp(((driver.mpgLoaded ?? 6.2) / 7.5) * 100 + ((driver.currentFuelPercent ?? 60) > 30 ? 10 : -15));
      const parkingViability = clamp(55 + hosAfterTrip * 6);
      const tomorrowImpact = clamp(driver.downstreamDependencyIds?.length ? 48 : 86);
      const strandedRisk = clamp(deadheadMiles < 50 ? 92 : 70 - deadheadMiles * 0.06);

      const components = [
        scoreComponent("deadhead", "Deadhead miles/time", 20, 100 - deadheadMiles / 4, `${Math.round(deadheadMiles)} mi to pickup.`),
        scoreComponent("hos", "HOS remaining / feasibility", 20, tripFeasible ? 65 + hosAfterTrip * 8 : 26, `${driver.hosDriveRemaining.toFixed(1)}h drive time remaining.`),
        scoreComponent("trip_time", "Total route/trip time", 10, 100 - totalTripHours * 5.5, `${totalTripHours.toFixed(1)}h total with deadhead.`),
        scoreComponent("equipment", "Equipment compatibility", 10, equipmentFit, driver.truckType),
        scoreComponent("maintenance", "Maintenance / ELD confidence", 10, maintenanceScore - (driver.eldErrorCode ? 18 : 0), driver.eldErrorCode ? `ELD issue ${driver.eldErrorCode}.` : "Healthy truck and ELD."),
        scoreComponent("tomorrow_impact", "Tomorrow-load downstream impact", 10, tomorrowImpact, driver.downstreamDependencyIds?.length ? "Tomorrow commitments create a tradeoff." : "No hard downstream conflict."),
        scoreComponent("stranded_risk", "Stranded-driver prevention", 10, strandedRisk, "Keeps the asset useful after delivery."),
        scoreComponent("fuel_plan", "Fuel plan / route economics", 5, fuelEconomics, `${driver.currentFuelPercent ?? 0}% fuel and ${(driver.mpgLoaded ?? 0).toFixed(1)} MPG loaded.`),
        scoreComponent("parking_viability", "Parking / HOS stop viability", 5, parkingViability, `${hosAfterTrip.toFixed(1)}h projected after trip.`),
      ];

      const score = Number(components.reduce((sum, part) => sum + part.weightedScore, 0).toFixed(1));
      const estimatedCost = Math.round(deadheadMiles * DEADHEAD_COST_PER_MILE + routeMiles * driver.costPerMile + (routeContext?.tolls ?? 0));
      const pickupArrival = new Date(Date.now() + deadheadMinutes * 60_000);
      const deliveryArrival = new Date(pickupArrival.getTime() + routeHours * 60 * 60_000);

      return {
        driver,
        score,
        deadheadMiles: Math.round(deadheadMiles),
        deadheadMinutes: Math.round(deadheadMinutes),
        etaToPickup: pickupArrival.toISOString(),
        etaToDelivery: deliveryArrival.toISOString(),
        tripFeasible,
        hosAfterTrip,
        estimatedCost,
        reasoning: components
          .sort((left, right) => right.weightedScore - left.weightedScore)
          .slice(0, 3)
          .map((item) => item.explanation)
          .join(" • "),
        components,
      };
    })
    .sort((left, right) => right.score - left.score);

  const bestDriver = rankedDrivers[0] ?? null;
  return {
    loadId: load.id,
    rankedDrivers,
    bestDriver,
    confidenceScore: bestDriver ? clamp(bestDriver.score + 4) : 0,
    explanation: bestDriver
      ? `${bestDriver.driver.firstName} ${bestDriver.driver.lastName} leads the board with ${bestDriver.score}/100 by balancing deadhead, HOS feasibility, equipment fit, and downstream protection.`
      : "No available drivers cleared the deterministic readiness gates.",
    generatedAt: new Date().toISOString(),
  };
}
