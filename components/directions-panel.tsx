"use client";
import { MapPin } from "lucide-react";
import type { RouteAlt } from "@/lib/route";
import type { StopPoint } from "@/lib/types";
import { formatDuration, formatMiles } from "@/lib/format";
import { DrawerShell } from "./drawer-shell";

interface Props {
  route: RouteAlt;
  stops: StopPoint[];
  onClose: () => void;
}

export function DirectionsPanel({ route, stops, onClose }: Props) {
  return (
    <DrawerShell
      title="Directions"
      subtitle={`${route.label} · ${formatMiles(route.miles)} · ${formatDuration(route.minutes)}`}
      onClose={onClose}
    >
      <div className="divide-y divide-ink-100">
        {route.legs.map((leg, legIdx) => (
          <div key={legIdx}>
            <LegHeader
              label={legIdx === 0 ? stops[0]?.address_name : stops[legIdx]?.address_name}
              from={legIdx === 0}
            />
            {leg.steps.map((s, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_auto_auto] items-start gap-3 px-3 py-2 text-sm hover:bg-ink-50"
              >
                <div className="text-ink-700">{s.instruction}</div>
                <div className="text-[11px] text-ink-400">{formatDuration(s.minutes)}</div>
                <div className="text-[11px] tabular-nums text-ink-500">{formatMiles(s.miles)}</div>
              </div>
            ))}
          </div>
        ))}
        <div className="flex items-center gap-2 bg-ink-50 px-3 py-3 text-sm font-semibold text-ink-900">
          <MapPin className="h-4 w-4 text-brand-500" />
          <span className="flex-1 truncate">{stops[stops.length - 1]?.address_name}</span>
          <span className="text-xs text-ink-500">
            {formatDuration(route.minutes)} · {formatMiles(route.miles)}
          </span>
        </div>
      </div>
    </DrawerShell>
  );
}

function LegHeader({ label, from }: { label?: string; from?: boolean }) {
  if (!label) return null;
  return (
    <div className="flex items-center gap-2 bg-ink-50 px-3 py-2 text-xs font-semibold text-ink-900">
      <MapPin className="h-3.5 w-3.5 text-brand-500" />
      <span className="truncate">{label}</span>
      {!from && <span className="ml-auto text-ink-400">Leg</span>}
    </div>
  );
}
