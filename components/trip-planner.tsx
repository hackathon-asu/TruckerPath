"use client";
import { useEffect, useState } from "react";
import {
  ChevronRight,
  Clock,
  FileBarChart,
  Fuel,
  GripVertical,
  Heart,
  Map as MapIcon,
  MapPin,
  MoreHorizontal,
  Navigation,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { api } from "@/lib/client";
import { formatDuration, formatMiles } from "@/lib/format";
import { useSavedRoutes } from "@/lib/saved-routes";
import type { RoutingProfile, StopPoint } from "@/lib/types";
import { StopSearch } from "./stop-search";
import { RoutingProfileCard } from "./routing-profile-card";

type RouteInfo = { miles: number; minutes: number; polyline: [number, number][] };

interface Props {
  profiles: RoutingProfile[];
  profile?: RoutingProfile;
  setProfile: (p: RoutingProfile) => void;
  stops: StopPoint[];
  setStops: (s: StopPoint[]) => void;
  route: RouteInfo | null;
  setRoute: (r: RouteInfo | null) => void;
  onOpenReport: () => void;
  onOpenAddProfile: () => void;
  onSendRoute: () => void;
  sending: boolean;
}

export function TripPlanner({
  profiles,
  profile,
  setProfile,
  stops,
  setStops,
  route,
  setRoute,
  onOpenReport,
  onOpenAddProfile,
  onSendRoute,
  sending,
}: Props) {
  const [tab, setTab] = useState<"recent" | "saved" | "shared">("recent");
  const { items: saved, save: saveRoute, remove } = useSavedRoutes();

  useEffect(() => {
    if (stops.length < 2) {
      setRoute(null);
      return;
    }
    let alive = true;
    api
      .calcRoute(stops.map((s) => ({ latitude: s.latitude, longitude: s.longitude })))
      .then((r) => {
        if (alive) setRoute(r);
      });
    return () => {
      alive = false;
    };
  }, [stops, setRoute]);

  const addStop = (s: StopPoint) => setStops([...stops, s]);
  const removeStop = (id: string) => setStops(stops.filter((x) => x.id !== id));
  const clearTrip = () => {
    setStops([]);
    setRoute(null);
  };

  return (
    <div className="flex h-full flex-col bg-ink-50">
      <Tabs />
      <div className="flex-1 space-y-3 overflow-auto p-3 scrollbar-thin">
        <RoutingProfileCard
          profile={profile}
          profiles={profiles}
          onChange={setProfile}
          onAdd={onOpenAddProfile}
        />

        {stops.length > 0 && (
          <div className="card divide-y divide-ink-200">
            {stops.map((s, i) => (
              <StopRow key={s.id} index={i} count={stops.length} stop={s} onRemove={() => removeStop(s.id)} />
            ))}
          </div>
        )}

        <StopSearch onPick={addStop} />

        {route && stops.length >= 2 && (
          <div className="card p-3">
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-4">
                <TabLabel active>Route 1</TabLabel>
                <TabLabel>Route 2</TabLabel>
              </div>
              <span className="text-[11px] text-ink-500">
                {stops.length} stop{stops.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="mt-1 text-xs font-semibold uppercase text-brand-500">Fastest Route</div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <Metric icon={<Clock className="h-3.5 w-3.5" />} label="Drive time" value={formatDuration(route.minutes)} />
              <Metric icon={<MapIcon className="h-3.5 w-3.5" />} label="Est. miles" value={formatMiles(route.miles)} />
              <Metric
                icon={<Fuel className="h-3.5 w-3.5" />}
                label="Fuel"
                value={`${(route.miles / 6).toFixed(1)}gal`}
              />
            </div>
          </div>
        )}

        {stops.length >= 2 && (
          <div className="card divide-y divide-ink-200 text-sm">
            <ActionRow icon={<FileBarChart className="h-4 w-4" />} label="Trip Report" onClick={onOpenReport} />
            <ActionRow icon={<Fuel className="h-4 w-4" />} label="Fuel Plan" />
            <ActionRow icon={<Navigation className="h-4 w-4" />} label="Directions" />
            <ActionRow icon={<MapPin className="h-4 w-4" />} label="POIs Along Route" />
            <ActionRow icon={<MapIcon className="h-4 w-4" />} label="Weather Alerts" />
          </div>
        )}

        {tab === "recent" && stops.length === 0 && <EmptyRecent />}

        {tab === "saved" && (
          <SavedList
            items={saved.map((r) => ({ id: r.id, name: r.name, miles: r.miles ?? 0 }))}
            onLoad={(id) => {
              const r = saved.find((x) => x.id === id);
              if (r) setStops(r.stops);
            }}
            onRemove={remove}
          />
        )}

        {tab === "shared" && <EmptyShared />}
      </div>

      {/* bottom bar */}
      <div className="border-t border-ink-200 bg-white p-3">
        {stops.length === 0 ? (
          <button className="btn-outline w-full text-rose-500" onClick={clearTrip}>
            <Trash2 className="h-4 w-4" />
            Clear Trip
          </button>
        ) : (
          <div className="flex gap-2">
            <button className="btn-outline flex-1" onClick={clearTrip}>
              <Trash2 className="h-4 w-4 text-rose-500" />
              Clear
            </button>
            <button
              className="btn-outline flex-1"
              onClick={() => {
                if (stops.length < 2) return;
                saveRoute({
                  name: `${stops[0].address_name} → ${stops[stops.length - 1].address_name}`,
                  stops,
                  miles: route?.miles,
                  minutes: route?.minutes,
                  profileId: profile?.id,
                });
              }}
            >
              <Heart className="h-4 w-4" />
              Save
            </button>
            <button
              className="btn-primary flex-[1.2] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={stops.length < 2 || sending}
              onClick={onSendRoute}
            >
              <Send className="h-4 w-4" />
              {sending ? "Sending…" : "Send Route"}
            </button>
          </div>
        )}
      </div>

      {/* Local tabs impl (needs access to tab state) */}
      <style jsx>{``}</style>
    </div>
  );

  function Tabs() {
    const tabs = [
      { id: "recent", label: "Recent Trips" },
      { id: "saved", label: "Saved Routes" },
      { id: "shared", label: "Shared Trips" },
    ] as const;
    return (
      <div className="flex items-center gap-4 border-b border-ink-200 bg-white px-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "relative py-2.5 text-sm font-medium",
              tab === t.id
                ? "text-brand-500 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand-500"
                : "text-ink-500 hover:text-ink-900",
            )}
          >
            {t.label}
          </button>
        ))}
        <button className="ml-auto rounded p-1 text-ink-400 hover:bg-ink-100">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
    );
  }
}

