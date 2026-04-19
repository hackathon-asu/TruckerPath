"use client";
import {
  Package,
  AlertTriangle,
  DollarSign,
  ParkingCircle,
  Users,
} from "lucide-react";

interface KpiData {
  activeLoads: number;
  atRiskLoads: number;
  avgCostPerMile: number;
  parkingRiskLoads: number;
  availableDrivers: number;
}

const kpis: {
  key: keyof KpiData;
  label: string;
  icon: React.ReactNode;
  format: (v: number) => string;
  accent?: string;
}[] = [
  {
    key: "activeLoads",
    label: "Active Loads",
    icon: <Package className="h-4 w-4" />,
    format: (v) => String(v),
  },
  {
    key: "atRiskLoads",
    label: "At-Risk Loads",
    icon: <AlertTriangle className="h-4 w-4" />,
    format: (v) => String(v),
    accent: "text-amber-600",
  },
  {
    key: "avgCostPerMile",
    label: "Avg Cost/Mile",
    icon: <DollarSign className="h-4 w-4" />,
    format: (v) => `$${v.toFixed(2)}`,
  },
  {
    key: "parkingRiskLoads",
    label: "Parking Risk",
    icon: <ParkingCircle className="h-4 w-4" />,
    format: (v) => String(v),
    accent: "text-rose-600",
  },
  {
    key: "availableDrivers",
    label: "Available Drivers",
    icon: <Users className="h-4 w-4" />,
    format: (v) => String(v),
  },
];

export function KpiCards({ data }: { data: KpiData }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {kpis.map((kpi) => (
        <div
          key={kpi.key}
          className="card group relative overflow-hidden p-4 transition-shadow hover:shadow-md"
        >
          {/* subtle gradient accent bar */}
          <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-brand-500 to-brand-600 opacity-60" />

          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-ink-500">
            <span className={kpi.accent}>{kpi.icon}</span>
            {kpi.label}
          </div>
          <div className={`mt-2 text-2xl font-semibold ${kpi.accent ?? "text-ink-900"}`}>
            {kpi.format(data[kpi.key])}
          </div>
        </div>
      ))}
    </div>
  );
}
