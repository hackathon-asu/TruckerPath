import { NextResponse } from "next/server";
import type { RouteCalcRequest } from "@/lib/route";
import { calculateScreenedRoutes } from "@/lib/truck-routing";

export async function POST(req: Request) {
  const body = (await req.json()) as RouteCalcRequest;
  if (!body.stops || body.stops.length < 2) {
    return NextResponse.json({ error: "need >= 2 stops" }, { status: 400 });
  }

  const result = await calculateScreenedRoutes(body);
  return NextResponse.json(result);
}
