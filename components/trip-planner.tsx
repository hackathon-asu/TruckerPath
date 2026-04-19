"use client";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Clock,
  FileBarChart,
  Fuel,
  GripVertical,
  Heart,
  Map as MapIcon,
  MapPin,
  MoreHorizontal,
  Navigation,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { api } from "@/lib/client";
import { formatDuration, formatMiles } from "@/lib/format";
import { useSavedRoutes } from "@/lib/saved-routes";
import type { RouteAlt } from "@/lib/route";
import type { RoutingProfile, StopPoint } from "@/lib/types";
import { StopSearch } from "./stop-search";
import { RoutingProfileCard } from "./routing-profile-card";

interface Props {
  profiles: RoutingProfile[];
  profile?: RoutingProfile;
  setProfile: (p: RoutingProfile) => void;
  stops: StopPoint[];
  setStops: (s: StopPoint[]) => void;
  routes: RouteAlt[];
  setRoutes: (r: RouteAlt[]) => void;
  activeRouteId: string | null;
  setActiveRouteId: (id: string | null) => void;
  onOpenReport: () => void;
  onOpenDirections: () => void;
  onOpenPois: () => void;
  onOpenFuel: () => void;
  onOpenWeather: () => void;
  onOpenDocuments: () => void;
  onOpenAddProfile: () => void;
  onSendRoute: () => void;
  sending: boolean;
}

