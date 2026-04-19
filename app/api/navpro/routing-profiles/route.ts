import { NextResponse } from "next/server";
import { mockProfiles } from "@/lib/mock";
import { getJson } from "@/lib/navpro";
import type { RoutingProfile } from "@/lib/types";

export async function GET() {
  const result = await getJson<{ content?: RoutingProfile[]; data?: RoutingProfile[] | Record<string, RoutingProfile> }>(
    "/api/routing-profile/list?page=0&size=50",
    { content: mockProfiles },
  );

  const normalizedProfiles = normalizeProfiles(result.data);
  return NextResponse.json({
    live: result.live,
    profiles: normalizedProfiles.length > 0 ? normalizedProfiles : mockProfiles,
  });
}

export async function POST(req: Request) {
  // Not defined in spec — demo endpoint that echoes back with a synthetic id.
  const body = await req.json();
  const created: RoutingProfile = {
    id: Math.floor(Math.random() * 100000),
    name: body.name ?? "Untitled",
    truck_ft_length: body.truck_ft_length ?? 53,
    truck_in_length: body.truck_in_length ?? 0,
    truck_ft_width: body.truck_ft_width ?? 8,
    truck_in_width: body.truck_in_width ?? 6,
    truck_ft_height: body.truck_ft_height ?? 13,
    truck_in_height: body.truck_in_height ?? 6,
    weight_limit: body.weight_limit ?? 80000,
    weight_per_axle: body.weight_per_axle ?? 20000,
    axles: body.axles ?? 5,
    trailers: body.trailers ?? 1,
    hazmat: !!body.hazmat,
    avoid_areas: body.avoid_areas ?? [],
    avoid_bridges: body.avoid_bridges ?? [],
    route_policy: {
      enforce_permitted_network: body.route_policy?.enforce_permitted_network ?? true,
      enforce_hazmat_restrictions: body.route_policy?.enforce_hazmat_restrictions ?? true,
      enforce_clearance_limits: body.route_policy?.enforce_clearance_limits ?? true,
    },
  };
  return NextResponse.json({ live: false, profile: created });
}

function normalizeProfiles(
  payload: { content?: RoutingProfile[]; data?: RoutingProfile[] | Record<string, RoutingProfile> } | null,
) {
  if (!payload) return [];
  if (Array.isArray(payload.content)) return payload.content.map(normalizeProfile);
  if (Array.isArray(payload.data)) return payload.data.map(normalizeProfile);
  if (payload.data && typeof payload.data === "object") {
    return Object.values(payload.data).map(normalizeProfile);
  }
  return [];
}

function normalizeProfile(profile: RoutingProfile): RoutingProfile {
  return {
    ...profile,
    avoid_areas: profile.avoid_areas ?? [],
    avoid_bridges: profile.avoid_bridges ?? [],
    route_policy: {
      enforce_permitted_network: profile.route_policy?.enforce_permitted_network ?? true,
      enforce_hazmat_restrictions: profile.route_policy?.enforce_hazmat_restrictions ?? true,
      enforce_clearance_limits: profile.route_policy?.enforce_clearance_limits ?? true,
    },
  };
}
