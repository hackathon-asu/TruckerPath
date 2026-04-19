import { NextResponse } from "next/server";
import { postJson } from "@/lib/navpro";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const result = await postJson("/api/driver/invite", { drivers: [body] }, {
    invite_result: [{ status: "success", email: body.driver_email ?? "" }],
  });
  return NextResponse.json({ live: result.live, invite: result.data });
}
