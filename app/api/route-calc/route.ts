import { NextResponse } from "next/server";

interface Pt {
  latitude: number;
  longitude: number;
}

export async function POST(req: Request) {
  const body = (await req.json()) as { stops: Pt[] };
  if (!body.stops || body.stops.length < 2) {
    return NextResponse.json({ error: "need >= 2 stops" }, { status: 400 });
  }
  const coords = body.stops.map((s) => `${s.longitude},${s.latitude}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const j = (await res.json()) as {
      routes: Array<{
        distance: number;
        duration: number;
        geometry: { coordinates: [number, number][] };
      }>;
    };
    const r = j.routes?.[0];
    if (!r) throw new Error("no route");
    const miles = r.distance / 1609.344;
    const minutes = r.duration / 60;
    return NextResponse.json({
      miles,
      minutes,
      // convert lng,lat -> lat,lng for Leaflet
      polyline: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    });
  } catch (err) {
    // fallback: straight-line approximation
    const miles = straightLineMiles(body.stops);
    const minutes = (miles / 55) * 60;
    const poly: [number, number][] = body.stops.map((s) => [s.latitude, s.longitude]);
    return NextResponse.json({ miles, minutes, polyline: poly, fallback: true });
  }
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
