"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import { mapAlertRow, mapLoadRow } from "@/lib/copilot-data";
import { insforge } from "@/lib/insforge";
import type {
  CopilotAlert,
  CostBreakdown,
  DetentionImpactResult,
  DispatchRecommendation,
  Load,
  ParkingRiskResult,
} from "@/lib/types";
import { TopHeader } from "@/components/top-header";
import { IconRail } from "@/components/icon-rail";
import { KpiCards } from "@/components/copilot/kpi-cards";
import { LoadsTable } from "@/components/copilot/loads-table";
import { AlertFeed } from "@/components/copilot/alert-feed";
import { DispatchPanel } from "@/components/copilot/dispatch-panel";
import { useToast } from "@/components/toast";

async function loadInsforgeSnapshot() {
  const [{ data: loadsData, error: loadsError }, driversResult, alertsResult] = await Promise.all([
    insforge.database.from("loads").select("*").order("id", { ascending: true }),
    insforge.database.from("dispatch_drivers").select("*", { count: "exact", head: true }),
    insforge.database.from("copilot_alerts").select("*").order("timestamp", { ascending: false }),
  ]);

  if (loadsError) throw new Error(loadsError.message);
  if (driversResult.error) throw new Error(driversResult.error.message);
  if (alertsResult.error) throw new Error(alertsResult.error.message);

  return {
    loads: (loadsData ?? []).map((row) => mapLoadRow(row as Record<string, unknown>)),
    driversCount: driversResult.count ?? 0,
    alerts: (alertsResult.data ?? []).map((row) => mapAlertRow(row as Record<string, unknown>)),
  };
}

