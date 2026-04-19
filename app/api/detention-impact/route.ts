import { NextResponse } from "next/server";
import { analyzeDetentionImpact } from "@/lib/detention-engine";
import { mapDriverRow, mapLoadRow, mapParkingStopRow } from "@/lib/copilot-data";
import { insforge, assertInsforgeConfigured } from "@/lib/insforge";

export async function POST(req: Request) {
  try {
    assertInsforgeConfigured();

    const body = (await req.json()) as {
      loadId: string;
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
    const driverId = load.assignedDriverId;
    if (driverId === undefined) {
      return NextResponse.json(
        { error: "Load has no assigned driver in InsForge" },
        { status: 409 },
      );
    }

    const { data: driverRow, error: driverError } = await insforge.database
      .from("dispatch_drivers")
      .select("*")
      .eq("driver_id", driverId)
      .single();
    if (driverError) {
      return NextResponse.json({ error: driverError.message }, { status: 500 });
    }
    if (!driverRow) {
      return NextResponse.json({ error: "Assigned driver not found in InsForge" }, { status: 404 });
    }

    let delayMinutes = body.delayMinutes;
    if (delayMinutes === undefined) {
      const { data: detentionRow } = await insforge.database
        .from("detention_events")
        .select("*")
        .eq("load_id", body.loadId)
        .order("started_at", { ascending: false })
        .limit(1)
        .single();
      delayMinutes = detentionRow ? Number((detentionRow as Record<string, unknown>).delay_minutes ?? 0) : undefined;
    }

    if (delayMinutes === undefined || Number.isNaN(delayMinutes)) {
      return NextResponse.json(
        { error: "No detention delay provided and no detention_events row found in InsForge" },
        { status: 409 },
      );
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

    const result = analyzeDetentionImpact({
      load,
      driver: mapDriverRow(driverRow as Record<string, unknown>),
      delayMinutes,
      parkingStops,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
