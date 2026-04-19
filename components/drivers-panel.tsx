"use client";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Clock, Gauge, Mail, Phone, Search, Truck, UserPlus } from "lucide-react";
import { api } from "@/lib/client";
import { cn } from "@/lib/cn";
import { niceStatus } from "@/lib/format";
import type { Driver } from "@/lib/types";
import type { DriverShiftSummary } from "@/lib/eld-engine";
import { formatDutyStatus, hosColor, hosPercent } from "@/lib/eld-engine";

const statuses = ["ALL", "AVAILABLE", "IN_TRANSIT", "INACTIVE"] as const;

// ─── HOS Gauge Bar ───────────────────────────────────────────────
function HosBar({ summary }: { summary: DriverShiftSummary }) {
  const pct = hosPercent(summary);
  const color = hosColor(summary);
  const colorClass = {
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
  }[color];

  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center justify-between text-[10px]">
        <span className="text-ink-500">HOS Drive Time</span>
        <span className={cn(
          "font-semibold",
          color === "emerald" ? "text-emerald-600" : color === "amber" ? "text-amber-600" : "text-rose-600",
        )}>
          {summary.driveTimeRemainingH.toFixed(1)}h left
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
        <div
          className={cn("h-full rounded-full transition-all", colorClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-0.5 flex justify-between text-[9px] text-ink-400">
        <span>{summary.driveTimeUsedH.toFixed(1)}h used</span>
        <span>11h limit</span>
      </div>
    </div>
  );
}

// ─── ELD status dot ──────────────────────────────────────────────
function EldStatusDot({ status }: { status: DriverShiftSummary["currentStatus"] }) {
  const colors: Record<DriverShiftSummary["currentStatus"], string> = {
    DRIVING: "bg-brand-500",
    ON_DUTY: "bg-emerald-500",
    OFF_DUTY: "bg-ink-400",
    SLEEPER: "bg-purple-400",
  };
  return <span className={cn("h-2 w-2 rounded-full", colors[status])} />;
}

// ─── Driver row with ELD data ─────────────────────────────────────
function DriverRow({ d, summary }: { d: Driver; summary?: DriverShiftSummary }) {
  const [expanded, setExpanded] = useState(false);

  const dot = {
    AVAILABLE: "bg-emerald-500",
    IN_TRANSIT: "bg-brand-500",
    INACTIVE: "bg-ink-400",
  }[d.work_status];

  return (
    <div className="border-b border-ink-200 hover:bg-ink-50">
      <button
        className="w-full p-3 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
            {d.driver_first_name[0]}{d.driver_last_name[0]}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="truncate text-sm font-semibold text-ink-900">
                {d.driver_first_name} {d.driver_last_name}
              </div>
              {summary ? (
                <EldStatusDot status={summary.currentStatus} />
              ) : (
                <span className={cn("h-2 w-2 rounded-full", dot)} />
              )}
            </div>
            <div className="flex items-center gap-2 truncate text-[11px] text-ink-500">
              <span>{d.terminal}</span>
              {summary && (
                <>
                  <span>·</span>
                  <span className="font-medium text-ink-700">
                    {formatDutyStatus(summary.currentStatus)}
                  </span>
                  {summary.cmvUnit && (
                    <>
                      <span>·</span>
                      <span>{summary.cmvUnit}</span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
          {/* Quick HOS indicator */}
          {summary && summary.currentStatus !== "OFF_DUTY" && (
            <div className="text-right">
              <div className={cn(
                "text-xs font-bold",
                hosColor(summary) === "emerald" ? "text-emerald-600"
                  : hosColor(summary) === "amber" ? "text-amber-600" : "text-rose-600",
              )}>
                {summary.driveTimeRemainingH.toFixed(1)}h
              </div>
              <div className="text-[9px] text-ink-400">HOS</div>
            </div>
          )}
        </div>

        {/* Quick HOS bar */}
        {summary && summary.currentStatus !== "OFF_DUTY" && (
          <HosBar summary={summary} />
        )}
      </button>

      {/* Expanded ELD details */}
      {expanded && (
        <div className="border-t border-ink-100 bg-ink-50/60 px-4 pb-3 pt-2">
          {/* Contact */}
          <div className="flex items-center gap-4 text-[11px] text-ink-500">
            {d.driver_phone_number && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" />{d.driver_phone_number}
              </span>
            )}
            {d.driver_email && (
              <span className="inline-flex items-center gap-1 truncate">
                <Mail className="h-3 w-3" />{d.driver_email}
              </span>
            )}
          </div>

          {summary && (
            <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
              <div className="rounded-md border border-ink-200 bg-white p-2">
                <div className="text-ink-400">Vehicle</div>
                <div className="font-semibold text-ink-800">{summary.cmvUnit}</div>
                <div className="truncate text-ink-400">{summary.cmvVin}</div>
              </div>
              <div className="rounded-md border border-ink-200 bg-white p-2">
                <div className="text-ink-400">Odometer</div>
                <div className="font-semibold text-ink-800">
                  {summary.totalOdometerMi.toLocaleString()} mi
                </div>
                <div className="text-ink-400">{summary.totalEngineH.toFixed(1)}h engine</div>
              </div>
              <div className="rounded-md border border-ink-200 bg-white p-2">
                <div className="text-ink-400">Shift Duration</div>
                <div className="font-semibold text-ink-800">{summary.shiftElapsedH.toFixed(1)}h</div>
                <div className="text-ink-400">{summary.onDutyWindowRemainingH.toFixed(1)}h window left</div>
              </div>
              <div className="rounded-md border border-ink-200 bg-white p-2">
                <div className="text-ink-400">Miles This Shift</div>
                <div className="font-semibold text-ink-800">{summary.milesDrivenThisShift} mi</div>
                <div className={cn(
                  "text-[9px]",
                  summary.breakNeeded ? "font-semibold text-amber-600" : "text-ink-400",
                )}>
                  {summary.breakNeeded ? "⚠ Break required" : "Break compliance OK"}
                </div>
              </div>
            </div>
          )}

          {/* Recent ELD events */}
          {summary && summary.events.length > 0 && (
            <div className="mt-2">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                Recent ELD Events
              </div>
              <div className="space-y-1">
                {summary.events.slice(0, 3).map((ev) => (
                  <div key={ev.sequenceId} className="flex items-center gap-2 rounded border border-ink-100 bg-white px-2 py-1 text-[10px]">
                    <EldStatusDot status={ev.dutyStatus} />
                    <span className="font-medium text-ink-700">{formatDutyStatus(ev.dutyStatus)}</span>
                    <span className="text-ink-400">·</span>
                    <span className="truncate text-ink-500">{ev.location}</span>
                    <span className="ml-auto text-ink-400">
                      {new Date(ev.timestampMs).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {d.last_known_location && (
            <div className="mt-2 text-[11px] text-ink-700">📍 {d.last_known_location}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ELD compliance badge for drivers panel header ────────────────
function ComplianceBadge({ summaries }: { summaries: DriverShiftSummary[] }) {
  const atRisk = summaries.filter((s) => s.hosViolationRisk || s.breakNeeded).length;
  if (atRisk === 0) {
    return (
      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
        HOS Clear
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
      {atRisk} HOS Alert{atRisk > 1 ? "s" : ""}
    </span>
  );
}

// ─── Main panel ───────────────────────────────────────────────────
export function DriversPanel() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<(typeof statuses)[number]>("ALL");
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [eldSummaries, setEldSummaries] = useState<DriverShiftSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    Promise.all([
      api.queryDrivers({ search: q, work_status: status }),
      fetch("/api/eld-summary").then((r) => r.json()),
    ]).then(([driverRes, eldRes]) => {
      if (!alive) return;
      setDrivers(driverRes.drivers);
      setLive(driverRes.live);
      if (eldRes.summaries) setEldSummaries(eldRes.summaries);
    }).finally(() => alive && setLoading(false));

    return () => { alive = false; };
  }, [q, status]);

  const groups = useMemo(() => {
    const by: Record<string, Driver[]> = { IN_TRANSIT: [], AVAILABLE: [], INACTIVE: [] };
    drivers.forEach((d) => by[d.work_status]?.push(d));
    return by;
  }, [drivers]);

  // Map driver_id → ELD summary (DRV001 = driver_id 1001)
  const eldByDriverId = useMemo(() => {
    const map = new Map<number, DriverShiftSummary>();
    eldSummaries.forEach((s) => {
      const numId = parseInt(s.driverId.replace("DRV", "100"), 10);
      map.set(numId, s);
    });
    return map;
  }, [eldSummaries]);

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
          {drivers.length} driver{drivers.length === 1 ? "" : "s"} · {live ? "live API" : "demo + ELD data"}
        </span>
        <div className="flex items-center gap-2">
          {eldSummaries.length > 0 && <ComplianceBadge summaries={eldSummaries} />}
          <button
            onClick={() => setInviteOpen(true)}
            className="inline-flex items-center gap-1 text-brand-500 hover:underline"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Invite
          </button>
        </div>
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
                  <DriverRow key={d.driver_id} d={d} summary={eldByDriverId.get(d.driver_id)} />
                ))}
              </div>
            ) : null,
          )}
      </div>

      {inviteOpen && <InviteDialog onClose={() => setInviteOpen(false)} />}
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
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={!email || saving}>
            {done ? "Invited ✓" : saving ? "Inviting…" : "Send Invite"}
          </button>
        </div>
      </div>
    </div>
  );
}
