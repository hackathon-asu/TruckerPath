import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

export async function POST(req: Request) {
  try {
    const { load, drivers } = await req.json();

    const result = await generateObject({
      model: google("gemini-1.5-flash"),
      system: `You are an expert dispatcher AI for a trucking fleet.
Your job is to match drivers to a specific load. You have strict FMCSA Hours of Service (HOS) constraints and you optimize for:
1. Feasibility (HOS)
2. Deadhead miles (closer is better)
3. Cost per mile
4. Readiness status

Always output scores 0-100.
Create a brief, human-readable reason for the score of each driver.
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

    // We must merge the original driver objects back to the Vercel AI result to return the `RankedDriver` structure
    const rankedDrivers = result.object.rankedDrivers.map(aiResult => {
      const originalDriver = drivers.find((d: any) => d.driverId === aiResult.driverId);
      return {
        driver: originalDriver,
        ...aiResult
      };
    }).sort((a, b) => b.score - a.score);

    let bestDriver = result.object.bestDriverId 
      ? rankedDrivers.find(d => d.driver.driverId === result.object.bestDriverId) 
      : (rankedDrivers[0] ?? null);

    if (bestDriver && !bestDriver.tripFeasible) {
      const bestFeasible = rankedDrivers.find(d => d.tripFeasible);
      if (bestFeasible) {
        bestDriver = bestFeasible;
      }
    }

    return Response.json({
      loadId: load.id,
      rankedDrivers: rankedDrivers,
      bestDriver: bestDriver ?? null,
      confidenceScore: result.object.confidenceScore ?? (bestDriver?.score || 0),
      explanation: result.object.explanation
    });

  } catch (error: any) {
    console.error("AI Dispatch Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
