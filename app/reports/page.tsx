import { mockDrivers, mockVehicles, mockTerminals } from "@/lib/mock";
import { getJson, postJson, liveMode } from "@/lib/navpro";
import type { Driver, Vehicle, Terminal } from "@/lib/types";
import { IconRail } from "@/components/icon-rail";
import { TopHeader } from "@/components/top-header";
import { Activity, CheckCircle2, Shield, Truck, Users, Wallet } from "lucide-react";
import { niceStatus, shortRelative } from "@/lib/format";
import { computeAllShiftSummaries } from "@/lib/eld-engine";
import { hosColor } from "@/lib/eld-engine";
import type { DriverShiftSummary } from "@/lib/eld-engine";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

async function loadData() {
  const [d, v, t] = await Promise.all([
    postJson<{ content: Driver[] }>("/api/driver/query", { page: 0, size: 100 }, { content: mockDrivers }),
    postJson<{ content: Vehicle[] }>("/api/vehicle/query", { page: 0, size: 100 }, { content: mockVehicles }),
    getJson<{ content: Terminal[] }>("/api/terminal/get/list", { content: mockTerminals }),
  ]);
  return {
    drivers: d.data?.content ?? mockDrivers,
    vehicles: v.data?.content ?? mockVehicles,
    terminals: t.data?.content ?? mockTerminals,
    live: liveMode,
  };
}

