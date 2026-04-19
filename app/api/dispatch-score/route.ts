import { NextResponse } from "next/server";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

// ── Mock fallback data (used when DB is not yet seeded) ──────────────
const MOCK_LOADS: Record<string, any> = {
  "PHX-2847": {
    id: "PHX-2847", commodity: "Electronics", weight: 42000, rate: 3850, miles: 1065,
    origin: { lat: 33.4484, lng: -112.074, name: "Phoenix, AZ" },
    destination: { lat: 32.7767, lng: -96.797, name: "Dallas, TX" },
    shipper: "West Valley Distribution", receiver: "DFW Logistics Hub", status: "pending",
    notes: "High-value freight — temperature monitoring required"
  },
  "TUC-1134": {
    id: "TUC-1134", commodity: "Building Materials", weight: 44000, rate: 1420, miles: 450,
    origin: { lat: 32.2226, lng: -110.9747, name: "Tucson, AZ" },
    destination: { lat: 35.0844, lng: -106.6504, name: "Albuquerque, NM" },
    shipper: "Southwest Lumber Co.", receiver: "ABQ Construction Supply", status: "assigned"
  },
  "LV-0921": {
    id: "LV-0921", commodity: "Consumer Goods", weight: 38000, rate: 1650, miles: 270,
    origin: { lat: 36.1699, lng: -115.1398, name: "Las Vegas, NV" },
    destination: { lat: 34.0522, lng: -118.2437, name: "Los Angeles, CA" },
    shipper: "Vegas Wholesale", receiver: "LA Distribution Center", status: "pending"
  },
  "PHX-3310": {
    id: "PHX-3310", commodity: "Produce (Refrigerated)", weight: 39000, rate: 2800, miles: 515,
    origin: { lat: 33.4484, lng: -112.074, name: "Phoenix, AZ" },
    destination: { lat: 36.7783, lng: -119.4179, name: "Fresno, CA" },
    shipper: "Arizona Fresh Farms", receiver: "Central Valley Cold Storage", status: "pending",
    notes: "Reefer required — 34°F"
  }
};

const MOCK_DRIVERS = [
  { driver_id: 1001, first_name: "Jordan", last_name: "Reyes", phone: "602-555-0142", email: "jordan.reyes@fleet.example", terminal: "Phoenix Hub", current_lat: 32.89, current_lng: -111.76, current_city: "Casa Grande, AZ", hos_remaining: 5.5, hos_drive_remaining: 3.5, status: "IN_TRANSIT", readiness: "unavailable", truck_type: "Dry Van 53ft", cost_per_mile: 1.85 },
  { driver_id: 1002, first_name: "Alex", last_name: "Novak", phone: "480-555-0199", email: "alex.novak@fleet.example", terminal: "Phoenix Hub", current_lat: 33.425, current_lng: -111.94, current_city: "Tempe, AZ", hos_remaining: 6.0, hos_drive_remaining: 11.0, status: "AVAILABLE", readiness: "immediate", truck_type: "Dry Van 53ft", cost_per_mile: 1.72 },
  { driver_id: 1003, first_name: "Mia", last_name: "Okonkwo", phone: "702-555-0108", email: "mia.o@fleet.example", terminal: "Las Vegas Yard", current_lat: 36.1699, current_lng: -115.1398, current_city: "Las Vegas, NV", hos_remaining: 6.0, hos_drive_remaining: 11.0, status: "AVAILABLE", readiness: "immediate", truck_type: "Flatbed 48ft", cost_per_mile: 1.95 },
  { driver_id: 1004, first_name: "Sam", last_name: "Chen", phone: "520-555-0166", email: "sam.chen@fleet.example", terminal: "Tucson Depot", current_lat: 32.2217, current_lng: -110.9265, current_city: "Tucson, AZ", hos_remaining: 14.0, hos_drive_remaining: 11.0, status: "AVAILABLE", readiness: "1hr", truck_type: "Dry Van 53ft", cost_per_mile: 1.68 },
  { driver_id: 1005, first_name: "Priya", last_name: "Shah", phone: "435-555-0121", email: "priya.shah@fleet.example", terminal: "Utah Steel", current_lat: 37.6775, current_lng: -113.0619, current_city: "Cedar City, UT", hos_remaining: 6.0, hos_drive_remaining: 4.0, status: "IN_TRANSIT", readiness: "unavailable", truck_type: "Dry Van 53ft", cost_per_mile: 1.90 },
];

