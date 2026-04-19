"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Expand, MapPinned } from "lucide-react";
import type { FleetMarker, MapType } from "@/components/fleet-map";
import type { OperationsDriver } from "@/lib/types";

const FleetMap = dynamic(() => import("@/components/fleet-map"), { ssr: false });

function groupMarkers(drivers: OperationsDriver[]): FleetMarker[] {
  const buckets = new Map<string, FleetMarker[]>();
  for (const driver of drivers) {
    const key = `${driver.currentLat.toFixed(1)}:${driver.currentLng.toFixed(1)}`;
    const marker: FleetMarker = {
      id: driver.id,
      latitude: driver.currentLat,
      longitude: driver.currentLng,
      label: `${driver.firstName} ${driver.lastName}`,
      status:
        driver.status === "breakdown"
          ? "breakdown"
          : driver.status === "maintenance"
            ? "maintenance"
            : driver.status === "detained"
              ? "detained"
              : driver.status === "available"
                ? "available"
                : "active",
      subtitle: `${driver.unit} • ${driver.currentCity}`,
    };
    buckets.set(key, [...(buckets.get(key) ?? []), marker]);
  }

  return Array.from(buckets.values()).map((bucket, index) =>
    bucket.length === 1
      ? bucket[0]
      : {
          id: `cluster-${index}`,
          latitude: bucket[0].latitude,
          longitude: bucket[0].longitude,
          label: `${bucket.length} trucks`,
          status: "cluster",
          subtitle: bucket.map((entry) => entry.label).join(", "),
          count: bucket.length,
        },
  );
}

export function FleetMapCard({
  drivers,
  filter,
  onExpand,
}: {
  drivers: OperationsDriver[];
  filter: string;
  onExpand: () => void;
}) {
  const [mapType] = useState<MapType>("road");
  const filtered = useMemo(() => {
    if (filter === "all") return drivers;
    return drivers.filter((driver) => driver.status === filter);
  }, [drivers, filter]);
  const markers = useMemo(() => groupMarkers(filtered), [filtered]);

  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_16px_48px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">Unified fleet view</h3>
          <p className="text-sm text-slate-500">Compact live preview with status overlays and fleet clustering.</p>
        </div>
        <button onClick={onExpand} className="btn-outline">
          <Expand className="h-4 w-4" />
          Expand
        </button>
      </div>
      <div className="h-[320px] bg-slate-100">
        <FleetMap stops={[]} routes={[]} fleetMarkers={markers} mapType={mapType} />
      </div>
      <div className="flex flex-wrap gap-2 px-5 py-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-blue-700"><MapPinned className="h-3.5 w-3.5" /> {filtered.length} assets in view</span>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">Available {drivers.filter((driver) => driver.status === "available").length}</span>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">At risk {drivers.filter((driver) => driver.status === "maintenance" || driver.status === "detained").length}</span>
        <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-700">Breakdowns {drivers.filter((driver) => driver.status === "breakdown").length}</span>
      </div>
    </section>
  );
}