function TabLabel({ active, children }: { active?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "text-xs font-semibold",
        active ? "text-brand-500" : "text-ink-400",
      )}
    >
      {children}
    </span>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md bg-ink-50 p-2">
      <div className="flex items-center justify-center gap-1 text-[10px] text-ink-500">
        {icon}
        {label}
      </div>
      <div className="text-sm font-semibold text-ink-900">{value}</div>
    </div>
  );
}

function StopRow({
  index,
  count,
  stop,
  onRemove,
}: {
  index: number;
  count: number;
  stop: StopPoint;
  onRemove: () => void;
}) {
  const role = index === 0 ? "Start" : index === count - 1 ? "Stop" : "Stop";
  return (
    <div className="flex items-start gap-2 p-3">
      <button className="cursor-grab text-ink-300" title="Reorder">
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[10px] font-semibold text-brand-500">
        {String.fromCharCode(65 + index)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-ink-900">{stop.address_name}</div>
        <div className="text-[11px] text-ink-500">{role}</div>
      </div>
      <button onClick={onRemove} className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-rose-500">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ActionRow({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-ink-50"
    >
      <span className="text-ink-500">{icon}</span>
      <span className="flex-1">{label}</span>
      <ChevronRight className="h-4 w-4 text-ink-400" />
    </button>
  );
}

function EmptyRecent() {
  return (
    <div className="flex flex-col items-center p-6 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-ink-400 shadow-sm">
        <Clock className="h-5 w-5" />
      </div>
      <div className="mt-3 text-xs font-medium text-ink-500">No Recent Trips</div>
    </div>
  );
}
function EmptyShared() {
  return (
    <div className="flex flex-col items-center p-6 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-ink-400 shadow-sm">
        <Send className="h-5 w-5" />
      </div>
      <div className="mt-3 text-xs font-medium text-ink-500">Nothing shared yet</div>
    </div>
  );
}

function SavedList({
  items,
  onLoad,
  onRemove,
}: {
  items: { id: string; name: string; miles: number }[];
  onLoad: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  if (items.length === 0)
    return (
      <div className="flex flex-col items-center p-6 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-ink-400 shadow-sm">
          <Heart className="h-5 w-5" />
        </div>
        <div className="mt-3 text-xs font-medium text-ink-500">No Saved Routes</div>
      </div>
    );
  return (
    <div className="card divide-y divide-ink-200">
      {items.map((r) => (
        <div key={r.id} className="flex items-center gap-2 p-3 text-sm">
          <button onClick={() => onLoad(r.id)} className="min-w-0 flex-1 truncate text-left hover:text-brand-500">
            <div className="truncate font-medium">{r.name}</div>
            <div className="text-[11px] text-ink-500">{formatMiles(r.miles)}</div>
          </button>
          <button onClick={() => onRemove(r.id)} className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-rose-500">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
