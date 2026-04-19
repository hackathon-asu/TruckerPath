import { NextResponse } from "next/server";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { mapDriverRow, mapLoadRow } from "@/lib/copilot-data";
import { scoreDriversForLoad } from "@/lib/dispatch-engine";
import { GEMINI_MODEL, hasGeminiConfig } from "@/lib/gemini";
import { hasInsforgeConfig, insforge } from "@/lib/insforge";
import { mockDispatchDrivers, mockLoads } from "@/lib/mock";
import type { DispatchDriver, Load } from "@/lib/types";

async function resolveScenario(loadId: string): Promise<{ load: Load; drivers: DispatchDriver[]; source: string } | Response> {
  if (hasInsforgeConfig && insforge) {
    const client = insforge;
    const { data: loadRow, error: loadError } = await client.database
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

    const { data: driverRows, error: driversError } = await client.database
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

    return {
      load: mapLoadRow(loadRow as Record<string, unknown>),
      drivers: driverRows.map((row) => mapDriverRow(row as Record<string, unknown>)),
      source: "insforge",
    };
  }

  const load = mockLoads.find((item) => item.id === loadId);
  if (!load) {
    return NextResponse.json({ error: `Load '${loadId}' was not found in demo data` }, { status: 404 });
  }

  return {
    load,
    drivers: mockDispatchDrivers,
    source: "demo",
  };
}

export async function POST(req: Request) {
  try {
    const { loadId } = (await req.json()) as { loadId?: string };
    if (!loadId) {
      return NextResponse.json({ error: "loadId is required" }, { status: 400 });
    }

    const scenario = await resolveScenario(loadId);
    if (scenario instanceof Response) {
      return scenario;
    }

    const deterministicRecommendation = scoreDriversForLoad(scenario.load, scenario.drivers);

    if (!hasGeminiConfig) {
      return NextResponse.json({
        ...deterministicRecommendation,
        source: `${scenario.source}-deterministic`,
      });
    }

    try {
      const result = await generateObject({
        model: google(GEMINI_MODEL),
        system: `You are an expert dispatcher AI for a trucking fleet.
Rank the available drivers for one load using only the provided load and driver data.
Optimize for:
1. Trip feasibility under HOS constraints
2. Deadhead distance and pickup ETA
3. Cost per mile
4. Driver readiness

Be conservative. If a driver is not feasible, score them significantly lower.
Scores must be between 0 and 100.
Return concise reasoning and one overall explanation for the best driver.`,
        prompt: `Load: ${JSON.stringify(scenario.load, null, 2)}\n\nDrivers: ${JSON.stringify(scenario.drivers, null, 2)}`,
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
          const driver = scenario.drivers.find((item) => item.driverId === aiResult.driverId);
          return driver ? { driver, ...aiResult } : null;
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .sort((a, b) => b.score - a.score);

      const bestDriver =
        result.object.bestDriverId !== null
          ? rankedDrivers.find((item) => item.driver.driverId === result.object.bestDriverId) ?? null
          : rankedDrivers[0] ?? null;

      return NextResponse.json({
        loadId: scenario.load.id,
        rankedDrivers,
        bestDriver,
        confidenceScore: result.object.confidenceScore ?? bestDriver?.score ?? 0,
        explanation: result.object.explanation,
        source: `${scenario.source}-gemini`,
      });
    } catch (error) {
      console.error("dispatch-score AI fallback:", error);
      return NextResponse.json({
        ...deterministicRecommendation,
        source: `${scenario.source}-deterministic-fallback`,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("dispatch-score failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
