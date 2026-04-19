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

const init = {
  name: "",
  truck_ft_length: 53,
  truck_in_length: 0,
  truck_ft_width: 8,
  truck_in_width: 6,
  truck_ft_height: 13,
  truck_in_height: 6,
  weight_limit: 80000,
  axles: 5,
  trailers: 1,
  hazmat: false,
};

export function RoutingProfileDialog({ open, onClose, onCreated }: Props) {
  const [v, setV] = useState(init);
  const [saving, setSaving] = useState(false);
  if (!open) return null;

  const set = <K extends keyof typeof init>(k: K, val: (typeof init)[K]) =>
    setV((s) => ({ ...s, [k]: val }));

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
