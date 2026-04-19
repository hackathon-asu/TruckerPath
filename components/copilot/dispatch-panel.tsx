"use client";
import { cn } from "@/lib/cn";
import type {
  Load,
  DispatchRecommendation,
  ParkingRiskResult,
  DetentionImpactResult,
  CostBreakdown,
  RankedDriver,
  RiskLevel,
} from "@/lib/types";
import {
  ArrowDownRight,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  Fuel,
  MapPin,
  ParkingCircle,
  Shield,
  Sparkles,
  Star,
  TrendingUp,
  Truck,
  User,
  X,
} from "lucide-react";

// ─── Risk badge ──────────────────────────────
function RiskBadge({ level }: { level: RiskLevel }) {
  const styles: Record<RiskLevel, string> = {
    low: "bg-emerald-100 text-emerald-700",
    medium: "bg-amber-100 text-amber-700",
    high: "bg-orange-100 text-orange-700",
    critical: "bg-rose-100 text-rose-700",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", styles[level])}>
      {level}
    </span>
  );
}

// ─── Section wrapper ─────────────────────────
function Section({ title, icon, children, accent }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-ink-200 bg-white">
      <div className={cn("flex items-center gap-2 border-b border-ink-100 px-4 py-2.5 text-xs font-semibold", accent ?? "text-ink-700")}>
        {icon}
        {title}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ─── Driver ranking card ─────────────────────
function DriverCard({ rd, isBest, onAssign }: { rd: RankedDriver; isBest: boolean; onAssign?: () => void }) {
  return (
    <div className={cn("rounded-lg border p-3", isBest ? "border-brand-300 bg-brand-50/40" : "border-ink-200")}>
      <div className="flex items-center gap-3">
        <div className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold",
          isBest ? "bg-brand-500 text-white" : "bg-ink-100 text-ink-600",
        )}>
          {rd.driver.firstName[0]}{rd.driver.lastName[0]}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-ink-900">{rd.driver.firstName} {rd.driver.lastName}</span>
            {isBest && (
              <span className="flex items-center gap-0.5 rounded bg-brand-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                <Star className="h-2.5 w-2.5" /> BEST
              </span>
            )}
          </div>
          <div className="text-[11px] text-ink-500">{rd.driver.currentCity} · {rd.driver.truckType}</div>
        </div>
        <div className="text-right">
          <div className={cn(
            "text-lg font-bold",
            rd.score >= 70 ? "text-emerald-600" : rd.score >= 50 ? "text-amber-600" : "text-rose-600",
          )}>
            {rd.score}
          </div>
          <div className="text-[9px] uppercase text-ink-400">Score</div>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2 text-center text-[10px]">
        <div className="rounded bg-ink-50 p-1.5">
          <div className="text-ink-500">Deadhead</div>
          <div className="font-semibold text-ink-800">{rd.deadheadMiles} mi</div>
        </div>
        <div className="rounded bg-ink-50 p-1.5">
          <div className="text-ink-500">HOS Left</div>
          <div className="font-semibold text-ink-800">{rd.driver.hosDriveRemaining}h</div>
        </div>
        <div className="rounded bg-ink-50 p-1.5">
          <div className="text-ink-500">Cost</div>
          <div className="font-semibold text-ink-800">${rd.estimatedCost.toLocaleString()}</div>
        </div>
        <div className="rounded bg-ink-50 p-1.5">
          <div className="text-ink-500">Feasible</div>
          <div className={cn("font-semibold", rd.tripFeasible ? "text-emerald-600" : "text-rose-600")}>
            {rd.tripFeasible ? "Yes" : "No"}
          </div>
        </div>
      </div>
      <div className="mt-2 text-[11px] text-ink-600">{rd.reasoning}</div>
      {isBest && onAssign && (
        <button
          onClick={onAssign}
          className="btn-primary mt-3 w-full text-xs"
        >
          <Truck className="h-3.5 w-3.5" /> Assign Driver
        </button>
      )}
    </div>
  );
}

// ─── Main dispatch panel ──────────────────────
interface Props {
  load: Load | null;
  dispatch: DispatchRecommendation | null;
  parking: ParkingRiskResult | null;
  detention: DetentionImpactResult | null;
  cost: CostBreakdown | null;
  onClose: () => void;
  onAssign?: () => void;
  onReserveParking?: () => void;
  onNotifyCustomer?: () => void;
  demoStep: number;
}

