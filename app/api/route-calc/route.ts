import { NextResponse } from "next/server";

interface Pt {
  latitude: number;
  longitude: number;
}

interface OsrmStep {
  distance: number;
  duration: number;
  maneuver: { instruction?: string; type?: string; modifier?: string };
  name?: string;
}
interface OsrmLeg {
  distance: number;
  duration: number;
  steps: OsrmStep[];
}
interface OsrmRoute {
  distance: number;
  duration: number;
  legs: OsrmLeg[];
  geometry: { coordinates: [number, number][] };
}

export type RouteAlt = {
  id: string;
  label: "Fastest Route" | "Shortest Route" | "Most Economical";
  miles: number;
  minutes: number;
  gallons: number;
  fuelCost: number;
  tolls: number;
  polyline: [number, number][];
  legs: {
    miles: number;
    minutes: number;
    tolls: number;
    steps: { instruction: string; miles: number; minutes: number }[];
  }[];
};

const MPG = 6;
const FUEL_PRICE = 3.85;
const TOLL_PER_MILE = 0.0095; // rough interstate blend

export async function POST(req: Request) {
  const body = (await req.json()) as { stops: Pt[] };
  if (!body.stops || body.stops.length < 2) {
    return NextResponse.json({ error: "need >= 2 stops" }, { status: 400 });
  }
  const coords = body.stops.map((s) => `${s.longitude},${s.latitude}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true&alternatives=3`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const j = (await res.json()) as { routes: OsrmRoute[] };
    if (!j.routes?.length) throw new Error("no route");

    const base = j.routes.map((r, i) => toAlt(r, `r${i}`));
    const deduped = dedupeNearDuplicates(base);
    const withLabels = assignLabels(deduped);
    return NextResponse.json({ routes: withLabels });
  } catch {
    const miles = straightLineMiles(body.stops);
    const minutes = (miles / 55) * 60;
    const poly: [number, number][] = body.stops.map((s) => [s.latitude, s.longitude]);
    const alt: RouteAlt = {
      id: "fallback",
      label: "Fastest Route",
      miles,
      minutes,
      gallons: miles / MPG,
      fuelCost: (miles / MPG) * FUEL_PRICE,
      tolls: miles * TOLL_PER_MILE,
      polyline: poly,
      legs: [],
    };
    return NextResponse.json({ routes: [alt], fallback: true });
  }
}

function toAlt(r: OsrmRoute, id: string): Omit<RouteAlt, "label"> & { label: RouteAlt["label"] } {
  const miles = r.distance / 1609.344;
  const minutes = r.duration / 60;
  const gallons = miles / MPG;
  return {
    id,
    label: "Fastest Route",
    miles,
    minutes,
    gallons,
    fuelCost: gallons * FUEL_PRICE,
    tolls: miles * TOLL_PER_MILE,
    polyline: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    legs: r.legs.map((leg) => ({
      miles: leg.distance / 1609.344,
      minutes: leg.duration / 60,
      tolls: (leg.distance / 1609.344) * TOLL_PER_MILE,
      steps: leg.steps.map((s) => ({
        instruction:
          s.maneuver.instruction ??
          buildInstruction(s.maneuver.type, s.maneuver.modifier, s.name),
        miles: s.distance / 1609.344,
        minutes: s.duration / 60,
      })),
    })),
  };
}

function buildInstruction(type?: string, modifier?: string, name?: string): string {
  const verbs: Record<string, string> = {
    turn: "Turn",
    "new name": "Continue on",
    depart: "Head",
    arrive: "Arrive at",
    merge: "Merge",
    "on ramp": "Take ramp",
    "off ramp": "Exit",
    fork: "Keep",
    "end of road": "Turn",
    continue: "Continue",
    roundabout: "Take roundabout",
    rotary: "Take roundabout",
  };
  const v = verbs[type ?? "continue"] ?? "Continue";
  const m = modifier ? ` ${modifier}` : "";
  const n = name ? ` onto ${name}` : "";
  return `${v}${m}${n}`.trim();
}

function dedupeNearDuplicates(alts: Omit<RouteAlt, "label">[]): Omit<RouteAlt, "label">[] {
  if (alts.length <= 1) return alts;
  const sorted = [...alts].sort((a, b) => a.minutes - b.minutes);
  const kept: Omit<RouteAlt, "label">[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const c = sorted[i];
    const isDuplicate = kept.some(
      (k) =>
        Math.abs(c.miles - k.miles) / k.miles < 0.02 &&
        Math.abs(c.minutes - k.minutes) / k.minutes < 0.02,
    );
    if (!isDuplicate) kept.push(c);
  }
  return kept;
}

function assignLabels(alts: Omit<RouteAlt, "label">[]): RouteAlt[] {
  const byFastest = [...alts].sort((a, b) => a.minutes - b.minutes)[0];
  const out: RouteAlt[] = [{ ...byFastest, label: "Fastest Route" }];

  // Shortest: must actually have fewer miles than the fastest
  const shortestCandidate = [...alts]
    .sort((a, b) => a.miles - b.miles)
    .find((r) => r.id !== byFastest.id && r.miles < byFastest.miles - 0.5);
  if (shortestCandidate) out.push({ ...shortestCandidate, label: "Shortest Route" });

  // Economical: must have strictly lower fuel+tolls than fastest AND differ from shortest
  const usedIds = new Set(out.map((r) => r.id));
  const fastestTotal = byFastest.fuelCost + byFastest.tolls;
  const economicalCandidate = [...alts]
    .sort((a, b) => a.fuelCost + a.tolls - (b.fuelCost + b.tolls))
    .find((r) => !usedIds.has(r.id) && r.fuelCost + r.tolls < fastestTotal - 0.5);
  if (economicalCandidate) out.push({ ...economicalCandidate, label: "Most Economical" });

  return out;
}

function straightLineMiles(stops: Pt[]): number {
  const R = 3958.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  let total = 0;
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    const dLat = rad(b.latitude - a.latitude);
    const dLon = rad(b.longitude - a.longitude);
    const lat1 = rad(a.latitude);
    const lat2 = rad(b.latitude);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    total += 2 * R * Math.asin(Math.sqrt(h));
  }
  return total;
}