export async function POST(req: Request) {
  try {
    const { loadId } = (await req.json()) as { loadId: string };
    
    // Try InsForge DB first, fall back to mock data
    let load: any = null;
    let drivers: any[] = [];
    let usingMock = false;

    try {
      const { createClient } = await import("@insforge/sdk");
      const client = createClient({
        baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL || "",
        anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || ""
      });

      const { data: loadData, error: loadError } = await client.database
        .from("loads")
        .select("*")
        .eq("id", loadId)
        .single();

      if (!loadError && loadData) {
        load = loadData;
        const { data: driversData } = await client.database.from("dispatch_drivers").select("*");
        if (driversData && driversData.length > 0) drivers = driversData;
      }
    } catch (dbErr) {
      console.warn("InsForge DB unavailable, using mock data:", dbErr);
    }

    // Fall back to mock data if DB returned nothing
    if (!load) {
      load = MOCK_LOADS[loadId];
      usingMock = true;
    }
    if (drivers.length === 0) {
      drivers = MOCK_DRIVERS;
      usingMock = true;
    }

    if (!load) {
      return NextResponse.json({ error: `Load '${loadId}' not found` }, { status: 404 });
    }

    const result = await generateObject({
      model: google("gemini-1.5-flash"),
      system: `You are an expert dispatcher AI for a trucking fleet.
Your job is to match drivers to a specific load. You have strict FMCSA Hours of Service (HOS) constraints and you optimize for:
1. Feasibility (HOS)
2. Deadhead miles (closer is better)
3. Cost per mile
4. Readiness status (immediate is best)

Scores must be 0-100.
Provide an overall explanation for the top recommended best driver choice.`,
      prompt: `Load: ${JSON.stringify(load, null, 2)}\n\nDrivers available: ${JSON.stringify(drivers, null, 2)}`,
      schema: z.object({
        rankedDrivers: z.array(
          z.object({
            driverId: z.number(),
            score: z.number().describe("0-100 score, 100 is best"),
            deadheadMiles: z.number().describe("Estimated distance to pickup"),
            deadheadMinutes: z.number(),
            etaToPickup: z.string().describe("ISO datetime"),
            etaToDelivery: z.string().describe("ISO datetime"),
            tripFeasible: z.boolean(),
            hosAfterTrip: z.number().describe("Remaining drive hours after trip"),
            estimatedCost: z.number(),
            reasoning: z.string().describe("Short bullet points (e.g. 'Very close (25 mi deadhead) · Ready now')"),
          })
        ),
        bestDriverId: z.number().nullable(),
        confidenceScore: z.number(),
        explanation: z.string(),
      }),
    });

    const rankedDrivers = result.object.rankedDrivers.map(aiResult => {
      const originalDriver = drivers.find((d: any) => d.driver_id === aiResult.driverId);
      const mappedDriver = originalDriver ? {
        driverId: originalDriver.driver_id,
        firstName: originalDriver.first_name,
        lastName: originalDriver.last_name,
        phone: originalDriver.phone,
        email: originalDriver.email,
        terminal: originalDriver.terminal,
        currentLat: originalDriver.current_lat,
        currentLng: originalDriver.current_lng,
        currentCity: originalDriver.current_city,
        hosRemaining: originalDriver.hos_remaining,
        hosDriveRemaining: originalDriver.hos_drive_remaining,
        status: originalDriver.status,
        readiness: originalDriver.readiness,
        truckType: originalDriver.truck_type,
        costPerMile: originalDriver.cost_per_mile
      } : null;
      return { driver: mappedDriver, ...aiResult };
    }).filter(d => d.driver !== null).sort((a, b) => b.score - a.score);

    const bestDriver = result.object.bestDriverId 
      ? rankedDrivers.find(d => d.driver.driverId === result.object.bestDriverId) 
      : (rankedDrivers[0] ?? null);

    return NextResponse.json({
      loadId: load.id,
      rankedDrivers,
      bestDriver: bestDriver ?? null,
      confidenceScore: result.object.confidenceScore ?? (bestDriver?.score || 0),
      explanation: result.object.explanation,
      source: usingMock ? "mock" : "insforge"
    });

  } catch (error: any) {
    console.error("AI Dispatch Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