export default function CopilotPage() {
  const [loads, setLoads] = useState<Load[]>([]);
  const [driversCount, setDriversCount] = useState(0);
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(null);
  const [dispatch, setDispatch] = useState<DispatchRecommendation | null>(null);
  const [parking, setParking] = useState<ParkingRiskResult | null>(null);
  const [detention, setDetention] = useState<DetentionImpactResult | null>(null);
  const [alerts, setAlerts] = useState<CopilotAlert[]>([]);
  const [bootError, setBootError] = useState<string | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(true);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const { show, Toast } = useToast();

  const refreshSnapshot = useCallback(async (preserveSelection = true) => {
    setLoadingSnapshot(true);
    try {
      const snapshot = await loadInsforgeSnapshot();
      setLoads(snapshot.loads);
      setDriversCount(snapshot.driversCount);
      setAlerts(snapshot.alerts);
      setBootError(null);

      if (!preserveSelection || !snapshot.loads.some((load) => load.id === selectedLoadId)) {
        setSelectedLoadId(snapshot.loads[0]?.id ?? null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load InsForge data";
      setBootError(message);
      setLoads([]);
      setAlerts([]);
      setDriversCount(0);
    } finally {
      setLoadingSnapshot(false);
    }
  }, [selectedLoadId]);

  useEffect(() => {
    void refreshSnapshot(false);

    const interval = window.setInterval(() => {
      void refreshSnapshot(true);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [refreshSnapshot]);

  const analyzeLoad = useCallback(
    async (loadId: string) => {
      setAnalysisLoading(true);
      try {
        const dispatchResult = await api.dispatchScore(loadId);
        setDispatch(dispatchResult);

        const bestHosRemaining = dispatchResult.bestDriver?.driver.hosDriveRemaining;
        const parkingResult = await api.parkingRisk({
          loadId,
          hosRemaining: bestHosRemaining,
        });
        setParking(parkingResult);

        try {
          const detentionResult = await api.detentionImpact({ loadId });
          setDetention(detentionResult);
        } catch {
          setDetention(null);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Analysis failed";
        setDispatch(null);
        setParking(null);
        setDetention(null);
        show(message);
      } finally {
        setAnalysisLoading(false);
      }
    },
    [show],
  );

  useEffect(() => {
    if (!selectedLoadId) {
      setDispatch(null);
      setParking(null);
      setDetention(null);
      return;
    }

    void analyzeLoad(selectedLoadId);
  }, [analyzeLoad, selectedLoadId]);

  const selectedLoad = loads.find((load) => load.id === selectedLoadId) ?? null;

  const cost: CostBreakdown | null = useMemo(() => {
    if (!selectedLoad || !dispatch?.bestDriver) return null;

    const bestDriver = dispatch.bestDriver;
    const fuelEstimate = (selectedLoad.miles / 6) * 3.85;
    const tollEstimate = selectedLoad.miles * 0.0095;
    const deadheadCost = bestDriver.deadheadMiles * 1.5;
    const detentionCost = detention?.costImpact.detentionCost ?? 0;
    const laborCost = selectedLoad.miles * 0.45;
    const totalCost = fuelEstimate + tollEstimate + deadheadCost + detentionCost + laborCost;

    return {
      fuelEstimate,
      tollEstimate,
      deadheadCost,
      detentionCost,
      laborCost,
      totalCost,
      revenue: selectedLoad.rate,
      estimatedMargin: selectedLoad.rate - totalCost,
      costPerMile: totalCost / Math.max(selectedLoad.miles, 1),
    };
  }, [detention, dispatch, selectedLoad]);

  const kpiData = useMemo(() => {
    const activeAlerts = alerts.filter((alert) => !alert.dismissed);
    return {
      activeLoads: loads.length,
      atRiskLoads: activeAlerts.filter((alert) => alert.severity !== "info").length,
      avgCostPerMile: cost?.costPerMile ?? 0,
      parkingRiskLoads: activeAlerts.filter((alert) => alert.type === "parking_risk").length,
      availableDrivers: driversCount,
    };
  }, [alerts, cost, driversCount, loads.length]);

  const riskLoadIds = useMemo(() => {
    const ids = new Set<string>();
    alerts.forEach((alert) => {
      if (alert.loadId) ids.add(alert.loadId);
    });
    return ids;
  }, [alerts]);

  const handleAlertAction = useCallback(
    async (alert: CopilotAlert) => {
      if (!alert.loadId) return;

      setSelectedLoadId(alert.loadId);

      if (alert.actionLabel === "View Impact") {
        try {
          const result = await api.detentionImpact({ loadId: alert.loadId });
          setDetention(result);
          show(`Loaded live detention impact for ${alert.loadId}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to load detention impact";
          show(message);
        }
      }

      if (alert.actionLabel === "View Parking Plan") {
        try {
          const result = await api.parkingRisk({
            loadId: alert.loadId,
            hosRemaining: dispatch?.bestDriver?.driver.hosDriveRemaining,
          });
          setParking(result);
          show(`Loaded live parking plan for ${alert.loadId}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to load parking plan";
          show(message);
        }
      }
    },
    [dispatch?.bestDriver?.driver.hosDriveRemaining, show],
  );

  return (
    <div className="flex h-screen flex-col">
      <TopHeader />
      <div className="flex flex-1 overflow-hidden">
        <IconRail />
        <main className="flex-1 overflow-auto bg-ink-50">
          <div className="mx-auto max-w-[1440px] space-y-4 p-4 lg:p-6">
            <div className="rounded-xl border border-brand-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">
                    Live CoPilot
                  </div>
                  <div className="mt-1 text-sm text-ink-700">
                    Live InsForge loads and alerts with Gemini-backed dispatch scoring.
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-700">
                    InsForge
                  </span>
                  <span className="rounded-full bg-sky-100 px-2.5 py-1 font-semibold text-sky-700">
                    Gemini
                  </span>
                  {analysisLoading && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-700">
                      Analyzing
                    </span>
                  )}
                </div>
              </div>
              {bootError && (
                <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {bootError}
                </div>
              )}
            </div>

            <KpiCards data={kpiData} />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="space-y-4 lg:col-span-4">
                <LoadsTable
                  loads={loads}
                  selectedLoadId={selectedLoadId}
                  onSelect={setSelectedLoadId}
                  riskLoadIds={riskLoadIds}
                />
                <AlertFeed alerts={alerts} onAction={handleAlertAction} />
              </div>

              <div className="lg:col-span-8">
                <DispatchPanel
                  load={selectedLoad}
                  dispatch={dispatch}
                  parking={parking}
                  detention={detention}
                  cost={cost}
                  onClose={() => setSelectedLoadId(null)}
                  onAssign={() => show("Assignment action is ready to be wired to a live update route.")}
                  onReserveParking={() => show("Parking reservation action is ready to be wired to a live update route.")}
                  onNotifyCustomer={() => show("Customer notification action is ready to be wired to a live workflow.")}
                  loading={loadingSnapshot || analysisLoading}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
      <Toast />
    </div>
  );
}
