"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Grid3X3, Search, Sparkles, Truck } from "lucide-react";
import { cn } from "@/lib/cn";

export function TopHeader({ onOpenCmd }: { onOpenCmd?: () => void }) {
  const pathname = usePathname();
  const tabs = [
    { href: "/", label: "Map" },
    { href: "/copilot", label: "CoPilot", icon: Sparkles },
    { href: "/reports", label: "Reports" },
  ];
  return (
    <header
      className="flex items-center justify-between border-b border-ink-200 bg-white px-4"
      style={{ height: "var(--header-h)" }}
    >
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-500 text-white">
            <Truck className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <div className="text-[10px] uppercase tracking-wider text-ink-500">Trucker Path</div>
            <div className="text-sm font-semibold tracking-tight">FLEETS</div>
          </div>
        </Link>
        <nav className="flex items-center gap-1">
          {tabs.map((t) => {
            const active =
              t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
            const Icon = (t as { icon?: React.ComponentType<{ className?: string }> }).icon;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={cn(
                  "relative flex items-center gap-1 px-3 py-4 text-sm font-medium transition-colors",
                  active
                    ? "text-brand-500 after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand-500"
                    : "text-ink-700 hover:text-ink-900",
                )}
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenCmd}
          className="flex items-center gap-2 rounded-md border border-ink-200 bg-ink-50 px-3 py-1.5 text-sm text-ink-500 hover:bg-white"
        >
          <Search className="h-4 w-4" />
          <span>Quick search…</span>
          <span className="kbd">⌘K</span>
        </button>
        <button className="flex h-9 w-9 items-center justify-center rounded-md text-ink-500 hover:bg-ink-100">
          <Bell className="h-5 w-5" />
        </button>
        <button className="flex h-9 w-9 items-center justify-center rounded-md text-ink-500 hover:bg-ink-100">
          <Grid3X3 className="h-5 w-5" />
        </button>
        <div className="ml-2 flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white">
          AR
        </div>
      </div>
    </header>
  );
}
