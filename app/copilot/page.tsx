"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
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
import { DemoScenario } from "@/components/copilot/demo-scenario";
import { useToast } from "@/components/toast";

export default function CopilotPage() {
  const [loads, setLoads] = useState<Load[]>([]);
  const [driversCount, setDriversCount] = useState(0);
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(null);
  const [dispatch, setDispatch] = useState<DispatchRecommendation | null>(null);
  const [parking, setParking] = useState<ParkingRiskResult | null>(null);
  const [detention, setDetention] = useState<DetentionImpactResult | null>(null);
  const [alerts, setAlerts] = useState<CopilotAlert[]>([]);
  const [demoStep, setDemoStep] = useState(0);
  const { show, Toast } = useToast();

  useEffect(() => {
    // Initial fetch of data
    const fetchData = async () => {
      try {
        const { data: loadsData } = await insforge.database.from("loads").select("*");
        if (loadsData && loadsData.length > 0) {
          setLoads(loadsData as any);
        } else {
          // Fall back to mock loads if DB not yet seeded
          setLoads([
            { id: "PHX-2847", commodity: "Electronics", weight: 42000, rate: 3850, miles: 1065, origin: { lat: 33.4484, lng: -112.074, name: "Phoenix, AZ" }, destination: { lat: 32.7767, lng: -96.797, name: "Dallas, TX" }, shipper: "West Valley Distribution", receiver: "DFW Logistics Hub", status: "pending", notes: "High-value freight — temperature monitoring required" },
            { id: "TUC-1134", commodity: "Building Materials", weight: 44000, rate: 1420, miles: 450, origin: { lat: 32.2226, lng: -110.9747, name: "Tucson, AZ" }, destination: { lat: 35.0844, lng: -106.6504, name: "Albuquerque, NM" }, shipper: "Southwest Lumber Co.", receiver: "ABQ Construction Supply", status: "assigned" },
            { id: "LV-0921", commodity: "Consumer Goods", weight: 38000, rate: 1650, miles: 270, origin: { lat: 36.1699, lng: -115.1398, name: "Las Vegas, NV" }, destination: { lat: 34.0522, lng: -118.2437, name: "Los Angeles, CA" }, shipper: "Vegas Wholesale", receiver: "LA Distribution Center", status: "pending" },
            { id: "PHX-3310", commodity: "Produce (Refrigerated)", weight: 39000, rate: 2800, miles: 515, origin: { lat: 33.4484, lng: -112.074, name: "Phoenix, AZ" }, destination: { lat: 36.7783, lng: -119.4179, name: "Fresno, CA" }, shipper: "Arizona Fresh Farms", receiver: "Central Valley Cold Storage", status: "pending", notes: "Reefer required — 34°F" },
          ] as any);
        }
      } catch {
        // same mock fallback on connection error
        setLoads([
          { id: "PHX-2847", commodity: "Electronics", weight: 42000, rate: 3850, miles: 1065, origin: { lat: 33.4484, lng: -112.074, name: "Phoenix, AZ" }, destination: { lat: 32.7767, lng: -96.797, name: "Dallas, TX" }, shipper: "West Valley Distribution", receiver: "DFW Logistics Hub", status: "pending", notes: "High-value freight — temperature monitoring required" },
          { id: "TUC-1134", commodity: "Building Materials", weight: 44000, rate: 1420, miles: 450, origin: { lat: 32.2226, lng: -110.9747, name: "Tucson, AZ" }, destination: { lat: 35.0844, lng: -106.6504, name: "Albuquerque, NM" }, shipper: "Southwest Lumber Co.", receiver: "ABQ Construction Supply", status: "assigned" },
          { id: "LV-0921", commodity: "Consumer Goods", weight: 38000, rate: 1650, miles: 270, origin: { lat: 36.1699, lng: -115.1398, name: "Las Vegas, NV" }, destination: { lat: 34.0522, lng: -118.2437, name: "Los Angeles, CA" }, shipper: "Vegas Wholesale", receiver: "LA Distribution Center", status: "pending" },
          { id: "PHX-3310", commodity: "Produce (Refrigerated)", weight: 39000, rate: 2800, miles: 515, origin: { lat: 33.4484, lng: -112.074, name: "Phoenix, AZ" }, destination: { lat: 36.7783, lng: -119.4179, name: "Fresno, CA" }, shipper: "Arizona Fresh Farms", receiver: "Central Valley Cold Storage", status: "pending", notes: "Reefer required — 34°F" },
        ] as any);
      }

      try {
        const { count } = await insforge.database.from("dispatch_drivers").select("*", { count: "exact", head: true });
        setDriversCount(count ?? 5);
      } catch {
        setDriversCount(5); // 5 mock drivers
      }

      try {
        const { data: alertsData } = await insforge.database.from("copilot_alerts").select("*").order("timestamp", { ascending: false });
        if (alertsData && alertsData.length > 0) {
          setAlerts(alertsData.map((a: any) => ({
            id: a.id, type: a.type, severity: a.severity, title: a.title, message: a.message,
            actionLabel: a.action_label, loadId: a.load_id, timestamp: a.timestamp, dismissed: a.dismissed
          })));
        }
      } catch {
        // no alerts yet, that's fine
      }
    };

    let interval: NodeJS.Timeout;

    const setupPolling = () => {
      // Since InsForge realtime API differs from Supabase, we'll use a fast poll 
      // for the demo to ensure alerts pop up consistently without socket management.
      interval = setInterval(async () => {
        try {
          const { data: alertsData } = await insforge.database
            .from("copilot_alerts")
            .select("*")
            .order("timestamp", { ascending: false });
            
          if (alertsData) {
            setAlerts(alertsData.map((a: any) => ({
              id: a.id,
              type: a.type,
              severity: a.severity,
              title: a.title,
              message: a.message,
              actionLabel: a.action_label,
              loadId: a.load_id,
              timestamp: a.timestamp,
              dismissed: a.dismissed
            })));
          }
        } catch {
          // silently skip if DB isn't reachable
        }
      }, 3000);
    };

    fetchData().then(setupPolling);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [show]);

  const selectedLoad = loads.find((l) => l.id === selectedLoadId) ?? null;

  // Cost breakdown derived from dispatch + detention data
  const cost: CostBreakdown | null = useMemo(() => {
    if (!selectedLoad || !dispatch?.bestDriver) return null;
    const rd = dispatch.bestDriver;
    const fuelEstimate = (selectedLoad.miles / 6) * 3.85;
    const tollEstimate = selectedLoad.miles * 0.0095;
    const deadheadCost = rd.deadheadMiles * 1.50;
    const detentionCost = detention ? detention.costImpact.detentionCost : 0;
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
      costPerMile: totalCost / selectedLoad.miles,
    };
  }, [selectedLoad, dispatch, detention]);

  // KPI data derived from current state
  const kpiData = useMemo(() => {
    const atRisk = alerts.filter(a => !a.dismissed && a.severity !== "info").length;
    const parkingRisk = alerts.filter(a => a.type === "parking_risk" && !a.dismissed).length;
    const avgCpm = cost ? cost.costPerMile : 1.82;
    return {
      activeLoads: loads.length,
      atRiskLoads: atRisk,
      avgCostPerMile: avgCpm,
      parkingRiskLoads: parkingRisk,
      availableDrivers: driversCount,
    };
  }, [loads, cost, alerts, driversCount]);

  // Risk load IDs for visual indicators
  const riskLoadIds = useMemo(() => {
    const set = new Set<string>();
    alerts.forEach(a => {
      if (a.loadId) set.add(a.loadId);
    });
    return set;
  }, [alerts]);

  // ── Demo flow controller ──
  const advanceDemo = useCallback(async () => {
    const next = demoStep + 1;

    if (next === 1) {
      if (loads.length > 0) {
        setSelectedLoadId(loads[0].id);
        show("Selected load " + loads[0].id);
      } else {
        show("No loads available from DB");
      }
    }

    if (next === 2) {
      if (!selectedLoadId) return;
      try {
        const res = await fetch("/api/dispatch-score", {
          method: "POST",
          body: JSON.stringify({ loadId: selectedLoadId })
        }).then(res => res.json());
        setDispatch(res);
        show("AI analyzed and ranked drivers for this load");
      } catch {
        show("Dispatch scoring failed");
      }
    }

    if (next === 3) {
      if (!selectedLoadId) return;
      try {
        // We trigger the autonomous AI dispatcher directly instead of mock detection
        const triggerRes = await fetch("/api/agent/trigger", {
          method: "POST",
          body: JSON.stringify({
            event: {
              type: "detention",
              loadId: selectedLoadId,
              delayMinutes: 120,
              description: "Driver stuck at shipper due to backlog"
            }
          })
        });
        
        show("⚠ 2-hour detention event fired. Agent analyzing...");
      } catch {
        show("Agent simulation failed");
      }
    }

    if (next === 4) {
      // By now, real time subscription should have popped the alert into the `alerts` state
      show("AI Agent analyzed hazards and emitted alerts!");
    }

    if (next === 5) {
      show("✓ Demo complete — Event-driven AI dispatching successful.");
    }

    setDemoStep(next);
  }, [demoStep, show, loads, selectedLoadId]);

  const resetDemo = useCallback(() => {
    setDemoStep(0);
    setSelectedLoadId(null);
    setDispatch(null);
    setParking(null);
    setDetention(null);
    setAlerts([]);
    show("Demo reset");
  }, [show]);

  // Handle alert action clicks
  const handleAlertAction = useCallback(
    (alert: CopilotAlert) => {
      if (alert.loadId) {
        setSelectedLoadId(alert.loadId);
      }
      if (alert.actionLabel === "View Impact" || alert.actionLabel === "View Parking Plan") {
        show(`Viewing ${alert.actionLabel} for ${alert.loadId}`);
      }
    },
    [show],
  );

  return (
    <div className="flex h-screen flex-col">
      <TopHeader />
      <div className="flex flex-1 overflow-hidden">
        <IconRail />
        <main className="flex-1 overflow-auto bg-ink-50">
          <div className="mx-auto max-w-[1440px] space-y-4 p-4 lg:p-6">
            <DemoScenario
              currentStep={demoStep}
              onAdvance={advanceDemo}
              onReset={resetDemo}
            />

            <KpiCards data={kpiData} />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="space-y-4 lg:col-span-4">
                <LoadsTable
                  loads={loads}
                  selectedLoadId={selectedLoadId}
                  onSelect={setSelectedLoadId}
                  riskLoadIds={riskLoadIds}
                />
                <AlertFeed
                  alerts={alerts}
                  onAction={handleAlertAction}
                />
              </div>

              <div className="lg:col-span-8">
                <DispatchPanel
                  load={selectedLoad}
                  dispatch={dispatch}
                  parking={parking}
                  detention={detention}
                  cost={cost}
                  onClose={() => setSelectedLoadId(null)}
                  demoStep={demoStep}
                  onAssign={() => show("✓ Driver assigned")}
                  onReserveParking={() => show("✓ Parking reserved")}
                  onNotifyCustomer={() => show("📧 Customer notified")}
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
