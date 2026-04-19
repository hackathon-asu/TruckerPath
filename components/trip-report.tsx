"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Sparkles, X } from "lucide-react";
import { api } from "@/lib/client";
import { formatDuration } from "@/lib/format";
import type { RoutingProfile, StopPoint } from "@/lib/types";

interface Props {
  stops: StopPoint[];
  miles: number;
  minutes: number;
  profile: RoutingProfile;
  onClose: () => void;
}

export function TripReport({ stops, miles, minutes, profile, onClose }: Props) {
  const [mpg, setMpg] = useState(6);
  const [fuelPrice, setFuelPrice] = useState(3.85);
  const [opCostPerMile, setOpCostPerMile] = useState(1.2);
  const [otherCosts, setOtherCosts] = useState(0);
  const [insights, setInsights] = useState<string[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(true);

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
    return () => {
      alive = false;
    };
  }, [miles, minutes, stops, profile]);

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