export default async function ReportsPage() {
  const { drivers, vehicles, terminals, live } = await loadData();
  const eldSummaries = computeAllShiftSummaries();

  const inTransit = drivers.filter((d) => d.work_status === "IN_TRANSIT").length;
  const active = drivers.filter((d) => d.work_status !== "INACTIVE").length;
  const activeVehicles = vehicles.filter((v) => v.status === "ACTIVE").length;
  const utilization = vehicles.length ? Math.round((activeVehicles / vehicles.length) * 100) : 0;
  const hosAlerts = eldSummaries.filter((s) => s.hosViolationRisk || s.breakNeeded).length;

  return (
    <div className="flex h-screen flex-col">
      <TopHeader />
      <div className="flex flex-1 overflow-hidden">
        <IconRail />
        <main className="flex-1 overflow-auto bg-ink-50 p-8">
          <div className="mx-auto max-w-6xl">
            <div className="flex items-end justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Fleet Reports</h1>
                <p className="mt-1 text-sm text-ink-500">
                  Snapshot of today's operations · {live ? "live NavPro data" : "demo data (set NAVPRO_API_BEARER_TOKEN for live)"}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  live ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                }`}
              >
                {live ? "Live" : "Demo"}
              </span>
            </div>

            {/* KPI stat cards */}
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={<Users className="h-4 w-4" />} label="Active Drivers" value={active} sub={`of ${drivers.length} total`} />
              <StatCard icon={<Activity className="h-4 w-4" />} label="In Transit" value={inTransit} sub="right now" />
              <StatCard icon={<Truck className="h-4 w-4" />} label="Vehicle Utilization" value={`${utilization}%`} sub={`${activeVehicles} / ${vehicles.length} active`} />
              <StatCard
                icon={<Shield className="h-4 w-4" />}
                label="HOS Alerts"
                value={hosAlerts}
                sub={hosAlerts === 0 ? "fleet compliant" : `${hosAlerts} driver${hosAlerts > 1 ? "s" : ""} at risk`}
                accent={hosAlerts > 0 ? "text-amber-600" : undefined}
              />
            </div>

            {/* ELD Shift Status Table */}
            <div className="mt-6">
              <section className="card overflow-hidden">
                <header className="flex items-center justify-between border-b border-ink-200 px-4 py-3">
                  <h2 className="text-sm font-semibold">ELD Shift Status — Live</h2>
                  <span className="flex items-center gap-1.5 text-[11px] text-ink-500">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                    ELD Data
                  </span>
                </header>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-ink-50 text-[10px] uppercase tracking-wider text-ink-500">
                      <tr>
                        <th className="p-3 text-left font-medium">Driver</th>
                        <th className="p-3 text-left font-medium">Vehicle</th>
                        <th className="p-3 text-left font-medium">Duty Status</th>
                        <th className="p-3 text-left font-medium">Location</th>
                        <th className="p-3 text-center font-medium">Drive Time Used</th>
                        <th className="p-3 text-center font-medium">HOS Remaining</th>
                        <th className="p-3 text-center font-medium">Miles Today</th>
                        <th className="p-3 text-center font-medium">Compliance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {eldSummaries.map((s) => (
                        <EldRow key={s.driverId} s={s} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            {/* Driver Roster + Vehicles */}
            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <section className="card lg:col-span-2">
                <header className="flex items-center justify-between border-b border-ink-200 px-4 py-3">
                  <h2 className="text-sm font-semibold">Driver Roster</h2>
                  <span className="text-xs text-ink-500">{drivers.length} drivers</span>
                </header>
                <div className="divide-y divide-ink-200">
                  {drivers.map((d) => {
                    // Find matching ELD summary (driver_id is numeric, ELD uses DRV00x)
                    const eldMatch = eldSummaries.find(
                      (s) => `DRV00${d.driver_id}` === s.driverId || `DRV0${d.driver_id}` === s.driverId,
                    );
                    return (
                      <div key={d.driver_id} className="flex items-center gap-3 px-4 py-3 text-sm">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                          {d.driver_first_name[0]}{d.driver_last_name[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">
                            {d.driver_first_name} {d.driver_last_name}
                          </div>
                          <div className="flex items-center gap-2 truncate text-[11px] text-ink-500">
                            <span>{d.terminal}</span>
                            {eldMatch && (
                              <>
                                <span>·</span>
                                <span>{eldMatch.cmvUnit}</span>
                                <span>·</span>
                                <span>{eldMatch.totalOdometerMi.toLocaleString()} mi</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {eldMatch && (
                            <div className={cn(
                              "text-xs font-semibold",
                              hosColor(eldMatch) === "emerald" ? "text-emerald-600"
                                : hosColor(eldMatch) === "amber" ? "text-amber-600" : "text-rose-600",
                            )}>
                              {eldMatch.driveTimeRemainingH.toFixed(1)}h
                            </div>
                          )}
                          <StatusPill s={d.work_status} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="card">
                <header className="flex items-center justify-between border-b border-ink-200 px-4 py-3">
                  <h2 className="text-sm font-semibold">Vehicles</h2>
                  <span className="text-xs text-ink-500">{vehicles.length}</span>
                </header>
                <div className="divide-y divide-ink-200">
                  {vehicles.map((v) => (
                    <div key={v.vehicle_id} className="px-4 py-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{v.vehicle_name}</span>
                        <span
                          className={`text-[10px] uppercase tracking-wider ${
                            v.status === "ACTIVE" ? "text-emerald-600" : "text-ink-400"
                          }`}
                        >
                          {v.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-ink-500">
                        {v.vehicle_plate ?? "—"} · {v.assigned_driver ?? "Unassigned"}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Terminals */}
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {terminals.map((t) => (
                <div key={t.terminal_id} className="card p-4">
                  <div className="text-sm font-semibold">{t.terminal_name}</div>
                  <div className="text-[11px] text-ink-500">{t.location}</div>
                  <div className="mt-3 flex items-center gap-1 text-xs text-ink-700">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    {t.member_count ?? 0} members
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function EldRow({ s }: { s: DriverShiftSummary }) {
  const color = hosColor(s);
  const hosBarPct = Math.min(100, (s.driveTimeUsedH / 11) * 100);
  const isActive = s.currentStatus !== "OFF_DUTY";

  return (
    <tr className="hover:bg-ink-50">
      <td className="p-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-700">
            {s.initials}
          </div>
          <span className="font-medium text-ink-900">{s.driverName}</span>
        </div>
      </td>
      <td className="p-3 text-ink-600">{s.cmvUnit}</td>
      <td className="p-3">
        <DutyBadge status={s.currentStatus} />
      </td>
      <td className="p-3 max-w-[160px] truncate text-ink-500">{s.currentLocation}</td>
      <td className="p-3">
        <div className="flex flex-col items-center gap-1">
          <span className="font-semibold text-ink-800">{isActive ? `${s.driveTimeUsedH.toFixed(1)}h` : "—"}</span>
          {isActive && (
            <div className="h-1 w-16 overflow-hidden rounded-full bg-ink-100">
              <div
                className={cn("h-full rounded-full", {
                  emerald: "bg-emerald-500",
                  amber: "bg-amber-500",
                  rose: "bg-rose-500",
                }[color])}
                style={{ width: `${hosBarPct}%` }}
              />
            </div>
          )}
        </div>
      </td>
      <td className="p-3 text-center">
        {isActive ? (
          <span className={cn(
            "font-bold",
            color === "emerald" ? "text-emerald-600"
              : color === "amber" ? "text-amber-600" : "text-rose-600",
          )}>
            {s.driveTimeRemainingH.toFixed(1)}h
          </span>
        ) : (
          <span className="text-ink-400">Resting</span>
        )}
      </td>
      <td className="p-3 text-center text-ink-700">
        {s.milesDrivenThisShift > 0 ? `${s.milesDrivenThisShift} mi` : "—"}
      </td>
      <td className="p-3 text-center">
        {s.currentStatus === "OFF_DUTY" ? (
          <span className="text-ink-400">—</span>
        ) : s.hosViolationRisk || s.breakNeeded ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            {s.hosViolationRisk ? "HOS Risk" : "Break Due"}
          </span>
        ) : (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            OK
          </span>
        )}
      </td>
    </tr>
  );
}

function DutyBadge({ status }: { status: DriverShiftSummary["currentStatus"] }) {
  const styles: Record<DriverShiftSummary["currentStatus"], string> = {
    DRIVING: "bg-brand-100 text-brand-700",
    ON_DUTY: "bg-emerald-100 text-emerald-700",
    SLEEPER: "bg-purple-100 text-purple-700",
    OFF_DUTY: "bg-ink-100 text-ink-500",
  };
  const labels: Record<DriverShiftSummary["currentStatus"], string> = {
    DRIVING: "Driving",
    ON_DUTY: "On Duty",
    SLEEPER: "Sleeper",
    OFF_DUTY: "Off Duty",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", styles[status])}>
      {labels[status]}
    </span>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-ink-500">
        <span>{icon}</span>
        {label}
      </div>
      <div className={cn("mt-2 text-2xl font-semibold", accent ?? "text-ink-900")}>{value}</div>
      {sub && <div className="text-[11px] text-ink-500">{sub}</div>}
    </div>
  );
}

function StatusPill({ s }: { s: Driver["work_status"] }) {
  const cls = {
    AVAILABLE: "bg-emerald-50 text-emerald-700",
    IN_TRANSIT: "bg-brand-50 text-brand-700",
    INACTIVE: "bg-ink-100 text-ink-500",
  }[s];
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>{niceStatus(s)}</span>;
}
