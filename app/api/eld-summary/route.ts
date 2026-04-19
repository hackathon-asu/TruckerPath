import { NextResponse } from "next/server";
import { computeAllShiftSummaries } from "@/lib/eld-engine";
import { buildPostTripAnalysis } from "@/lib/eld-engine";
import { eldDrivers, eldCmvs } from "@/lib/eld-mock";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const driverId = searchParams.get("driverId");
  const mode = searchParams.get("mode") ?? "summary"; // "summary" | "post-trip" | "all"

  if (mode === "post-trip" && driverId) {
    return NextResponse.json(buildPostTripAnalysis(driverId));
  }

  if (mode === "post-trip") {
    // Return post-trip for all drivers
    const analyses = eldDrivers.map((d) => buildPostTripAnalysis(d.driverId));
    return NextResponse.json({ analyses });
  }

  if (driverId) {
    const summaries = computeAllShiftSummaries();
    const s = summaries.find((x) => x.driverId === driverId);
    return NextResponse.json(s ?? { error: "Driver not found" });
  }

  // Default: all summaries
  const summaries = computeAllShiftSummaries();
  return NextResponse.json({ summaries, drivers: eldDrivers, cmvs: eldCmvs });
}
