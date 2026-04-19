import { NextResponse } from "next/server";
import { mapDriverRow, mapLoadRow, mapParkingStopRow } from "@/lib/copilot-data";
import { analyzeDetentionImpact } from "@/lib/detention-engine";
import { hasInsforgeConfig, insforge } from "@/lib/insforge";
import { mockDetentionEvents, mockDispatchDrivers, mockLoads, mockParkingStops } from "@/lib/mock";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      loadId: string;
      delayMinutes?: number;
    };

    if (!body.loadId) {
      return NextResponse.json({ error: "loadId is required" }, { status: 400 });
    }

    let load = mockLoads.find((item) => item.id === body.loadId) ?? null;
    let driver = null;
    const mockAssignedDriverId = load?.assignedDriverId;
    if (mockAssignedDriverId !== undefined) {
      driver = mockDispatchDrivers.find((item) => item.driverId === mockAssignedDriverId) ?? null;
    }
    let delayMinutes =
      body.delayMinutes ?? mockDetentionEvents.find((item) => item.loadId === body.loadId)?.delayMinutes;
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
      const driverId = load.assignedDriverId;
      if (driverId === undefined) {
        return NextResponse.json(
          { error: "Load has no assigned driver in InsForge" },
          { status: 409 },
        );
      }

      const { data: driverRow, error: driverError } = await client.database
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

      driver = mapDriverRow(driverRow as Record<string, unknown>);

      if (delayMinutes === undefined) {
        const { data: detentionRow } = await client.database
          .from("detention_events")
          .select("*")
          .eq("load_id", body.loadId)
          .order("started_at", { ascending: false })
          .limit(1)
          .single();
        delayMinutes = detentionRow
          ? Number((detentionRow as Record<string, unknown>).delay_minutes ?? 0)
          : undefined;
      }

      const { data: parkingRows, error: parkingError } = await client.database
        .from("parking_stops")
        .select("*")
        .order("miles_from_origin", { ascending: true });
      if (parkingError) {
        return NextResponse.json({ error: parkingError.message }, { status: 500 });
      }

      parkingStops = (parkingRows ?? []).map((row) => mapParkingStopRow(row as Record<string, unknown>));
    }

    if (!load) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }
    if (!driver) {
      return NextResponse.json({ error: "Load has no assigned driver" }, { status: 409 });
    }
    if (delayMinutes === undefined || Number.isNaN(delayMinutes)) {
      return NextResponse.json(
        { error: "No detention delay is available for this load" },
        { status: 409 },
      );
    }
    if (!parkingStops.length) {
      return NextResponse.json({ error: "No parking stops available" }, { status: 409 });
    }

    const result = analyzeDetentionImpact({
      load,
      driver,
      delayMinutes,
      parkingStops,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
