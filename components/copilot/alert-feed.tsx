"use client";
import { cn } from "@/lib/cn";
import type { CopilotAlert } from "@/lib/types";
import {
  AlertTriangle,
  Bell,
  Clock,
  ParkingCircle,
  Shield,
  TrendingDown,
  UserCheck,
  Zap,
} from "lucide-react";

const iconMap: Record<CopilotAlert["type"], React.ReactNode> = {
  detention_delay: <Clock className="h-4 w-4" />,
  parking_risk: <ParkingCircle className="h-4 w-4" />,
  hos_violation_risk: <Shield className="h-4 w-4" />,
  traffic_delay: <Zap className="h-4 w-4" />,
  better_driver: <UserCheck className="h-4 w-4" />,
  detention_cost: <TrendingDown className="h-4 w-4" />,
  late_delivery_risk: <AlertTriangle className="h-4 w-4" />,
  eta_update: <Bell className="h-4 w-4" />,
};

const severityStyles: Record<CopilotAlert["severity"], { bg: string; icon: string; border: string }> = {
  critical: { bg: "bg-rose-50", icon: "text-rose-600", border: "border-rose-200" },
  warning: { bg: "bg-amber-50", icon: "text-amber-600", border: "border-amber-200" },
  info: { bg: "bg-blue-50", icon: "text-blue-600", border: "border-blue-200" },
};

function timeSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}

interface Props {
  alerts: CopilotAlert[];
  onAction?: (alert: CopilotAlert) => void;
}

export function AlertFeed({ alerts, onAction }: Props) {
  const visible = alerts.filter((a) => !a.dismissed);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-ink-200 px-4 py-3">
        <h2 className="text-sm font-semibold">
          Live Alerts
          <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
            {visible.length}
          </span>
        </h2>
        <span className="flex items-center gap-1 text-[10px] text-ink-500">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Live
        </span>
      </div>
      <div className="max-h-[420px] divide-y divide-ink-100 overflow-auto scrollbar-thin">
        {visible.length === 0 && (
          <div className="flex flex-col items-center py-8 text-center text-ink-400">
            <Bell className="h-6 w-6" />
            <div className="mt-2 text-xs">All clear — no active alerts</div>
          </div>
        )}
        {visible.map((alert) => {
          const style = severityStyles[alert.severity];
          return (
            <div
              key={alert.id}
              className={cn("px-4 py-3 transition-colors hover:bg-ink-50")}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                    style.bg,
                    style.border,
                    style.icon,
                  )}
                >
                  {iconMap[alert.type]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink-900">{alert.title}</span>
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                        alert.severity === "critical"
                          ? "bg-rose-100 text-rose-700"
                          : alert.severity === "warning"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-blue-100 text-blue-700",
                      )}
                    >
                      {alert.severity}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-600">{alert.message}</p>
                  <div className="mt-1.5 flex items-center gap-3">
                    <span className="text-[10px] text-ink-400">{timeSince(alert.timestamp)}</span>
                    {alert.loadId && (
                      <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-600">
                        {alert.loadId}
                      </span>
                    )}
                    {alert.actionLabel && onAction && (
                      <button
                        onClick={() => onAction(alert)}
                        className="rounded-md bg-brand-500 px-2.5 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-brand-600"
                      >
                        {alert.actionLabel}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
