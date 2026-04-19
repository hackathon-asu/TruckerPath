import type {
  Load,
  DispatchDriver,
  DetentionEvent,
  ParkingStop,
  CopilotAlert,
} from "./types";
import { analyzeParkingRisk } from "./parking-engine";

const AVG_SPEED_MPH = 55;

/**
 * Generate proactive alerts based on current fleet state.
 * Scans for: detention delays, HOS risks, parking issues, late delivery threats, better assignments.
 */
export function generateAlerts(params: {
  loads: Load[];
  drivers: DispatchDriver[];
  detentionEvents: DetentionEvent[];
  parkingStops: ParkingStop[];
}): CopilotAlert[] {
  const { loads, drivers, detentionEvents, parkingStops } = params;
  const alerts: CopilotAlert[] = [];
  const now = new Date();
  let alertId = 1;

  // ── Detention delay alerts ──
  for (const det of detentionEvents) {
    if (det.delayMinutes >= 60) {
      const load = loads.find((l) => l.id === det.loadId);
      const driver = load?.assignedDriverId
        ? drivers.find((d) => d.driverId === load.assignedDriverId)
        : null;
      const driverName = driver ? `${driver.firstName} ${driver.lastName}` : "Unassigned driver";

      alerts.push({
        id: `gen-${alertId++}`,
        type: "detention_delay",
        severity: det.delayMinutes >= 120 ? "critical" : "warning",
        title: `${Math.round(det.delayMinutes / 60)}h Detention at ${det.facilityName}`,
        message: `${driverName} held for ${det.delayMinutes} min at ${det.location}. Cost accrued: $${((det.delayMinutes / 60) * det.costPerHour).toFixed(0)}.`,
        loadId: det.loadId,
        driverId: driver?.driverId,
        timestamp: det.startedAt,
        actionLabel: "View Impact",
        dismissed: false,
      });
    }
  }

  // ── HOS violation risk ──
  for (const driver of drivers) {
    if (driver.status === "IN_TRANSIT" || driver.readiness !== "unavailable") {
      if (driver.hosDriveRemaining <= 3) {
        alerts.push({
          id: `gen-${alertId++}`,
          type: "hos_violation_risk",
          severity: driver.hosDriveRemaining <= 1 ? "critical" : "warning",
          title: `HOS Alert — ${driver.firstName} ${driver.lastName}`,
          message: `Only ${driver.hosDriveRemaining}h drive time remaining. Rest stop required soon.`,
          driverId: driver.driverId,
          timestamp: now.toISOString(),
          dismissed: false,
        });
      }
    }
  }

  // ── Parking risk for assigned loads ──
  for (const load of loads) {
    if (load.status === "assigned" || load.status === "in_transit") {
      const driver = drivers.find((d) => d.driverId === load.assignedDriverId);
      if (!driver) continue;

      const parking = analyzeParkingRisk({
        loadId: load.id,
        originLat: load.origin.lat,
        originLng: load.origin.lng,
        departureMiles: 0,
        hosRemaining: driver.hosDriveRemaining,
        departureTime: now,
        parkingStops,
      });

      if (parking.riskLevel === "high" || parking.riskLevel === "critical") {
        alerts.push({
          id: `gen-${alertId++}`,
          type: "parking_risk",
          severity: parking.riskLevel === "critical" ? "critical" : "warning",
          title: `Parking Risk — ${load.id}`,
          message: parking.explanation,
          loadId: load.id,
          timestamp: now.toISOString(),
          actionLabel: "View Parking Plan",
          dismissed: false,
        });
      }
    }
  }

  // ── Better driver available (for unassigned loads) ──
  for (const load of loads) {
    if (load.status !== "pending") continue;

    const available = drivers.filter(
      (d) => d.status !== "IN_TRANSIT" && d.readiness !== "unavailable",
    );

    if (available.length === 0) continue;

    // Find closest driver
    const closest = available.reduce((best, d) => {
      const dist = haversine(d.currentLat, d.currentLng, load.origin.lat, load.origin.lng);
      const bestDist = haversine(best.currentLat, best.currentLng, load.origin.lat, load.origin.lng);
      return dist < bestDist ? d : best;
    });

    const closestDist = haversine(
      closest.currentLat,
      closest.currentLng,
      load.origin.lat,
      load.origin.lng,
    );

    if (closestDist < 50) {
      alerts.push({
        id: `gen-${alertId++}`,
        type: "better_driver",
        severity: "info",
        title: `Nearby Driver for ${load.id}`,
        message: `${closest.firstName} ${closest.lastName} is ${Math.round(closestDist)} mi from ${load.origin.name} pickup. Ready: ${closest.readiness}.`,
        loadId: load.id,
        driverId: closest.driverId,
        timestamp: now.toISOString(),
        actionLabel: "Assign Driver",
        dismissed: false,
      });
    }
  }

  return alerts.sort(
    (a, b) => severityWeight(b.severity) - severityWeight(a.severity),
  );
}

function severityWeight(s: CopilotAlert["severity"]): number {
  return { critical: 3, warning: 2, info: 1 }[s];
}

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
