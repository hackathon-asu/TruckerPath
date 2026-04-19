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
  ChevronRight,
  CircleDot,
  Download,
  Filter,
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
  DispatcherSnapshot,
  DispatcherTask,
  DocumentBillingCase,
  LoadBoardRecord,
  OperationsDriver,
  RouteChoice,
} from "@/lib/types";

const sectionNav = [
  { id: "todo", label: "AI insights & to-do" },
  { id: "ready", label: "Ready to dispatch" },
  { id: "active", label: "Active trips" },
  { id: "exceptions", label: "Needs attention" },
  { id: "loads", label: "Load board" },
  { id: "costs", label: "Cost intelligence" },
  { id: "safety", label: "Safety / compliance" },
  { id: "docs", label: "Docs / billing" },
] as const;

type HealthTone = "good" | "warning" | "danger";

function tripHealth(trip: CurrentTrip): { label: string; tone: HealthTone } {
  const fuel = trip.fuelStatus?.toLowerCase() ?? "";
  const parking = trip.parkingStopPlan?.toLowerCase() ?? "";
  const detention = trip.detentionState?.toLowerCase() ?? "";
  const detentionActive =
    detention.length > 0 &&
    !/none|no|not started|n\/a|clear|ok/.test(detention);
  if (
    trip.routeHealth === "risk" ||
    trip.liveHosHours < 2 ||
    /low|empty|risk/.test(fuel)
  ) {
    return { label: "Risk", tone: "danger" };
  }
  if (
    trip.routeHealth === "watch" ||
    /watch|tight|soon/.test(fuel) ||
    /risk|tight|watch/.test(parking) ||
    detentionActive
  ) {
    return { label: "Watch", tone: "warning" };
  }
  return { label: "Good", tone: "good" };
}

function recommendedAction(trip: CurrentTrip): string {
  const fuel = trip.fuelStatus?.toLowerCase() ?? "";
  const parking = trip.parkingStopPlan?.toLowerCase() ?? "";
  const detention = trip.detentionState?.toLowerCase() ?? "";
  if (trip.routeHealth === "risk") return "Reroute recommended";
  if (trip.liveHosHours < 2) return "HOS stop risk ahead";
  if (/low|empty/.test(fuel)) return "Fuel stop needed soon";
  if (/risk|tight/.test(parking)) return "Parking risk near destination";
  if (
    detention.length > 0 &&
    !/none|no|not started|n\/a|clear|ok/.test(detention)
  )
    return "Detention in progress — escalate";
  if (trip.routeHealth === "watch") return "Monitor route conditions";
  return "No action needed";
}

