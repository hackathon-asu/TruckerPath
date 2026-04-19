import { NextResponse } from "next/server";
import { analyzeParkingRisk } from "@/lib/parking-engine";
import { mapDriverRow, mapLoadRow, mapParkingStopRow } from "@/lib/copilot-data";
import { insforge, assertInsforgeConfigured } from "@/lib/insforge";

export async function POST(req: Request) {
  try {
    assertInsforgeConfigured();

    const body = (await req.json()) as {
      loadId: string;
      hosRemaining?: number;
      delayMinutes?: number;
    };

    const { data: loadRow, error: loadError } = await insforge.database
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

    const load = mapLoadRow(loadRow as Record<string, unknown>);

    let defaultHosRemaining = 9;
    if (load.assignedDriverId !== undefined) {
      const { data: driverRow } = await insforge.database
        .from("dispatch_drivers")
        .select("*")
        .eq("driver_id", load.assignedDriverId)
        .single();
      if (driverRow) {
        defaultHosRemaining = mapDriverRow(driverRow as Record<string, unknown>).hosDriveRemaining;
      }
    }

    const { data: parkingRows, error: parkingError } = await insforge.database
      .from("parking_stops")
      .select("*")
      .order("miles_from_origin", { ascending: true });
    if (parkingError) {
      return NextResponse.json({ error: parkingError.message }, { status: 500 });
    }

    const parkingStops = (parkingRows ?? []).map((row) => mapParkingStopRow(row as Record<string, unknown>));
    if (!parkingStops.length) {
      return NextResponse.json({ error: "No parking_stops records found in InsForge" }, { status: 409 });
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
