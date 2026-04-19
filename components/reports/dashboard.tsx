"use client";

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ChevronDown,
  CircleDot,
  Download,
  RefreshCw,
  Sparkles,
  Truck,
} from "lucide-react";
import { api } from "@/lib/client";
import { cn } from "@/lib/cn";
import {
  mergeDemoState,
  readDemoOpsState,
  writeDemoOpsState,
} from "@/lib/reports-storage";
import { DetailDrawer } from "@/components/reports/detail-drawer";
import { FleetMapCard } from "@/components/reports/fleet-map-card";
import type {
  CurrentTrip,
  DashboardKpi,
  DispatcherSnapshot,
  DispatcherTask,
  DocumentBillingCase,
  LoadBoardRecord,
  OperationalAlert,
  OperationsDriver,
} from "@/lib/types";

const sectionNav = [
  { id: "todo", label: "Smart to-do" },
  { id: "drivers", label: "Available drivers" },
  { id: "trips", label: "Current trips" },
  { id: "loads", label: "Load board" },
  { id: "routes", label: "Route optimizer" },
  { id: "costs", label: "Cost intelligence" },
  { id: "safety", label: "Safety / compliance" },
  { id: "docs", label: "Docs / billing" },
] as const;

export function ReportsDashboard() {
  const [snapshot, setSnapshot] = useState<DispatcherSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeKpi, setActiveKpi] = useState<string>("all");
  const [fleetFilter, setFleetFilter] = useState<string>("all");
  const [driverSort, setDriverSort] = useState<
    "readiness" | "hos" | "deadhead" | "profitability"
  >("readiness");
  const [taskFilter, setTaskFilter] = useState<
    DispatcherTask["category"] | "all"
  >("all");
  const [activeRouteLoadId, setActiveRouteLoadId] = useState<string>("LD-4812");
  const [selectedLastMile, setSelectedLastMile] =
    useState<string>("fac-houston");
  const [mapExpanded, setMapExpanded] = useState(false);
  const [docsSearch, setDocsSearch] = useState("");
  const deferredDocsSearch = useDeferredValue(docsSearch);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .dispatcherSnapshot()
      .then((data) => {
        if (!alive) return;
        setSnapshot(mergeDemoState(data, readDemoOpsState()));
        setError(null);
      })
      .catch((issue) => {
        if (!alive) return;
        setError(
          issue instanceof Error
            ? issue.message
            : "Unable to load dispatcher dashboard",
        );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const selectedDriverId = searchParams.get("driver");
  const selectedLoadId = searchParams.get("load");
  const selectedTripId = searchParams.get("trip");

  const selectedDriver =
    snapshot?.drivers.find((driver) => driver.id === selectedDriverId) ?? null;
  const selectedLoad =
    snapshot?.loads.find((load) => load.id === selectedLoadId) ?? null;
  const selectedTrip =
    snapshot?.trips.find((trip) => trip.id === selectedTripId) ?? null;

  const filteredDrivers = useMemo(() => {
    if (!snapshot) return [];
    const list = [...snapshot.drivers]
      .filter((driver) => {
        if (activeKpi === "open_loads") return driver.status === "available";
        if (activeKpi === "on_time_rate") return driver.status !== "breakdown";
        return true;
      })
      .sort((left, right) => {
        if (driverSort === "hos")
          return right.hosRemainingHours - left.hosRemainingHours;
        if (driverSort === "deadhead")
          return left.deadheadMiles - right.deadheadMiles;
        if (driverSort === "profitability")
          return right.profitabilityScore - left.profitabilityScore;
        return right.readinessScore - left.readinessScore;
      });
    return list;
  }, [activeKpi, driverSort, snapshot]);

  const filteredTrips = useMemo(() => {
    if (!snapshot) return [];
    if (activeKpi === "on_time_rate") {
      return snapshot.trips.filter((trip) => trip.routeHealth !== "healthy");
    }
    return snapshot.trips;
  }, [activeKpi, snapshot]);

  const filteredLoads = useMemo(() => {
    if (!snapshot) return [];
    if (activeKpi === "open_loads") {
      return snapshot.loads.filter((load) => !load.assignedDriverId);
    }
    return snapshot.loads;
  }, [activeKpi, snapshot]);

  const visibleTasks = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.tasks.filter((task) => {
      if (task.status !== "open") return false;
      if (taskFilter === "all") return true;
      return task.category === taskFilter;
    });
  }, [snapshot, taskFilter]);

  const visibleDocs = useMemo(() => {
    if (!snapshot) return [];
    const query = deferredDocsSearch.trim().toLowerCase();
    if (!query) return snapshot.documentCases;
    return snapshot.documentCases.filter((doc) =>
      `${doc.loadId} ${doc.driverName} ${doc.customer}`
        .toLowerCase()
        .includes(query),
    );
  }, [deferredDocsSearch, snapshot]);

  function updateQueryParam(
    key: "driver" | "load" | "trip",
    value: string | null,
  ) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function patchSnapshot(
    mutator: (draft: DispatcherSnapshot) => DispatcherSnapshot,
  ) {
    setSnapshot((current) => {
      if (!current) return current;
      const next = mutator(current);
      const persisted = readDemoOpsState();
      writeDemoOpsState(persisted);
      return next;
    });
  }

  function updateDemoState(
    action: (state: ReturnType<typeof readDemoOpsState>) => void,
  ) {
    const current = readDemoOpsState();
    action(current);
    writeDemoOpsState(current);
    setSnapshot((existing) =>
      existing ? mergeDemoState(existing, current) : existing,
    );
  }

  function handleTaskStatus(
    taskId: string,
    status: "completed" | "dismissed" | "snoozed",
  ) {
    updateDemoState((state) => {
      state.tasks[taskId] = status;
    });
  }

  function handleAlertStatus(
    alertId: string,
    status: "acknowledged" | "snoozed",
  ) {
    updateDemoState((state) => {
      state.alerts[alertId] = status;
    });
  }

  function handleAssign(loadId: string, driverId?: string) {
    updateDemoState((state) => {
      if (driverId)
        state.assignments[loadId] = {
          driverId,
          assignedAt: new Date().toISOString(),
        };
    });
    router.push(
      `/?dispatchLoad=${encodeURIComponent(loadId)}${driverId ? `&suggestedDriver=${encodeURIComponent(driverId)}` : ""}`,
    );
  }

  function handleDocStatus(
    docId: string,
    status: DocumentBillingCase["reconciliationStatus"],
  ) {
    updateDemoState((state) => {
      state.docs[docId] = status;
    });
  }

  function exportSnapshot() {
    if (!snapshot) return;
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "dispatcher-hq-export.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function scrollToSection(id: string) {
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (loading) {
    return (
      <main className="flex-1 overflow-auto bg-[#f5f6f8] p-6">
        <div className="mx-auto max-w-[1500px] animate-pulse space-y-5">
          <div className="h-28 rounded-[28px] bg-white" />
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-6">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="h-32 rounded-[24px] bg-white" />
            ))}
          </div>
          <div className="h-[420px] rounded-[28px] bg-white" />
        </div>
      </main>
    );
  }

  if (error || !snapshot) {
    return (
      <main className="flex flex-1 items-center justify-center bg-[#f5f6f8] p-6">
        <div className="max-w-md rounded-[28px] border border-rose-200 bg-white p-8 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <AlertTriangle className="mx-auto h-8 w-8 text-rose-500" />
          <h1 className="mt-4 text-xl font-semibold text-slate-950">
            Reports could not load
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {error ?? "Unknown error"}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary mt-5"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </main>
    );
  }

  const routeLoad =
    snapshot.loads.find((load) => load.id === activeRouteLoadId) ??
    snapshot.loads[0];
  const selectedLastMileInsight =
    snapshot.lastMileInsights.find(
      (item) => item.facilityId === selectedLastMile,
    ) ?? snapshot.lastMileInsights[0];
  const activeDrivers = filteredDrivers.filter(
    (driver) => driver.status !== "available",
  );
  const availableDrivers = filteredDrivers.filter(
    (driver) => driver.status === "available",
  );

  return (
    <>
      <main className="flex-1 overflow-auto bg-[#f5f6f8] p-6">
        <div className="mx-auto max-w-[1500px] space-y-5">
          <section className="rounded-[30px] border border-slate-200 bg-white px-6 py-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium uppercase tracking-[0.24em] text-blue-600">
                  Dispatcher HQ
                </div>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                  {snapshot.greeting}
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  {snapshot.fleetHeadline}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 font-semibold",
                      snapshot.mode === "demo"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-emerald-50 text-emerald-700",
                    )}
                  >
                    {snapshot.mode === "demo" ? "Demo mode" : "Live mode"}
                  </span>
                  <span>
                    Last refresh{" "}
                    {new Date(snapshot.lastRefresh).toLocaleTimeString(
                      "en-US",
                      { hour: "numeric", minute: "2-digit" },
                    )}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button onClick={exportSnapshot} className="btn-outline">
                  <Download className="h-4 w-4" />
                  Export
                </button>
                <button
                  onClick={() => router.push("/?dispatchMode=new")}
                  className="btn-primary"
                >
                  <Truck className="h-4 w-4" />
                  New dispatch
                </button>
              </div>
            </div>
            {snapshot.modeNotice ? (
              <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
                {snapshot.modeNotice}
              </div>
            ) : null}
          </section>

          <section className="grid grid-cols-2 gap-4 xl:grid-cols-6">
            {snapshot.kpis.map((kpi) => (
              <button
                key={kpi.key}
                onClick={() =>
                  setActiveKpi((current) =>
                    current === kpi.key ? "all" : kpi.key,
                  )
                }
                className={cn(
                  "rounded-[24px] border bg-white p-5 text-left shadow-[0_16px_44px_rgba(15,23,42,0.06)] transition",
                  activeKpi === kpi.key
                    ? "border-blue-500 ring-2 ring-blue-100"
                    : "border-slate-200 hover:border-blue-200 hover:shadow-[0_18px_48px_rgba(15,23,42,0.09)]",
                )}
              >
                <div className="text-sm text-slate-500">{kpi.label}</div>
                <div className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
                  {kpi.value}
                </div>
                <div
                  className={cn(
                    "mt-3 text-sm",
                    kpi.tone === "positive"
                      ? "text-emerald-600"
                      : kpi.tone === "critical"
                        ? "text-rose-600"
                        : kpi.tone === "warning"
                          ? "text-amber-600"
                          : "text-slate-500",
                  )}
                >
                  {kpi.change}
                </div>
              </button>
            ))}
          </section>

          <section className="overflow-hidden rounded-[28px] border border-rose-200 bg-white shadow-[0_20px_56px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between bg-rose-600 px-5 py-3 text-white">
              <div className="flex items-center gap-3 text-lg font-semibold">
                <CircleDot className="h-4 w-4 fill-current" />
                Urgent action needed now
              </div>
              <span className="text-sm">
                {snapshot.urgentBand.length} items
              </span>
            </div>
            <div className="divide-y divide-rose-200 bg-rose-50">
              {snapshot.urgentBand.map((alert) => (
                <div
                  key={alert.id}
                  className="grid gap-3 px-5 py-4 lg:grid-cols-[160px_minmax(0,1fr)_140px] lg:items-center"
                >
                  <div className="text-sm font-semibold text-rose-700">
                    {alert.type.replace(/_/g, " ")}
                  </div>
                  <div>
                    <div className="text-rose-950">{alert.title}</div>
                    <div className="mt-1 text-sm text-rose-800/80">
                      {alert.description}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const relatedLoad = alert.related.find(
                        (item) => item.type === "load",
                      );
                      const relatedDriver = alert.related.find(
                        (item) => item.type === "driver",
                      );
                      if (relatedLoad) updateQueryParam("load", relatedLoad.id);
                      if (relatedDriver)
                        updateQueryParam("driver", relatedDriver.id);
                    }}
                    className="rounded-full border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-white"
                  >
                    {alert.actionLabel}
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="flex gap-3 overflow-x-auto rounded-[28px] border border-slate-200 bg-white px-4 py-3 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
            {sectionNav.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className="shrink-0 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
              >
                {item.label}
              </button>
            ))}
          </section>

          <section id="todo" className="grid gap-5 xl:grid-cols-[1.3fr_0.9fr]">
            <div className="overflow-hidden rounded-[30px] border border-blue-600 bg-white shadow-[0_24px_64px_rgba(37,99,235,0.12)]">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-blue-700 px-5 py-4 text-white">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5" />
                  <div>
                    <h2 className="text-xl font-semibold">
                      Axle's smart to-do board
                    </h2>
                    <p className="text-sm text-blue-100">
                      Deterministic dispatch rules first, Gemini-style reasoning
                      layered on top.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(["all", "urgent", "alerts", "ai"] as const).map((key) => (
                    <button
                      key={key}
                      onClick={() => setTaskFilter(key)}
                      className={cn(
                        "rounded-full px-3 py-1 text-sm font-medium",
                        taskFilter === key
                          ? "bg-white text-blue-700"
                          : "bg-blue-600 text-blue-100",
                      )}
                    >
                      {key === "all"
                        ? "All"
                        : key === "ai"
                          ? "AI suggestions"
                          : key}
                    </button>
                  ))}
                  <button className="rounded-full border border-blue-300 px-3 py-1 text-sm font-medium text-white transition hover:bg-blue-600">
                    Regenerate
                  </button>
                </div>
              </div>
              <div className="divide-y divide-slate-200">
                {visibleTasks.length === 0 ? (
                  <div className="px-5 py-12 text-center text-slate-500">
                    No open tasks in this view.
                  </div>
                ) : (
                  visibleTasks.map((task, index) => (
                    <article
                      key={task.id}
                      className="grid gap-4 px-5 py-5 lg:grid-cols-[44px_minmax(0,1fr)_220px]"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-lg font-semibold text-blue-700">
                        {index + 1}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xl font-semibold text-slate-950">
                            {task.title}
                          </h3>
                          {task.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                          {task.whyItMatters}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                          {task.related.map((item) => (
                            <button
                              key={item.id}
                              onClick={() =>
                                updateQueryParam(
                                  item.type === "trip"
                                    ? "trip"
                                    : item.type === "driver"
                                      ? "driver"
                                      : "load",
                                  item.id,
                                )
                              }
                              className="rounded-full border border-slate-200 px-3 py-1 transition hover:border-blue-300 hover:text-blue-700"
                            >
                              {item.label}
                            </button>
                          ))}
                          <span>Estimated effort {task.effortMinutes} min</span>
                          {typeof task.confidence === "number" ? (
                            <span>
                              Confidence {Math.round(task.confidence * 100)}%
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                          <div className="font-medium text-slate-950">
                            Operational reasons
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {task.operationalReasons.map((reason) => (
                              <span
                                key={reason}
                                className="rounded-full bg-white px-3 py-1 text-xs text-slate-600"
                              >
                                {reason}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => {
                            const load = task.related.find(
                              (item) => item.type === "load",
                            );
                            const driver = task.related.find(
                              (item) => item.type === "driver",
                            );
                            if (task.primaryAction === "assign" && load)
                              handleAssign(load.id, driver?.id);
                            if (task.primaryAction === "open_driver" && driver)
                              updateQueryParam("driver", driver.id);
                            if (task.primaryAction === "open_trip") {
                              const trip = task.related.find(
                                (item) => item.type === "trip",
                              );
                              if (trip) updateQueryParam("trip", trip.id);
                            }
                            if (task.primaryAction === "open_docs") {
                              const loadRef = task.related.find(
                                (item) => item.type === "load",
                              );
                              if (loadRef) updateQueryParam("load", loadRef.id);
                            }
                          }}
                          className="btn-primary justify-center"
                        >
                          {task.primaryCta}
                        </button>
                        <button
                          onClick={() => handleTaskStatus(task.id, "snoozed")}
                          className="btn-outline justify-center"
                        >
                          Snooze
                        </button>
                        <button
                          onClick={() => handleTaskStatus(task.id, "dismissed")}
                          className="btn-outline justify-center"
                        >
                          Dismiss
                        </button>
                        <button
                          onClick={() => handleTaskStatus(task.id, "completed")}
                          className="rounded-full px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50"
                        >
                          Mark complete
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-5">
              <FleetMapCard
                drivers={snapshot.drivers}
                filter={fleetFilter}
                onExpand={() => setMapExpanded(true)}
              />
              <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_16px_44px_rgba(15,23,42,0.06)]">
                <h3 className="text-lg font-semibold text-slate-950">
                  Fleet filters
                </h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    "all",
                    "active",
                    "available",
                    "detained",
                    "maintenance",
                    "breakdown",
                  ].map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setFleetFilter(filter)}
                      className={cn(
                        "rounded-full border px-4 py-2 text-sm",
                        fleetFilter === filter
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-slate-200 text-slate-600",
                      )}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
                <div className="mt-5 space-y-3">
                  {snapshot.alerts.slice(0, 4).map((alert) => (
                    <div
                      key={alert.id}
                      className="rounded-2xl border border-slate-200 px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium text-slate-900">
                          {alert.title}
                        </div>
                        <button
                          onClick={() =>
                            handleAlertStatus(alert.id, "acknowledged")
                          }
                          className="text-xs font-semibold text-blue-600"
                        >
                          Acknowledge
                        </button>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {alert.description}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </section>

          <section
            id="drivers"
            className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-950">
                  Available drivers
                </h2>
                <p className="text-sm text-slate-500">
                  Split by in-transit and available with readiness, HOS,
                  maintenance, and downstream impact.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-500">Sort</label>
                <div className="relative">
                  <select
                    value={driverSort}
                    onChange={(event) =>
                      startTransition(() =>
                        setDriverSort(event.target.value as typeof driverSort),
                      )
                    }
                    className="input min-w-[180px] appearance-none pr-10"
                  >
                    <option value="readiness">Readiness score</option>
                    <option value="hos">HOS remaining</option>
                    <option value="deadhead">Deadhead miles</option>
                    <option value="profitability">Profitability</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-400" />
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              <DriverColumn
                title="Actively driving"
                drivers={activeDrivers}
                onOpen={(driverId) => updateQueryParam("driver", driverId)}
              />
              <DriverColumn
                title="Inactive / available"
                drivers={availableDrivers}
                onOpen={(driverId) => updateQueryParam("driver", driverId)}
              />
            </div>
          </section>

          <section
            id="trips"
            className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-slate-950">
                  Current trips
                </h2>
                <p className="text-sm text-slate-500">
                  Live HOS, ETA, route health, parking plans, detention state,
                  and reroute actions.
                </p>
              </div>
            </div>
            <div className="mt-5 space-y-4">
              {filteredTrips.map((trip) => (
                <div
                  key={trip.id}
                  className="rounded-[24px] border border-slate-200 p-4"
                >
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_repeat(5,minmax(0,1fr))_140px]">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">
                        {trip.driverName} • {trip.truckUnit}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {trip.origin} → {trip.destination}
                      </div>
                    </div>
                    <TripMetric
                      label="Live HOS"
                      value={`${trip.liveHosHours.toFixed(1)}h`}
                    />
                    <TripMetric label="Live ETA" value={trip.liveEta} />
                    <TripMetric
                      label="Route health"
                      value={trip.routeHealth}
                      tone={
                        trip.routeHealth === "risk"
                          ? "danger"
                          : trip.routeHealth === "watch"
                            ? "warning"
                            : "good"
                      }
                    />
                    <TripMetric label="Fuel" value={trip.fuelStatus} />
                    <TripMetric label="Parking" value={trip.parkingStopPlan} />
                    <TripMetric label="Detention" value={trip.detentionState} />
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => updateQueryParam("trip", trip.id)}
                        className="btn-outline justify-center"
                      >
                        Expand
                      </button>
                      <button
                        onClick={() => setActiveRouteLoadId(trip.loadId)}
                        className="btn-primary justify-center"
                      >
                        Reroute
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section
            id="loads"
            className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-slate-950">
                  Load board
                </h2>
                <p className="text-sm text-slate-500">
                  Dense row-first view with urgency, projected margin,
                  best-match driver, and assignment flow.
                </p>
              </div>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase tracking-[0.18em] text-slate-500">
                  <tr>
                    <th className="pb-3">Load</th>
                    <th className="pb-3">Lane</th>
                    <th className="pb-3">Windows</th>
                    <th className="pb-3">Equipment</th>
                    <th className="pb-3">Miles</th>
                    <th className="pb-3">Rate</th>
                    <th className="pb-3">State</th>
                    <th className="pb-3">Best match</th>
                    <th className="pb-3">Margin</th>
                    <th className="pb-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredLoads.map((load) => (
                    <tr key={load.id} className="hover:bg-slate-50">
                      <td className="py-4 font-semibold text-slate-950">
                        {load.id}
                      </td>
                      <td className="py-4">{load.lane}</td>
                      <td className="py-4 text-slate-500">
                        {load.pickupWindow}
                        <br />
                        {load.deliveryWindow}
                      </td>
                      <td className="py-4">{load.equipment}</td>
                      <td className="py-4">{load.miles}</td>
                      <td className="py-4">${load.rate.toLocaleString()}</td>
                      <td className="py-4">
                        <span
                          className={cn(
                            "rounded-full px-3 py-1 text-xs font-semibold",
                            load.assignedDriverId
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-700",
                          )}
                        >
                          {load.assignedDriverId ? "Assigned" : "Unassigned"}
                        </span>
                      </td>
                      <td className="py-4">
                        {load.bestMatchDriverName ?? "Open"}
                      </td>
                      <td className="py-4 text-emerald-700">
                        ${load.marginProjection.toLocaleString()}
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => updateQueryParam("load", load.id)}
                            className="btn-outline"
                          >
                            Details
                          </button>
                          <button
                            onClick={() =>
                              handleAssign(load.id, load.bestMatchDriverId)
                            }
                            className="btn-primary"
                          >
                            Assign driver
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section
            id="routes"
            className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-950">
                  Route optimizer
                </h2>
                <p className="text-sm text-slate-500">
                  Four route choices with legality, fuel, HOS, parking, weather,
                  detention, and last-mile confidence.
                </p>
              </div>
              <div className="relative">
                <select
                  value={activeRouteLoadId}
                  onChange={(event) => setActiveRouteLoadId(event.target.value)}
                  className="input min-w-[260px] appearance-none pr-10"
                >
                  {snapshot.loads.map((load) => (
                    <option key={load.id} value={load.id}>
                      {load.id} • {load.lane}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-400" />
              </div>
            </div>
            <div className="mt-5 grid gap-4 xl:grid-cols-4">
              {routeLoad.routeChoices.map((choice) => (
                <article
                  key={choice.id}
                  className={cn(
                    "rounded-[24px] border p-4",
                    choice.label === "Recommended"
                      ? "border-blue-500 bg-blue-50/60"
                      : "border-slate-200",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-semibold text-slate-950">
                      {choice.label}
                    </div>
                    {choice.label === "Recommended" ? (
                      <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                        Best overall
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    <RouteMetric label="Miles" value={String(choice.miles)} />
                    <RouteMetric
                      label="ETA"
                      value={`${choice.etaMinutes} min`}
                    />
                    <RouteMetric label="Fuel" value={`$${choice.fuelCost}`} />
                    <RouteMetric label="Tolls" value={`$${choice.tolls}`} />
                    <RouteMetric
                      label="Savings"
                      value={`$${choice.fuelPartnerSavings}`}
                    />
                    <RouteMetric
                      label="HOS left"
                      value={`${choice.leftoverHosHours.toFixed(1)}h`}
                    />
                    <RouteMetric
                      label="Parking"
                      value={`${choice.parkingViability}%`}
                    />
                    <RouteMetric
                      label="Last mile"
                      value={`${choice.lastMileConfidence}%`}
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    {choice.stateWarnings.map((warning) => (
                      <span
                        key={warning}
                        className="rounded-full bg-amber-100 px-3 py-1 text-amber-700"
                      >
                        {warning}
                      </span>
                    ))}
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
                      Legality {choice.legalityScore}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                      Weather {choice.weatherRisk}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                      Detention {choice.detentionSensitivity}
                    </span>
                  </div>
                  <p className="mt-4 text-sm text-slate-600">
                    {choice.explanation}
                  </p>
                  <button
                    onClick={() =>
                      handleAssign(routeLoad.id, routeLoad.bestMatchDriverId)
                    }
                    className="btn-outline mt-4 w-full justify-center"
                  >
                    Send to Map workflow
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-950">
                    Last-mile navigation
                  </h2>
                  <p className="text-sm text-slate-500">
                    Truck entrance, staging area, avoid notes, and image-backed
                    confidence.
                  </p>
                </div>
                <div className="relative">
                  <select
                    value={selectedLastMile}
                    onChange={(event) =>
                      setSelectedLastMile(event.target.value)
                    }
                    className="input min-w-[220px] appearance-none pr-10"
                  >
                    {snapshot.lastMileInsights.map((insight) => (
                      <option
                        key={insight.facilityId}
                        value={insight.facilityId}
                      >
                        {insight.facilityName}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-400" />
                </div>
              </div>
              <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-lg font-semibold text-slate-950">
                  {selectedLastMileInsight.recommendedEntrance}
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  Parking / staging: {selectedLastMileInsight.parkingArea}
                </div>
                <div className="mt-3 rounded-2xl bg-white p-4 text-sm text-slate-600">
                  {selectedLastMileInsight.reasoning}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedLastMileInsight.avoidNotes.map((note) => (
                    <span
                      key={note}
                      className="rounded-full bg-rose-50 px-3 py-1 text-xs text-rose-700"
                    >
                      {note}
                    </span>
                  ))}
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">
                    Confidence{" "}
                    {Math.round(selectedLastMileInsight.confidence * 100)}%
                  </span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {selectedLastMileInsight.imageRefs.map((ref) => (
                    <div
                      key={ref}
                      className="overflow-hidden rounded-[20px] border border-slate-200 bg-white"
                    >
                      <Image
                        src={ref}
                        alt={`${selectedLastMileInsight.facilityName} facility preview`}
                        width={600}
                        height={320}
                        className="h-40 w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-950">
                    Proactive alerts
                  </h2>
                  <p className="text-sm text-slate-500">
                    Dispatcher-facing exceptions plus driver-facing nudges.
                  </p>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {snapshot.alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="rounded-[22px] border border-slate-200 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "rounded-full px-3 py-1 text-xs font-semibold",
                              alert.severity === "critical"
                                ? "bg-rose-50 text-rose-700"
                                : alert.severity === "warning"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-sky-50 text-sky-700",
                            )}
                          >
                            {alert.severity}
                          </span>
                          <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                            {alert.scope}
                          </span>
                        </div>
                        <div className="mt-2 text-base font-semibold text-slate-950">
                          {alert.title}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          {alert.description}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() =>
                            handleAlertStatus(alert.id, "acknowledged")
                          }
                          className="btn-outline justify-center"
                        >
                          Acknowledge
                        </button>
                        <button
                          onClick={() => handleAlertStatus(alert.id, "snoozed")}
                          className="btn-outline justify-center"
                        >
                          Snooze
                        </button>
                      </div>
                    </div>
                    {alert.draftMessage ? (
                      <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
                        {alert.draftMessage}
                      </div>
                    ) : null}
                    {alert.sourceUrl ? (
                      <div className="mt-3 text-xs text-slate-500">
                        Source:{" "}
                        <a
                          href={alert.sourceUrl}
                          className="text-blue-600 underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          official reference
                        </a>
                        {alert.effectiveDate
                          ? ` • effective ${alert.effectiveDate}`
                          : ""}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-950">
                    Detention and exception management
                  </h2>
                  <p className="text-sm text-slate-500">
                    Shared detention clock, invoice draft automation,
                    escalation, and AI alternatives.
                  </p>
                </div>
              </div>
              <div className="mt-5 space-y-4">
                {snapshot.detentions.map((detention) => (
                  <div
                    key={detention.id}
                    className="rounded-[24px] border border-slate-200 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-lg font-semibold text-slate-950">
                          {detention.facility}
                        </div>
                        <div className="text-sm text-slate-500">
                          {detention.loadId} • {detention.clockState}
                        </div>
                      </div>
                      <div className="rounded-full bg-rose-50 px-3 py-1 text-sm font-semibold text-rose-700">
                        {Math.floor(detention.minutes / 60)}h{" "}
                        {detention.minutes % 60}m
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <InfoCard
                        label="Invoice draft"
                        value={
                          detention.invoiceDraftReady ? "Ready" : "Pending"
                        }
                        tone={detention.invoiceDraftReady ? "good" : "warning"}
                      />
                      <InfoCard
                        label="Tomorrow impact"
                        value={detention.tomorrowImpact}
                      />
                      <InfoCard
                        label="Margin impact"
                        value={detention.marginImpact}
                        tone="danger"
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {detention.aiAlternatives.map((option) => (
                        <span
                          key={option}
                          className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
                        >
                          {option}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section
              id="costs"
              className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]"
            >
              <div>
                <h2 className="text-2xl font-semibold text-slate-950">
                  Cost intelligence
                </h2>
                <p className="text-sm text-slate-500">
                  Live economics, variance vs target, and lane/customer
                  profitability.
                </p>
              </div>
              <div className="mt-5 space-y-3">
                {snapshot.costTrend.map((point) => (
                  <div key={point.label}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">
                        {point.label}
                      </span>
                      <span className="text-slate-500">
                        CPM ${point.costPerMile.toFixed(2)}
                      </span>
                    </div>
                    <div className="grid grid-cols-[1fr_1fr] gap-2">
                      <div className="h-3 rounded-full bg-slate-100">
                        <div
                          className="h-3 rounded-full bg-blue-600"
                          style={{
                            width: `${Math.min(100, point.revenue / 450)}%`,
                          }}
                        />
                      </div>
                      <div className="h-3 rounded-full bg-slate-100">
                        <div
                          className="h-3 rounded-full bg-emerald-500"
                          style={{
                            width: `${Math.min(100, point.margin / 140)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <InfoCard
                  label="Deadhead cost exposure"
                  value="$1.9K live"
                  tone="warning"
                />
                <InfoCard
                  label="Detention cost today"
                  value="$534"
                  tone="danger"
                />
                <InfoCard
                  label="Best lane margin"
                  value="Dallas -> Houston"
                  tone="good"
                />
                <InfoCard
                  label="Most profitable driver"
                  value="Patel / Davis"
                  tone="good"
                />
              </div>
            </section>
          </section>

          <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <section
              id="safety"
              className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]"
            >
              <div>
                <h2 className="text-2xl font-semibold text-slate-950">
                  Safety and compliance
                </h2>
                <p className="text-sm text-slate-500">
                  HOS, inspections, maintenance due, CSA view, and action
                  center.
                </p>
              </div>
              <div className="mt-5 space-y-3">
                {snapshot.safetyCases.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[22px] border border-slate-200 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-slate-950">
                          {item.title}
                        </div>
                        <div className="text-sm text-slate-500">
                          {item.owner} • {item.dueText}
                        </div>
                      </div>
                      <button className="btn-outline">Follow up</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section
              id="docs"
              className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-950">
                    Documents and billing
                  </h2>
                  <p className="text-sm text-slate-500">
                    Required doc nudges, invoice blockers, reconciliation
                    status, and dispatcher review.
                  </p>
                </div>
                <input
                  className="input min-w-[260px]"
                  value={docsSearch}
                  onChange={(event) => setDocsSearch(event.target.value)}
                  placeholder="Search load, driver, or customer"
                />
              </div>
              <div className="mt-5 space-y-3">
                {visibleDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="rounded-[22px] border border-slate-200 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-slate-950">
                          {doc.loadId} • {doc.customer}
                        </div>
                        <div className="text-sm text-slate-500">
                          {doc.driverName}
                        </div>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-semibold",
                          doc.reconciliationStatus === "approved"
                            ? "bg-emerald-50 text-emerald-700"
                            : doc.reconciliationStatus === "blocked"
                              ? "bg-rose-50 text-rose-700"
                              : "bg-amber-50 text-amber-700",
                        )}
                      >
                        {doc.reconciliationStatus}
                      </span>
                    </div>
                    <div className="mt-3 text-sm text-slate-600">
                      {doc.aiExplanation}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {doc.missingDocs.map((item) => (
                        <span
                          key={item}
                          className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
                        >
                          {item}
                        </span>
                      ))}
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">
                        Match {Math.round(doc.invoiceMatchConfidence * 100)}%
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => handleDocStatus(doc.id, "approved")}
                        className="btn-primary"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleDocStatus(doc.id, "review")}
                        className="btn-outline"
                      >
                        Review
                      </button>
                      <button
                        onClick={() => handleDocStatus(doc.id, "blocked")}
                        className="btn-outline"
                      >
                        Reject / block
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </section>
        </div>
      </main>

      <DetailDrawer
        open={Boolean(selectedDriver)}
        title={
          selectedDriver
            ? `${selectedDriver.firstName} ${selectedDriver.lastName}`
            : ""
        }
        subtitle={
          selectedDriver
            ? `${selectedDriver.unit} • ${selectedDriver.currentCity}`
            : undefined
        }
        onClose={() => updateQueryParam("driver", null)}
      >
        {selectedDriver ? <DriverDetail driver={selectedDriver} /> : null}
      </DetailDrawer>

      <DetailDrawer
        open={Boolean(selectedLoad)}
        title={selectedLoad ? `${selectedLoad.id} • ${selectedLoad.lane}` : ""}
        subtitle={
          selectedLoad
            ? `${selectedLoad.customer} • ${selectedLoad.equipment}`
            : undefined
        }
        onClose={() => updateQueryParam("load", null)}
      >
        {selectedLoad ? (
          <LoadDetail
            load={selectedLoad}
            onAssign={() =>
              handleAssign(selectedLoad.id, selectedLoad.bestMatchDriverId)
            }
          />
        ) : null}
      </DetailDrawer>

      <DetailDrawer
        open={Boolean(selectedTrip)}
        title={
          selectedTrip ? `${selectedTrip.id} • ${selectedTrip.driverName}` : ""
        }
        subtitle={
          selectedTrip
            ? `${selectedTrip.origin} → ${selectedTrip.destination}`
            : undefined
        }
        onClose={() => updateQueryParam("trip", null)}
      >
        {selectedTrip ? <TripDetail trip={selectedTrip} /> : null}
      </DetailDrawer>

      {mapExpanded ? (
        <div className="fixed inset-0 z-50 bg-slate-950/50 p-6">
          <div className="h-full rounded-[30px] border border-slate-200 bg-white p-4">
            <FleetMapCard
              drivers={snapshot.drivers}
              filter={fleetFilter}
              onExpand={() => setMapExpanded(false)}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

function DriverColumn({
  title,
  drivers,
  onOpen,
}: {
  title: string;
  drivers: OperationsDriver[];
  onOpen: (driverId: string) => void;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="text-lg font-semibold text-slate-950">{title}</div>
      </div>
      <div className="divide-y divide-slate-200">
        {drivers.map((driver) => (
          <button
            key={driver.id}
            onClick={() => onOpen(driver.id)}
            className="grid w-full gap-3 px-4 py-4 text-left transition hover:bg-slate-50 md:grid-cols-[minmax(0,1fr)_120px_120px_120px]"
          >
            <div>
              <div className="text-base font-semibold text-slate-950">
                {driver.firstName} {driver.lastName} • {driver.unit}
              </div>
              <div className="mt-1 text-sm text-slate-500">
                {driver.currentRoute}
              </div>
              <div className="mt-2 text-xs text-slate-500">
                {driver.downstreamImpact}
              </div>
            </div>
            <DriverStat
              label="Readiness"
              value={`${driver.readinessScore}`}
              tone={
                driver.readinessScore > 84
                  ? "good"
                  : driver.readinessScore < 55
                    ? "danger"
                    : "warning"
              }
            />
            <DriverStat
              label="HOS left"
              value={`${driver.hosRemainingHours.toFixed(1)}h`}
            />
            <DriverStat label="Deadhead" value={`${driver.deadheadMiles} mi`} />
          </button>
        ))}
      </div>
    </div>
  );
}

function DriverStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "good" | "warning" | "danger";
}) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div
        className={cn(
          "mt-1 text-lg font-semibold",
          tone === "good"
            ? "text-emerald-700"
            : tone === "warning"
              ? "text-amber-700"
              : tone === "danger"
                ? "text-rose-700"
                : "text-slate-950",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function TripMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "good" | "warning" | "danger";
}) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div
        className={cn(
          "mt-1 text-sm font-semibold",
          tone === "good"
            ? "text-emerald-700"
            : tone === "warning"
              ? "text-amber-700"
              : tone === "danger"
                ? "text-rose-700"
                : "text-slate-950",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function RouteMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white px-3 py-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function InfoCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "good" | "warning" | "danger";
}) {
  return (
    <div className="rounded-[20px] border border-slate-200 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div
        className={cn(
          "mt-2 text-sm font-semibold",
          tone === "good"
            ? "text-emerald-700"
            : tone === "warning"
              ? "text-amber-700"
              : tone === "danger"
                ? "text-rose-700"
                : "text-slate-950",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function DriverDetail({ driver }: { driver: OperationsDriver }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <InfoCard label="Current status" value={driver.status} />
        <InfoCard label="Current route/load" value={driver.currentRoute} />
        <InfoCard
          label="HOS remaining"
          value={`${driver.hosRemainingHours.toFixed(1)}h`}
          tone={driver.hosRemainingHours < 2 ? "danger" : "good"}
        />
        <InfoCard
          label="Readiness score"
          value={`${driver.readinessScore}/100`}
          tone={driver.readinessScore > 84 ? "good" : "warning"}
        />
        <InfoCard
          label="Maintenance score"
          value={`${driver.maintenanceScore}`}
          tone={driver.maintenanceScore < 60 ? "danger" : "good"}
        />
        <InfoCard
          label="CSA score"
          value={`${driver.csaScore}`}
          tone={driver.csaScore > 20 ? "warning" : "good"}
        />
      </div>
      <section className="rounded-[24px] border border-slate-200 p-4">
        <h3 className="text-lg font-semibold text-slate-950">
          AI-generated overview
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          {driver.profile.overview.summary}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {driver.profile.overview.recommendations.map((item) => (
            <span
              key={item}
              className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700"
            >
              {item}
            </span>
          ))}
        </div>
      </section>
      <section className="rounded-[24px] border border-slate-200 p-4">
        <h3 className="text-lg font-semibold text-slate-950">
          Readiness breakdown
        </h3>
        <div className="mt-3 space-y-3">
          {driver.readinessBreakdown.map((factor) => (
            <div key={factor.key}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">
                  {factor.label}
                </span>
                <span className="text-slate-500">
                  {Math.round(factor.rawScore)} / 100
                </span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-blue-600"
                  style={{ width: `${factor.rawScore}%` }}
                />
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {factor.explanation}
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-[24px] border border-slate-200 p-4">
        <h3 className="text-lg font-semibold text-slate-950">Driver profile</h3>
        <div className="mt-3 space-y-2 text-sm text-slate-600">
          <p>{driver.profile.bio}</p>
          <p>{driver.profile.hosTrend}</p>
          <p>{driver.profile.averageMargin}</p>
          <p>
            Ready for OTR now?{" "}
            <span className="font-semibold text-slate-950">
              {driver.profile.overview.readyForOtrNow ? "Yes" : "No"}
            </span>{" "}
            — {driver.profile.overview.readyExplanation}
          </p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <InfoCard
            label="Fuel efficiency"
            value={driver.profile.fuelEfficiency}
          />
          <InfoCard
            label="Average trip duration"
            value={driver.profile.averageTripDuration}
          />
        </div>
      </section>
    </div>
  );
}

function LoadDetail({
  load,
  onAssign,
}: {
  load: LoadBoardRecord;
  onAssign: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <InfoCard label="Customer" value={load.customer} />
        <InfoCard
          label="Urgency"
          value={load.urgency}
          tone={
            load.urgency === "critical"
              ? "danger"
              : load.urgency === "high"
                ? "warning"
                : "default"
          }
        />
        <InfoCard
          label="Windows"
          value={`${load.pickupWindow} / ${load.deliveryWindow}`}
        />
        <InfoCard
          label="Projected margin"
          value={`$${load.marginProjection}`}
          tone="good"
        />
      </div>
      <section className="rounded-[24px] border border-slate-200 p-4">
        <h3 className="text-lg font-semibold text-slate-950">
          Assignment recommendation
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          {load.aiAssignmentRecommendation}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {load.docsRequired.map((doc) => (
            <span
              key={doc}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
            >
              {doc}
            </span>
          ))}
          {load.bestMatchDriverName ? (
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">
              Best match {load.bestMatchDriverName}
            </span>
          ) : null}
        </div>
        <button onClick={onAssign} className="btn-primary mt-4">
          Assign driver in Map workflow
        </button>
      </section>
      <section className="rounded-[24px] border border-slate-200 p-4">
        <h3 className="text-lg font-semibold text-slate-950">
          Route options summary
        </h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {load.routeChoices.map((choice) => (
            <div key={choice.id} className="rounded-[20px] bg-slate-50 p-3">
              <div className="font-semibold text-slate-950">{choice.label}</div>
              <div className="mt-1 text-sm text-slate-600">
                {choice.explanation}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function TripDetail({ trip }: { trip: CurrentTrip }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <InfoCard label="Live ETA" value={trip.liveEta} />
        <InfoCard
          label="Route health"
          value={trip.routeHealth}
          tone={
            trip.routeHealth === "risk"
              ? "danger"
              : trip.routeHealth === "watch"
                ? "warning"
                : "good"
          }
        />
        <InfoCard label="Fuel status" value={trip.fuelStatus} />
        <InfoCard label="Parking plan" value={trip.parkingStopPlan} />
      </div>
      <section className="rounded-[24px] border border-slate-200 p-4">
        <h3 className="text-lg font-semibold text-slate-950">Timeline</h3>
        <div className="mt-3 space-y-3">
          {trip.timeline.map((item) => (
            <div key={item.id} className="rounded-[18px] bg-slate-50 p-3">
              <div className="font-medium text-slate-900">{item.label}</div>
              <div className="mt-1 text-sm text-slate-500">
                {new Date(item.timestamp).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-[24px] border border-slate-200 p-4">
        <h3 className="text-lg font-semibold text-slate-950">Route options</h3>
        <div className="mt-3 space-y-2 text-sm text-slate-600">
          {trip.routeOptionsSummary.map((item) => (
            <div key={item}>• {item}</div>
          ))}
        </div>
      </section>
    </div>
  );
}
