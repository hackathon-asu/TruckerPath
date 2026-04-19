import { NextResponse } from "next/server";
import { createDemoDispatcherSnapshot } from "@/lib/reports-demo";

export async function GET() {
  return NextResponse.json(createDemoDispatcherSnapshot());
}
