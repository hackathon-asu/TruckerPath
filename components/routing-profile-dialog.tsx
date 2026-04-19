"use client";
import { useState } from "react";
import { X } from "lucide-react";
import { api } from "@/lib/client";
import type { RoutingProfile } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (p: RoutingProfile) => void;
}

type DraftRoutingProfile = Omit<RoutingProfile, "id"> & {
  avoid_areas: NonNullable<RoutingProfile["avoid_areas"]>;
  avoid_bridges: NonNullable<RoutingProfile["avoid_bridges"]>;
  route_policy: Required<NonNullable<RoutingProfile["route_policy"]>>;
};

const init: DraftRoutingProfile = {
  name: "",
  truck_ft_length: 53,
  truck_in_length: 0,
  truck_ft_width: 8,
  truck_in_width: 6,
  truck_ft_height: 13,
  truck_in_height: 6,
  weight_limit: 80000,
  weight_per_axle: 20000,
  axles: 5,
  trailers: 1,
  hazmat: false,
  avoid_areas: [],
  avoid_bridges: [],
  route_policy: {
    enforce_permitted_network: true,
    enforce_hazmat_restrictions: true,
    enforce_clearance_limits: true,
  },
};

export function RoutingProfileDialog({ open, onClose, onCreated }: Props) {
  const [v, setV] = useState<DraftRoutingProfile>(init);
  const [saving, setSaving] = useState(false);
  const [bridgeState, setBridgeState] = useState("");
  const [bridgeRules, setBridgeRules] = useState("");
  const [areaName, setAreaName] = useState("");
  const [minLat, setMinLat] = useState("");
  const [minLng, setMinLng] = useState("");
  const [maxLat, setMaxLat] = useState("");
  const [maxLng, setMaxLng] = useState("");
  if (!open) return null;

  const set = <K extends keyof typeof init>(k: K, val: (typeof init)[K]) =>
    setV((s) => ({ ...s, [k]: val }));

  const togglePolicy = (key: keyof typeof init.route_policy, checked: boolean) =>
    setV((state) => ({
      ...state,
      route_policy: {
        ...state.route_policy,
        [key]: checked,
      },
    }));

  const addBridgeRule = () => {
    const state = bridgeState.trim().toUpperCase();
    const rules = bridgeRules
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (!state || rules.length === 0) return;

    setV((current) => ({
      ...current,
      avoid_bridges: [
        ...current.avoid_bridges.filter((item) => item.state !== state),
        { state, rules },
      ],
    }));
    setBridgeState("");
    setBridgeRules("");
  };

  const addAvoidArea = () => {
    const parsed = [minLat, minLng, maxLat, maxLng].map((value) => Number(value));
    if (!areaName.trim() || parsed.some((value) => Number.isNaN(value))) return;
    const [minLatitude, minLongitude, maxLatitude, maxLongitude] = parsed;
    const top = Math.max(minLatitude, maxLatitude);
    const bottom = Math.min(minLatitude, maxLatitude);
    const left = Math.min(minLongitude, maxLongitude);
    const right = Math.max(minLongitude, maxLongitude);

    setV((current) => ({
      ...current,
      avoid_areas: [
        ...current.avoid_areas,
        {
          area_name: areaName.trim(),
          type: "rectangle",
          coordinates: [[
            { lat: bottom, lng: left },
            { lat: top, lng: left },
            { lat: top, lng: right },
            { lat: bottom, lng: right },
          ]],
        },
      ],
    }));

    setAreaName("");
    setMinLat("");
    setMinLng("");
    setMaxLat("");
    setMaxLng("");
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-xl rounded-lg bg-white shadow-panel">
        <div className="flex items-center justify-between border-b border-ink-200 px-5 py-3">
          <h2 className="text-base font-semibold">Add Routing Profile</h2>
          <button onClick={onClose} className="rounded p-1 text-ink-500 hover:bg-ink-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-3 p-5 text-sm">
          <Field label="* Name" className="col-span-4">
            <input
              className="input"
              value={v.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Standard Dry Van"
            />
          </Field>
          <Field label="* Height" suffix="ft">
            <input
              type="number"
              className="input"
              value={v.truck_ft_height}
              onChange={(e) => set("truck_ft_height", Number(e.target.value))}
            />
          </Field>
          <Field label="Height" suffix="in">
            <input
              type="number"
              className="input"
              value={v.truck_in_height}
              onChange={(e) => set("truck_in_height", Number(e.target.value))}
            />
          </Field>
          <Field label="* Width" suffix="ft">
            <input
              type="number"
              className="input"
              value={v.truck_ft_width}
              onChange={(e) => set("truck_ft_width", Number(e.target.value))}
            />
          </Field>
          <Field label="Width" suffix="in">
            <input
              type="number"
              className="input"
              value={v.truck_in_width}
              onChange={(e) => set("truck_in_width", Number(e.target.value))}
            />
          </Field>
          <Field label="* Length" suffix="ft">
            <input
              type="number"
              className="input"
              value={v.truck_ft_length}
              onChange={(e) => set("truck_ft_length", Number(e.target.value))}
            />
          </Field>
          <Field label="Length" suffix="in">
            <input
              type="number"
              className="input"
              value={v.truck_in_length}
              onChange={(e) => set("truck_in_length", Number(e.target.value))}
            />
          </Field>
          <Field label="* Weight" suffix="lb" className="col-span-2">
            <input
              type="number"
              className="input"
              value={v.weight_limit}
              onChange={(e) => set("weight_limit", Number(e.target.value))}
            />
          </Field>
          <Field label="Axles">
            <select
              className="input"
              value={v.axles}
              onChange={(e) => set("axles", Number(e.target.value))}
            >
              {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </Field>
          <Field label="Trailers">
            <select
              className="input"
              value={v.trailers}
              onChange={(e) => set("trailers", Number(e.target.value))}
            >
              {[0, 1, 2, 3].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </Field>
          <label className="col-span-4 mt-1 flex items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-ink-300 text-brand-500 focus:ring-brand-500/20"
              checked={v.hazmat}
              onChange={(e) => set("hazmat", e.target.checked)}
            />
            Truck will be transporting hazardous material
          </label>

          <div className="col-span-4 mt-2 rounded-lg border border-ink-200 bg-ink-50 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
              Route Policy
            </div>
            <div className="mt-2 space-y-2">
              <CheckboxRow
                label="Enforce permitted-network screening"
                checked={v.route_policy.enforce_permitted_network}
                onChange={(checked) => togglePolicy("enforce_permitted_network", checked)}
              />
              <CheckboxRow
                label="Enforce hazmat restrictions"
                checked={v.route_policy.enforce_hazmat_restrictions}
                onChange={(checked) => togglePolicy("enforce_hazmat_restrictions", checked)}
              />
              <CheckboxRow
                label="Enforce clearance and weight restrictions"
                checked={v.route_policy.enforce_clearance_limits}
                onChange={(checked) => togglePolicy("enforce_clearance_limits", checked)}
              />
            </div>
          </div>

          <div className="col-span-4 rounded-lg border border-ink-200 p-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                Avoid Bridge Rules
              </div>
              <span className="text-[11px] text-ink-400">
                State code + comma-separated rule labels
              </span>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              <input
                className="input"
                placeholder="State"
                value={bridgeState}
                maxLength={2}
                onChange={(e) => setBridgeState(e.target.value.toUpperCase())}
              />
              <input
                className="input col-span-2"
                placeholder="GA-ATL-I75-W1, IL-CHI-CLR-1"
                value={bridgeRules}
                onChange={(e) => setBridgeRules(e.target.value)}
              />
              <button type="button" className="btn-outline" onClick={addBridgeRule}>
                Add Rule
              </button>
            </div>
            {v.avoid_bridges.length > 0 && (
              <div className="mt-2 space-y-2">
                {v.avoid_bridges.map((item) => (
                  <div
                    key={item.state}
                    className="flex items-center justify-between rounded-md border border-ink-200 bg-ink-50 px-3 py-2 text-[11px]"
                  >
                    <div>
                      <div className="font-semibold text-ink-800">{item.state}</div>
                      <div className="text-ink-500">{item.rules.join(", ")}</div>
                    </div>
                    <button
                      type="button"
                      className="text-ink-400 hover:text-rose-600"
                      onClick={() =>
                        setV((current) => ({
                          ...current,
                          avoid_bridges: current.avoid_bridges.filter((entry) => entry.state !== item.state),
                        }))
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="col-span-4 rounded-lg border border-ink-200 p-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                Avoid Areas
              </div>
              <span className="text-[11px] text-ink-400">
                Rectangle bounds for known truck-no-go zones
              </span>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              <input
                className="input col-span-2"
                placeholder="Area name"
                value={areaName}
                onChange={(e) => setAreaName(e.target.value)}
              />
              <input className="input" placeholder="Min lat" value={minLat} onChange={(e) => setMinLat(e.target.value)} />
              <input className="input" placeholder="Min lng" value={minLng} onChange={(e) => setMinLng(e.target.value)} />
              <input className="input" placeholder="Max lat" value={maxLat} onChange={(e) => setMaxLat(e.target.value)} />
              <input className="input" placeholder="Max lng" value={maxLng} onChange={(e) => setMaxLng(e.target.value)} />
              <button type="button" className="btn-outline col-span-4" onClick={addAvoidArea}>
                Add Avoid Area
              </button>
            </div>
            {v.avoid_areas.length > 0 && (
              <div className="mt-2 space-y-2">
                {v.avoid_areas.map((item, index) => {
                  const points = item.coordinates[0] ?? [];
                  const latitudes = points.map((point) => point.lat);
                  const longitudes = points.map((point) => point.lng);
                  return (
                    <div
                      key={`${item.area_name}-${index}`}
                      className="flex items-center justify-between rounded-md border border-ink-200 bg-ink-50 px-3 py-2 text-[11px]"
                    >
                      <div>
                        <div className="font-semibold text-ink-800">{item.area_name}</div>
                        <div className="text-ink-500">
                          {Math.min(...latitudes).toFixed(3)}, {Math.min(...longitudes).toFixed(3)} to{" "}
                          {Math.max(...latitudes).toFixed(3)}, {Math.max(...longitudes).toFixed(3)}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="text-ink-400 hover:text-rose-600"
                        onClick={() =>
                          setV((current) => ({
                            ...current,
                            avoid_areas: current.avoid_areas.filter((_, areaIndex) => areaIndex !== index),
                          }))
                        }
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-ink-200 px-5 py-3">
          <button className="btn-ghost uppercase" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary uppercase"
            disabled={!v.name.trim() || saving}
            onClick={async () => {
              setSaving(true);
              try {
                const res = await api.createProfile(v);
                onCreated(res.profile);
                onClose();
                setV(init);
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckboxRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink-700">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-ink-300 text-brand-500 focus:ring-brand-500/20"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

function Field({
  label,
  suffix,
  className = "",
  children,
}: {
  label: string;
  suffix?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[11px] font-medium text-ink-500">{label}</span>
      <div className="relative">
        {children}
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-ink-400">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}
