import { mockDrivers, mockVehicles, mockTerminals } from "@/lib/mock";
import { getJson, postJson, liveMode } from "@/lib/navpro";
import type { Driver, Vehicle, Terminal } from "@/lib/types";
import { IconRail } from "@/components/icon-rail";
import { TopHeader } from "@/components/top-header";
import { Activity, CheckCircle2, Truck, Users, Wallet } from "lucide-react";
import { niceStatus, shortRelative } from "@/lib/format";

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
  const inTransit = drivers.filter((d) => d.work_status === "IN_TRANSIT").length;
  const active = drivers.filter((d) => d.work_status !== "INACTIVE").length;
  const activeVehicles = vehicles.filter((v) => v.status === "ACTIVE").length;
  const utilization = vehicles.length ? Math.round((activeVehicles / vehicles.length) * 100) : 0;

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

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={<Users className="h-4 w-4" />} label="Active Drivers" value={active} sub={`of ${drivers.length} total`} />
              <StatCard icon={<Activity className="h-4 w-4" />} label="In Transit" value={inTransit} sub="right now" />
              <StatCard icon={<Truck className="h-4 w-4" />} label="Vehicle Utilization" value={`${utilization}%`} sub={`${activeVehicles} / ${vehicles.length} active`} />
              <StatCard icon={<Wallet className="h-4 w-4" />} label="Terminals" value={terminals.length} sub="across network" />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <section className="card lg:col-span-2">
                <header className="flex items-center justify-between border-b border-ink-200 px-4 py-3">
                  <h2 className="text-sm font-semibold">Driver Roster</h2>
                  <span className="text-xs text-ink-500">{drivers.length} drivers</span>
                </header>
                <div className="divide-y divide-ink-200">
                  {drivers.map((d) => (
                    <div key={d.driver_id} className="flex items-center gap-3 px-4 py-3 text-sm">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                        {d.driver_first_name[0]}
                        {d.driver_last_name[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">
                          {d.driver_first_name} {d.driver_last_name}
                        </div>
                        <div className="truncate text-[11px] text-ink-500">
                          {d.terminal} · {shortRelative(d.latest_update)}
                        </div>
                      </div>
                      <StatusPill s={d.work_status} />
                    </div>
                  ))}
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

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-ink-500">
        <span>{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-ink-900">{value}</div>
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
