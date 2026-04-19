// ELD HOS calculation engine — derives HOS remaining, shift summaries, violations
// from ELD event records using FMCSA 11/14-hour property-carrying rules.

import type { EldEvent, EldDutyStatus } from "./eld-mock";
import { getDriverEvents, getDriverCmv, eldDrivers, eldCmvs } from "./eld-mock";

export const HOS_DRIVE_LIMIT_H = 11;    // 11-hour driving limit
export const HOS_ON_DUTY_LIMIT_H = 14;  // 14-hour on-duty window
export const HOS_BREAK_REQUIRED_H = 8;  // 30-min break required after 8h drive
export const HOS_RESTART_H = 34;        // 34-hour restart

export interface DriverShiftSummary {
  driverId: string;
  driverName: string;
  initials: string;
  cmvUnit: string;
  cmvVin: string;
  currentStatus: EldDutyStatus;
  currentLocation: string;
  lastEventTs: number;       // ms
  shiftStartTs: number;      // ms — first on-duty event this cycle
  shiftElapsedH: number;     // hours since start of on-duty window
  driveTimeUsedH: number;    // hours behind the wheel this shift
  driveTimeRemainingH: number;
  onDutyTimeUsedH: number;   // includes driving + on-duty-not-driving
  onDutyWindowRemainingH: number;
  breakNeeded: boolean;      // true if 8h drive without 30min break
  hosViolationRisk: boolean; // < 2h drive remaining
  totalOdometerMi: number;
  totalEngineH: number;
  events: EldEvent[];        // sorted newest-first for display
  // Post-trip summary fields (derived from event chain)
  tripStartMiles: number;
  tripEndMiles: number;
  milesDrivenThisShift: number;
}

/**
 * Derive the full shift summary for a driver from their ELD events.
 * All calculations follow FMCSA 11/14-hour property-carrying rules.
 */
export function computeShiftSummary(driverId: string): DriverShiftSummary {
  const events = getDriverEvents(driverId); // newest first
  const driver = eldDrivers.find((d) => d.driverId === driverId);
  const cmvOrderNum = events[0]?.userOrderNumber ?? 1;
  const cmv = getDriverCmv(cmvOrderNum);
  const now = Date.now();

  // The shift starts at the earliest ON_DUTY or DRIVING event in this cycle
  const cycleEvents = events.filter((e) => e.dutyStatus !== "OFF_DUTY");
  const sortedAsc = [...cycleEvents].sort((a, b) => a.timestampMs - b.timestampMs);
  const shiftStartTs = sortedAsc[0]?.timestampMs ?? now;

  // Current status = most recent event's duty status
  const latestEvent = events[0];
  const currentStatus: EldDutyStatus = latestEvent?.dutyStatus ?? "OFF_DUTY";

  // Calculate drive time used: sum durations of DRIVING segments
  // and on-duty non-driving time for the 14h window
  let driveTimeUsedMs = 0;
  let onDutyTimeUsedMs = 0;
  let continuousDriveMs = 0; // since last 30-min break
  let breakNeeded = false;

  // Walk events oldest→newest to accumulate segment durations
  for (let i = sortedAsc.length - 1; i >= 0; i--) {
    const ev = sortedAsc[i];
    const nextEv = sortedAsc[i + 1]; // the event after this one chronologically
    const segEnd = nextEv ? nextEv.timestampMs : now;
    const segDurationMs = Math.max(0, segEnd - ev.timestampMs);

    if (ev.dutyStatus === "DRIVING") {
      driveTimeUsedMs += segDurationMs;
      continuousDriveMs += segDurationMs;
      onDutyTimeUsedMs += segDurationMs;
    } else if (ev.dutyStatus === "ON_DUTY") {
      onDutyTimeUsedMs += segDurationMs;
      // Reset continuous drive counter only after ≥30min break
      if (segDurationMs >= 30 * 60_000) continuousDriveMs = 0;
    } else if (ev.dutyStatus === "OFF_DUTY" || ev.dutyStatus === "SLEEPER") {
      if (segDurationMs >= 30 * 60_000) continuousDriveMs = 0;
    }
  }

  // If driver is currently driving, add time since last event
  if (currentStatus === "DRIVING" && latestEvent) {
    const ongoingMs = now - latestEvent.timestampMs;
    driveTimeUsedMs += ongoingMs;
    continuousDriveMs += ongoingMs;
    onDutyTimeUsedMs += ongoingMs;
  } else if (currentStatus === "ON_DUTY" && latestEvent) {
    onDutyTimeUsedMs += now - latestEvent.timestampMs;
  }

  const shiftElapsedH = (now - shiftStartTs) / 3600_000;
  const driveTimeUsedH = driveTimeUsedMs / 3600_000;
  const onDutyTimeUsedH = onDutyTimeUsedMs / 3600_000;

  const driveTimeRemainingH = Math.max(0, HOS_DRIVE_LIMIT_H - driveTimeUsedH);
  const onDutyWindowRemainingH = Math.max(0, HOS_ON_DUTY_LIMIT_H - shiftElapsedH);

  if (continuousDriveMs / 3600_000 >= HOS_BREAK_REQUIRED_H) breakNeeded = true;

  const hosViolationRisk = driveTimeRemainingH < 2;

  // Mileage
  const tripStartMiles = sortedAsc[0]?.totalVehicleMiles ?? 0;
  const latestMiles = latestEvent?.totalVehicleMiles ?? tripStartMiles;
  const milesDrivenThisShift = latestMiles - tripStartMiles;

  return {
    driverId,
    driverName: driver?.name ?? driverId,
    initials: driver?.initials ?? "??",
    cmvUnit: cmv?.powerUnitNumber ?? "—",
    cmvVin: cmv?.vin ?? "—",
    currentStatus,
    currentLocation: latestEvent?.location ?? driver?.currentLocation ?? "—",
    lastEventTs: latestEvent?.timestampMs ?? now,
    shiftStartTs,
    shiftElapsedH: Math.round(shiftElapsedH * 10) / 10,
    driveTimeUsedH: Math.round(driveTimeUsedH * 10) / 10,
    driveTimeRemainingH: Math.round(driveTimeRemainingH * 10) / 10,
    onDutyTimeUsedH: Math.round(onDutyTimeUsedH * 10) / 10,
    onDutyWindowRemainingH: Math.round(onDutyWindowRemainingH * 10) / 10,
    breakNeeded,
    hosViolationRisk,
    totalOdometerMi: latestEvent?.totalVehicleMiles ?? 0,
    totalEngineH: latestEvent?.totalEngineHours ?? 0,
    events,
    tripStartMiles,
    tripEndMiles: latestMiles,
    milesDrivenThisShift: Math.round(milesDrivenThisShift),
  };
}

