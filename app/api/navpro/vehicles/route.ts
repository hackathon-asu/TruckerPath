import { NextResponse } from "next/server";
import { mockVehicles } from "@/lib/mock";
import { postJson } from "@/lib/navpro";
import type { Vehicle } from "@/lib/types";

export async function GET() {
  const result = await postJson<{ content: Vehicle[] }>(
    "/api/vehicle/query",
    { page: 0, size: 50 },
    { content: mockVehicles },
  );
  return NextResponse.json({ live: result.live, vehicles: result.data?.content ?? mockVehicles });
}
