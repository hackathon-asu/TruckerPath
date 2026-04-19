"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Shield, Sparkles, Truck, X } from "lucide-react";
import { api } from "@/lib/client";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { RoutingProfile, StopPoint } from "@/lib/types";
import type { RouteAlt, RouteOverlaySegment } from "@/lib/route";
import type { PostTripAnalysis } from "@/lib/eld-engine";
import { formatDutyStatus } from "@/lib/eld-engine";

interface Props {
  stops: StopPoint[];
  route: RouteAlt;
  profile: RoutingProfile;
  onClose: () => void;
}

const ELD_DRIVERS = [
  { id: "DRV001", name: "Jordan Reyes" },
  { id: "DRV002", name: "Priya Shah" },
  { id: "DRV003", name: "Alex Novak" },
  { id: "DRV004", name: "Mia Okonkwo" },
  { id: "DRV005", name: "Sam Chen" },
];

export function TripReport({ stops, route, profile, onClose }: Props) {
  const [mpg, setMpg] = useState(6);
  const [fuelPrice, setFuelPrice] = useState(3.85);
  const [opCostPerMile, setOpCostPerMile] = useState(1.2);
  const [otherCosts, setOtherCosts] = useState(0);
  const [insights, setInsights] = useState<string[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(true);
  const [eldDriverId, setEldDriverId] = useState("DRV001");
  const [postTrip, setPostTrip] = useState<PostTripAnalysis | null>(null);
  const [loadingEld, setLoadingEld] = useState(false);
  const miles = route.miles;
  const minutes = route.minutes;

  const gallons = useMemo(() => (mpg > 0 ? miles / mpg : 0), [miles, mpg]);
  const fuelCost = gallons * fuelPrice;
  const operating = miles * opCostPerMile;
  const total = fuelCost + operating + otherCosts;

  useEffect(() => {
    let alive = true;
    setLoadingInsights(true);
    api
      .tripInsights({ miles, minutes, stopCount: stops.length, profile, stops })
      .then((r) => {
        if (alive) setInsights(r.insights);
      })
      .finally(() => alive && setLoadingInsights(false));
    return () => { alive = false; };
  }, [miles, minutes, stops, profile]);

  // Fetch ELD post-trip analysis when driver changes
  useEffect(() => {
    let alive = true;
    setLoadingEld(true);
    fetch(`/api/eld-summary?driverId=${eldDriverId}&mode=post-trip`)
      .then((r) => r.json())
      .then((data: PostTripAnalysis) => { if (alive) setPostTrip(data); })
      .finally(() => alive && setLoadingEld(false));
    return () => { alive = false; };
  }, [eldDriverId]);

  return (
    <div
      className="flex h-full flex-col overflow-auto scrollbar-thin"
      style={{ width: "var(--panel-w)" }}
    >
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-ink-200 bg-white px-4 py-3">
        <button onClick={onClose} className="rounded p-1 hover:bg-ink-100">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 text-sm font-semibold">Trip Report</div>
        <button onClick={onClose} className="rounded p-1 text-ink-500 hover:bg-ink-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4 p-4">
        <section>
          <div className="mb-1 text-xs font-semibold text-ink-500">Truck Settings</div>
          <div className="text-xs text-ink-700">
            {profile.name}: Height: {profile.truck_ft_height}ft{profile.truck_in_height}in, Width:{" "}
            {profile.truck_ft_width}ft{profile.truck_in_width}in, Length: {profile.truck_ft_length}ft,
            Weight: {profile.weight_limit.toLocaleString()} lb, Axles: {profile.axles}, Trailers:{" "}
            {profile.trailers}
          </div>
        </section>

        <section>
          <div className="mb-1 text-xs font-semibold text-ink-500">Road Options</div>
          <div className="text-xs text-ink-700">
            Avoid U-turns, Avoid Unpaved Roads, Avoid Ferries
          </div>
        </section>

        <section className="rounded-md border border-ink-200 bg-white p-3">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-ink-700">
            <Shield className="h-3.5 w-3.5 text-brand-500" />
            Route Screening
          </div>
          <div className="flex flex-wrap gap-2">
            <ScreeningBadge
              tone={route.blocked ? "rose" : route.complianceScore >= 85 ? "emerald" : "amber"}
              label={route.blocked ? "Blocked" : `Compliance ${route.complianceScore}`}
            />
            <ScreeningBadge tone="slate" label={humanizeCoverage(route.coverageLevel)} />
            <ScreeningBadge tone="slate" label={humanizeBasis(route.routeBasis)} />
            <ScreeningBadge tone="slate" label={`${capitalize(route.screeningConfidence)} confidence`} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            <Stat label="Flagged Segments" value={String(route.overlays.length)} />
            <Stat label="Blocking Issues" value={String(route.violations.length)} />
          </div>

          {route.violations[0] && (
            <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              <div className="font-semibold">{route.violations[0].title}</div>
              <div className="mt-0.5 text-[11px] text-rose-600">{route.violations[0].message}</div>
            </div>
          )}

          <div className="mt-3 space-y-2">
            {route.overlays.length > 0 ? (
              route.overlays.map((overlay) => (
                <RouteOverlayCard key={overlay.id} overlay={overlay} />
              ))
            ) : (
              <div className="rounded-md border border-dashed border-ink-200 bg-ink-50 px-3 py-2 text-xs text-ink-500">
                No corridor-specific overlays matched this route. Federal baseline screening still applied.
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="mb-2 text-xs font-semibold text-ink-500">Itinerary</div>
          <div className="overflow-hidden rounded-md border border-ink-200">
            <table className="w-full text-[11px]">
              <thead className="bg-ink-50 text-ink-500">
                <tr>
                  <th className="p-2 text-left font-medium">Stop</th>
                  <th className="p-2 text-left font-medium">ETA</th>
                  <th className="p-2 text-left font-medium">Dwell</th>
                  <th className="p-2 text-right font-medium">Miles</th>
                </tr>
              </thead>
              <tbody>
                {stops.map((s, i) => (
                  <tr key={s.id} className="border-t border-ink-200">
                    <td className="p-2">
                      <div className="font-medium text-ink-900">{s.address_name}</div>
                      <div className="text-ink-500">{i === 0 ? "Origin" : i === stops.length - 1 ? "Destination" : "Stop"}</div>
                    </td>
                    <td className="p-2 text-ink-700">{s.appointment_time ?? "—"}</td>
                    <td className="p-2 text-ink-700">{s.dwell_time ? `${s.dwell_time}m` : "—"}</td>
                    <td className="p-2 text-right text-ink-700">
                      {i === 0 ? "—" : ((miles * i) / (stops.length - 1)).toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-ink-500">
            <span>Total drive time</span>
            <span className="font-semibold text-ink-900">{formatDuration(minutes)}</span>
          </div>
        </section>

        <section>
          <div className="mb-2 text-xs font-semibold text-ink-500">Trip Cost</div>
          <div className="grid grid-cols-2 gap-3">
            <LabeledInput label="Truck MPG" suffix="MPG" value={mpg} onChange={setMpg} />
            <LabeledInput label="Average Fuel Price" suffix="/Gal" prefix="$" value={fuelPrice} onChange={setFuelPrice} />
            <LabeledInput label="Operating Cost / Mile" suffix="/Mi" prefix="$" value={opCostPerMile} onChange={setOpCostPerMile} />
            <LabeledInput label="Other Costs" prefix="$" value={otherCosts} onChange={setOtherCosts} />
          </div>
          <div className="mt-3 space-y-1 rounded-md border border-ink-200 bg-ink-50 p-3 text-xs">
            <Row label="Gallons Burned" value={`${gallons.toFixed(1)} Gallon`} />
            <Row label="Fuel Cost" value={`$${fuelCost.toFixed(2)}`} />
            <Row label="Operating Cost" value={`$${operating.toFixed(2)}`} />
            <Row label="Other Cost" value={`$${otherCosts.toFixed(2)}`} />
            <div className="mt-1 flex items-center justify-between border-t border-ink-200 pt-1 text-sm">
              <span className="font-semibold">Total Expense</span>
              <span className="font-semibold text-brand-500">${total.toFixed(2)}</span>
            </div>
          </div>
        </section>

        <section className="rounded-md border border-brand-500/20 bg-brand-50 p-3">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-brand-700">
            <Sparkles className="h-3.5 w-3.5" />
            AI Trip Insights
          </div>
          {loadingInsights ? (
            <div className="text-xs text-ink-500">Analysing route…</div>
          ) : (
            <ul className="space-y-1 text-xs text-ink-700">
              {insights.map((t, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className="text-brand-500">•</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Post-Trip ELD Analysis ── */}
        <section className="rounded-md border border-ink-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink-200 px-4 py-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-ink-700">
              <Truck className="h-3.5 w-3.5 text-brand-500" />
              Post-Trip ELD Analysis
            </div>
            <select
              value={eldDriverId}
              onChange={(e) => setEldDriverId(e.target.value)}
              className="rounded border border-ink-200 bg-ink-50 px-2 py-1 text-[11px] text-ink-700"
            >
              {ELD_DRIVERS.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {loadingEld && (
            <div className="p-4 text-xs text-ink-500">Loading ELD data…</div>
          )}

          {!loadingEld && postTrip && (
            <div className="p-4 space-y-3">
              {/* Compliance score */}
              <div className="flex items-center justify-between rounded-lg border border-ink-200 p-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">HOS Compliance Score</div>
                  <div className={cn(
                    "mt-0.5 text-2xl font-bold",
                    postTrip.complianceScore === 100 ? "text-emerald-600"
                      : postTrip.complianceScore >= 80 ? "text-amber-600" : "text-rose-600",
                  )}>
                    {postTrip.complianceScore}/100
                  </div>
                </div>
                {postTrip.complianceScore === 100 ? (
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                ) : (
                  <Shield className="h-8 w-8 text-amber-500" />
                )}
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <Stat label="Drive Time" value={`${postTrip.totalDriveH.toFixed(1)}h`} />
                <Stat label="On Duty" value={`${postTrip.totalOnDutyH.toFixed(1)}h`} />
                <Stat label="Miles Driven" value={`${postTrip.totalMilesDriven} mi`} />
                <Stat label="Avg Speed" value={`${postTrip.averageSpeedMph} mph`} />
                <Stat label="Breaks Taken" value={String(postTrip.breaksTaken)} />
                <Stat label="Vehicle" value={postTrip.cmvUnit} />
              </div>

              {/* Violations */}
              {postTrip.violations.length > 0 ? (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-rose-600">Violations</div>
                  {postTrip.violations.map((v, i) => (
                    <div key={i} className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                      <div className="font-semibold">{v.type}</div>
                      <div className="text-[10px] text-rose-600">{v.detail}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  ✓ No HOS violations recorded for this duty cycle
                </div>
              )}

              {/* ELD event log */}
              <div>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-400">ELD Event Log</div>
                <div className="overflow-hidden rounded-md border border-ink-200">
                  <table className="w-full text-[10px]">
                    <thead className="bg-ink-50 text-ink-500">
                      <tr>
                        <th className="p-2 text-left font-medium">Status</th>
                        <th className="p-2 text-right font-medium">Duration</th>
                        <th className="p-2 text-left font-medium">Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {postTrip.segments.map((seg, i) => (
                        <tr key={i} className="border-t border-ink-100">
                          <td className="p-2">
                            <span className={cn(
                              "rounded-full px-1.5 py-0.5 font-semibold uppercase",
                              seg.status === "DRIVING" ? "bg-brand-100 text-brand-700"
                                : seg.status === "ON_DUTY" ? "bg-emerald-100 text-emerald-700"
                                : seg.status === "SLEEPER" ? "bg-purple-100 text-purple-700"
                                : "bg-ink-100 text-ink-500",
                            )}>
                              {formatDutyStatus(seg.status)}
                            </span>
                          </td>
                          <td className="p-2 text-right font-medium text-ink-700">
                            {seg.durationM >= 60
                              ? `${(seg.durationM / 60).toFixed(1)}h`
                              : `${seg.durationM}m`}
                          </td>
                          <td className="p-2 truncate text-ink-500 max-w-[140px]">{seg.location}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-500">{label}</span>
      <span className="font-medium text-ink-900">{value}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-ink-200 bg-ink-50 p-2">
      <div className="text-ink-400">{label}</div>
      <div className="mt-0.5 font-semibold text-ink-800">{value}</div>
    </div>
  );
}

function ScreeningBadge({
  tone,
  label,
}: {
  tone: "emerald" | "amber" | "rose" | "slate";
  label: string;
}) {
  const classes = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    slate: "border-ink-200 bg-ink-50 text-ink-700",
  }[tone];

  return <span className={cn("rounded-full border px-2 py-1 text-[11px] font-medium", classes)}>{label}</span>;
}

function RouteOverlayCard({ overlay }: { overlay: RouteOverlaySegment }) {
  const tone =
    overlay.status === "violation"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : overlay.status === "advisory"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <div className={cn("rounded-md border px-3 py-2 text-xs", tone)}>
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold">{overlay.title}</div>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
          {overlay.status}
        </span>
      </div>
      <div className="mt-1 text-[11px]">{overlay.message}</div>
      {overlay.states.length > 0 && (
        <div className="mt-1 text-[10px] font-medium uppercase tracking-wide opacity-80">
          {overlay.states.join(", ")}
        </div>
      )}
    </div>
  );
}

function humanizeCoverage(value: RouteAlt["coverageLevel"]) {
  if (value === "state-overlay-screened") return "State overlays active";
  if (value === "federal-only") return "Federal baseline";
  return "Generic only";
}

function humanizeBasis(value: RouteAlt["routeBasis"]) {
  if (value === "state-overlay-screened") return "State-screened";
  if (value === "federal-backbone-screened") return "Federal-screened";
  return "Generic preview";
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}


function LabeledInput({
  label,
  suffix,
  prefix,
  value,
  onChange,
}: {
  label: string;
  suffix?: string;
  prefix?: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] text-ink-500">{label}</div>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-ink-400">
            {prefix}
          </span>
        )}
        <input
          type="number"
          className={`input ${prefix ? "pl-6" : ""} ${suffix ? "pr-12" : ""}`}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-ink-400">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}
