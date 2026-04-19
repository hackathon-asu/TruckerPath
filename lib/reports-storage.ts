"use client";

import type { DispatcherSnapshot } from "./types";

export interface DemoOpsState {
  tasks: Record<string, "open" | "snoozed" | "dismissed" | "completed">;
  alerts: Record<string, "new" | "acknowledged" | "snoozed">;
  assignments: Record<string, { driverId: string; assignedAt: string }>;
  docs: Record<string, "blocked" | "review" | "approved">;
}

const STORAGE_KEY = "truckerpath-dispatcher-os-demo";

const EMPTY_STATE: DemoOpsState = {
  tasks: {},
  alerts: {},
  assignments: {},
  docs: {},
};

export function readDemoOpsState(): DemoOpsState {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    return { ...EMPTY_STATE, ...(JSON.parse(raw) as DemoOpsState) };
  } catch {
    return EMPTY_STATE;
  }
}

export function writeDemoOpsState(state: DemoOpsState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function mergeDemoState(snapshot: DispatcherSnapshot, state: DemoOpsState): DispatcherSnapshot {
  const assignedLoadIds = new Set(Object.keys(state.assignments));
  return {
    ...snapshot,
    tasks: snapshot.tasks.map((task) => ({
      ...task,
      status: state.tasks[task.id] ?? task.status,
    })),
    alerts: snapshot.alerts.map((alert) => ({
      ...alert,
      status: state.alerts[alert.id] ?? alert.status,
    })),
    urgentBand: snapshot.urgentBand.map((alert) => ({
      ...alert,
      status: state.alerts[alert.id] ?? alert.status,
    })),
    documentCases: snapshot.documentCases.map((doc) => ({
      ...doc,
      reconciliationStatus: state.docs[doc.id] ?? doc.reconciliationStatus,
    })),
    loads: snapshot.loads.map((load) => {
      const override = state.assignments[load.id];
      if (!override) return load;
      const driver = snapshot.drivers.find((entry) => entry.id === override.driverId);
      return {
        ...load,
        assignedDriverId: override.driverId,
        bestMatchDriverId: override.driverId,
        bestMatchDriverName: driver ? `${driver.firstName} ${driver.lastName}` : load.bestMatchDriverName,
      };
    }),
    kpis: snapshot.kpis.map((kpi) =>
      kpi.key === "open_loads"
        ? {
            ...kpi,
            rawValue: Math.max(0, kpi.rawValue - assignedLoadIds.size),
            value: String(Math.max(0, kpi.rawValue - assignedLoadIds.size)),
          }
        : kpi,
    ),
  };
}