export function DispatchPanel({
  load,
  dispatch,
  parking,
  detention,
  cost,
  onClose,
  onAssign,
  onReserveParking,
  onNotifyCustomer,
  demoStep,
}: Props) {
  if (!load) {
    return (
      <div className="card flex h-full items-center justify-center p-8 text-center">
        <div>
          <Sparkles className="mx-auto h-8 w-8 text-brand-300" />
          <div className="mt-3 text-sm font-semibold text-ink-700">Select a load</div>
          <div className="mt-1 text-xs text-ink-500">
            Click on a load to see dispatch recommendations, parking plans, and cost analysis
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-ink-200 px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-brand-500">{load.id}</span>
            <Sparkles className="h-3.5 w-3.5 text-brand-400" />
            <span className="text-xs font-medium text-ink-500">CoPilot Analysis</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-ink-900">
            {load.origin.name}
            <ArrowRight className="h-3.5 w-3.5 text-ink-400" />
            {load.destination.name}
          </div>
        </div>
        <button onClick={onClose} className="rounded p-1 text-ink-400 hover:bg-ink-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 space-y-3 overflow-auto p-4 scrollbar-thin">
        {/* Load summary */}
        <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
          <div className="rounded-lg bg-ink-50 p-2">
            <div className="text-ink-500">Distance</div>
            <div className="text-sm font-semibold text-ink-800">{load.miles} mi</div>
          </div>
          <div className="rounded-lg bg-ink-50 p-2">
            <div className="text-ink-500">Revenue</div>
            <div className="text-sm font-semibold text-emerald-600">${load.rate.toLocaleString()}</div>
          </div>
          <div className="rounded-lg bg-ink-50 p-2">
            <div className="text-ink-500">Weight</div>
            <div className="text-sm font-semibold text-ink-800">{(load.weight / 1000).toFixed(0)}k lb</div>
          </div>
          <div className="rounded-lg bg-ink-50 p-2">
            <div className="text-ink-500">Commodity</div>
            <div className="text-sm font-semibold text-ink-800 truncate">{load.commodity}</div>
          </div>
        </div>

        {/* Dispatch recommendations */}
        {dispatch && (
          <Section
            title="Smart Dispatch — Driver Ranking"
            icon={<User className="h-3.5 w-3.5" />}
            accent="text-brand-600"
          >
            <div className="mb-2 rounded-md bg-brand-50 p-2.5 text-xs text-brand-700">
              <div className="flex items-center gap-1.5 font-semibold">
                <Sparkles className="h-3 w-3" />
                AI Recommendation
                {(dispatch as any).source === "insforge" ? (
                  <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-700">⚡ Live DB</span>
                ) : (
                  <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-700">🔶 Demo Data</span>
                )}
              </div>
              <p className="mt-1 leading-relaxed">{dispatch.explanation}</p>
              <div className="mt-1 text-[10px] text-brand-500">
                Confidence: {dispatch.confidenceScore}/100
              </div>
            </div>
            <div className="space-y-2">
              {(dispatch.rankedDrivers ?? []).slice(0, 3).map((rd, i) => (
                <DriverCard
                  key={rd.driver.driverId}
                  rd={rd}
                  isBest={i === 0}
                  onAssign={i === 0 ? onAssign : undefined}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Detention impact — shown when demo advances */}
        {detention && demoStep >= 3 && (
          <Section
            title="Detention Impact Analysis"
            icon={<Clock className="h-3.5 w-3.5" />}
            accent="text-amber-700"
          >
            <div className="space-y-2 text-xs">
              <div className="rounded-md bg-amber-50 p-2.5 text-amber-800">
                <p className="leading-relaxed">{detention.explanation}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-ink-200 p-2.5">
                  <div className="text-[10px] text-ink-500">ETA Shift</div>
                  <div className="mt-0.5 flex items-center gap-1">
                    <span className="text-ink-400 line-through text-[11px]">
                      {new Date(detention.originalEta).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <ArrowRight className="h-3 w-3 text-ink-400" />
                    <span className="font-semibold text-rose-600">
                      {new Date(detention.updatedEta).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
                <div className="rounded-lg border border-ink-200 p-2.5">
                  <div className="text-[10px] text-ink-500">On-Time?</div>
                  <div className={cn("mt-0.5 font-semibold", detention.onTimeFeasible ? "text-emerald-600" : "text-rose-600")}>
                    {detention.onTimeFeasible ? "Feasible (tight)" : "At Risk"}
                  </div>
                </div>
                <div className="rounded-lg border border-ink-200 p-2.5">
                  <div className="text-[10px] text-ink-500">HOS Impact</div>
                  <div className="mt-0.5">
                    <span className="text-ink-500">{detention.hosImpact.before}h</span>
                    <ArrowRight className="mx-1 inline h-3 w-3 text-ink-400" />
                    <span className={cn("font-semibold", detention.hosImpact.violationRisk ? "text-rose-600" : "text-amber-600")}>
                      {detention.hosImpact.after}h
                    </span>
                  </div>
                </div>
                <div className="rounded-lg border border-ink-200 p-2.5">
                  <div className="text-[10px] text-ink-500">Added Cost</div>
                  <div className="mt-0.5 font-semibold text-rose-600">
                    +${detention.costImpact.totalAdded.toFixed(0)}
                  </div>
                </div>
              </div>

              {detention.notifyCustomer && onNotifyCustomer && (
                <button
                  onClick={onNotifyCustomer}
                  className="btn-outline w-full border-amber-300 text-amber-700 hover:bg-amber-50"
                >
                  <ArrowDownRight className="h-3.5 w-3.5" /> Notify Customer — ETA Delayed
                </button>
              )}
            </div>
          </Section>
        )}

        {/* Parking risk — shown when demo advances */}
        {parking && demoStep >= 3 && (
          <Section
            title="Parking Risk Planner"
            icon={<ParkingCircle className="h-3.5 w-3.5" />}
            accent={parking.riskLevel === "high" || parking.riskLevel === "critical" ? "text-rose-700" : "text-ink-700"}
          >
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-ink-500">Overall Risk</span>
                <RiskBadge level={parking.riskLevel} />
              </div>

              <div className="rounded-md bg-ink-50 p-2.5 text-ink-600 leading-relaxed">
                {parking.explanation}
              </div>

              {parking.primaryStop && (
                <div className={cn(
                  "rounded-lg border p-3",
                  parking.riskLevel === "high" || parking.riskLevel === "critical"
                    ? "border-rose-200 bg-rose-50/50"
                    : "border-ink-200",
                )}>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-ink-500" />
                    <span className="font-semibold text-ink-800">Primary: {parking.primaryStop.name}</span>
                  </div>
                  <div className="mt-1 pl-5.5 text-[11px] text-ink-500">
                    {parking.primaryStop.city} · {parking.primaryStop.occupancyPercent}% occupied · {parking.primaryStop.totalSpaces} spaces
                  </div>
                </div>
              )}

              {parking.backupStop && demoStep >= 4 && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="font-semibold text-emerald-800">Backup: {parking.backupStop.name}</span>
                  </div>
                  <div className="mt-1 pl-5.5 text-[11px] text-emerald-700">
                    {parking.backupStop.city} · {parking.backupStop.occupancyPercent}% occupied · {parking.backupStop.totalSpaces} spaces
                  </div>
                  {onReserveParking && (
                    <button
                      onClick={onReserveParking}
                      className="btn-primary mt-2 w-full text-xs"
                    >
                      <ParkingCircle className="h-3.5 w-3.5" /> Reserve Backup Stop
                    </button>
                  )}
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Cost intelligence */}
        {cost && (
          <Section title="Cost Intelligence" icon={<DollarSign className="h-3.5 w-3.5" />}>
            <div className="space-y-1.5 text-xs">
              <CostRow label="Fuel Estimate" value={`$${cost.fuelEstimate.toFixed(0)}`} />
              <CostRow label="Toll Estimate" value={`$${cost.tollEstimate.toFixed(0)}`} />
              <CostRow label="Deadhead Cost" value={`$${cost.deadheadCost.toFixed(0)}`} />
              {cost.detentionCost > 0 && (
                <CostRow label="Detention Cost" value={`$${cost.detentionCost.toFixed(0)}`} warn />
              )}
              <CostRow label="Labor Cost" value={`$${cost.laborCost.toFixed(0)}`} />
              <div className="border-t border-ink-200 pt-1.5">
                <CostRow label="Total Cost" value={`$${cost.totalCost.toFixed(0)}`} bold />
                <CostRow label="Revenue" value={`$${cost.revenue.toFixed(0)}`} />
                <div className="mt-1 flex items-center justify-between font-semibold">
                  <span>Est. Margin</span>
                  <span className={cost.estimatedMargin > 0 ? "text-emerald-600" : "text-rose-600"}>
                    ${cost.estimatedMargin.toFixed(0)} ({((cost.estimatedMargin / cost.revenue) * 100).toFixed(0)}%)
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-ink-500">
                  <span>Cost/Mile</span>
                  <span className="font-semibold text-ink-800">${cost.costPerMile.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function CostRow({ label, value, bold, warn }: { label: string; value: string; bold?: boolean; warn?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between", bold && "font-semibold")}>
      <span className="text-ink-500">{label}</span>
      <span className={cn("text-ink-800", warn && "text-rose-600 font-semibold")}>{value}</span>
    </div>
  );
}
