"use client";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Mail, Phone, Search, UserPlus } from "lucide-react";
import { api } from "@/lib/client";
import { cn } from "@/lib/cn";
import { niceStatus, shortRelative } from "@/lib/format";
import type { Driver } from "@/lib/types";

const statuses = ["ALL", "AVAILABLE", "IN_TRANSIT", "INACTIVE"] as const;

export function DriversPanel() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<(typeof statuses)[number]>("ALL");
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .queryDrivers({ search: q, work_status: status })
      .then((r) => {
        if (!alive) return;
        setDrivers(r.drivers);
        setLive(r.live);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [q, status]);

  const groups = useMemo(() => {
    const by: Record<string, Driver[]> = { IN_TRANSIT: [], AVAILABLE: [], INACTIVE: [] };
    drivers.forEach((d) => by[d.work_status]?.push(d));
    return by;
  }, [drivers]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-ink-200 p-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            className="input pl-9"
            placeholder="Search Driver"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="relative">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="input appearance-none pr-8"
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s === "ALL" ? "Driver status" : niceStatus(s)}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        </div>
      </div>

      <div className="flex items-center justify-between px-3 py-2 text-[11px] text-ink-500">
        <span>
          {drivers.length} driver{drivers.length === 1 ? "" : "s"} · {live ? "live API" : "demo data"}
        </span>
        <button
          onClick={() => setInviteOpen(true)}
          className="inline-flex items-center gap-1 text-brand-500 hover:underline"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Invite
        </button>
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin">
        {loading && <div className="p-4 text-xs text-ink-500">Loading drivers…</div>}
        {!loading && drivers.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-ink-100 text-ink-400">
              <UserPlus className="h-5 w-5" />
            </div>
            <div className="mt-3 text-sm font-semibold">No Drivers Found</div>
            <div className="mt-1 text-xs text-ink-500">
              You can add a Driver by navigating to Fleet Management and click on Drivers
            </div>
          </div>
        )}
        {!loading &&
          drivers.length > 0 &&
          (["IN_TRANSIT", "AVAILABLE", "INACTIVE"] as const).map((key) =>
            groups[key].length ? (
              <div key={key}>
                <div className="bg-ink-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                  {niceStatus(key)} · {groups[key].length}
                </div>
                {groups[key].map((d) => (
                  <DriverRow key={d.driver_id} d={d} />
                ))}
              </div>
            ) : null,
          )}
      </div>

      {inviteOpen && <InviteDialog onClose={() => setInviteOpen(false)} />}
    </div>
  );
}

function DriverRow({ d }: { d: Driver }) {
  const dot = {
    AVAILABLE: "bg-emerald-500",
    IN_TRANSIT: "bg-brand-500",
    INACTIVE: "bg-ink-400",
  }[d.work_status];
  return (
    <div className="border-b border-ink-200 p-3 hover:bg-ink-50">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
          {d.driver_first_name[0]}
          {d.driver_last_name[0]}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate text-sm font-semibold text-ink-900">
              {d.driver_first_name} {d.driver_last_name}
            </div>
            <span className={cn("h-2 w-2 rounded-full", dot)} />
          </div>
          <div className="truncate text-[11px] text-ink-500">
            {d.terminal} · {shortRelative(d.latest_update)}
          </div>
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-3 pl-10 text-[11px] text-ink-500">
        {d.driver_phone_number && (
          <span className="inline-flex items-center gap-1">
            <Phone className="h-3 w-3" />
            {d.driver_phone_number}
          </span>
        )}
        {d.driver_email && (
          <span className="inline-flex items-center gap-1 truncate">
            <Mail className="h-3 w-3" />
            {d.driver_email}
          </span>
        )}
      </div>
      {d.last_known_location && (
        <div className="mt-1 pl-10 text-[11px] text-ink-700">{d.last_known_location}</div>
      )}
    </div>
  );
}

function InviteDialog({ onClose }: { onClose: () => void }) {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await api.inviteDriver({
        driver_first_name: first,
        driver_last_name: last,
        driver_email: email,
        driver_phone_number: phone,
      });
      setDone(true);
      setTimeout(onClose, 800);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-panel">
        <div className="border-b border-ink-200 px-5 py-3 text-base font-semibold">
          Invite Driver
        </div>
        <div className="grid grid-cols-2 gap-3 p-5 text-sm">
          <input className="input" placeholder="First name" value={first} onChange={(e) => setFirst(e.target.value)} />
          <input className="input" placeholder="Last name" value={last} onChange={(e) => setLast(e.target.value)} />
          <input className="input col-span-2" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input col-span-2" placeholder="Phone (xxx-xxx-xxxx)" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-ink-200 px-5 py-3">
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={submit} disabled={!email || saving}>
            {done ? "Invited ✓" : saving ? "Inviting…" : "Send Invite"}
          </button>
        </div>
      </div>
    </div>
  );
}
