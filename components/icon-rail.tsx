"use client";
import { cn } from "@/lib/cn";
import {
  Map as MapIcon,
  Users,
  Truck,
  MapPin,
  FileText,
  Settings,
  HelpCircle,
  ListTodo,
} from "lucide-react";

const items = [
  { icon: MapIcon, label: "Map", active: true },
  { icon: Users, label: "Drivers" },
  { icon: Truck, label: "Vehicles" },
  { icon: ListTodo, label: "Trips" },
  { icon: MapPin, label: "POIs" },
  { icon: FileText, label: "Documents" },
];

const bottom = [
  { icon: Settings, label: "Settings" },
  { icon: HelpCircle, label: "Help" },
];

export function IconRail() {
  return (
    <aside
      className="flex h-full w-14 flex-col items-center justify-between border-r border-ink-200 bg-white py-3"
      style={{ width: "var(--rail-w)" }}
    >
      <nav className="flex flex-col items-center gap-1">
        {items.map((it) => (
          <button
            key={it.label}
            title={it.label}
            className={cn(
              "group relative flex h-10 w-10 items-center justify-center rounded-md text-ink-500 transition-colors",
              it.active ? "bg-brand-50 text-brand-500" : "hover:bg-ink-100 hover:text-ink-900",
            )}
          >
            <it.icon className="h-5 w-5" />
            <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded bg-ink-900 px-2 py-1 text-[11px] text-white opacity-0 group-hover:opacity-100 z-50">
              {it.label}
            </span>
          </button>
        ))}
      </nav>
      <nav className="flex flex-col items-center gap-1">
        {bottom.map((it) => (
          <button
            key={it.label}
            title={it.label}
            className="flex h-10 w-10 items-center justify-center rounded-md text-ink-500 hover:bg-ink-100 hover:text-ink-900"
          >
            <it.icon className="h-5 w-5" />
          </button>
        ))}
      </nav>
    </aside>
  );
}
