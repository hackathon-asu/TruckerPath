import type {
  Load,
  DispatchDriver,
  ParkingStop,
  DetentionImpactResult,
  RiskLevel,
} from "./types";
import { analyzeParkingRisk } from "./parking-engine";

const AVG_SPEED_MPH = 55;

/**
 * Analyze cascading impact of a detention delay.
 * Returns updated ETA, HOS impact, parking viability, cost changes, and recommendations.
 */
export function analyzeDetentionImpact(params: {
  load: Load;
  driver: DispatchDriver;
  delayMinutes: number;
  parkingStops: ParkingStop[];
  detentionCostPerHour?: number;
}): DetentionImpactResult {
  const {
    load,
    driver,
    delayMinutes,
    parkingStops,
    detentionCostPerHour = 75,
  } = params;

  const tripHours = load.miles / AVG_SPEED_MPH;
  const now = new Date();

  // ── Original plan (no delay) ──
  const originalEta = new Date(now.getTime() + tripHours * 3600_000 + 60 * 60_000); // +1h loading
  const originalHosAfter = driver.hosDriveRemaining - tripHours;

  // ── Updated plan (with delay) ──
  const updatedEta = new Date(originalEta.getTime() + delayMinutes * 60_000);
  const hosAfterDelay = driver.hosRemaining - delayMinutes / 60;
  const hosDriveAfterDelay = driver.hosDriveRemaining; // detention doesn't consume drive time, but does consume on-duty time
  // However, the driver's available on-duty window shrinks, which may force an earlier rest
  const effectiveHos = Math.min(hosAfterDelay, hosDriveAfterDelay);

  // ── On-time feasibility ──
  const deliveryWindowEnd = new Date(load.deliveryWindow.end);
  const onTimeFeasible = updatedEta <= deliveryWindowEnd;

  // ── HOS violation risk ──
  const hosViolationRisk = effectiveHos < (tripHours * 0.5); // can't even make it halfway

  // ── Parking impact ──
  // Before delay
  const parkingBefore = analyzeParkingRisk({
    loadId: load.id,
    originLat: load.origin.lat,
    originLng: load.origin.lng,
    departureMiles: 0,
    hosRemaining: driver.hosDriveRemaining,
    departureTime: now,
    parkingStops,
    delayMinutes: 0,
  });

  // After delay
  const parkingAfter = analyzeParkingRisk({
    loadId: load.id,
    originLat: load.origin.lat,
    originLng: load.origin.lng,
    departureMiles: 0,
    hosRemaining: effectiveHos,
    departureTime: new Date(now.getTime() + delayMinutes * 60_000),
    parkingStops,
    delayMinutes,
  });

  // ── Cost impact ──
  const detentionCost = (delayMinutes / 60) * detentionCostPerHour;
  // Additional fuel from possible reroute to backup parking
  const additionalFuel = parkingAfter.backupStop && !parkingAfter.primaryStop
    ? 15 // ~$15 for a short detour
    : 0;
  const totalAdded = detentionCost + additionalFuel;

  // ── Should we notify the customer? ──
  const notifyCustomer = !onTimeFeasible || delayMinutes >= 90;

  // ── Should we consider relay/reassignment? ──
  const considerRelay = hosViolationRisk && delayMinutes >= 120;

  // ── Build explanation ──
  const parts: string[] = [];
  parts.push(`${delayMinutes}-minute detention at ${load.shipper}.`);
  parts.push(`ETA shifts from ${formatTime(originalEta)} to ${formatTime(updatedEta)}.`);

  if (!onTimeFeasible) {
    parts.push("⚠ Delivery window will likely be missed.");
  } else {
    parts.push("On-time delivery still feasible but margin reduced.");
  }

  if (hosViolationRisk) {
    parts.push(`HOS violation risk: only ${effectiveHos.toFixed(1)}h remaining for ${tripHours.toFixed(1)}h trip.`);
  }

  if (parkingAfter.riskLevel !== parkingBefore.riskLevel) {
    parts.push(`Parking risk changed: ${parkingBefore.riskLevel} → ${parkingAfter.riskLevel}.`);
  }

  if (parkingAfter.backupStop) {
    parts.push(`Backup parking recommended at ${parkingAfter.backupStop.name} (${parkingAfter.backupStop.city}).`);
  }

  parts.push(`Added cost: $${totalAdded.toFixed(0)} ($${detentionCost.toFixed(0)} detention).`);

  return {
    loadId: load.id,
    originalEta: originalEta.toISOString(),
    updatedEta: updatedEta.toISOString(),
    delayMinutes,
    onTimeFeasible,
    hosImpact: {
      before: driver.hosRemaining,
      after: Math.round(hosAfterDelay * 10) / 10,
      violationRisk: hosViolationRisk,
    },
    parkingImpact: {
      previousRisk: parkingBefore.riskLevel,
      newRisk: parkingAfter.riskLevel,
      primaryStillViable: parkingAfter.primaryStop !== null && parkingAfter.riskLevel !== "critical",
      suggestedBackup: parkingAfter.backupStop,
    },
    notifyCustomer,
    considerRelay,
    costImpact: {
      detentionCost,
      additionalFuel,
      totalAdded,
    },
    explanation: parts.join(" "),
  };
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
}