export function ReportsDashboard() {
  const [snapshot, setSnapshot] = useState<DispatcherSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeKpi, setActiveKpi] = useState<string>("all");
  const [fleetFilter, setFleetFilter] = useState<string>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [driverSort, setDriverSort] = useState<
    "readiness" | "hos" | "deadhead" | "profitability"
  >("readiness");
  const [taskFilter, setTaskFilter] = useState<
    DispatcherTask["category"] | "all"
  >("all");
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);
  const [routeDrawerTripId, setRouteDrawerTripId] = useState<string | null>(
    null,
  );
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
    return [...snapshot.drivers]
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

  const { activeTrips, exceptionTrips } = useMemo(() => {
    const active: CurrentTrip[] = [];
    const exceptions: CurrentTrip[] = [];
    for (const trip of filteredTrips) {
      if (tripHealth(trip).tone === "good") active.push(trip);
      else exceptions.push(trip);
    }
    return { activeTrips: active, exceptionTrips: exceptions };
  }, [filteredTrips]);

  function updateQueryParam(
    key: "driver" | "load" | "trip",
    value: string | null,
  ) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
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

  const activeDrivers = filteredDrivers.filter(
    (driver) => driver.status !== "available",
  );
  const availableDrivers = filteredDrivers.filter(
    (driver) => driver.status === "available",
  );

  const routeDrawerTrip =
    snapshot.trips.find((trip) => trip.id === routeDrawerTripId) ?? null;
  const routeDrawerLoad = routeDrawerTrip
    ? (snapshot.loads.find((load) => load.id === routeDrawerTrip.loadId) ??
      null)
    : null;

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

          {/* AI Insights + To-Do Board (prominent, full detail) */}
          <section id="todo" className="grid gap-5 xl:grid-cols-[1.3fr_0.9fr]">
            <div className="overflow-hidden rounded-[30px] border border-blue-600 bg-white shadow-[0_24px_64px_rgba(37,99,235,0.12)]">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-blue-700 px-5 py-4 text-white">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5" />
                  <div>
                    <h2 className="text-xl font-semibold">
                      Axle AI insights & smart to-do board
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

            {/* Right rail: Fleet map, collapsible Fleet Filters, then Proactive Alerts BELOW filters */}
            <div className="space-y-5">
              <FleetMapCard
                drivers={snapshot.drivers}
                filter={fleetFilter}
                onExpand={() => setMapExpanded(true)}
              />

              <section className="rounded-[28px] border border-slate-200 bg-white shadow-[0_16px_44px_rgba(15,23,42,0.06)]">
                <button
                  onClick={() => setFiltersOpen((value) => !value)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                >
                  <div className="flex items-center gap-3">
                    <Filter className="h-4 w-4 text-slate-500" />
                    <div>
                      <div className="text-lg font-semibold text-slate-950">
                        Fleet filters
                      </div>
                      <div className="text-xs text-slate-500">
                        Status · HOS · fuel · parking · detention · route health
                      </div>
                    </div>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-slate-500 transition",
                      filtersOpen ? "rotate-180" : "",
                    )}
                  />
                </button>
                {filtersOpen ? (
                  <div className="border-t border-slate-200 px-5 py-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Driver status
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
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
                            "rounded-full border px-3 py-1.5 text-xs",
                            fleetFilter === filter
                              ? "border-blue-500 bg-blue-50 text-blue-700"
                              : "border-slate-200 text-slate-600",
                          )}
                        >
                          {filter}
                        </button>
                      ))}
                    </div>
                    <div className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Risk filters
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      {[
                        { key: "hos", label: "HOS risk" },
                        { key: "fuel", label: "Fuel risk" },
                        { key: "parking", label: "Parking risk" },
                        { key: "detention", label: "Detention risk" },
                        { key: "route", label: "Route health" },
                        { key: "available", label: "Available drivers" },
                      ].map((filter) => (
                        <button
                          key={filter.key}
                          onClick={() => setActiveKpi(filter.key)}
                          className={cn(
                            "rounded-full border px-3 py-1.5",
                            activeKpi === filter.key
                              ? "border-blue-500 bg-blue-50 text-blue-700"
                              : "border-slate-200 text-slate-600",
                          )}
                        >
                          {filter.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_16px_44px_rgba(15,23,42,0.06)]">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950">
                      Proactive alerts
                    </h3>
                    <p className="text-xs text-slate-500">
                      Dispatcher exceptions and driver nudges.
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {snapshot.alerts.length}
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {snapshot.alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="rounded-2xl border border-slate-200 px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                              alert.severity === "critical"
                                ? "bg-rose-50 text-rose-700"
                                : alert.severity === "warning"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-sky-50 text-sky-700",
                            )}
                          >
                            {alert.severity}
                          </span>
                          <span className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                            {alert.scope}
                          </span>
                        </div>
                        <button
                          onClick={() =>
                            handleAlertStatus(alert.id, "acknowledged")
                          }
                          className="text-xs font-semibold text-blue-600"
                        >
                          Ack
                        </button>
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {alert.title}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {alert.description}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </section>

          {/* Ready to dispatch */}
          <section
            id="ready"
            className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-950">
                  Ready to dispatch
                </h2>
                <p className="text-sm text-slate-500">
                  Available drivers with readiness, HOS, and deadhead — ranked
                  for assignment.
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
            <div className="mt-5">
              <DriverList
                drivers={availableDrivers}
                onOpen={(driverId) => updateQueryParam("driver", driverId)}
              />
            </div>
            {activeDrivers.length > 0 ? (
              <details className="mt-4 rounded-2xl border border-slate-200 px-4 py-3 text-sm">
                <summary className="cursor-pointer font-medium text-slate-700">
                  Show {activeDrivers.length} actively driving
                </summary>
                <div className="mt-3">
                  <DriverList
                    drivers={activeDrivers}
                    onOpen={(driverId) => updateQueryParam("driver", driverId)}
                  />
                </div>
              </details>
            ) : null}
          </section>

          {/* Active trips */}
          <section
            id="active"
            className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-slate-950">
                  Active trips
                </h2>
                <p className="text-sm text-slate-500">
                  Live monitoring — expand a row for fuel, parking, detention,
                  and route reasoning.
                </p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                {activeTrips.length} healthy
              </span>
            </div>
            <div className="mt-4 space-y-2">
              {activeTrips.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                  No healthy trips in view.
                </div>
              ) : (
                activeTrips.map((trip) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    expanded={expandedTripId === trip.id}
                    onToggle={() =>
                      setExpandedTripId((current) =>
                        current === trip.id ? null : trip.id,
                      )
                    }
                    onOpenDetail={() => updateQueryParam("trip", trip.id)}
                    onOptimize={() => setRouteDrawerTripId(trip.id)}
                    onOpenLoad={() => updateQueryParam("load", trip.loadId)}
                    onOpenDriver={() => updateQueryParam("driver", trip.driverId)}
                  />
                ))
              )}
            </div>
          </section>

          {/* Exceptions / Needs attention */}
          <section
            id="exceptions"
            className="rounded-[30px] border border-amber-200 bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-slate-950">
                  Needs attention
                </h2>
                <p className="text-sm text-slate-500">
                  Trips flagged for HOS, fuel, parking, detention, or route
                  risk.
                </p>
              </div>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                {exceptionTrips.length} flagged
              </span>
            </div>
            <div className="mt-4 space-y-2">
              {exceptionTrips.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                  Nothing flagged. All trips are healthy.
                </div>
              ) : (
                exceptionTrips.map((trip) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    expanded={expandedTripId === trip.id}
                    onToggle={() =>
                      setExpandedTripId((current) =>
                        current === trip.id ? null : trip.id,
                      )
                    }
                    onOpenDetail={() => updateQueryParam("trip", trip.id)}
                    onOptimize={() => setRouteDrawerTripId(trip.id)}
                    onOpenLoad={() => updateQueryParam("load", trip.loadId)}
                    onOpenDriver={() => updateQueryParam("driver", trip.driverId)}
                  />
                ))
              )}
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
        {selectedTrip ? (
          <TripDetail
            trip={selectedTrip}
            lastMile={
              snapshot.lastMileInsights.find(
                (item) => item.facilityId === selectedTrip.loadId,
              ) ?? snapshot.lastMileInsights[0]
            }
          />
        ) : null}
      </DetailDrawer>

      {/* Route optimization drawer — launched from trip cards */}
      <DetailDrawer
        open={Boolean(routeDrawerTrip)}
        title={
          routeDrawerTrip
            ? `Optimize route • ${routeDrawerTrip.id}`
            : "Optimize route"
        }
        subtitle={
          routeDrawerTrip
            ? `${routeDrawerTrip.origin} → ${routeDrawerTrip.destination}`
            : undefined
        }
        onClose={() => setRouteDrawerTripId(null)}
      >
        {routeDrawerTrip && routeDrawerLoad ? (
          <RouteOptimizer
            choices={routeDrawerLoad.routeChoices}
            onAssign={() =>
              handleAssign(routeDrawerLoad.id, routeDrawerLoad.bestMatchDriverId)
            }
          />
        ) : null}
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

