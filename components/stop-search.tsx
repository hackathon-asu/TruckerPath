"use client";
import { useEffect, useRef, useState } from "react";
import { MapPin, Search } from "lucide-react";
import { api } from "@/lib/client";
import type { StopPoint } from "@/lib/types";

export function StopSearch({ onPick }: { onPick: (s: StopPoint) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<
    { id: number; name: string; latitude: number; longitude: number }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await api.geocode(q);
        setResults(r.results);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input
          className="input pl-9"
          placeholder="Search for a location to add to your trip"
          value={q}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
        />
      </div>
      {open && (q.trim() || results.length > 0) && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-md border border-ink-200 bg-white shadow-panel">
          {loading && <div className="p-3 text-xs text-ink-500">Searching…</div>}
          {!loading && results.length === 0 && q.trim() && (
            <div className="p-3 text-xs text-ink-500">No matches</div>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-ink-50"
              onClick={() => {
                onPick({
                  id: crypto.randomUUID(),
                  address_name: r.name.split(",").slice(0, 3).join(",").trim(),
                  latitude: r.latitude,
                  longitude: r.longitude,
                });
                setQ("");
                setResults([]);
                setOpen(false);
              }}
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
              <span className="line-clamp-2">{r.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
