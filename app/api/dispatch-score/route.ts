import { NextResponse } from "next/server";
import { scoreDriversForLoad } from "@/lib/dispatch-engine";
import { mockLoads, mockDispatchDrivers } from "@/lib/mock";

export async function POST(req: Request) {
  const { loadId } = (await req.json()) as { loadId: string };
  const load = mockLoads.find((l) => l.id === loadId);
  if (!load) {
    return NextResponse.json({ error: "Load not found" }, { status: 404 });
  }
  const result = scoreDriversForLoad(load, mockDispatchDrivers);
  return NextResponse.json(result);
}
