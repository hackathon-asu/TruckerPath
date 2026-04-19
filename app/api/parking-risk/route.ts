import { NextResponse } from "next/server";
import { mapDriverRow, mapLoadRow, mapParkingStopRow } from "@/lib/copilot-data";
import { hasInsforgeConfig, insforge } from "@/lib/insforge";
import { mockDispatchDrivers, mockLoads, mockParkingStops } from "@/lib/mock";
import { analyzeParkingRisk } from "@/lib/parking-engine";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      loadId: string;
      hosRemaining?: number;
      delayMinutes?: number;
    };

    if (!body.loadId) {
      return NextResponse.json({ error: "loadId is required" }, { status: 400 });
    }

    let load = mockLoads.find((item) => item.id === body.loadId) ?? null;
    let defaultHosRemaining = 9;
    let parkingStops = mockParkingStops;

    if (hasInsforgeConfig && insforge) {
      const client = insforge;
      const { data: loadRow, error: loadError } = await client.database
        .from("loads")
        .select("*")
        .eq("id", body.loadId)
        .single();
      if (loadError) {
        return NextResponse.json({ error: loadError.message }, { status: 500 });
      }
      if (!loadRow) {
        return NextResponse.json({ error: "Load not found in InsForge" }, { status: 404 });
      }

      load = mapLoadRow(loadRow as Record<string, unknown>);

      if (load.assignedDriverId !== undefined) {
        const { data: driverRow } = await client.database
          .from("dispatch_drivers")
          .select("*")
          .eq("driver_id", load.assignedDriverId)
          .single();
        if (driverRow) {
          defaultHosRemaining = mapDriverRow(driverRow as Record<string, unknown>).hosDriveRemaining;
        }
      }

      const { data: parkingRows, error: parkingError } = await client.database
        .from("parking_stops")
        .select("*")
        .order("miles_from_origin", { ascending: true });
      if (parkingError) {
        return NextResponse.json({ error: parkingError.message }, { status: 500 });
      }

      parkingStops = (parkingRows ?? []).map((row) => mapParkingStopRow(row as Record<string, unknown>));
    } else {
      const mockAssignedDriverId = load?.assignedDriverId;
      if (mockAssignedDriverId !== undefined) {
      defaultHosRemaining =
          mockDispatchDrivers.find((driver) => driver.driverId === mockAssignedDriverId)?.hosDriveRemaining ?? 9;
      }
    }

    if (!load) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }
    if (!parkingStops.length) {
      return NextResponse.json({ error: "No parking stops available" }, { status: 409 });
    }

    const result = analyzeParkingRisk({
      loadId: load.id,
      originLat: load.origin.lat,
      originLng: load.origin.lng,
      departureMiles: 0,
      hosRemaining: body.hosRemaining ?? defaultHosRemaining,
      departureTime: new Date(),
      parkingStops,
      delayMinutes: body.delayMinutes ?? 0,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
