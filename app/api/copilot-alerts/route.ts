import { NextResponse } from "next/server";
import { mockAlerts } from "@/lib/mock";

export async function GET() {
  // Return the pre-built demo alerts sorted by severity
  return NextResponse.json({ alerts: mockAlerts });
}
