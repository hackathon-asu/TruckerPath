"use client";
import { ChevronDown, Plus } from "lucide-react";
import type { RoutingProfile } from "@/lib/types";
import { formatFt } from "@/lib/format";

export function RoutingProfileCard({
  profile,
  profiles,
  onChange,
  onAdd,
}: {
  profile?: RoutingProfile;
  profiles: RoutingProfile[];
  onChange: (p: RoutingProfile) => void;
  onAdd: () => void;
}) {
  if (!profile) {
    return (
      <div className="card p-3">
        <div className="text-xs font-medium text-ink-500">Routing Profile</div>
        <button onClick={onAdd} className="btn-outline mt-2 w-full">
          <Plus className="h-4 w-4" />
          Add a profile
        </button>
      </div>
    );
  }
  return (
    <div className="card p-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-ink-500">Routing Profile</div>
        <button onClick={onAdd} className="text-xs font-medium text-brand-500 hover:underline">
          + ROUTE SETTINGS
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div className="min-w-0 truncate text-sm font-semibold text-ink-900">{profile.name}</div>
        <select
          value={profile.id}
          onChange={(e) => {
            const next = profiles.find((p) => p.id === Number(e.target.value));
            if (next) onChange(next);
          }}
          className="-mr-1 rounded-md border-none bg-transparent text-xs text-ink-500 focus:outline-none"
        >
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <dl className="mt-3 grid grid-cols-5 gap-2 text-[11px]">
        <Stat label="Length" value={formatFt(profile.truck_ft_length, profile.truck_in_length)} />
        <Stat label="Height" value={formatFt(profile.truck_ft_height, profile.truck_in_height)} />
        <Stat label="Weight" value={`${(profile.weight_limit / 1000).toFixed(0)}k lb`} />
        <Stat label="Axles" value={String(profile.axles)} />
        <Stat label="Trailers" value={String(profile.trailers)} />
      </dl>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-ink-400">{label}</div>
      <div className="font-semibold text-ink-900">{value}</div>
    </div>
  );
}
