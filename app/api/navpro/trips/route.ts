import { NextResponse } from "next/server";
import { postJson } from "@/lib/navpro";

export async function POST(req: Request) {
  const body = await req.json();
  const syntheticId = `${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(
    Math.random() * 9000 + 1000,
  )}`;
  const result = await postJson(
    "/api/trip/create",
    {
      driver_id: body.driver_id,
      scheduled_start_time: body.scheduled_start_time,
      routing_profile_id: body.routing_profile_id,
      stop_points: body.stop_points,
    },
    { code: 200, success: true, trip_id: syntheticId, msg: "demo" },
  );
  return NextResponse.json({ live: result.live, trip: result.data });
}
