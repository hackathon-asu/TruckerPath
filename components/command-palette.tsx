"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Keyboard, MapIcon, PlusSquare, UserPlus, Users } from "lucide-react";

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    if (open) {
      setQ("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);
  if (!open) return null;

  const items = [
    { icon: <MapIcon className="h-4 w-4" />, label: "Go to Map", run: () => router.push("/") },
    { icon: <PlusSquare className="h-4 w-4" />, label: "Reports dashboard", run: () => router.push("/reports") },
    { icon: <Users className="h-4 w-4" />, label: "Find drivers", run: () => window.dispatchEvent(new CustomEvent("navpro:switch-tab", { detail: "drivers" })) },
    { icon: <UserPlus className="h-4 w-4" />, label: "New trip", run: () => window.dispatchEvent(new CustomEvent("navpro:switch-tab", { detail: "search" })) },
    { icon: <Keyboard className="h-4 w-4" />, label: "Keyboard shortcuts", run: () => window.dispatchEvent(new CustomEvent("navpro:shortcuts")) },
  ].filter((it) => it.label.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-24" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-panel"
      >
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Type a command or search…"
          className="w-full border-b border-ink-200 px-4 py-3 text-sm outline-none"
        />
        <div className="max-h-80 overflow-auto py-1">
          {items.length === 0 && <div className="px-4 py-3 text-sm text-ink-500">No matches</div>}
          {items.map((it) => (
            <button
              key={it.label}
              onClick={() => {
                it.run();
                onClose();
              }}
              className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-ink-50"
            >
              <span className="text-ink-500">{it.icon}</span>
              <span className="flex-1">{it.label}</span>
              <ArrowRight className="h-3.5 w-3.5 text-ink-400" />
            </button>
          ))}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-ink-200 px-3 py-2 text-[11px] text-ink-500">
          <span>
            <span className="kbd">↵</span> open
          </span>
          <span>
            <span className="kbd">esc</span> close
          </span>
        </div>
      </div>
    </div>
  );
}
