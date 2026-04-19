import { NextResponse } from "next/server";
import { mockTerminals } from "@/lib/mock";
import { getJson } from "@/lib/navpro";
import type { Terminal } from "@/lib/types";

export async function GET() {
  const result = await getJson<{ content: Terminal[] }>("/api/terminal/get/list", {
    content: mockTerminals,
  });
  return NextResponse.json({
    live: result.live,
    terminals: result.data?.content ?? mockTerminals,
  });
}
