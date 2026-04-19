import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ results: [] });
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "6");
  url.searchParams.set("countrycodes", "us,ca,mx");
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "NavPro-Fleets-Demo/1.0" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(String(res.status));
    const raw = (await res.json()) as Array<{
      display_name: string;
      lat: string;
      lon: string;
      place_id: number;
    }>;
    return NextResponse.json({
      results: raw.map((r) => ({
        id: r.place_id,
        name: r.display_name,
        latitude: Number(r.lat),
        longitude: Number(r.lon),
      })),
    });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
