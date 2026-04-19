"use client";
import { ArrowLeft, X } from "lucide-react";

interface Props {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  subtitle?: React.ReactNode;
}

export function DrawerShell({ title, onClose, subtitle, children, footer }: Props) {
  return (
    <div className="flex h-full flex-col bg-white" style={{ width: "var(--panel-w)" }}>
      <div className="flex items-center gap-2 border-b border-ink-200 px-3 py-3">
        <button onClick={onClose} className="rounded p-1 text-ink-500 hover:bg-ink-100" aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-ink-900">{title}</div>
          {subtitle && <div className="truncate text-[11px] text-ink-500">{subtitle}</div>}
        </div>
        <button onClick={onClose} className="rounded p-1 text-ink-400 hover:bg-ink-100" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-auto scrollbar-thin">{children}</div>
      {footer && <div className="border-t border-ink-200 bg-white p-3">{footer}</div>}
    </div>
  );
}