/** Compute summaries for all 5 drivers. */
export function computeAllShiftSummaries(): DriverShiftSummary[] {
  return eldDrivers.map((d) => computeShiftSummary(d.driverId));
}

/** HOS gauge: 0–100 percent of drive limit used. */
export function hosPercent(summary: DriverShiftSummary): number {
  return Math.min(100, (summary.driveTimeUsedH / HOS_DRIVE_LIMIT_H) * 100);
}

/** Color class for HOS gauge based on remaining time. */
export function hosColor(summary: DriverShiftSummary): "emerald" | "amber" | "rose" {
  const rem = summary.driveTimeRemainingH;
  if (rem >= 4) return "emerald";
  if (rem >= 2) return "amber";
  return "rose";
}

/** Format duty status for display. */
export function formatDutyStatus(s: EldDutyStatus): string {
  const labels: Record<EldDutyStatus, string> = {
    DRIVING: "Driving",
    ON_DUTY: "On Duty",
    OFF_DUTY: "Off Duty",
    SLEEPER: "Sleeper Berth",
  };
  return labels[s];
}

/**
 * Post-trip analysis — builds a narrative & stats breakdown from completed events.
 * Uses the ELD event chain to reconstruct drive segments, stops, and violations.
 */
export interface PostTripAnalysis {
  driverId: string;
  driverName: string;
  cmvUnit: string;
  totalDriveH: number;
  totalOnDutyH: number;
  totalMilesDriven: number;
  averageSpeedMph: number;
  longestDriveSegmentH: number;
  breaksTaken: number;
  violations: { type: string; detail: string }[];
  complianceScore: number;   // 0–100
  segments: { status: EldDutyStatus; durationM: number; location: string }[];
}

export function buildPostTripAnalysis(driverId: string): PostTripAnalysis {
  const summary = computeShiftSummary(driverId);
  const sortedAsc = [...summary.events].sort((a, b) => a.timestampMs - b.timestampMs);
  const now = Date.now();

  const segments: PostTripAnalysis["segments"] = [];
  const violations: { type: string; detail: string }[] = [];
  let breaksTaken = 0;
  let longestDriveMs = 0;
  let continuousDriveMs = 0;

  for (let i = 0; i < sortedAsc.length; i++) {
    const ev = sortedAsc[i];
    const nextEv = sortedAsc[i + 1];
    const segEndMs = nextEv ? nextEv.timestampMs : now;
    const segDurationMs = Math.max(0, segEndMs - ev.timestampMs);
    const segDurationM = Math.round(segDurationMs / 60_000);

    segments.push({ status: ev.dutyStatus, durationM: segDurationM, location: ev.location });

    if (ev.dutyStatus === "DRIVING") {
      continuousDriveMs += segDurationMs;
      longestDriveMs = Math.max(longestDriveMs, continuousDriveMs);
    } else if (segDurationMs >= 30 * 60_000) {
      if (continuousDriveMs > 0) breaksTaken++;
      continuousDriveMs = 0;
    }
  }

  // HOS violations
  if (summary.driveTimeUsedH > HOS_DRIVE_LIMIT_H) {
    violations.push({
      type: "11-Hour Drive Limit Exceeded",
      detail: `Drove ${summary.driveTimeUsedH.toFixed(1)}h (limit: ${HOS_DRIVE_LIMIT_H}h)`,
    });
  }
  if (summary.shiftElapsedH > HOS_ON_DUTY_LIMIT_H) {
    violations.push({
      type: "14-Hour Window Exceeded",
      detail: `On-duty window ${summary.shiftElapsedH.toFixed(1)}h (limit: ${HOS_ON_DUTY_LIMIT_H}h)`,
    });
  }
  if (summary.breakNeeded && breaksTaken === 0) {
    violations.push({
      type: "30-Minute Break Required",
      detail: `Drove more than ${HOS_BREAK_REQUIRED_H}h without a 30-min break`,
    });
  }

  const avgSpeedMph =
    summary.driveTimeUsedH > 0 ? summary.milesDrivenThisShift / summary.driveTimeUsedH : 0;

  // Compliance: start at 100, deduct per violation
  const complianceScore = Math.max(0, 100 - violations.length * 20);

  return {
    driverId,
    driverName: summary.driverName,
    cmvUnit: summary.cmvUnit,
    totalDriveH: summary.driveTimeUsedH,
    totalOnDutyH: summary.onDutyTimeUsedH,
    totalMilesDriven: summary.milesDrivenThisShift,
    averageSpeedMph: Math.round(avgSpeedMph),
    longestDriveSegmentH: Math.round((longestDriveMs / 3600_000) * 10) / 10,
    breaksTaken,
    violations,
    complianceScore,
    segments,
  };
}
