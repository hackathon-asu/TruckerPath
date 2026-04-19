import { NextResponse } from "next/server";
import { analyzeParkingRisk } from "@/lib/parking-engine";
import { mockLoads, mockDispatchDrivers, mockParkingStops } from "@/lib/mock";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    loadId: string;
    hosRemaining?: number;
    delayMinutes?: number;
  };

  const load = mockLoads.find((l) => l.id === body.loadId);
  if (!load) {
    return NextResponse.json({ error: "Load not found" }, { status: 404 });
  }

  const driver = load.assignedDriverId
    ? mockDispatchDrivers.find((d) => d.driverId === load.assignedDriverId)
    : mockDispatchDrivers[0]; // default to first available for demo

  const hosRemaining = body.hosRemaining ?? driver?.hosDriveRemaining ?? 9;

  const result = analyzeParkingRisk({
    loadId: load.id,
    originLat: load.origin.lat,
    originLng: load.origin.lng,
    departureMiles: 0,
    hosRemaining,
    departureTime: new Date(),
    parkingStops: mockParkingStops,
    delayMinutes: body.delayMinutes ?? 0,
  });

  return NextResponse.json(result);
}
