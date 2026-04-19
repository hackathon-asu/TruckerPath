"use client";
import { useEffect, useState } from "react";
import { FileText, Plus, Trash2 } from "lucide-react";
import { DrawerShell } from "./drawer-shell";

interface TripDoc {
  id: string;
  name: string;
  size: number;
  addedAt: string;
}

const KEY = "navpro-trip-docs";

function useDocs() {
  const [docs, setDocs] = useState<TripDoc[]>([]);
  useEffect(() => {
    try {
      setDocs(JSON.parse(localStorage.getItem(KEY) ?? "[]"));
    } catch {
      /* ignore */
    }
  }, []);
  const persist = (next: TripDoc[]) => {
    setDocs(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  };
  return {
    docs,
    add: (d: TripDoc) => persist([d, ...docs]),
    remove: (id: string) => persist(docs.filter((d) => d.id !== id)),
  };
}

export function DocumentsPanel({ onClose }: { onClose: () => void }) {
  const { docs, add, remove } = useDocs();

  const onPick = (file: File) => {
    add({ id: crypto.randomUUID(), name: file.name, size: file.size, addedAt: new Date().toISOString() });
  };

  return (
    <DrawerShell title="Documents" onClose={onClose}>
      {docs.length === 0 ? (
        <div className="flex flex-col items-center p-10 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-ink-400 shadow-sm">
            <FileText className="h-5 w-5" />
          </div>
          <div className="mt-3 text-xs text-ink-500">Share documents on this trip with your driver</div>
          <label className="btn-primary mt-4 cursor-pointer">
            <Plus className="h-4 w-4" /> Add New Doc
            <input
              type="file"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])}
            />
          </label>
        </div>
      ) : (
        <div className="divide-y divide-ink-100">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center gap-3 px-3 py-3">
              <FileText className="h-5 w-5 text-ink-400" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink-900">{d.name}</div>
                <div className="text-[11px] text-ink-500">
                  {(d.size / 1024).toFixed(1)} kB · {new Date(d.addedAt).toLocaleString()}
                </div>
              </div>
              <button
                onClick={() => remove(d.id)}
                className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-rose-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <div className="p-3">
            <label className="btn-outline w-full cursor-pointer">
              <Plus className="h-4 w-4" /> Add New Doc
              <input
                type="file"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])}
              />
            </label>
          </div>
        </div>
      )}
    </DrawerShell>
  );
}
