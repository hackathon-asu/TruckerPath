"use client";
import { useEffect, useRef, useState } from "react";
import { CloudRain, Layers, User2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { MapType } from "./fleet-map";

interface Props {
  mapType: MapType;
  onMapType: (t: MapType) => void;
  weatherAlerts: boolean;
  onWeather: (v: boolean) => void;
  showDrivers: boolean;
  onShowDrivers: (v: boolean) => void;
}

export function MapLayerPopover({
  mapType,
  onMapType,
  weatherAlerts,
  onWeather,
  showDrivers,
  onShowDrivers,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} className="absolute right-4 top-4 z-[400]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md border border-ink-200 bg-white px-3 py-1.5 text-sm shadow-panel hover:bg-ink-50"
      >
        <Layers className="h-4 w-4" />
        Map Layer
      </button>
      {open && (
        <div className="mt-2 w-64 rounded-md border border-ink-200 bg-white p-3 shadow-panel">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold">Map Layer</div>
            <button onClick={() => setOpen(false)} className="rounded p-0.5 text-ink-500 hover:bg-ink-100">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-3 text-[11px] font-medium text-ink-500">Map Display</div>
          <button
            onClick={() => onShowDrivers(!showDrivers)}
            className={cn(
              "mt-1 flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-xs",
              showDrivers ? "border-brand-500 bg-brand-50 text-brand-700" : "border-ink-200 bg-white",
            )}
          >
            <User2 className="h-3.5 w-3.5" />
            Driver
          </button>
          <div className="mt-3 text-[11px] font-medium text-ink-500">Map Type</div>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {(["hybrid", "road", "satellite"] as MapType[]).map((t) => (
              <button
                key={t}
                onClick={() => onMapType(t)}
                className={cn(
                  "rounded-md border p-2 text-center text-[11px] capitalize",
                  mapType === t ? "border-brand-500 bg-brand-50 text-brand-700" : "border-ink-200",
                )}
              >
                <div
                  className="mb-1 h-9 w-full rounded"
                  style={{
                    background:
                      t === "road"
                        ? "linear-gradient(135deg,#e5e7eb,#cbd5e1)"
                        : t === "satellite"
                          ? "linear-gradient(135deg,#1e3a8a,#0f172a)"
                          : "linear-gradient(135deg,#bbf7d0,#86efac)",
                  }}
                />
                {t === "road" ? "Road Map" : t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <div className="mt-3 text-[11px] font-medium text-ink-500">Weather Type</div>
          <label className="mt-1 flex cursor-pointer items-start gap-2 rounded-md border border-ink-200 p-2">
            <input
              type="checkbox"
              className="mt-0.5 h-3.5 w-3.5 rounded border-ink-300 text-brand-500"
              checked={weatherAlerts}
              onChange={(e) => onWeather(e.target.checked)}
            />
            <span className="flex-1">
              <span className="flex items-center gap-1 text-xs font-medium text-ink-900">
                <CloudRain className="h-3.5 w-3.5 text-orange-500" />
                Weather Alert
              </span>
              <span className="text-[10px] text-ink-500">
                Forecasted weather issues, such as floods, tornados, etc., on the planned route or searched location.
              </span>
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
