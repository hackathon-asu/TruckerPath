import { NextResponse } from "next/server";

interface NwsAlert {
  properties: {
    id: string;
    event: string;
    headline: string;
    severity: string;
    areaDesc: string;
    effective: string;
    expires: string;
  };
}

export async function POST(req: Request) {
  const { polyline } = (await req.json()) as { polyline: [number, number][] };
  if (!polyline || polyline.length === 0) {
    return NextResponse.json({ alerts: [] });
  }

  const samples = samplePoints(polyline, 8);
  const seen = new Set<string>();
  const alerts: { id: string; event: string; headline: string; severity: string; area: string; effective: string; expires: string }[] = [];

  await Promise.all(
    samples.map(async ([lat, lng]) => {
      try {
        const res = await fetch(`https://api.weather.gov/alerts/active?point=${lat},${lng}`, {
          headers: { "User-Agent": "navpro-fleets-hackathon (demo)" },
          cache: "no-store",
        });
        if (!res.ok) return;
        const j = (await res.json()) as { features: NwsAlert[] };
        for (const a of j.features ?? []) {
          if (seen.has(a.properties.id)) continue;
          seen.add(a.properties.id);
          alerts.push({
            id: a.properties.id,
            event: a.properties.event,
            headline: a.properties.headline,
            severity: a.properties.severity,
            area: a.properties.areaDesc,
            effective: a.properties.effective,
            expires: a.properties.expires,
          });
        }
      } catch {
        /* ignore */
      }
    }),
  );

  return NextResponse.json({ alerts });
}

function samplePoints(poly: [number, number][], count: number): [number, number][] {
  if (poly.length <= count) return poly;
  const step = poly.length / count;
  const out: [number, number][] = [];
  for (let i = 0; i < count; i++) out.push(poly[Math.floor(i * step)]);
  return out;
}
