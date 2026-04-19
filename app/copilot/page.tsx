"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import { mockLoads, mockDispatchDrivers, mockAlerts as staticAlerts, mockParkingStops } from "@/lib/mock";
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
  const [loads] = useState<Load[]>(mockLoads);
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(null);
  const [dispatch, setDispatch] = useState<DispatchRecommendation | null>(null);
  const [parking, setParking] = useState<ParkingRiskResult | null>(null);
  const [detention, setDetention] = useState<DetentionImpactResult | null>(null);
  const [alerts, setAlerts] = useState<CopilotAlert[]>([]);
  const [demoStep, setDemoStep] = useState(0);
  const { show, Toast } = useToast();

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
    const atRisk = demoStep >= 3 ? 1 : 0;
    const parkingRisk = demoStep >= 3 ? 1 : 0;
    const avgCpm = cost ? cost.costPerMile : 1.82;
    const available = mockDispatchDrivers.filter(
      (d) => d.status !== "IN_TRANSIT" && d.readiness !== "unavailable",
    ).length;
    return {
      activeLoads: loads.length,
      atRiskLoads: atRisk,
      avgCostPerMile: avgCpm,
      parkingRiskLoads: parkingRisk,
      availableDrivers: available,
    };
  }, [loads, demoStep, cost]);

  // Risk load IDs for visual indicators
  const riskLoadIds = useMemo(() => {
    const set = new Set<string>();
    if (demoStep >= 3) set.add("PHX-2847");
    return set;
  }, [demoStep]);

  // ── Demo flow controller ──
  const advanceDemo = useCallback(async () => {
    const next = demoStep + 1;

    if (next === 1) {
      // Step 1: Select load
      setSelectedLoadId("PHX-2847");
      show("Selected load PHX-2847 — Phoenix to Dallas");
    }

    if (next === 2) {
      // Step 2: Run dispatch scoring
      try {
        const res = await api.dispatchScore("PHX-2847");
        setDispatch(res);
        show("AI ranked 4 drivers — Jordan Reyes is the best match");
      } catch {
        show("Dispatch scoring failed");
      }
    }

    if (next === 3) {
      // Step 3: Simulate detention + run impact
      try {
        const [det, prk] = await Promise.all([
          api.detentionImpact({ loadId: "PHX-2847", delayMinutes: 120 }),
          api.parkingRisk({ loadId: "PHX-2847", hosRemaining: 7.5, delayMinutes: 120 }),
        ]);
        setDetention(det);
        setParking(prk);
        // Add alerts for this step
        setAlerts(staticAlerts.filter((a) => a.loadId === "PHX-2847"));
        show("⚠ 2-hour detention triggered — recalculating trip plan");
      } catch {
        show("Impact analysis failed");
      }
    }

    if (next === 4) {
      // Step 4: Show full impact (parking backup, customer notification)
      // Data is already loaded from step 3 — revealing via demoStep
      setAlerts(staticAlerts);
      show("Parking risk elevated — CoPilot suggests backup stop at Shamrock, TX");
    }

    if (next === 5) {
      // Step 5: Complete — all actions available
      show("✓ Demo complete — all CoPilot insights active");
    }

    setDemoStep(next);
  }, [demoStep, show]);

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
        // Already showing the panel via selection
        show(`Viewing ${alert.actionLabel} for ${alert.loadId}`);
      }
      if (alert.actionLabel === "Notify Customer") {
        show("📧 Customer notification sent — DFW Logistics Hub notified of ETA change");
      }
      if (alert.actionLabel === "Assign Driver") {
        show("✓ Driver assignment initiated");
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
            {/* Demo controller */}
            <DemoScenario
              currentStep={demoStep}
              onAdvance={advanceDemo}
              onReset={resetDemo}
            />

            {/* KPI strip */}
            <KpiCards data={kpiData} />

            {/* Main grid */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              {/* Left: Loads + Alerts */}
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

              {/* Right: Dispatch decision panel */}
              <div className="lg:col-span-8">
                <DispatchPanel
                  load={selectedLoad}
                  dispatch={dispatch}
                  parking={parking}
                  detention={detention}
                  cost={cost}
                  onClose={() => setSelectedLoadId(null)}
                  demoStep={demoStep}
                  onAssign={() => show("✓ Jordan Reyes assigned to PHX-2847")}
                  onReserveParking={() => show("✓ Parking reserved at Shamrock Truck Stop")}
                  onNotifyCustomer={() => show("📧 DFW Logistics Hub notified — updated ETA sent")}
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
