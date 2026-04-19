"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Star } from "lucide-react";
import { cn } from "@/lib/cn";
import type { RouteAlt } from "@/lib/route";
import type { StopPoint } from "@/lib/types";
import { generatePoisAlongRoute, type PoiCategory, type RoutePoi } from "@/lib/poi-along-route";
import { DrawerShell } from "./drawer-shell";

interface Props {
  route: RouteAlt;
  onClose: () => void;
  onAdd: (s: StopPoint) => void;
  onPoisChange?: (pois: RoutePoi[]) => void;
}

type Tab = "all" | PoiCategory;

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "truck_parking", label: "Truck Parking" },
  { id: "weigh_station", label: "Weigh Station" },
  { id: "fuel", label: "Fuel" },
];

export function PoisPanel({ route, onClose, onAdd, onPoisChange }: Props) {
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const pois = useMemo(() => generatePoisAlongRoute(route.polyline, route.miles), [route.polyline, route.miles]);
  const filtered = useMemo(() => {
    const byTab = tab === "all" ? pois : pois.filter((p) => p.category === tab);
    if (!q.trim()) return byTab;
    const needle = q.toLowerCase();
    return byTab.filter((p) => p.name.toLowerCase().includes(needle) || p.address.toLowerCase().includes(needle));
  }, [pois, tab, q]);
  useEffect(() => {
    onPoisChange?.(filtered);
    return () => onPoisChange?.([]);
  }, [filtered, onPoisChange]);

  return (
    <DrawerShell title="POIs Along Route" onClose={onClose} subtitle={`${pois.length} along this route`}>
      <div className="flex items-center gap-4 border-b border-ink-200 px-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "relative py-2.5 text-sm font-medium",
              tab === t.id
                ? "text-brand-500 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-brand-500"
                : "text-ink-500 hover:text-ink-900",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search POI type, title, address"
            className="input !pl-9"
          />
        </div>
      </div>

      <div className="divide-y divide-ink-100 pb-4">
        {filtered.map((p) => (
          <PoiRow key={p.id} poi={p} onAdd={() => onAdd(poiToStop(p))} />
        ))}
        {filtered.length === 0 && <div className="p-6 text-center text-sm text-ink-500">No POIs match</div>}
      </div>
    </DrawerShell>
  );
}

function PoiRow({ poi, onAdd }: { poi: RoutePoi; onAdd: () => void }) {
  return (
    <div className="flex items-start gap-3 px-3 py-3 hover:bg-ink-50">
      <CategoryBadge category={poi.category} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-ink-900">{poi.name}</div>
        <div className="text-[11px] text-ink-500">
          {poi.routeMile.toFixed(0)} mi · {poi.address}
        </div>
        <div className="mt-0.5 text-[11px] text-ink-500">{poi.offRouteMiles.toFixed(1)} mi off route</div>
        <div className="mt-1 flex items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-0.5 font-semibold text-amber-500">
            <Star className="h-3 w-3 fill-amber-500" /> {poi.rating.toFixed(1)}
          </span>
          <StatusPill status={poi.status} />
          {poi.pumpPrice != null && <span className="text-ink-500">Pump: ${poi.pumpPrice.toFixed(3)}</span>}
          <span className="text-ink-400">· {shortAgo(poi.lastReportedMinutesAgo)}</span>
        </div>
      </div>
      <button
        onClick={onAdd}
        className="inline-flex shrink-0 items-center gap-1 rounded border border-ink-200 px-2 py-1 text-[11px] font-medium text-brand-500 hover:bg-brand-50"
      >
        <Plus className="h-3 w-3" /> ADD TO TRIP
      </button>
    </div>
  );
}

function CategoryBadge({ category }: { category: PoiCategory }) {
  const map: Record<PoiCategory, { bg: string; tx: string; icon: string }> = {
    truck_parking: { bg: "bg-amber-50", tx: "text-amber-600", icon: "P" },
    weigh_station: { bg: "bg-sky-50", tx: "text-sky-600", icon: "W" },
    fuel: { bg: "bg-rose-50", tx: "text-rose-600", icon: "F" },
    rest_area: { bg: "bg-emerald-50", tx: "text-emerald-600", icon: "R" },
  };
  const m = map[category];
  return <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded ${m.bg} ${m.tx} text-xs font-bold`}>{m.icon}</div>;
}

function StatusPill({ status }: { status: RoutePoi["status"] }) {
  const color =
    status === "FULL" ? "bg-rose-50 text-rose-600" : status === "SOME" ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-700";
  return <span className={`rounded px-1 py-0.5 text-[10px] font-bold ${color}`}>{status}</span>;
}

function shortAgo(m: number): string {
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hours ago`;
  return `${Math.floor(h / 24)} days ago`;
}

function poiToStop(p: RoutePoi): StopPoint {
  return {
    id: p.id,
    address_name: p.name,
    latitude: p.latitude,
    longitude: p.longitude,
  };
}
