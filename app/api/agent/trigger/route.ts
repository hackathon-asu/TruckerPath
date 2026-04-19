import { NextResponse } from "next/server";
import { insforge } from "@/lib/insforge";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { mapDriverRow, mapLoadRow, mapParkingStopRow } from "@/lib/copilot-data";
import { GEMINI_MODEL, assertGeminiConfigured } from "@/lib/gemini";
import { assertInsforgeConfigured } from "@/lib/insforge";

export async function POST(req: Request) {
  try {
    assertInsforgeConfigured();
    assertGeminiConfigured();
    const client = insforge;
    if (!client) {
      throw new Error("Missing NEXT_PUBLIC_INSFORGE_URL or NEXT_PUBLIC_INSFORGE_ANON_KEY");
    }

    const { event } = await req.json();
    if (!event?.loadId) {
      return NextResponse.json({ error: "event.loadId is required" }, { status: 400 });
    }

    const { data: loadRow, error: loadError } = await client.database
      .from("loads")
      .select("*")
      .eq("id", event.loadId)
      .single();
    if (loadError) {
      return NextResponse.json({ error: loadError.message }, { status: 500 });
    }
    if (!loadRow) {
      return NextResponse.json({ error: `Load '${event.loadId}' not found in InsForge` }, { status: 404 });
    }

    const load = mapLoadRow(loadRow as Record<string, unknown>);

    let assignedDriver = null;
    if (load.assignedDriverId !== undefined) {
      const { data: driverRow } = await client.database
        .from("dispatch_drivers")
        .select("*")
        .eq("driver_id", load.assignedDriverId)
        .single();
      assignedDriver = driverRow ? mapDriverRow(driverRow as Record<string, unknown>) : null;
    }

    const { data: parkingRows } = await client.database
      .from("parking_stops")
      .select("*")
      .order("miles_from_origin", { ascending: true });

    const parkingStops = (parkingRows ?? []).map((row) => mapParkingStopRow(row as Record<string, unknown>));

    const result = await generateObject({
      model: google(GEMINI_MODEL),
      system: `You are an autonomous AI dispatcher monitoring live fleet events from InsForge.
Analyze the event and determine what cascading effects it has on Hours of Service, ETA, parking, or profitability.
Draft exactly ONE distinct CopilotAlert to notify the human dispatcher.`,
      prompt: `Event details: ${JSON.stringify(event, null, 2)}

Load info: ${JSON.stringify(load, null, 2)}

Assigned driver: ${JSON.stringify(assignedDriver, null, 2)}

Parking stops: ${JSON.stringify(parkingStops.slice(0, 6), null, 2)}`,
      schema: z.object({
        alert: z.object({
          type: z.enum(["detention_delay", "parking_risk", "late_delivery_risk", "hos_violation_risk", "detention_cost", "better_driver"]),
          severity: z.enum(["critical", "warning", "info"]),
          title: z.string(),
          message: z.string().describe("Human readable explanation of the risk"),
          actionLabel: z.string().optional().describe("E.g., 'View Impact'"),
        })
      })
    });

    const alert = {
      id: `ai-alert-${Date.now()}`,
      ...result.object.alert,
      load_id: event.loadId,
      driver_id: assignedDriver?.driverId ?? null,
      timestamp: new Date().toISOString(),
      dismissed: false
    };

    // Insert alert into database so realtime feed picks it up
    const { error } = await client.database.from("copilot_alerts").insert([alert]);
    
    if (error) {
      console.error("Failed to insert AI alert:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, alert });
  } catch (error: any) {
    console.error("Agent Trigger Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
