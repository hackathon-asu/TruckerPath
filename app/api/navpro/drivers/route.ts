import { NextResponse } from "next/server";
import { mockDrivers } from "@/lib/mock";
import { postJson } from "@/lib/navpro";
import type { Driver } from "@/lib/types";

interface DriverQueryBody {
  search?: string;
  work_status?: "AVAILABLE" | "IN_TRANSIT" | "INACTIVE" | "ALL";
  page?: number;
  size?: number;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as DriverQueryBody;
  const result = await postJson<{ content: Driver[]; total: number }>(
    "/api/driver/query",
    { page: body.page ?? 0, size: body.size ?? 50, search: body.search ?? "", work_status: body.work_status },
    { content: mockDrivers, total: mockDrivers.length },
  );
  const raw = result.data?.content ?? mockDrivers;
  const filtered = raw.filter((d) => {
    const s = (body.search ?? "").toLowerCase().trim();
    const matchesSearch =
      !s ||
      `${d.driver_first_name} ${d.driver_last_name}`.toLowerCase().includes(s) ||
      (d.driver_email ?? "").toLowerCase().includes(s) ||
      (d.terminal ?? "").toLowerCase().includes(s);
    const matchesStatus =
      !body.work_status || body.work_status === "ALL" || d.work_status === body.work_status;
    return matchesSearch && matchesStatus;
  });
  return NextResponse.json({ live: result.live, drivers: filtered });
}
