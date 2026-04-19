"use client";
import { useEffect, useState } from "react";
import { Cloud } from "lucide-react";
import type { RouteAlt } from "@/lib/route";
import { DrawerShell } from "./drawer-shell";

interface Alert {
  id: string;
  event: string;
  headline: string;
  severity: string;
  area: string;
  effective: string;
  expires: string;
}

interface Props {
  route: RouteAlt;
  onClose: () => void;
}

export function WeatherPanel({ route, onClose }: Props) {
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [when, setWhen] = useState<string>(() => new Date().toISOString().slice(0, 16));

  useEffect(() => {
    let alive = true;
    setAlerts(null);
    fetch("/api/weather-alerts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ polyline: route.polyline }),
    })
      .then((r) => r.json())
      .then((j: { alerts: Alert[] }) => {
        if (alive) setAlerts(j.alerts);
      })
      .catch(() => alive && setAlerts([]));
    return () => {
      alive = false;
    };
  }, [route.polyline]);

  const whenMs = new Date(when).getTime();
  const active = (alerts ?? []).filter((a) => {
    const s = new Date(a.effective).getTime();
    const e = new Date(a.expires).getTime();
    return whenMs >= s && whenMs <= e;
  });

  return (
    <DrawerShell title="Weather Alerts" onClose={onClose} subtitle={route.label}>
      <div className="border-b border-ink-100 p-3">
        <div className="mb-1 text-[11px] font-medium text-ink-500">Show alerts active at</div>
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="input"
        />
      </div>

      {alerts == null && <div className="p-6 text-center text-sm text-ink-500">Loading alerts…</div>}

      {alerts && active.length === 0 && (
        <div className="flex flex-col items-center p-10 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-ink-400 shadow-sm">
            <Cloud className="h-5 w-5" />
          </div>
          <div className="mt-3 text-xs font-medium text-ink-500">No Weather Alerts</div>
        </div>
      )}

      <div className="divide-y divide-ink-100">
        {active.map((a) => (
          <div key={a.id} className="p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-ink-900">{a.event}</div>
              <Severity s={a.severity} />
            </div>
            <div className="mt-0.5 text-[11px] text-ink-500">{a.area}</div>
            <div className="mt-1 text-xs text-ink-700">{a.headline}</div>
          </div>
        ))}
      </div>
    </DrawerShell>
  );
}

function Severity({ s }: { s: string }) {
  const color =
    s === "Extreme" || s === "Severe"
      ? "bg-rose-50 text-rose-600"
      : s === "Moderate"
        ? "bg-amber-50 text-amber-600"
        : "bg-sky-50 text-sky-600";
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${color}`}>{s}</span>;
}
