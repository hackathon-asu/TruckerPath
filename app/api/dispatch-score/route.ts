import { NextResponse } from "next/server";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { mapDriverRow, mapLoadRow } from "@/lib/copilot-data";
import { GEMINI_MODEL, assertGeminiConfigured } from "@/lib/gemini";
import { insforge, assertInsforgeConfigured } from "@/lib/insforge";

export async function POST(req: Request) {
  try {
    assertInsforgeConfigured();
    assertGeminiConfigured();

    const { loadId } = (await req.json()) as { loadId?: string };
    if (!loadId) {
      return NextResponse.json({ error: "loadId is required" }, { status: 400 });
    }

    const { data: loadRow, error: loadError } = await insforge.database
      .from("loads")
      .select("*")
      .eq("id", loadId)
      .single();

    if (loadError) {
      return NextResponse.json({ error: loadError.message }, { status: 500 });
    }
    if (!loadRow) {
      return NextResponse.json({ error: `Load '${loadId}' not found in InsForge` }, { status: 404 });
    }

    const { data: driverRows, error: driversError } = await insforge.database
      .from("dispatch_drivers")
      .select("*");

    if (driversError) {
      return NextResponse.json({ error: driversError.message }, { status: 500 });
    }
    if (!driverRows?.length) {
      return NextResponse.json(
        { error: "No dispatch_drivers records found in InsForge" },
        { status: 409 },
      );
    }

    const load = mapLoadRow(loadRow as Record<string, unknown>);
    const drivers = driverRows.map((row) => mapDriverRow(row as Record<string, unknown>));

    const result = await generateObject({
      model: google(GEMINI_MODEL),
      system: `You are an expert dispatcher AI for a trucking fleet.
Rank the available drivers for one load using the provided live InsForge data only.
Optimize for:
1. Trip feasibility under HOS constraints
2. Deadhead distance and pickup ETA
3. Cost per mile
4. Driver readiness

Be conservative. If a driver is not feasible, score them significantly lower.
Scores must be between 0 and 100.
Return concise reasoning and one overall explanation for the best driver.`,
      prompt: `Load: ${JSON.stringify(load, null, 2)}\n\nDrivers: ${JSON.stringify(drivers, null, 2)}`,
      schema: z.object({
        rankedDrivers: z.array(
          z.object({
            driverId: z.number(),
            score: z.number().min(0).max(100),
            deadheadMiles: z.number().min(0),
            deadheadMinutes: z.number().min(0),
            etaToPickup: z.string(),
            etaToDelivery: z.string(),
            tripFeasible: z.boolean(),
            hosAfterTrip: z.number(),
            estimatedCost: z.number().min(0),
            reasoning: z.string(),
          }),
        ),
        bestDriverId: z.number().nullable(),
        confidenceScore: z.number().min(0).max(100),
        explanation: z.string(),
      }),
    });

    const rankedDrivers = result.object.rankedDrivers
      .map((aiResult) => {
        const driver = drivers.find((item) => item.driverId === aiResult.driverId);
        return driver ? { driver, ...aiResult } : null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.score - a.score);

    const bestDriver =
      result.object.bestDriverId !== null
        ? rankedDrivers.find((item) => item.driver.driverId === result.object.bestDriverId) ?? null
        : rankedDrivers[0] ?? null;

    return NextResponse.json({
      loadId: load.id,
      rankedDrivers,
      bestDriver,
      confidenceScore: result.object.confidenceScore ?? bestDriver?.score ?? 0,
      explanation: result.object.explanation,
      source: "insforge",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("dispatch-score failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
