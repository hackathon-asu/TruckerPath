import { NextResponse } from "next/server";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { mapDriverRow, mapLoadRow } from "@/lib/copilot-data";
import { scoreDriversForLoad } from "@/lib/dispatch-engine";
import { GEMINI_MODEL, hasGeminiConfig } from "@/lib/gemini";
import { hasInsforgeConfig, insforge } from "@/lib/insforge";
import { createDemoDispatcherSnapshot } from "@/lib/reports-demo";
import type { DispatchDriver, Load } from "@/lib/types";

let geminiCooldownUntil = 0;

function getErrorStatusCode(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null;
  const maybeStatus = (error as { statusCode?: unknown }).statusCode;
  return typeof maybeStatus === "number" ? maybeStatus : null;
}

function getCooldownMs(error: unknown): number {
  if (typeof error !== "object" || error === null) return 60_000;

  const maybeData = (error as { data?: { error?: { details?: Array<{ retryDelay?: string }> } } }).data;
  const details = maybeData?.error?.details;
  const retryDelay = details?.find((detail) => typeof detail?.retryDelay === "string")?.retryDelay;

  if (!retryDelay) return 60_000;

  const seconds = Number.parseInt(retryDelay.replace(/s$/, ""), 10);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 60_000;
}

function summarizeAiFailure(error: unknown): string {
  const statusCode = getErrorStatusCode(error);

  if (statusCode === 429) {
    return "Gemini quota hit; using deterministic scoring temporarily.";
  }

  if (statusCode === 503) {
    return "Gemini is temporarily unavailable; using deterministic scoring.";
  }

  if (error instanceof Error) {
    return `Gemini request failed; using deterministic scoring. ${error.message}`;
  }

  return "Gemini request failed; using deterministic scoring.";
}

async function resolveScenario(loadId: string): Promise<{ load: Load; drivers: DispatchDriver[]; source: string } | Response> {
  const demoSnapshot = createDemoDispatcherSnapshot();
  const demoLoad = demoSnapshot.loads.find((item) => item.id === loadId);
  const demoDrivers: DispatchDriver[] = demoSnapshot.drivers.map((driver, index) => ({
    driverId: 2000 + index,
    firstName: driver.firstName,
    lastName: driver.lastName,
    phone: driver.profile.phone,
    email: driver.profile.email,
    terminal: driver.terminal,
    currentLat: driver.currentLat,
    currentLng: driver.currentLng,
    currentCity: driver.currentCity,
    hosRemaining: driver.hosRemainingHours,
    hosDriveRemaining: driver.hosRemainingHours,
    status: driver.status === "available" ? "AVAILABLE" : driver.status === "active" ? "IN_TRANSIT" : "INACTIVE",
    readiness: driver.status === "available" ? "immediate" : driver.status === "active" ? "unavailable" : "1hr",
    truckType: driver.truckType,
    costPerMile: Number((1.55 + (100 - driver.profitabilityScore) * 0.01).toFixed(2)),
    maintenanceScore: driver.maintenanceScore,
    csaScore: driver.csaScore,
    profitabilityScore: driver.profitabilityScore,
    currentFuelPercent: driver.currentFuelPercent,
    mpgLoaded: driver.mpgLoaded,
    mpgEmpty: driver.mpgEmpty,
    currentTripId: driver.currentTripId,
    breakdownStatus: driver.breakdownStatus,
    repairEtaHours: driver.repairEtaHours,
    readinessExplanation: driver.profile.overview.readyExplanation,
  }));
  const loadFromReports: Load | null = demoLoad
    ? {
        id: demoLoad.id,
        origin: { lat: 32.7767, lng: -96.797, name: demoLoad.origin },
        destination: { lat: 29.7604, lng: -95.3698, name: demoLoad.destination },
        commodity: demoLoad.customer,
        equipment: demoLoad.equipment,
        weight: 42000,
        rate: demoLoad.rate,
        miles: demoLoad.miles,
        pickupWindow: { start: new Date().toISOString(), end: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() },
        deliveryWindow: { start: new Date().toISOString(), end: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() },
        shipper: demoLoad.customer,
        receiver: demoLoad.customer,
        status: demoLoad.assignedDriverId ? "assigned" : "pending",
        urgency: demoLoad.urgency,
        docsRequired: demoLoad.docsRequired,
        customer: demoLoad.customer,
        notes: demoLoad.aiAssignmentRecommendation,
      }
    : null;

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
    if (!loadRow && loadFromReports) {
      return {
        load: loadFromReports,
        drivers: demoDrivers,
        source: "demo",
      };
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

  if (!loadFromReports) {
    return NextResponse.json({ error: `Load '${loadId}' was not found in demo data` }, { status: 404 });
  }

  return {
    load: loadFromReports,
    drivers: demoDrivers,
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

    if (Date.now() < geminiCooldownUntil) {
      return NextResponse.json({
        ...deterministicRecommendation,
        source: `${scenario.source}-deterministic-cooldown`,
      });
    }

    try {
      const result = await generateObject({
        maxRetries: 0,
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
      const statusCode = getErrorStatusCode(error);
      if (statusCode === 429 || statusCode === 503) {
        geminiCooldownUntil = Date.now() + getCooldownMs(error);
      }

      console.warn(summarizeAiFailure(error));
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