/* ---------- Trip card (2-layer, chip-based) ---------- */

function TripCard({
  trip,
  expanded,
  onToggle,
  onOpenDetail,
  onOptimize,
  onOpenLoad,
  onOpenDriver,
}: {
  trip: CurrentTrip;
  expanded: boolean;
  onToggle: () => void;
  onOpenDetail: () => void;
  onOptimize: () => void;
  onOpenLoad: () => void;
  onOpenDriver: () => void;
}) {
  const health = tripHealth(trip);
  const action = recommendedAction(trip);
  const routeTone: HealthTone =
    trip.routeHealth === "risk"
      ? "danger"
      : trip.routeHealth === "watch"
        ? "warning"
        : "good";

  return (
    <div
      className={cn(
        "rounded-[20px] border bg-white transition",
        expanded ? "border-blue-300 shadow-[0_12px_32px_rgba(37,99,235,0.08)]" : "border-slate-200",
      )}
    >
      <button
        onClick={onToggle}
        className="grid w-full gap-3 px-4 py-3 text-left lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_auto_auto_auto_minmax(0,1.4fr)_auto] lg:items-center"
      >
        <div>
          <div className="text-sm font-semibold text-slate-950">
            {trip.driverName} • {trip.truckUnit}
          </div>
          <div className="text-xs text-slate-500">{trip.id}</div>
        </div>
        <div className="text-sm text-slate-600">
          {trip.origin} → {trip.destination}
        </div>
        <Chip label={`ETA ${trip.liveEta}`} />
        <Chip label={`HOS ${trip.liveHosHours.toFixed(1)}h`} tone={trip.liveHosHours < 2 ? "danger" : trip.liveHosHours < 4 ? "warning" : "default"} />
        <Chip label={`Trip ${health.label}`} tone={health.tone} strong />
        <div className="text-sm font-medium text-slate-700">{action}</div>
        <div className="flex items-center gap-2 justify-self-end">
          <ChevronRight
            className={cn(
              "h-4 w-4 text-slate-400 transition",
              expanded ? "rotate-90" : "",
            )}
          />
        </div>
      </button>
      {expanded ? (
        <div className="border-t border-slate-200 px-4 py-4">
          <div className="flex flex-wrap gap-2">
            <Chip label={`Route ${trip.routeHealth}`} tone={routeTone} />
            <Chip label={`Fuel ${trip.fuelStatus}`} />
            <Chip label={`Parking ${trip.parkingStopPlan}`} />
            <Chip label={`Detention ${trip.detentionState}`} />
            {trip.weatherIncidents.slice(0, 2).map((item) => (
              <Chip key={item} label={`Weather: ${item}`} tone="warning" />
            ))}
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-3 text-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                AI reasoning
              </div>
              <p className="mt-1 text-slate-700">{trip.downstreamImpact}</p>
              <p className="mt-2 text-xs text-slate-500">
                Customer SLA: {trip.customerSlaRisk}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-3 text-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Alternate & permitted routes
              </div>
              <ul className="mt-1 space-y-1 text-slate-700">
                {trip.routeOptionsSummary.slice(0, 3).map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={onOptimize} className="btn-primary">
              Optimize route
            </button>
            <button onClick={onOpenDetail} className="btn-outline">
              Full trip detail
            </button>
            <button onClick={onOpenDriver} className="btn-outline">
              Message driver
            </button>
            <button onClick={onOpenLoad} className="btn-outline">
              Reassign load
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- Chip ---------- */

function Chip({
  label,
  tone = "default",
  strong = false,
}: {
  label: string;
  tone?: HealthTone | "default";
  strong?: boolean;
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-medium",
        tone === "good"
          ? "bg-emerald-50 text-emerald-700"
          : tone === "warning"
            ? "bg-amber-50 text-amber-700"
            : tone === "danger"
              ? "bg-rose-50 text-rose-700"
              : "bg-slate-100 text-slate-700",
        strong && "font-semibold",
      )}
    >
      {label}
    </span>
  );
}

/* ---------- Driver list (compact) ---------- */

function DriverList({
  drivers,
  onOpen,
}: {
  drivers: OperationsDriver[];
  onOpen: (driverId: string) => void;
}) {
  if (drivers.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
        No drivers in this view.
      </div>
    );
  }
  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {drivers.map((driver) => (
        <button
          key={driver.id}
          onClick={() => onOpen(driver.id)}
          className="rounded-2xl border border-slate-200 p-3 text-left transition hover:border-blue-300 hover:bg-slate-50"
        >
          <div className="text-sm font-semibold text-slate-950">
            {driver.firstName} {driver.lastName} • {driver.unit}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            {driver.currentCity}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Chip
              label={`Ready ${driver.readinessScore}`}
              tone={
                driver.readinessScore > 84
                  ? "good"
                  : driver.readinessScore < 55
                    ? "danger"
                    : "warning"
              }
            />
            <Chip
              label={`HOS ${driver.hosRemainingHours.toFixed(1)}h`}
              tone={driver.hosRemainingHours < 2 ? "danger" : "default"}
            />
            <Chip label={`DH ${driver.deadheadMiles}mi`} />
          </div>
        </button>
      ))}
    </div>
  );
}

/* ---------- Route optimizer (drawer body) ---------- */

function RouteOptimizer({
  choices,
  onAssign,
}: {
  choices: RouteChoice[];
  onAssign: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        Cheapest, fastest, shortest, and recommended — with HOS-safe parking,
        permitted routing, and fuel stops.
      </p>
      {choices.map((choice) => (
        <article
          key={choice.id}
          className={cn(
            "rounded-[22px] border p-4",
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
          <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
            <Chip label={`${choice.miles} mi`} />
            <Chip label={`ETA ${choice.etaMinutes}m`} />
            <Chip label={`Fuel $${choice.fuelCost}`} />
            <Chip label={`Tolls $${choice.tolls}`} />
            <Chip label={`HOS safe ${choice.leftoverHosHours.toFixed(1)}h`} tone={choice.leftoverHosHours < 2 ? "warning" : "good"} />
            <Chip label={`Parking ${choice.parkingViability}%`} />
            <Chip label={`Legality ${choice.legalityScore}`} tone="good" />
            <Chip label={`Weather ${choice.weatherRisk}`} tone={choice.weatherRisk === "high" ? "danger" : choice.weatherRisk === "medium" ? "warning" : "default"} />
            <Chip label={`Detention ${choice.detentionSensitivity}`} />
            <Chip label={choice.permitted ? "Permitted" : "Check permits"} tone={choice.permitted ? "good" : "warning"} />
          </div>
          {choice.stateWarnings.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {choice.stateWarnings.map((warning) => (
                <Chip key={warning} label={warning} tone="warning" />
              ))}
            </div>
          ) : null}
          <p className="mt-3 text-sm text-slate-600">{choice.explanation}</p>
        </article>
      ))}
      <button onClick={onAssign} className="btn-primary w-full justify-center">
        Send to Map workflow
      </button>
    </div>
  );
}

/* ---------- Shared small helpers ---------- */

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

function TripDetail({
  trip,
  lastMile,
}: {
  trip: CurrentTrip;
  lastMile?: DispatcherSnapshot["lastMileInsights"][number];
}) {
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
      {lastMile ? (
        <section className="rounded-[24px] border border-slate-200 p-4">
          <h3 className="text-lg font-semibold text-slate-950">
            Last-mile navigation
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Arrival guidance for {lastMile.facilityName}.
          </p>
          <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm">
            <div className="font-semibold text-slate-950">
              {lastMile.recommendedEntrance}
            </div>
            <div className="mt-1 text-slate-600">
              Parking / staging: {lastMile.parkingArea}
            </div>
            <p className="mt-2 text-slate-600">{lastMile.reasoning}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {lastMile.avoidNotes.map((note) => (
                <span
                  key={note}
                  className="rounded-full bg-rose-50 px-3 py-1 text-xs text-rose-700"
                >
                  {note}
                </span>
              ))}
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">
                Confidence {Math.round(lastMile.confidence * 100)}%
              </span>
            </div>
            {lastMile.imageRefs.length > 0 ? (
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {lastMile.imageRefs.map((ref) => (
                  <div
                    key={ref}
                    className="overflow-hidden rounded-[16px] border border-slate-200 bg-white"
                  >
                    <Image
                      src={ref}
                      alt={`${lastMile.facilityName} preview`}
                      width={600}
                      height={320}
                      className="h-32 w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