export function TripPlanner({
  profiles,
  profile,
  setProfile,
  stops,
  setStops,
  routes,
  setRoutes,
  activeRouteId,
  setActiveRouteId,
  onOpenReport,
  onOpenDirections,
  onOpenPois,
  onOpenFuel,
  onOpenWeather,
  onOpenDocuments,
  onOpenAddProfile,
  onSendRoute,
  sending,
}: Props) {
  const [tab, setTab] = useState<"recent" | "saved" | "shared">("recent");
  const { items: saved, save: saveRoute, remove } = useSavedRoutes();
  const active = routes.find((r) => r.id === activeRouteId) ?? routes[0] ?? null;
  const topAdvisory =
    active?.advisories.find((notice) => notice.type !== "coverage") ?? active?.advisories[0] ?? null;

  useEffect(() => {
    if (stops.length < 2) {
      setRoutes([]);
      setActiveRouteId(null);
      return;
    }
    let alive = true;
    api
      .calcRoute({
        stops: stops.map((s) => ({ latitude: s.latitude, longitude: s.longitude })),
        profile,
      })
      .then((r) => {
        if (!alive) return;
        setRoutes(r.routes);
        setActiveRouteId(r.routes[0]?.id ?? null);
      });
    return () => {
      alive = false;
    };
  }, [profile, stops, setRoutes, setActiveRouteId]);

  const addStop = (s: StopPoint) => setStops([...stops, s]);
  const removeStop = (id: string) => setStops(stops.filter((x) => x.id !== id));
  const clearTrip = () => {
    setStops([]);
    setRoutes([]);
    setActiveRouteId(null);
  };

  return (
    <div className="flex h-full flex-col bg-ink-50">
      <Tabs />
      <div className="flex-1 space-y-3 overflow-auto p-3 scrollbar-thin">
        <RoutingProfileCard
          profile={profile}
          profiles={profiles}
          onChange={setProfile}
          onAdd={onOpenAddProfile}
        />

        {stops.length > 0 && (
          <div className="card divide-y divide-ink-200">
            {stops.map((s, i) => (
              <StopRow
                key={s.id}
                index={i}
                count={stops.length}
                stop={s}
                leg={i > 0 ? active?.legs[i - 1] : undefined}
                cumulativeMinutes={sumMinutes(active, i)}
                onRemove={() => removeStop(s.id)}
              />
            ))}
          </div>
        )}

        <StopSearch onPick={addStop} />

        {routes.length > 0 && active && (
          <div className="card p-3">
            <div className="flex items-center gap-4 border-b border-ink-100 pb-2">
              {routes.map((r, i) => (
                <button
                  key={r.id}
                  onClick={() => setActiveRouteId(r.id)}
                  className={cn(
                    "text-xs font-semibold",
                    r.id === active.id ? "text-brand-500" : "text-ink-400 hover:text-ink-600",
                  )}
                >
                  Route {i + 1}
                </button>
              ))}
              <span className="ml-auto text-[11px] text-ink-500">
                {stops.length} stop{stops.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="mt-2 text-xs font-semibold uppercase text-brand-500">{active.label}</div>
            <div className="mt-2 grid grid-cols-4 gap-2 text-center">
              <Metric icon={<Clock className="h-3.5 w-3.5" />} label="Drive Time" value={formatDuration(active.minutes)} />
              <Metric icon={<Fuel className="h-3.5 w-3.5" />} label="Est. Gallons" value={`${active.gallons.toFixed(0)}gal`} />
              <Metric icon={<Fuel className="h-3.5 w-3.5" />} label="Est. Fuel Cost" value={`$${formatThousands(active.fuelCost)}`} />
              <Metric icon={<MapIcon className="h-3.5 w-3.5" />} label="Tolls" value={`$${active.tolls.toFixed(1)}`} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
              <StatusBadge
                tone={active.blocked ? "rose" : active.complianceScore >= 85 ? "emerald" : "amber"}
                label={active.blocked ? "Blocked" : `Compliance ${active.complianceScore}`}
              />
              <StatusBadge tone="slate" label={humanizeCoverage(active.coverageLevel)} />
              <StatusBadge tone="slate" label={humanizeBasis(active.routeBasis)} />
            </div>
            {active.violations.length > 0 && (
              <RouteNotice tone="critical" title={active.violations[0].title} message={active.violations[0].message} />
            )}
            {active.violations.length === 0 && topAdvisory && (
              <RouteNotice tone="warning" title={topAdvisory.title} message={topAdvisory.message} />
            )}
          </div>
        )}

        {stops.length >= 2 && (
          <div className="card divide-y divide-ink-200 text-sm">
            <ActionRow icon={<FileBarChart className="h-4 w-4" />} label="Trip Report" onClick={onOpenReport} />
            <ActionRow icon={<Fuel className="h-4 w-4" />} label="Fuel Plan" onClick={onOpenFuel} />
            <ActionRow icon={<Navigation className="h-4 w-4" />} label="Directions" onClick={onOpenDirections} />
            <ActionRow icon={<MapPin className="h-4 w-4" />} label="POIs Along Route" onClick={onOpenPois} />
            <ActionRow icon={<MapIcon className="h-4 w-4" />} label="Weather Alerts" onClick={onOpenWeather} />
            <ActionRow icon={<FileBarChart className="h-4 w-4" />} label="Documents" onClick={onOpenDocuments} />
          </div>
        )}

        {tab === "recent" && stops.length === 0 && <EmptyRecent />}

        {tab === "saved" && (
          <SavedList
            items={saved}
            onLoad={(id) => {
              const r = saved.find((x) => x.id === id);
              if (r) setStops(r.stops);
            }}
            onRemove={remove}
          />
        )}

        {tab === "shared" && <EmptyShared />}
      </div>

      {/* bottom bar */}
      <div className="border-t border-ink-200 bg-white p-3">
        {stops.length === 0 ? (
          <button className="btn-outline w-full text-rose-500" onClick={clearTrip}>
            <Trash2 className="h-4 w-4" />
            Clear Trip
          </button>
        ) : (
          <div className="flex gap-2">
            <button className="btn-outline flex-1" onClick={clearTrip}>
              <Trash2 className="h-4 w-4 text-rose-500" />
              Clear
            </button>
            <button
              className="btn-outline flex-1"
              onClick={() => {
                if (stops.length < 2) return;
                saveRoute({
                  name: `${stops[0].address_name} → ${stops[stops.length - 1].address_name}`,
                  stops,
                  miles: active?.miles,
                  minutes: active?.minutes,
                  profileId: profile?.id,
                });
              }}
            >
              <Heart className="h-4 w-4" />
              Save
            </button>
            <button
              className="btn-primary flex-[1.2] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={stops.length < 2 || sending || !!active?.blocked}
              onClick={onSendRoute}
            >
              <Send className="h-4 w-4" />
              {sending ? "Sending…" : active?.blocked ? "Review Needed" : "Send Route"}
            </button>
          </div>
        )}
      </div>

      {/* Local tabs impl (needs access to tab state) */}
      <style jsx>{``}</style>
    </div>
  );

  function Tabs() {
    const tabs = [
      { id: "recent", label: "Recent Trips" },
      { id: "saved", label: "Saved Routes" },
      { id: "shared", label: "Shared Trips" },
    ] as const;
    return (
      <div className="flex items-center gap-4 border-b border-ink-200 bg-white px-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "relative py-2.5 text-sm font-medium",
              tab === t.id
                ? "text-brand-500 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand-500"
                : "text-ink-500 hover:text-ink-900",
            )}
          >
            {t.label}
          </button>
        ))}
        <button className="ml-auto rounded p-1 text-ink-400 hover:bg-ink-100">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
    );
  }
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md bg-ink-50 p-2">
      <div className="flex items-center justify-center gap-1 text-[10px] text-ink-500">
        {icon}
        {label}
      </div>
      <div className="text-sm font-semibold text-ink-900">{value}</div>
    </div>
  );
}

