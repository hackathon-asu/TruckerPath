"use client";
import { useEffect, useState } from "react";
import type { StopPoint } from "./types";

export interface SavedRoute {
  id: string;
  name: string;
  stops: StopPoint[];
  miles?: number;
  minutes?: number;
  profileId?: number;
  savedAt: number;
}

const KEY = "navpro.saved-routes";

function read(): SavedRoute[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as SavedRoute[];
  } catch {
    return [];
  }
}
function write(v: SavedRoute[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(v));
  window.dispatchEvent(new CustomEvent("navpro:saved-routes"));
}

export function useSavedRoutes() {
  const [items, setItems] = useState<SavedRoute[]>([]);
  useEffect(() => {
    setItems(read());
    const on = () => setItems(read());
    window.addEventListener("navpro:saved-routes", on);
    return () => window.removeEventListener("navpro:saved-routes", on);
  }, []);
  return {
    items,
    save: (r: Omit<SavedRoute, "id" | "savedAt">) => {
      const next: SavedRoute = { ...r, id: crypto.randomUUID(), savedAt: Date.now() };
      const list = [next, ...read()].slice(0, 25);
      write(list);
      return next;
    },
    remove: (id: string) => write(read().filter((x) => x.id !== id)),
    clear: () => write([]),
  };
}
