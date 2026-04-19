"use client";
import { cn } from "@/lib/cn";
import type { Load } from "@/lib/types";
import { MapPin, ChevronRight, Clock } from "lucide-react";

function StatusBadge({ status }: { status: Load["status"] }) {
  const styles: Record<Load["status"], string> = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    assigned: "bg-blue-50 text-blue-700 border-blue-200",
    in_transit: "bg-emerald-50 text-emerald-700 border-emerald-200",
    delivered: "bg-ink-50 text-ink-500 border-ink-200",
    cancelled: "bg-rose-50 text-rose-700 border-rose-200",
  };
  const labels: Record<Load["status"], string> = {
    pending: "Pending",
    assigned: "Assigned",
    in_transit: "In Transit",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        styles[status],
      )}
    >
      {labels[status]}
    </span>
  );
}

function RiskDot({ hasRisk }: { hasRisk: boolean }) {
  if (!hasRisk) return null;
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
    </span>
  );
}

interface Props {
  loads: Load[];
  selectedLoadId: string | null;
  onSelect: (id: string) => void;
  riskLoadIds?: Set<string>;
}

export function LoadsTable({ loads, selectedLoadId, onSelect, riskLoadIds = new Set() }: Props) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-ink-200 px-4 py-3">
        <h2 className="text-sm font-semibold">
          Active Loads
          <span className="ml-2 text-xs font-normal text-ink-500">{loads.length} loads</span>
        </h2>
      </div>
      <div className="divide-y divide-ink-100">
        {loads.map((load) => (
          <button
            key={load.id}
            onClick={() => onSelect(load.id)}
            className={cn(
              "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-ink-50",
              selectedLoadId === load.id && "bg-brand-50/50 ring-1 ring-inset ring-brand-200",
            )}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-600">
              <MapPin className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-ink-400">{load.id}</span>
                <RiskDot hasRisk={riskLoadIds.has(load.id)} />
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-sm text-ink-900">
                <span className="truncate font-medium">{load.origin.name}</span>
                <ChevronRight className="h-3 w-3 shrink-0 text-ink-400" />
                <span className="truncate font-medium">{load.destination.name}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-3 text-[11px] text-ink-500">
                <span>{load.commodity}</span>
                <span>·</span>
                <span>{load.miles} mi</span>
                <span>·</span>
                <span className="font-medium text-emerald-600">${load.rate.toLocaleString()}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <StatusBadge status={load.status} />
              <div className="flex items-center gap-1 text-[10px] text-ink-500">
                <Clock className="h-3 w-3" />
                {load.weight.toLocaleString()} lb
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