function StopRow({
  index,
  count,
  stop,
  leg,
  cumulativeMinutes,
  onRemove,
}: {
  index: number;
  count: number;
  stop: StopPoint;
  leg?: { miles: number; minutes: number; tolls: number };
  cumulativeMinutes?: number;
  onRemove: () => void;
}) {
  const role = index === 0 ? "Start" : index === count - 1 ? "Stop" : "Waypoint";
  const arrival = cumulativeMinutes != null ? arrivalFromNow(cumulativeMinutes) : null;
  return (
    <div className="p-3">
      {leg && (
        <div className="mb-2 flex items-center gap-3 pl-8 text-[11px] text-ink-500">
          <span>{formatMiles(leg.miles)}</span>
          <span>·</span>
          <span>{formatDuration(leg.minutes)}</span>
          <span>·</span>
          <span>Toll ${leg.tolls.toFixed(1)}</span>
        </div>
      )}
      <div className="flex items-start gap-2">
        <button className="cursor-grab text-ink-300" title="Reorder">
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[10px] font-semibold text-brand-500">
          {String.fromCharCode(65 + index)}
        </div>
        <div className="min-w-0 flex-1">
          {arrival && (
            <div className="text-[11px] font-medium text-ink-900">
              {arrival.time} <span className="text-ink-400">· {arrival.date}</span>
            </div>
          )}
          <div className="truncate text-sm font-semibold text-ink-900">{stop.address_name}</div>
          <div className="text-[11px] text-ink-500">{role}</div>
        </div>
        <button onClick={onRemove} className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-rose-500">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function sumMinutes(active: RouteAlt | null, index: number): number | undefined {
  if (!active || index === 0) return 0;
  let total = 0;
  for (let i = 0; i < index && i < active.legs.length; i++) total += active.legs[i].minutes;
  return total;
}

function arrivalFromNow(minutes: number): { time: string; date: string } {
  const d = new Date(Date.now() + minutes * 60_000);
  return {
    time: d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) + " EST",
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  };
}

function formatThousands(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function ActionRow({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-ink-50"
    >
      <span className="text-ink-500">{icon}</span>
      <span className="flex-1">{label}</span>
      <ChevronRight className="h-4 w-4 text-ink-400" />
    </button>
  );
}

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "emerald" | "amber" | "rose" | "slate";
}) {
  const cls = {
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    slate: "bg-ink-100 text-ink-700",
  }[tone];
  return <span className={cn("rounded-full px-2 py-1 font-medium", cls)}>{label}</span>;
}

function RouteNotice({
  tone,
  title,
  message,
}: {
  tone: "critical" | "warning";
  title: string;
  message: string;
}) {
  const cls =
    tone === "critical"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-amber-200 bg-amber-50 text-amber-700";
  return (
    <div className={cn("mt-3 rounded-md border px-3 py-2 text-[11px]", cls)}>
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div>
          <div className="font-semibold">{title}</div>
          <div className="mt-0.5 leading-relaxed">{message}</div>
        </div>
      </div>
    </div>
  );
}

function humanizeCoverage(value: "generic-only" | "federal-only" | "state-overlay-screened") {
  if (value === "generic-only") return "Generic fallback";
  if (value === "federal-only") return "Federal baseline";
  return "State overlays";
}

function humanizeBasis(value: "generic-driving" | "federal-backbone-screened" | "state-overlay-screened") {
  if (value === "generic-driving") return "Generic driving";
  if (value === "federal-backbone-screened") return "Truck screened";
  return "Overlay screened";
}

function EmptyRecent() {
  return (
    <div className="flex flex-col items-center p-6 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-ink-400 shadow-sm">
        <Clock className="h-5 w-5" />
      </div>
      <div className="mt-3 text-xs font-medium text-ink-500">No Recent Trips</div>
    </div>
  );
}
function EmptyShared() {
  return (
    <div className="flex flex-col items-center p-6 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-ink-400 shadow-sm">
        <Send className="h-5 w-5" />
      </div>
      <div className="mt-3 text-xs font-medium text-ink-500">Nothing shared yet</div>
    </div>
  );
}

function SavedList({
  items,
  onLoad,
  onRemove,
}: {
  items: { id: string; name: string; miles?: number; stops: StopPoint[] }[];
  onLoad: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  if (items.length === 0)
    return (
      <div className="flex flex-col items-center p-6 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-ink-400 shadow-sm">
          <Heart className="h-5 w-5" />
        </div>
        <div className="mt-3 text-xs font-medium text-ink-500">No Saved Routes</div>
      </div>
    );
  return (
    <div className="space-y-2">
      {items.map((r) => (
        <div key={r.id} className="card p-3">
          <div className="flex items-start gap-2">
            <button onClick={() => onLoad(r.id)} className="min-w-0 flex-1 text-left hover:text-brand-500">
              <div className="truncate text-sm font-semibold text-ink-900">{r.name}</div>
              {r.miles != null && <div className="text-[11px] text-ink-500">{formatMiles(r.miles)}</div>}
            </button>
            <button
              onClick={() => onRemove(r.id)}
              className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-rose-500"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <ol className="mt-2 space-y-1 pl-1">
            {r.stops.map((s, i) => (
              <li key={s.id} className="flex items-center gap-2 text-[12px] text-ink-700">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[9px] font-semibold text-brand-500">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="truncate">{s.address_name}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
