"use client";
import { useMemo, useState } from "react";
import type { RouteAlt } from "@/lib/route";
import type { StopPoint } from "@/lib/types";
import { computeFuelPlan } from "@/lib/fuel-optimizer";
import { DrawerShell } from "./drawer-shell";

interface Props {
  route: RouteAlt;
  onClose: () => void;
  onApply: (stops: StopPoint[]) => void;
}

export function FuelPlanPanel({ route, onClose, onApply }: Props) {
  const [startTank, setStartTank] = useState(200);
  const [tankCap, setTankCap] = useState(250);
  const [lowMpg, setLowMpg] = useState(6);
  const [minBuy, setMinBuy] = useState(100);
  const [network, setNetwork] = useState<"Truck stops" | "All">("Truck stops");

  const plan = useMemo(
    () =>
      computeFuelPlan({
        polyline: route.polyline,
        totalMiles: route.miles,
        startTankGal: startTank,
        tankCapacityGal: tankCap,
        lowMpg,
        minBuyGal: minBuy,
      }),
    [route, startTank, tankCap, lowMpg, minBuy],
  );

  const savings = plan.smartAverageCost - plan.optimizedCost;

  return (
    <DrawerShell
      title="Fuel Plan"
      onClose={onClose}
      footer={
        <button
          disabled={plan.plan.length === 0}
          onClick={() => onApply(plan.plan.map((p) => poiToStop(p.poi.id, p.poi.name, p.poi.latitude, p.poi.longitude)))}
          className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
        >
          Apply to Trip
        </button>
      }
    >
      <div className="space-y-4 p-3">
        <Field label="Network">
          <select value={network} onChange={(e) => setNetwork(e.target.value as "Truck stops" | "All")} className="input">
            <option>Truck stops</option>
            <option>All</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Start Tank" suffix="Gal" value={startTank} onChange={setStartTank} />
          <NumberField label="Tank Capacity" suffix="Gal" value={tankCap} onChange={setTankCap} />
          <NumberField label="Low MPG" suffix="MPG" value={lowMpg} onChange={setLowMpg} />
          <NumberField label="Minimum Buy" suffix="Gal" value={minBuy} onChange={setMinBuy} />
        </div>

        <div className="card p-3">
          <div className="text-xs font-semibold uppercase text-ink-500">Result</div>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] text-ink-500">Fuel Optimized Cost</div>
              <div className="text-lg font-semibold text-ink-900">${plan.optimizedCost.toFixed(2)}</div>
              {savings > 0 && (
                <div className="text-[11px] font-medium text-emerald-600">Save ${savings.toFixed(2)}</div>
              )}
            </div>
            <div>
              <div className="text-[11px] text-ink-500">Smart Average Cost</div>
              <div className="text-lg font-semibold text-ink-900">${plan.avgPumpPrice.toFixed(3)}/gal</div>
              <div className="text-[11px] text-ink-400">{plan.totalGal.toFixed(0)} gal total</div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-ink-100">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 py-2 text-[11px] font-semibold uppercase text-ink-500">
          <span>Stop Name</span>
          <span className="text-right">Arrival Tank</span>
          <span className="text-right">Fuel Price</span>
          <span className="text-right">Fuel Amount</span>
        </div>
        {plan.plan.map((s, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 px-3 py-2 text-sm hover:bg-ink-50"
          >
            <div className="min-w-0">
              <div className="truncate font-semibold text-ink-900">{s.poi.name}</div>
              <div className="truncate text-[11px] text-ink-500">{s.poi.address}</div>
            </div>
            <div className="text-right text-[11px] text-ink-700">{s.arrivalTankGal.toFixed(0)} Gal</div>
            <div className="text-right text-[11px] text-ink-700">${s.pricePerGal.toFixed(3)}</div>
            <div className="text-right text-[11px] font-semibold text-ink-900">
              {s.fillGal.toFixed(0)} Gal · ${s.cost.toFixed(0)}
            </div>
          </div>
        ))}
        {plan.plan.length === 0 && (
          <div className="p-6 text-center text-sm text-ink-500">Start tank covers the full trip.</div>
        )}
      </div>
    </DrawerShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium text-ink-500">{label}</div>
      {children}
    </div>
  );
}

function NumberField({
  label,
  suffix,
  value,
  onChange,
}: {
  label: string;
  suffix: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium text-ink-500">{label}</div>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="input"
        />
        <span className="text-[11px] text-ink-500">{suffix}</span>
      </div>
    </div>
  );
}

function poiToStop(id: string, name: string, lat: number, lng: number): StopPoint {
  return { id, address_name: name, latitude: lat, longitude: lng };
}
