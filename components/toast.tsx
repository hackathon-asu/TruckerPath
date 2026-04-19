"use client";
import { useEffect, useState } from "react";

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(id);
  }, [msg]);
  const Toast = () =>
    msg ? (
      <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md bg-ink-900 px-4 py-2 text-sm text-white shadow-panel">
        {msg}
      </div>
    ) : null;
  return { show: setMsg, Toast };
}
