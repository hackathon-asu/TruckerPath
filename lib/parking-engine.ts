import type { ParkingStop, ParkingRiskResult, RiskLevel } from "./types";

const AVG_SPEED_MPH = 55;

/**
 * Predict parking risk and recommend primary + backup stops.
 * Factors: HOS remaining (when must driver stop?), time-of-day (evening = higher occupancy),
 * and current occupancy data for each candidate stop.
 */
export function analyzeParkingRisk(params: {
  loadId: string;
  originLat: number;
  originLng: number;
  departureMiles: number; // miles already covered (0 if starting)
  hosRemaining: number; // hours of drive time left
  departureTime: Date;
  parkingStops: ParkingStop[];
  delayMinutes?: number; // additional delay (detention, etc.)
}): ParkingRiskResult {
  const {
    loadId,
    departureMiles,
    hosRemaining,
    departureTime,
    parkingStops,
    delayMinutes = 0,
  } = params;

  // How far can the driver go before required rest?
  const maxDriveMiles = hosRemaining * AVG_SPEED_MPH;
  const idealStopMiles = departureMiles + maxDriveMiles * 0.85; // stop at 85% of max to have buffer

  // Filter to stops the driver can actually reach
  const reachable = parkingStops
    .filter((s) => s.milesFromOrigin >= departureMiles && s.milesFromOrigin <= departureMiles + maxDriveMiles)
    .sort((a, b) => {
      // Sort by proximity to ideal stop point
      const distA = Math.abs(a.milesFromOrigin - idealStopMiles);
      const distB = Math.abs(b.milesFromOrigin - idealStopMiles);
      return distA - distB;
    });

  if (reachable.length === 0) {
    return {
      loadId,
      primaryStop: null,
      backupStop: null,
      riskLevel: "critical",
      arrivalTime: new Date(departureTime.getTime() + hosRemaining * 3600_000).toISOString(),
      reserveRecommendation: true,
      explanation: "No truck stops within HOS range. Immediate route replanning required.",
    };
  }

  // Calculate arrival time at each stop and adjust occupancy for time-of-day
  const scored = reachable.map((stop) => {
    const driveHoursToStop = (stop.milesFromOrigin - departureMiles) / AVG_SPEED_MPH;
    const arrivalTime = new Date(
      departureTime.getTime() + (driveHoursToStop + delayMinutes / 60) * 3600_000,
    );
    const arrivalHour = arrivalTime.getHours();

    // Evening surge: occupancy rises 15-25% between 6 PM and 10 PM
    let projectedOccupancy = stop.occupancyPercent;
    if (arrivalHour >= 18 && arrivalHour <= 22) {
      const surgeMultiplier = 1 + (0.15 + (arrivalHour - 18) * 0.05);
      projectedOccupancy = Math.min(100, stop.occupancyPercent * surgeMultiplier);
    } else if (arrivalHour >= 22 || arrivalHour <= 4) {
      projectedOccupancy = Math.min(100, stop.occupancyPercent * 1.10);
    }

    // Additional delay pushes arrival later, further increasing risk
    if (delayMinutes > 60) {
      projectedOccupancy = Math.min(100, projectedOccupancy + 4);
    }

    const risk = occupancyToRisk(projectedOccupancy);

    return { stop, arrivalTime, projectedOccupancy, risk };
  });

  // Primary: best stop near ideal point with lowest risk
  const primary = scored.sort((a, b) => {
    const riskOrder: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 };
    const riskDiff = riskOrder[a.risk] - riskOrder[b.risk];
    if (riskDiff !== 0) return riskDiff;
    return Math.abs(a.stop.milesFromOrigin - idealStopMiles) -
           Math.abs(b.stop.milesFromOrigin - idealStopMiles);
  })[0];

  // Backup: different stop, ideally before the primary (so driver can stop earlier if needed)
  const backup = scored.find(
    (s) => s.stop.id !== primary.stop.id && s.stop.milesFromOrigin < primary.stop.milesFromOrigin,
  ) ?? scored.find((s) => s.stop.id !== primary.stop.id) ?? null;

  const overallRisk = primary.risk;
  const reasons: string[] = [];

  if (primary.projectedOccupancy > 85) {
    reasons.push(`${primary.stop.name} projected ${Math.round(primary.projectedOccupancy)}% full at ${formatTime(primary.arrivalTime)}`);
  }
  if (primary.arrivalTime.getHours() >= 19) {
    reasons.push("Late evening arrival increases parking competition");
  }
  if (delayMinutes > 0) {
    reasons.push(`${delayMinutes}min delay shifted arrival window`);
  }
  if (overallRisk === "low" && reasons.length === 0) {
    reasons.push(`Good availability at ${primary.stop.name} (${Math.round(primary.projectedOccupancy)}% occupied)`);
  }

  return {
    loadId,
    primaryStop: primary.stop,
    backupStop: backup?.stop ?? null,
    riskLevel: overallRisk,
    arrivalTime: primary.arrivalTime.toISOString(),
    reserveRecommendation: overallRisk === "high" || overallRisk === "critical",
    explanation: reasons.join(". ") + ".",
  };
}

function occupancyToRisk(pct: number): RiskLevel {
  if (pct < 65) return "low";
  if (pct < 80) return "medium";
  if (pct < 93) return "high";
  return "critical";
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}
