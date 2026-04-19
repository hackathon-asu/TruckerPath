import type { Driver, RoutingProfile, Terminal, Vehicle } from "./types";
import type { DispatchRecommendation, ParkingRiskResult, DetentionImpactResult, CopilotAlert } from "./types";
import type { RouteAlt } from "./route";

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  queryDrivers: (body: { search?: string; work_status?: string }) =>
    jsonFetch<{ live: boolean; drivers: Driver[] }>("/api/navpro/drivers", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  inviteDriver: (body: unknown) =>
    jsonFetch<{ live: boolean; invite: unknown }>("/api/navpro/drivers/invite", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listProfiles: () =>
    jsonFetch<{ live: boolean; profiles: RoutingProfile[] }>("/api/navpro/routing-profiles"),
  createProfile: (body: Partial<RoutingProfile> & { hazmat?: boolean }) =>
    jsonFetch<{ live: boolean; profile: RoutingProfile }>("/api/navpro/routing-profiles", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listVehicles: () =>
    jsonFetch<{ live: boolean; vehicles: Vehicle[] }>("/api/navpro/vehicles"),
  listTerminals: () =>
    jsonFetch<{ live: boolean; terminals: Terminal[] }>("/api/navpro/terminals"),
  createTrip: (body: unknown) =>
    jsonFetch<{ live: boolean; trip: { trip_id: string } }>("/api/navpro/trips", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  geocode: (q: string) =>
    jsonFetch<{ results: { id: number; name: string; latitude: number; longitude: number }[] }>(
      `/api/geocode?q=${encodeURIComponent(q)}`,
    ),
  calcRoute: (stops: { latitude: number; longitude: number }[]) =>
    jsonFetch<{ routes: RouteAlt[]; fallback?: boolean }>("/api/route-calc", {
      method: "POST",
      body: JSON.stringify({ stops }),
    }),
  tripInsights: (body: unknown) =>
    jsonFetch<{ insights: string[]; fuelGal: number; fuelCost: number; tolls: number }>(
      "/api/trip-insights",
      { method: "POST", body: JSON.stringify(body) },
    ),

  // ── Dispatcher CoPilot APIs ──
  dispatchScore: (loadId: string) =>
    jsonFetch<DispatchRecommendation>("/api/dispatch-score", {
      method: "POST",
      body: JSON.stringify({ loadId }),
    }),
  parkingRisk: (params: { loadId: string; hosRemaining?: number; delayMinutes?: number }) =>
    jsonFetch<ParkingRiskResult>("/api/parking-risk", {
      method: "POST",
      body: JSON.stringify(params),
    }),
  detentionImpact: (params: { loadId: string; delayMinutes: number }) =>
    jsonFetch<DetentionImpactResult>("/api/detention-impact", {
      method: "POST",
      body: JSON.stringify(params),
    }),
  copilotAlerts: () =>
    jsonFetch<{ alerts: CopilotAlert[] }>("/api/copilot-alerts"),
};

