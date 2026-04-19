import { NextResponse } from "next/server";
import { analyzeDetentionImpact } from "@/lib/detention-engine";
import { mockLoads, mockDispatchDrivers, mockParkingStops } from "@/lib/mock";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    loadId: string;
    delayMinutes: number;
  };

  const load = mockLoads.find((l) => l.id === body.loadId);
  if (!load) {
    return NextResponse.json({ error: "Load not found" }, { status: 404 });
  }

  // Use assigned driver or default to first available for the demo
  const driver = load.assignedDriverId
    ? mockDispatchDrivers.find((d) => d.driverId === load.assignedDriverId)
    : mockDispatchDrivers[0];

  if (!driver) {
    return NextResponse.json({ error: "No driver found" }, { status: 404 });
  }

  const result = analyzeDetentionImpact({
    load,
    driver,
    delayMinutes: body.delayMinutes,
    parkingStops: mockParkingStops,
  });

  return NextResponse.json(result);
}
