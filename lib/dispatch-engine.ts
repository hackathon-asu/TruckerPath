import type { Load, DispatchDriver, DispatchRecommendation, RankedDriver } from "./types";

// Haversine distance in miles between two lat/lng points
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const AVG_SPEED_MPH = 55;
const DEADHEAD_COST_PER_MILE = 1.50;

/**
 * Score and rank available drivers for a given load.
 * All heuristics are transparent and deterministic.
 */
export function scoreDriversForLoad(
  load: Load,
  drivers: DispatchDriver[],
): DispatchRecommendation {
  const tripHours = load.miles / AVG_SPEED_MPH;

  const ranked: RankedDriver[] = drivers
    .filter((d) => d.status !== "IN_TRANSIT" && d.readiness !== "unavailable")
    .map((driver) => {
      const deadheadMiles = haversine(
        driver.currentLat,
        driver.currentLng,
        load.origin.lat,
        load.origin.lng,
      );
      const deadheadMinutes = (deadheadMiles / AVG_SPEED_MPH) * 60;
      const totalDriveHours = deadheadMiles / AVG_SPEED_MPH + tripHours;
      const tripFeasible = driver.hosDriveRemaining >= Math.min(totalDriveHours, 11);
      const hosAfterTrip = Math.max(0, driver.hosDriveRemaining - totalDriveHours);
      const estimatedCost =
        deadheadMiles * DEADHEAD_COST_PER_MILE + load.miles * driver.costPerMile;

      // ── Scoring factors (each 0–100) ──
      // Deadhead: closer is better. 0 mi = 100, 500+ mi = 0
      const deadheadScore = Math.max(0, 100 - (deadheadMiles / 500) * 100);

      // HOS: more remaining time = better
      const hosScore = Math.min(100, (driver.hosDriveRemaining / 11) * 100);

      // Readiness: immediate=100, 30min=75, 1hr=50
      const readinessScore =
        driver.readiness === "immediate" ? 100 : driver.readiness === "30min" ? 75 : 50;

      // Cost: lower CPM is better, normalized around $2/mi
      const costScore = Math.max(0, Math.min(100, (2.0 - driver.costPerMile) * 200 + 50));

      // Trip feasibility is critical
      const feasibilityBonus = tripFeasible ? 15 : -40;

      // Weighted composite score
      const rawScore =
        deadheadScore * 0.30 +
        hosScore * 0.25 +
        readinessScore * 0.20 +
        costScore * 0.15 +
        feasibilityBonus;

      const score = Math.max(0, Math.min(100, Math.round(rawScore)));

      // Build reasoning
      const reasons: string[] = [];
      if (deadheadMiles < 30) reasons.push(`Very close (${deadheadMiles.toFixed(0)} mi deadhead)`);
      else if (deadheadMiles < 100) reasons.push(`${deadheadMiles.toFixed(0)} mi deadhead`);
      else reasons.push(`Far (${deadheadMiles.toFixed(0)} mi deadhead)`);
      if (!tripFeasible) reasons.push("⚠ HOS insufficient for full trip");
      if (driver.readiness === "immediate") reasons.push("Ready now");
      if (driver.costPerMile < 1.80) reasons.push("Low cost per mile");

      const now = Date.now();
      const pickupArrival = new Date(now + deadheadMinutes * 60_000);
      const deliveryArrival = new Date(
        pickupArrival.getTime() + tripHours * 3600_000 + 60 * 60_000, // +1h for loading
      );

      return {
        driver,
        score,
        deadheadMiles: Math.round(deadheadMiles),
        deadheadMinutes: Math.round(deadheadMinutes),
        etaToPickup: pickupArrival.toISOString(),
        etaToDelivery: deliveryArrival.toISOString(),
        tripFeasible,
        hosAfterTrip: Math.round(hosAfterTrip * 10) / 10,
        estimatedCost: Math.round(estimatedCost),
        reasoning: reasons.join(" · "),
      };
    })
    .sort((a, b) => b.score - a.score);

  const best = ranked[0] ?? null;
  const confidenceScore = best ? best.score : 0;

  let explanation = "No available drivers found.";
  if (best) {
    explanation = `${best.driver.firstName} ${best.driver.lastName} is the best match (score ${best.score}/100). ${best.deadheadMiles} mi deadhead from ${best.driver.currentCity}, ${best.driver.hosDriveRemaining}h HOS remaining, $${best.driver.costPerMile}/mi.`;
  }

  return {
    loadId: load.id,
    rankedDrivers: ranked,
    bestDriver: best,
    confidenceScore,
    explanation,
  };
}
