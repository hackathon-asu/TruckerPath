import type {
  RouteAlt,
  RouteBasis,
  RouteCalcRequest,
  RouteComplianceNotice,
  RouteLeg,
  RoutingBackendName,
  RouteNoticeSeverity,
  RouteOverlaySegment,
  RouteOverlayStatus,
  RouteStep,
} from "./route";
import type {
  AvoidArea,
  NormalizedRouteRestriction,
  RoutePolicy,
  RoutingProfile,
  RoutingCoverageLevel,
  RoutingConfidence,
  RouteCoordinate,
} from "./types";
import {
  NORMALIZED_ROUTE_RESTRICTIONS,
  getRoutingSourceById,
} from "./truck-routing-data";

const MPG = 6;
const FUEL_PRICE = 3.85;
const TOLL_PER_MILE = 0.0095;

// ── LRU Cache for OSRM results ─────────────────────────────────
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_MAX_ENTRIES = 50;

interface CacheEntry {
  result: { routes: GeneratedRoute[]; fallback?: boolean };
  timestamp: number;
}

const routeCache = new Map<string, CacheEntry>();

function cacheKeyForInput(
  backend: RoutingBackendName,
  input: Pick<RouteCalcRequest, "stops" | "profile" | "departure_time">,
) {
  const stopsKey = input.stops.map((s) => `${s.latitude.toFixed(4)},${s.longitude.toFixed(4)}`).join("|");
  if (backend === "osrm") {
    return `osrm:${stopsKey}`;
  }

  const profile = input.profile;
  const profileKey = profile
    ? [
        profile.truck_ft_length,
        profile.truck_in_length,
        profile.truck_ft_width,
        profile.truck_in_width,
        profile.truck_ft_height,
        profile.truck_in_height,
        profile.weight_limit,
        profile.weight_per_axle,
        profile.axles,
        profile.trailers,
        profile.hazmat ? 1 : 0,
      ].join(":")
    : "default";

  return `here:${stopsKey}:${profileKey}:${input.departure_time ?? "no-departure"}`;
}

function getCached(key: string): CacheEntry["result"] | null {
  const entry = routeCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    routeCache.delete(key);
    return null;
  }
  return entry.result;
}

function setCache(key: string, result: CacheEntry["result"]) {
  // Evict oldest entries if at capacity
  if (routeCache.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = routeCache.keys().next().value;
    if (oldestKey) routeCache.delete(oldestKey);
  }
  routeCache.set(key, { result, timestamp: Date.now() });
}

interface OsrmStep {
  distance: number;
  duration: number;
  maneuver: { instruction?: string; type?: string; modifier?: string };
  name?: string;
}

interface OsrmLeg {
  distance: number;
  duration: number;
  steps: OsrmStep[];
}

interface OsrmRoute {
  distance: number;
  duration: number;
  legs: OsrmLeg[];
  geometry: { coordinates: [number, number][] };
}

export type GeneratedRoute = Omit<
  RouteAlt,
  | "backend"
  | "routeBasis"
  | "coverageLevel"
  | "screeningConfidence"
  | "complianceScore"
  | "blocked"
  | "screenedRestrictionIds"
  | "violations"
  | "advisories"
  | "overlays"
>;

export interface RestrictionAssessment {
  violation?: RouteComplianceNotice;
  advisory?: RouteComplianceNotice;
}

export interface RoutingBackend {
  name: RoutingBackendName;
  generateRoutes(input: RouteCalcRequest): Promise<{ routes: GeneratedRoute[]; fallback?: boolean }>;
}

const defaultPolicy: Required<RoutePolicy> = {
  enforce_permitted_network: true,
  enforce_hazmat_restrictions: true,
  enforce_clearance_limits: true,
};

const defaultProfile: RoutingProfile = {
  id: 0,
  name: "Default Screening Profile",
  truck_ft_length: 53,
  truck_in_length: 0,
  truck_ft_width: 8,
  truck_in_width: 6,
  truck_ft_height: 13,
  truck_in_height: 6,
  weight_limit: 80000,
  weight_per_axle: 20000,
  axles: 5,
  trailers: 1,
  hazmat: false,
  avoid_areas: [],
  avoid_bridges: [],
  route_policy: defaultPolicy,
};

export const osrmRoutingBackend: RoutingBackend = {
  name: "osrm",
  async generateRoutes(input) {
    if (!input.stops || input.stops.length < 2) {
      throw new Error("need >= 2 stops");
    }

    // Check cache first
    const key = cacheKeyForInput("osrm", input);
    const cached = getCached(key);
    if (cached) return cached;

    const coords = input.stops.map((s) => `${s.longitude},${s.latitude}`).join(";");
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true&alternatives=3`;

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const payload = (await res.json()) as { routes: OsrmRoute[] };
      if (!payload.routes?.length) throw new Error("no route");

      const baseRoutes = payload.routes.map((route, index) => toGeneratedRoute(route, `r${index}`));
      const result = { routes: assignLabels(dedupeNearDuplicates(baseRoutes)) };
      setCache(key, result);
      return result;
    } catch {
      const miles = straightLineMiles(input.stops);
      const minutes = (miles / 55) * 60;
      const polyline: [number, number][] = input.stops.map((s) => [s.latitude, s.longitude]);

      return {
        fallback: true,
        routes: [
          {
            id: "fallback",
            label: "Fastest Route",
            miles,
            minutes,
            gallons: miles / MPG,
            fuelCost: (miles / MPG) * FUEL_PRICE,
            tolls: miles * TOLL_PER_MILE,
            polyline,
            legs: [],
          },
        ],
      };
    }
  },
};

// ── HERE Truck Routing Backend ──────────────────────────────────

const HERE_ROUTING_KEY = process.env.NEXT_PUBLIC_HERE_API_KEY ?? "";

export const hereRoutingBackend: RoutingBackend = {
  name: "here",
  async generateRoutes(input) {
    if (!HERE_ROUTING_KEY || !input.stops || input.stops.length < 2) {
      // Fall back to OSRM if no HERE key
      return osrmRoutingBackend.generateRoutes(input);
    }

    const key = cacheKeyForInput("here", input);
    const cached = getCached(key);
    if (cached) return cached;

    const profile = input.profile;
    const origin = input.stops[0];
    const destination = input.stops[input.stops.length - 1];
    const vias = input.stops.slice(1, -1);

    const params = new URLSearchParams({
      apiKey: HERE_ROUTING_KEY,
      origin: `${origin.latitude},${origin.longitude}`,
      destination: `${destination.latitude},${destination.longitude}`,
      transportMode: "truck",
      return: "polyline,summary,actions,instructions,turnByTurnActions",
      alternatives: "3",
    });

    // Wire truck profile parameters into HERE request
    if (profile) {
      const heightM = ((profile.truck_ft_height + profile.truck_in_height / 12) * 0.3048).toFixed(2);
      const widthM = ((profile.truck_ft_width + profile.truck_in_width / 12) * 0.3048).toFixed(2);
      const lengthM = ((profile.truck_ft_length + profile.truck_in_length / 12) * 0.3048).toFixed(2);
      const weightKg = Math.round(profile.weight_limit * 0.453592);
      const axleWeightKg = Math.round(profile.weight_per_axle * 0.453592);

      params.set("truck[grossWeight]", String(weightKg));
      params.set("truck[weightPerAxle]", String(axleWeightKg));
      params.set("truck[height]", heightM);
      params.set("truck[width]", widthM);
      params.set("truck[length]", lengthM);
      params.set("truck[axleCount]", String(profile.axles));
      params.set("truck[trailerCount]", String(profile.trailers));

      if (profile.hazmat) {
        params.set("truck[shippedHazardousGoods]", "explosive,gas,flammable,organic,poison,radioactive,corrosive");
      }
    }

    for (const via of vias) {
      params.append("via", `${via.latitude},${via.longitude}`);
    }

    if (input.departure_time) {
      params.set("departureTime", input.departure_time);
    }

    try {
      const url = `https://router.hereapi.com/v8/routes?${params.toString()}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HERE ${res.status}`);
      const payload = await res.json();

      if (!payload.routes?.length) throw new Error("no HERE route");

      const baseRoutes = payload.routes.map((route: HereRoute, index: number) =>
        hereToGeneratedRoute(route, `h${index}`),
      );
      const result = { routes: assignLabels(dedupeNearDuplicates(baseRoutes)) };
      setCache(key, result);
      return result;
    } catch {
      // Fall back to OSRM on any HERE failure
      return osrmRoutingBackend.generateRoutes(input);
    }
  },
};

export interface HereAction {
  action: string;
  duration: number;
  length: number;
  instruction: string;
  offset: number;
  nextRoad?: {
    name?: Array<string | { value: string; language?: string }>;
  };
}

export interface HereSection {
  summary: { length: number; duration: number };
  polyline: string;
  turnByTurnActions?: HereAction[];
  actions?: HereAction[];
}

export interface HereRoute {
  sections: HereSection[];
}

const FLEX_POLYLINE_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const FLEX_DECODING_TABLE = new Map(
  Array.from(FLEX_POLYLINE_ALPHABET).map((char, index) => [char, index]),
);

function decodeFlexiblePolyline(encoded: string): [number, number][] {
  let index = 0;

  const decodeUnsignedVarint = () => {
    let result = 0;
    let shift = 0;

    while (index < encoded.length) {
      const value = FLEX_DECODING_TABLE.get(encoded[index]);
      index += 1;
      if (value === undefined) throw new Error("invalid flexible polyline");
      result |= (value & 0x1f) << shift;
      if ((value & 0x20) === 0) return result;
      shift += 5;
    }

    throw new Error("truncated flexible polyline");
  };

  const version = decodeUnsignedVarint();
  if (version !== 1) throw new Error(`unsupported flexible polyline version ${version}`);

  const header = decodeUnsignedVarint();
  const precision = header & 0x0f;
  const thirdDimFlag = (header >> 4) & 0x07;
  const tupleSize = thirdDimFlag === 0 ? 2 : 3;
  const factor = 10 ** precision;

  let lat = 0;
  let lng = 0;
  let third = 0;
  const points: [number, number][] = [];
  let tupleIndex = 0;

  while (index < encoded.length) {
    const unsigned = decodeUnsignedVarint();
    const delta = unsigned & 1 ? -(unsigned + 1) / 2 : unsigned / 2;

    if (tupleIndex % tupleSize === 0) {
      lat += delta;
    } else if (tupleIndex % tupleSize === 1) {
      lng += delta;
      points.push([lat / factor, lng / factor]);
    } else {
      third += delta;
    }

    tupleIndex += 1;
  }

  return points;
}

export function hereToGeneratedRoute(route: HereRoute, id: string): GeneratedRoute {
  let totalMeters = 0;
  let totalSeconds = 0;
  const allPoints: [number, number][] = [];
  const legs: RouteLeg[] = [];

  for (const section of route.sections) {
    totalMeters += section.summary.length;
    totalSeconds += section.summary.duration;

    const sectionPoints = decodeFlexiblePolyline(section.polyline);
    for (const point of sectionPoints) {
      const previous = allPoints[allPoints.length - 1];
      if (!previous || previous[0] !== point[0] || previous[1] !== point[1]) {
        allPoints.push(point);
      }
    }

    const legMiles = section.summary.length / 1609.344;
    const legMinutes = section.summary.duration / 60;

    const sourceActions =
      section.turnByTurnActions?.length
        ? section.turnByTurnActions
        : section.actions?.length
          ? section.actions
          : [];
    const steps: RouteStep[] = sourceActions.map((action) => {
      const road = action.nextRoad?.name?.[0];
      const roadName = typeof road === "string" ? road : road?.value;

      return {
        instruction: action.instruction ?? `${action.action} on route`,
        miles: action.length / 1609.344,
        minutes: action.duration / 60,
        roadName,
      };
    });

    // If no actions were returned, provide a fallback step representing the section
    if (steps.length === 0 && section.summary.length > 0) {
      steps.push({
        instruction: "Continue on route",
        miles: legMiles,
        minutes: legMinutes,
      });
    }

    legs.push({
      miles: legMiles,
      minutes: legMinutes,
      tolls: legMiles * TOLL_PER_MILE,
      steps,
    });
  }

  const miles = totalMeters / 1609.344;
  const minutes = totalSeconds / 60;
  const gallons = miles / MPG;

  return {
    id,
    label: "Fastest Route",
    miles,
    minutes,
    gallons,
    fuelCost: gallons * FUEL_PRICE,
    tolls: miles * TOLL_PER_MILE,
    polyline: allPoints.length > 0 ? allPoints : [],
    legs,
  };
}

/**
 * Select the best available routing backend.
 * Prefers HERE truck routing when the API key is set.
 */
export function selectBackend(): RoutingBackend {
  return HERE_ROUTING_KEY ? hereRoutingBackend : osrmRoutingBackend;
}

export async function calculateScreenedRoutes(
  input: RouteCalcRequest,
  backend: RoutingBackend = selectBackend(),
) {
  const profile = normalizeProfile(input.profile);
  const generated = await backend.generateRoutes(input);
  const screened = rerankRoutes(
    generated.routes.map((route) =>
      screenRoute({
        route,
        profile,
        backend: backend.name,
        usedFallback: !!generated.fallback,
        departureTime: input.departure_time,
      }),
    ),
  );

  return {
    routes: screened,
    fallback: generated.fallback,
  };
}

function normalizeProfile(profile?: RoutingProfile): RoutingProfile {
  return {
    ...defaultProfile,
    ...profile,
    avoid_areas: profile?.avoid_areas ?? [],
    avoid_bridges: profile?.avoid_bridges ?? [],
    route_policy: {
      ...defaultPolicy,
      ...(profile?.route_policy ?? {}),
    },
  };
}

function screenRoute({
  route,
  profile,
  backend,
  usedFallback,
  departureTime,
}: {
  route: GeneratedRoute;
  profile: RoutingProfile;
  backend: RoutingBackendName;
  usedFallback: boolean;
  departureTime?: string;
}): RouteAlt {
  const coverage = usedFallback ? genericCoverage() : deriveCoverage(route);
  const advisories: RouteComplianceNotice[] = [];
  const violations: RouteComplianceNotice[] = [];
  const screenedRestrictionIds: string[] = [];
  const overlays: RouteOverlaySegment[] = [];

  advisories.push(buildCoverageNotice(coverage));

  if (!usedFallback && profile.route_policy?.enforce_permitted_network) {
    const federalNetworkNotice = assessFederalBackbone(route);
    if (federalNetworkNotice) advisories.push(federalNetworkNotice);
  }

  for (const area of profile.avoid_areas ?? []) {
    if (routeIntersectsAvoidArea(route.polyline, area)) {
      const notice: RouteComplianceNotice = {
        id: `avoid-area:${area.area_name}`,
        type: "avoid_area",
        severity: "critical",
        title: `Avoid area crossed: ${area.area_name}`,
        message: "This screened route enters a user-defined avoid area and requires a different candidate.",
        sourceIds: [],
        states: [],
        restrictionIds: [],
      };
      violations.push(notice);
      overlays.push({
        id: `overlay:avoid-area:${area.area_name}`,
        type: "avoid_area",
        status: "violation",
        severity: "critical",
        title: notice.title,
        message: notice.message,
        polyline: extractAvoidAreaOverlayPolyline(route.polyline, area),
        sourceIds: [],
        states: [],
      });
    }
  }

  for (const restriction of NORMALIZED_ROUTE_RESTRICTIONS) {
    if (!routeIntersectsRestriction(route.polyline, restriction)) continue;
    screenedRestrictionIds.push(restriction.id);

    const assessment = assessRestriction(route, restriction, profile, departureTime);
    if (assessment.violation) {
      violations.push(assessment.violation);
    }
    const avoidBridgeViolation = evaluateAvoidBridgeRule(restriction, profile);
    if (avoidBridgeViolation) {
      violations.push(avoidBridgeViolation);
    }

    if (!assessment.violation && assessment.advisory) {
      advisories.push(assessment.advisory);
    }

    overlays.push(
      buildRestrictionOverlay(route, restriction, avoidBridgeViolation ?? assessment.violation, assessment.advisory),
    );
  }

  const complianceScore = scoreRoute(route, advisories, violations);
  const blocked = violations.length > 0;

  return {
    ...route,
    backend,
    routeBasis: coverage.routeBasis,
    coverageLevel: coverage.coverageLevel,
    screeningConfidence: coverage.screeningConfidence,
    complianceScore,
    blocked,
    screenedRestrictionIds,
    violations,
    advisories,
    overlays,
  };
}

function deriveCoverage(route: GeneratedRoute): {
  routeBasis: RouteBasis;
  coverageLevel: RoutingCoverageLevel;
  screeningConfidence: RoutingConfidence;
  reviewedStates: string[];
  provisionalStates: string[];
} {
  const touchedRestrictions = NORMALIZED_ROUTE_RESTRICTIONS.filter(
    (restriction) =>
      restriction.source_id.startsWith("state-") &&
      !!restriction.state &&
      routeIntersectsRestriction(route.polyline, restriction),
  );

  const reviewedStates = Array.from(
    new Set(
      touchedRestrictions
        .filter((restriction) => restriction.verification_status !== "needs-review")
        .map((restriction) => restriction.state!),
    ),
  );

  const provisionalStates = Array.from(
    new Set(
      touchedRestrictions
        .filter((restriction) => restriction.verification_status === "needs-review")
        .map((restriction) => restriction.state!),
    ),
  );

  if (reviewedStates.length > 0 || provisionalStates.length > 0) {
    return {
      routeBasis: "state-overlay-screened",
      coverageLevel: "state-overlay-screened",
      screeningConfidence:
        provisionalStates.length > 0
          ? reviewedStates.length > 0
            ? "medium"
            : "low"
          : "high",
      reviewedStates,
      provisionalStates,
    };
  }

  return {
    routeBasis: "federal-backbone-screened",
    coverageLevel: "federal-only",
    screeningConfidence: "medium",
    reviewedStates: [],
    provisionalStates: [],
  };
}

function genericCoverage() {
  return {
    routeBasis: "generic-driving" as const,
    coverageLevel: "generic-only" as const,
    screeningConfidence: "low" as const,
    reviewedStates: [],
    provisionalStates: [],
  };
}

function buildCoverageNotice(coverage: {
  routeBasis: RouteBasis;
  coverageLevel: RoutingCoverageLevel;
  screeningConfidence: RoutingConfidence;
  reviewedStates: string[];
  provisionalStates: string[];
}): RouteComplianceNotice {
  if (coverage.coverageLevel === "generic-only") {
    return {
      id: "coverage:generic",
      type: "coverage",
      severity: "warning",
      title: "Generic routing fallback",
      message: "Route geometry came from a generic fallback. Manual truck review is required before dispatch.",
      sourceIds: [],
      states: [],
      restrictionIds: [],
    };
  }

  if (coverage.coverageLevel === "state-overlay-screened") {
    const reviewedText =
      coverage.reviewedStates.length > 0
        ? `reviewed overlay states (${coverage.reviewedStates.join(", ")})`
        : null;
    const provisionalText =
      coverage.provisionalStates.length > 0
        ? `provisional review corridors (${coverage.provisionalStates.join(", ")})`
        : null;
    const parts = [reviewedText, provisionalText].filter(Boolean);

    return {
      id: "coverage:state-overlay",
      type: "coverage",
      severity: coverage.provisionalStates.length > 0 ? "warning" : "info",
      title:
        coverage.provisionalStates.length > 0
          ? "Federal + mixed-confidence state screening"
          : "Federal + state overlay screening",
      message: `Screened against federal baseline sources and ${parts.join(" plus ")}. Manual permit review remains required for provisional corridors and anywhere outside normalized state overlays.`,
      sourceIds: [
        "federal-staa-appendix-a",
        "federal-fhwa-nhs",
        ...Array.from(new Set([...coverage.reviewedStates, ...coverage.provisionalStates])).map(
          (state) => `state-${state.toLowerCase()}-dot`,
        ),
      ],
      states: [...coverage.reviewedStates, ...coverage.provisionalStates],
      restrictionIds: [],
    };
  }

  return {
    id: "coverage:federal",
    type: "coverage",
    severity: "info",
    title: "Federal baseline screening",
    message: "Screened against federal backbone, bridge, tunnel, and hazmat sources. State permit review is still required where overlays are not yet normalized.",
    sourceIds: [
      "federal-staa-appendix-a",
      "federal-fhwa-nhs",
      "federal-fhwa-nbi",
      "federal-fhwa-nti",
      "federal-fmcsa-hazmat",
    ],
    states: [],
    restrictionIds: [],
  };
}

function assessFederalBackbone(route: GeneratedRoute): RouteComplianceNotice | null {
  const allSteps = route.legs.flatMap((leg) => leg.steps);
  const totalMiles = allSteps.reduce((sum, step) => sum + step.miles, 0);
  if (totalMiles < 150) return null;

  const backboneMiles = allSteps.reduce((sum, step) => {
    const haystack = `${step.roadName ?? ""} ${step.instruction}`.trim();
    return sum + (looksLikeFreightBackbone(haystack) ? step.miles : 0);
  }, 0);

  const ratio = totalMiles > 0 ? backboneMiles / totalMiles : 0;
  if (ratio >= 0.4) return null;

  return {
    id: "federal-network:advisory",
    type: "federal_network",
    severity: "warning",
    title: "Low federal-backbone adherence",
    message: `Only ${Math.round(ratio * 100)}% of the sampled route follows clear Interstate or US-route segments. Review for state-designated truck access before dispatch.`,
    sourceIds: ["federal-staa-appendix-a", "federal-fhwa-nhs"],
    states: [],
    restrictionIds: [],
  };
}

function looksLikeFreightBackbone(value: string) {
  return /\b(I-\d+|Interstate\s+\d+|US-\d+|US\s+\d+|Highway|Freeway|Expressway|Turnpike|Thruway|Tollway)\b/i.test(value);
}

export function assessRestriction(
  route: GeneratedRoute,
  restriction: NormalizedRouteRestriction,
  profile: RoutingProfile,
  departureTime?: string,
): RestrictionAssessment {
  const heightFt = profile.truck_ft_height + profile.truck_in_height / 12;
  const widthFt = profile.truck_ft_width + profile.truck_in_width / 12;
  const lengthFt = profile.truck_ft_length + profile.truck_in_length / 12;

  // ── Truck-prohibited roads (e.g., NY Parkways, NJ Pulaski Skyway) ──
  if (restriction.restriction_type === "truck_prohibited") {
    if (restriction.advisory_only) {
      return {
        advisory: buildRestrictionNotice(
          route,
          restriction,
          "warning",
          `Commercial vehicles are generally prohibited on this road, but limited local-access exceptions may apply. Review local access rules before dispatch.`,
        ),
      };
    }
    return {
      violation: buildRestrictionNotice(
        route,
        restriction,
        "critical",
        `Commercial vehicles are prohibited on this road. Fines may apply. Use designated truck routes.`,
      ),
    };
  }

  // ── Height restrictions ──
  if (
    (restriction.restriction_type === "bridge_clearance" ||
      restriction.restriction_type === "tunnel_clearance" ||
      restriction.restriction_type === "route_height_limit") &&
    profile.route_policy?.enforce_clearance_limits &&
    typeof restriction.vehicle_applicability?.max_height_ft === "number" &&
    heightFt > restriction.vehicle_applicability.max_height_ft
  ) {
    const message = `${heightFt.toFixed(1)} ft unit exceeds the screened ${restriction.vehicle_applicability.max_height_ft.toFixed(1)} ft limit.`;
    if (restriction.advisory_only) {
      return {
        advisory: buildRestrictionNotice(route, restriction, "warning", message),
      };
    }
    return {
      violation: buildRestrictionNotice(route, restriction, "critical", message),
    };
  }

  // ── Weight restrictions ──
  if (
    (restriction.restriction_type === "bridge_weight" ||
      restriction.restriction_type === "route_weight_limit") &&
    profile.route_policy?.enforce_clearance_limits &&
    typeof restriction.vehicle_applicability?.max_weight_lb === "number" &&
    profile.weight_limit > restriction.vehicle_applicability.max_weight_lb
  ) {
    const message = `${profile.weight_limit.toLocaleString()} lb exceeds the screened ${restriction.vehicle_applicability.max_weight_lb.toLocaleString()} lb limit.`;
    if (restriction.advisory_only) {
      return {
        advisory: buildRestrictionNotice(route, restriction, "warning", message),
      };
    }
    return {
      violation: buildRestrictionNotice(route, restriction, "critical", message),
    };
  }

  // ── Width restrictions ──
  if (
    restriction.restriction_type === "route_width_limit" &&
    profile.route_policy?.enforce_clearance_limits &&
    typeof (restriction.vehicle_applicability?.max_width_ft ?? restriction.vehicle_applicability?.min_width_ft) ===
      "number" &&
    widthFt >
      (restriction.vehicle_applicability?.max_width_ft ?? restriction.vehicle_applicability?.min_width_ft ?? 0)
  ) {
    const widthLimit =
      restriction.vehicle_applicability?.max_width_ft ?? restriction.vehicle_applicability?.min_width_ft ?? 0;
    const message = `${widthFt.toFixed(1)} ft unit exceeds the screened ${widthLimit.toFixed(1)} ft width limit.`;
    if (restriction.advisory_only) {
      return {
        advisory: buildRestrictionNotice(route, restriction, "warning", message),
      };
    }
    return {
      violation: buildRestrictionNotice(route, restriction, "critical", message),
    };
  }

  // ── Length restrictions ──
  if (
    restriction.restriction_type === "route_length_limit" &&
    profile.route_policy?.enforce_clearance_limits &&
    typeof (restriction.vehicle_applicability?.max_length_ft ?? restriction.vehicle_applicability?.min_length_ft) ===
      "number" &&
    lengthFt >
      (restriction.vehicle_applicability?.max_length_ft ?? restriction.vehicle_applicability?.min_length_ft ?? 0)
  ) {
    const lengthLimit =
      restriction.vehicle_applicability?.max_length_ft ?? restriction.vehicle_applicability?.min_length_ft ?? 0;
    const message = `${lengthFt.toFixed(0)} ft total length exceeds the ${lengthLimit.toFixed(0)} ft threshold for this corridor. Permit coordination required.`;
    if (restriction.advisory_only) {
      return {
        advisory: buildRestrictionNotice(route, restriction, "warning", message),
      };
    }
    return {
      violation: buildRestrictionNotice(route, restriction, "critical", message),
    };
  }

  // ── Hazmat (full ban) ──
  if (
    (restriction.restriction_type === "tunnel_hazmat" || restriction.restriction_type === "state_hazmat") &&
    profile.route_policy?.enforce_hazmat_restrictions &&
    profile.hazmat &&
    restriction.hazmat_applicability?.restricted
  ) {
    const message = restriction.hazmat_applicability.description ?? "Hazmat loads require an alternate corridor.";
    if (restriction.advisory_only) {
      return {
        advisory: buildRestrictionNotice(route, restriction, "warning", message),
      };
    }
    return {
      violation: buildRestrictionNotice(route, restriction, "critical", message),
    };
  }

  // ── Hazmat time-window (time-aware) ──
  if (
    restriction.restriction_type === "hazmat_time_window" &&
    profile.route_policy?.enforce_hazmat_restrictions &&
    profile.hazmat &&
    restriction.hazmat_applicability?.restricted
  ) {
    // Estimate ETA to the first segment intersection
    const intersectionIndex = findFirstIntersectionIndex(route.polyline, restriction);
    const minutesToSegment = estimateMinutesToPoint(route, intersectionIndex);
    
    const timeWindowInfo = evaluateTimeWindow(
      restriction.restriction_value, 
      departureTime,
      minutesToSegment
    );

    if (timeWindowInfo.outsideWindow) {
      const severity = restriction.advisory_only ? "warning" : "critical";
      const notice = buildRestrictionNotice(
        route,
        restriction,
        severity,
        `Estimated arrival at ${timeWindowInfo.estimatedArrival ?? "unknown"} falls outside the permitted window (${restriction.restriction_value}). ${restriction.hazmat_applicability.description ?? ""}`,
      );
      return restriction.advisory_only ? { advisory: notice } : { violation: notice };
    }

    return {
      advisory: buildRestrictionNotice(
        route,
        restriction,
        "warning",
        timeWindowInfo.message,
      ),
    };
  }

  // ── Inspection checkpoints ──
  if (restriction.restriction_type === "inspection_checkpoint") {
    return {
      advisory: buildRestrictionNotice(
        route,
        restriction,
        "info",
        "Official port-of-entry screening is ahead on this corridor. Confirm permits, paperwork, and inspection readiness before crossing.",
      ),
    };
  }

  if (restriction.restriction_type === "state_review_zone") {
    return {
      advisory: buildRestrictionNotice(
        route,
        restriction,
        "warning",
        "This route enters a provisional state review corridor anchored to official permit sources. Dispatcher review is required before dispatch.",
      ),
    };
  }

  // ── Escort requirements ──
  if (
    restriction.restriction_type === "escort_requirement" &&
    requiresEscortReview({ heightFt, widthFt, lengthFt }, restriction)
  ) {
    return {
      advisory: buildRestrictionNotice(
        route,
        restriction,
        "warning",
        "Current equipment dimensions intersect an escorted corridor. Review escort, pilot-car, and permit conditions before dispatch.",
      ),
    };
  }

  return {};
}

/**
 * Evaluate whether the departure time falls within a hazmat time-window restriction.
 * Window format: "HH:MM-HH:MM" (24-hour, local time)
 */
export function evaluateTimeWindow(
  windowValue: string | number | boolean | undefined,
  departureTime?: string,
  minutesToSegment: number = 0,
): { outsideWindow: boolean; estimatedArrival?: string; message: string } {
  if (typeof windowValue !== "string" || !windowValue.includes("-")) {
    return {
      outsideWindow: false,
      message: "Hazmat routing on this segment is time-limited and requires schedule review before dispatch.",
    };
  }

  const [startStr, endStr] = windowValue.split("-");
  if (!departureTime) {
    return {
      outsideWindow: false,
      message: `Hazmat transit is only permitted ${startStr}–${endStr}. No departure time set — manual schedule review required.`,
    };
  }

  try {
    const departure = new Date(departureTime);
    const arrival = new Date(departure.getTime() + minutesToSegment * 60 * 1000);
    const arrivalMinutes = arrival.getHours() * 60 + arrival.getMinutes();
    const [startH, startM] = startStr.split(":").map(Number);
    const [endH, endM] = endStr.split(":").map(Number);
    const windowStart = startH * 60 + startM;
    const windowEnd = endH * 60 + endM;

    const insideWindow = arrivalMinutes >= windowStart && arrivalMinutes <= windowEnd;
    const arrivalStr = arrival.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

    if (insideWindow) {
      return {
        outsideWindow: false,
        estimatedArrival: arrivalStr,
        message: `Estimated arrival at ${arrivalStr} is within the permitted window (${startStr}–${endStr}). Proceed with hazmat routing.`,
      };
    }

    return {
      outsideWindow: true,
      estimatedArrival: arrivalStr,
      message: `Estimated transit at ${arrivalStr} is outside the permitted window (${startStr}–${endStr}).`,
    };
  } catch {
    return {
      outsideWindow: false,
      message: `Hazmat transit is only permitted ${startStr}–${endStr}. Schedule review required.`,
    };
  }
}

function requiresEscortReview(
  dimensions: { heightFt: number; widthFt: number; lengthFt: number },
  restriction: NormalizedRouteRestriction,
) {
  const applicability = restriction.vehicle_applicability;
  if (!applicability) return false;

  return (
    (typeof applicability.min_height_ft === "number" && dimensions.heightFt > applicability.min_height_ft) ||
    (typeof applicability.min_width_ft === "number" && dimensions.widthFt > applicability.min_width_ft) ||
    (typeof applicability.min_length_ft === "number" && dimensions.lengthFt > applicability.min_length_ft)
  );
}

function evaluateAvoidBridgeRule(
  restriction: NormalizedRouteRestriction,
  profile: RoutingProfile,
): RouteComplianceNotice | null {
  if (!restriction.rule_label || !restriction.state) return null;

  const matchedRule = profile.avoid_bridges?.find(
    (item) => item.state.toUpperCase() === restriction.state && item.rules.includes(restriction.rule_label!),
  );

  if (!matchedRule) return null;

  return {
    id: `avoid-bridge:${restriction.id}`,
    type: "avoid_bridge_rule",
    severity: "critical",
    title: `Avoid bridge rule matched: ${restriction.rule_label}`,
    message: `The active routing profile excludes bridge rule ${restriction.rule_label} in ${restriction.state}. This candidate must be rejected.`,
    sourceIds: [restriction.source_id],
    states: [restriction.state],
    restrictionIds: [restriction.id],
  };
}

function buildRestrictionNotice(
  route: GeneratedRoute,
  restriction: NormalizedRouteRestriction,
  severity: RouteNoticeSeverity,
  message: string,
): RouteComplianceNotice {
  const source = getRoutingSourceById(restriction.source_id);
  return {
    id: `${restriction.restriction_type}:${route.id}:${restriction.id}`,
    type: restriction.restriction_type,
    severity,
    title: restriction.title,
    message,
    sourceIds: source ? [source.id] : [restriction.source_id],
    states: restriction.state ? [restriction.state] : [],
    restrictionIds: [restriction.id],
  };
}

function buildRestrictionOverlay(
  route: GeneratedRoute,
  restriction: NormalizedRouteRestriction,
  violation?: RouteComplianceNotice,
  advisory?: RouteComplianceNotice,
): RouteOverlaySegment {
  const notice = violation ?? advisory;
  const source = getRoutingSourceById(restriction.source_id);
  const polyline = extractRestrictionOverlayPolyline(route.polyline, restriction);

  return {
    id: `overlay:${restriction.id}:${route.id}`,
    restrictionId: restriction.id,
    type: restriction.restriction_type,
    status: deriveOverlayStatus(violation, advisory),
    severity: violation?.severity ?? advisory?.severity ?? "info",
    title: notice?.title ?? `${restriction.title} screened`,
    message:
      notice?.message ??
      `${restriction.segment_description}. This segment was screened against ${source?.agency ?? "official"} source data.`,
    polyline,
    sourceIds: notice?.sourceIds ?? (source ? [source.id] : [restriction.source_id]),
    states: notice?.states ?? (restriction.state ? [restriction.state] : []),
  };
}

function deriveOverlayStatus(
  violation?: RouteComplianceNotice,
  advisory?: RouteComplianceNotice,
): RouteOverlayStatus {
  if (violation) return "violation";
  if (advisory) return "advisory";
  return "screened";
}

function scoreRoute(
  route: GeneratedRoute,
  advisories: RouteComplianceNotice[],
  violations: RouteComplianceNotice[],
) {
  const warningPenalty = advisories.filter((notice) => notice.severity === "warning").length * 12;
  const criticalPenalty = violations.length * 45;
  const base =
    100 -
    criticalPenalty -
    warningPenalty -
    Math.max(0, route.minutes - 600) / 60;

  return Math.max(0, Math.round(base));
}

function rerankRoutes(routes: RouteAlt[]) {
  return [...routes].sort((a, b) => {
    if (a.blocked !== b.blocked) return a.blocked ? 1 : -1;
    if (a.complianceScore !== b.complianceScore) return b.complianceScore - a.complianceScore;
    if (a.fuelCost + a.tolls !== b.fuelCost + b.tolls) return a.fuelCost + a.tolls - (b.fuelCost + b.tolls);
    return a.minutes - b.minutes;
  });
}

export function extractRestrictionOverlayPolyline(
  polyline: [number, number][],
  restriction: NormalizedRouteRestriction,
) {
  if (restriction.geometry_type === "bbox" && restriction.bbox) {
    return extractPolylineSegment(polyline, ([lat, lng], index) => {
      if (pointInBbox(lat, lng, restriction.bbox!)) return true;
      if (index < polyline.length - 1) {
        const [nextLat, nextLng] = polyline[index + 1];
        return segmentIntersectsBbox(lat, lng, nextLat, nextLng, restriction.bbox!);
      }
      return false;
    });
  }

  if (restriction.geometry_type === "polyline" && restriction.polyline) {
    const sliced = extractPolylineSegment(polyline, ([lat, lng], index) => {
      if (isPointNearPolyline(lat, lng, restriction.polyline!.coordinates, restriction.polyline!.buffer_miles)) return true;
      if (index < polyline.length - 1) {
        const p2 = polyline[index + 1];
        for (let j = 0; j < restriction.polyline!.coordinates.length - 1; j++) {
          const q1 = restriction.polyline!.coordinates[j];
          const q2 = restriction.polyline!.coordinates[j + 1];
          if (segmentsIntersect(lat, lng, p2[0], p2[1], q1.lat, q1.lng, q2.lat, q2.lng)) return true;
          // Endpoint of restriction segment near route segment
          if (pointToSegmentDistance(q1.lat, q1.lng, lat, lng, p2[0], p2[1]) <= restriction.polyline!.buffer_miles) return true;
          if (pointToSegmentDistance(q2.lat, q2.lng, lat, lng, p2[0], p2[1]) <= restriction.polyline!.buffer_miles) return true;
        }
      }
      return false;
    });

    return sliced.length > 0
      ? sliced
      : restriction.polyline.coordinates.map((point) => [point.lat, point.lng] as [number, number]);
  }

  return polyline.slice(0, Math.min(polyline.length, 2));
}

export function extractAvoidAreaOverlayPolyline(polyline: [number, number][], area: AvoidArea) {
  const ring = area.coordinates[0] ?? [];
  if (ring.length === 0) return polyline.slice(0, Math.min(polyline.length, 2));

  if (area.type === "rectangle") {
    const latitudes = ring.map((point) => point.lat);
    const longitudes = ring.map((point) => point.lng);
    const bbox = {
      min_lat: Math.min(...latitudes),
      max_lat: Math.max(...latitudes),
      min_lng: Math.min(...longitudes),
      max_lng: Math.max(...longitudes),
    };
    return extractPolylineSegment(polyline, ([lat, lng], index) => {
      if (pointInBbox(lat, lng, bbox)) return true;
      if (index < polyline.length - 1) {
        const [nextLat, nextLng] = polyline[index + 1];
        return segmentIntersectsBbox(lat, lng, nextLat, nextLng, bbox);
      }
      return false;
    });
  }

  return extractPolylineSegment(polyline, ([lat, lng], index) => {
    if (pointInPolygon({ lat, lng }, ring)) return true;
    if (index < polyline.length - 1) {
      const p2 = polyline[index + 1];
      for (let j = 0; j < ring.length; j++) {
        const q1 = ring[j];
        const q2 = ring[(j + 1) % ring.length];
        if (segmentsIntersect(lat, lng, p2[0], p2[1], q1.lat, q1.lng, q2.lat, q2.lng)) return true;
      }
    }
    return false;
  });
}

function extractPolylineSegment(
  polyline: [number, number][],
  predicate: (point: [number, number], index: number) => boolean,
) {
  let bestStart = -1;
  let bestEnd = -1;
  let currentStart = -1;

  for (let index = 0; index < polyline.length; index += 1) {
    const inside = predicate(polyline[index], index);

    if (inside && currentStart === -1) currentStart = index;

    const segmentEnded = currentStart !== -1 && (!inside || index === polyline.length - 1);
    if (!segmentEnded) continue;

    const currentEnd = inside && index === polyline.length - 1 ? index : index - 1;
    if (bestStart === -1 || currentEnd - currentStart > bestEnd - bestStart) {
      bestStart = currentStart;
      bestEnd = currentEnd;
    }
    currentStart = -1;
  }

  if (bestStart === -1 || bestEnd === -1) {
    return polyline.slice(0, Math.min(polyline.length, 2));
  }

  const start = Math.max(0, bestStart - 1);
  const end = Math.min(polyline.length - 1, bestEnd + 1);
  return polyline.slice(start, end + 1);
}

export function findFirstIntersectionIndex(
  polyline: [number, number][],
  restriction: NormalizedRouteRestriction,
): number {
  if (restriction.geometry_type === "bbox" && restriction.bbox) {
    for (let i = 0; i < polyline.length; i++) {
      const [lat, lng] = polyline[i];
      if (pointInBbox(lat, lng, restriction.bbox)) {
        return i;
      }

      if (i < polyline.length - 1) {
        const [nextLat, nextLng] = polyline[i + 1];
        const entryFraction = segmentEntryFractionToBbox(lat, lng, nextLat, nextLng, restriction.bbox);
        if (entryFraction !== null) {
          return i + entryFraction;
        }
      }
    }
  }

  if (restriction.geometry_type === "polyline" && restriction.polyline) {
    const bbox = polylineToBbox(restriction.polyline.coordinates, restriction.polyline.buffer_miles);
    if (!routeIntersectsBbox(polyline, bbox)) return 0;

    for (let i = 0; i < polyline.length - 1; i++) {
      const p1 = polyline[i];
      const p2 = polyline[i + 1];

      for (let j = 0; j < restriction.polyline.coordinates.length - 1; j++) {
        const q1 = restriction.polyline.coordinates[j];
        const q2 = restriction.polyline.coordinates[j + 1];

        if (
          segmentsIntersect(p1[0], p1[1], p2[0], p2[1], q1.lat, q1.lng, q2.lat, q2.lng) ||
          pointToSegmentDistance(p1[0], p1[1], q1.lat, q1.lng, q2.lat, q2.lng) <= restriction.polyline.buffer_miles ||
          pointToSegmentDistance(p2[0], p2[1], q1.lat, q1.lng, q2.lat, q2.lng) <= restriction.polyline.buffer_miles ||
          pointToSegmentDistance(q1.lat, q1.lng, p1[0], p1[1], p2[0], p2[1]) <= restriction.polyline.buffer_miles ||
          pointToSegmentDistance(q2.lat, q2.lng, p1[0], p1[1], p2[0], p2[1]) <= restriction.polyline.buffer_miles
        ) {
          const intersectionFraction = segmentIntersectionFraction(
            p1[0],
            p1[1],
            p2[0],
            p2[1],
            q1.lat,
            q1.lng,
            q2.lat,
            q2.lng,
          );
          return i + (intersectionFraction ?? 0.5);
        }
      }
    }
  }

  return 0;
}

export function estimateMinutesToPoint(route: GeneratedRoute, pointIndex: number): number {
  if (pointIndex <= 0) return 0;
  if (pointIndex >= route.polyline.length - 1) return route.minutes;

  let distanceToPoint = 0;
  const wholeSegments = Math.floor(pointIndex);
  const fractionalSegment = pointIndex - wholeSegments;

  for (let i = 0; i < wholeSegments; i++) {
    distanceToPoint += getHaversineDistance(
      route.polyline[i][0],
      route.polyline[i][1],
      route.polyline[i + 1][0],
      route.polyline[i + 1][1],
    );
  }

  if (fractionalSegment > 0 && wholeSegments < route.polyline.length - 1) {
    const segmentDistance = getHaversineDistance(
      route.polyline[wholeSegments][0],
      route.polyline[wholeSegments][1],
      route.polyline[wholeSegments + 1][0],
      route.polyline[wholeSegments + 1][1],
    );
    distanceToPoint += segmentDistance * fractionalSegment;
  }

  let totalPolylineDistance = distanceToPoint;
  const remainingStartIndex = fractionalSegment > 0 ? wholeSegments + 1 : wholeSegments;

  if (fractionalSegment > 0 && wholeSegments < route.polyline.length - 1) {
    const segmentDistance = getHaversineDistance(
      route.polyline[wholeSegments][0],
      route.polyline[wholeSegments][1],
      route.polyline[wholeSegments + 1][0],
      route.polyline[wholeSegments + 1][1],
    );
    totalPolylineDistance += segmentDistance * (1 - fractionalSegment);
  }

  for (let i = remainingStartIndex; i < route.polyline.length - 1; i++) {
    totalPolylineDistance += getHaversineDistance(
      route.polyline[i][0],
      route.polyline[i][1],
      route.polyline[i + 1][0],
      route.polyline[i + 1][1],
    );
  }

  if (totalPolylineDistance === 0) return 0;
  return (distanceToPoint / totalPolylineDistance) * route.minutes;
}

function crossProduct(ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

function segmentsIntersect(
  lat1: number, lng1: number, lat2: number, lng2: number,
  lat3: number, lng3: number, lat4: number, lng4: number
): boolean {
  const epsilon = 1e-9;
  const cp1 = crossProduct(lat1, lng1, lat2, lng2, lat3, lng3);
  const cp2 = crossProduct(lat1, lng1, lat2, lng2, lat4, lng4);
  const cp3 = crossProduct(lat3, lng3, lat4, lng4, lat1, lng1);
  const cp4 = crossProduct(lat3, lng3, lat4, lng4, lat2, lng2);

  if (((cp1 > 0 && cp2 < 0) || (cp1 < 0 && cp2 > 0)) &&
      ((cp3 > 0 && cp4 < 0) || (cp3 < 0 && cp4 > 0))) return true;

  if (Math.abs(cp1) <= epsilon && pointOnSegment(lat3, lng3, lat1, lng1, lat2, lng2)) return true;
  if (Math.abs(cp2) <= epsilon && pointOnSegment(lat4, lng4, lat1, lng1, lat2, lng2)) return true;
  if (Math.abs(cp3) <= epsilon && pointOnSegment(lat1, lng1, lat3, lng3, lat4, lng4)) return true;
  if (Math.abs(cp4) <= epsilon && pointOnSegment(lat2, lng2, lat3, lng3, lat4, lng4)) return true;

  return false;
}

function pointOnSegment(
  lat: number,
  lng: number,
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
) {
  const epsilon = 1e-9;
  return (
    lat >= Math.min(startLat, endLat) - epsilon &&
    lat <= Math.max(startLat, endLat) + epsilon &&
    lng >= Math.min(startLng, endLng) - epsilon &&
    lng <= Math.max(startLng, endLng) + epsilon
  );
}

function pointToSegmentDistance(
  plat: number, plng: number,
  lat1: number, lng1: number, lat2: number, lng2: number
): number {
  // 1 degree latitude = 69 miles.
  // 1 degree longitude at latitude L = 69 * cos(L) miles.
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const latFactor = 69;
  const lngFactor = 69 * Math.cos(rad(lat1));
  
  const px = plng * lngFactor;
  const py = plat * latFactor;
  const x1 = lng1 * lngFactor;
  const y1 = lat1 * latFactor;
  const x2 = lng2 * lngFactor;
  const y2 = lat2 * latFactor;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;

  if (l2 === 0) return getHaversineDistance(plat, plng, lat1, lng1);

  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));

  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;

  const closestLat = closestY / latFactor;
  const closestLng = closestX / lngFactor;

  return getHaversineDistance(plat, plng, closestLat, closestLng);
}

function isPointNearPolyline(
  lat: number, lng: number,
  poly: RouteCoordinate[],
  bufferMiles: number
): boolean {
  for (let j = 0; j < poly.length - 1; j++) {
    const q1 = poly[j];
    const q2 = poly[j + 1];
    if (pointToSegmentDistance(lat, lng, q1.lat, q1.lng, q2.lat, q2.lng) <= bufferMiles) {
      return true;
    }
  }
  return false;
}

function getHaversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8; // Miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function routeIntersectsRestriction(polyline: [number, number][], restriction: NormalizedRouteRestriction) {
  if (restriction.geometry_type === "bbox" && restriction.bbox) {
    return routeIntersectsBbox(polyline, restriction.bbox);
  }

  if (restriction.geometry_type === "polyline" && restriction.polyline) {
    const bbox = polylineToBbox(restriction.polyline.coordinates, restriction.polyline.buffer_miles);
    if (!routeIntersectsBbox(polyline, bbox)) return false;

    // Fine-grained segment-to-segment proximity check
    for (let i = 0; i < polyline.length - 1; i++) {
      const p1 = polyline[i];
      const p2 = polyline[i + 1];

      for (let j = 0; j < restriction.polyline.coordinates.length - 1; j++) {
        const q1 = restriction.polyline.coordinates[j];
        const q2 = restriction.polyline.coordinates[j + 1];

        if (segmentsIntersect(p1[0], p1[1], p2[0], p2[1], q1.lat, q1.lng, q2.lat, q2.lng)) {
          return true;
        }

        if (
          pointToSegmentDistance(p1[0], p1[1], q1.lat, q1.lng, q2.lat, q2.lng) <= restriction.polyline.buffer_miles ||
          pointToSegmentDistance(p2[0], p2[1], q1.lat, q1.lng, q2.lat, q2.lng) <= restriction.polyline.buffer_miles ||
          pointToSegmentDistance(q1.lat, q1.lng, p1[0], p1[1], p2[0], p2[1]) <= restriction.polyline.buffer_miles ||
          pointToSegmentDistance(q2.lat, q2.lng, p1[0], p1[1], p2[0], p2[1]) <= restriction.polyline.buffer_miles
        ) {
          return true;
        }
      }
    }
  }

  return false;
}

export function routeIntersectsAvoidArea(polyline: [number, number][], area: AvoidArea) {
  const ring = area.coordinates[0] ?? [];
  if (ring.length === 0) return false;

  if (area.type === "rectangle") {
    const latitudes = ring.map((point) => point.lat);
    const longitudes = ring.map((point) => point.lng);
    return routeIntersectsBbox(polyline, {
      min_lat: Math.min(...latitudes),
      max_lat: Math.max(...latitudes),
      min_lng: Math.min(...longitudes),
      max_lng: Math.max(...longitudes),
    });
  }

  // Polygon: Point inclusion + segment crossing
  for (let i = 0; i < polyline.length - 1; i++) {
    const p1 = polyline[i];
    const p2 = polyline[i + 1];

    if (pointInPolygon({ lat: p1[0], lng: p1[1] }, ring)) return true;

    for (let j = 0; j < ring.length; j++) {
      const q1 = ring[j];
      const q2 = ring[(j + 1) % ring.length];
      if (segmentsIntersect(p1[0], p1[1], p2[0], p2[1], q1.lat, q1.lng, q2.lat, q2.lng)) {
        return true;
      }
    }
  }

  const last = polyline[polyline.length - 1];
  if (last && pointInPolygon({ lat: last[0], lng: last[1] }, ring)) return true;

  return false;
}

function pointInBbox(
  lat: number,
  lng: number,
  bbox: { min_lat: number; max_lat: number; min_lng: number; max_lng: number },
) {
  return lat >= bbox.min_lat && lat <= bbox.max_lat && lng >= bbox.min_lng && lng <= bbox.max_lng;
}

function segmentEntryFractionToBbox(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  bbox: { min_lat: number; max_lat: number; min_lng: number; max_lng: number },
) {
  const x1 = lng1;
  const y1 = lat1;
  const x2 = lng2;
  const y2 = lat2;
  const dx = x2 - x1;
  const dy = y2 - y1;

  let t0 = 0;
  let t1 = 1;

  const clip = (p: number, q: number) => {
    if (Math.abs(p) <= Number.EPSILON) {
      return q >= 0;
    }

    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
      return true;
    }

    if (r < t0) return false;
    if (r < t1) t1 = r;
    return true;
  };

  if (
    !clip(-dx, x1 - bbox.min_lng) ||
    !clip(dx, bbox.max_lng - x1) ||
    !clip(-dy, y1 - bbox.min_lat) ||
    !clip(dy, bbox.max_lat - y1)
  ) {
    return null;
  }

  return t0;
}

function segmentIntersectionFraction(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  lat3: number,
  lng3: number,
  lat4: number,
  lng4: number,
) {
  const x1 = lng1;
  const y1 = lat1;
  const x2 = lng2;
  const y2 = lat2;
  const x3 = lng3;
  const y3 = lat3;
  const x4 = lng4;
  const y4 = lat4;
  const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

  if (Math.abs(denominator) <= Number.EPSILON) {
    return null;
  }

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;
  if (t < 0 || t > 1) {
    return null;
  }

  return t;
}

function routeIntersectsBbox(polyline: [number, number][], bbox: {
  min_lat: number;
  max_lat: number;
  min_lng: number;
  max_lng: number;
}) {
  // Point-in-box check (fast path)
  for (const [lat, lng] of polyline) {
    if (lat >= bbox.min_lat && lat <= bbox.max_lat && lng >= bbox.min_lng && lng <= bbox.max_lng) {
      return true;
    }
  }

  // Segment-box intersection: check if any line segment between consecutive
  // points crosses the bbox, even if neither endpoint is inside it.
  // Uses Cohen-Sutherland outcode approach.
  for (let i = 0; i < polyline.length - 1; i++) {
    if (segmentIntersectsBbox(
      polyline[i][0], polyline[i][1],
      polyline[i + 1][0], polyline[i + 1][1],
      bbox,
    )) {
      return true;
    }
  }

  return false;
}

// Cohen-Sutherland outcodes for bbox clipping
const CS_INSIDE = 0;
const CS_LEFT = 1;
const CS_RIGHT = 2;
const CS_BOTTOM = 4;
const CS_TOP = 8;

function csOutcode(
  lat: number,
  lng: number,
  bbox: { min_lat: number; max_lat: number; min_lng: number; max_lng: number },
) {
  let code = CS_INSIDE;
  if (lng < bbox.min_lng) code |= CS_LEFT;
  else if (lng > bbox.max_lng) code |= CS_RIGHT;
  if (lat < bbox.min_lat) code |= CS_BOTTOM;
  else if (lat > bbox.max_lat) code |= CS_TOP;
  return code;
}

function segmentIntersectsBbox(
  lat1: number, lng1: number, lat2: number, lng2: number,
  bbox: { min_lat: number; max_lat: number; min_lng: number; max_lng: number },
): boolean {
  let code1 = csOutcode(lat1, lng1, bbox);
  let code2 = csOutcode(lat2, lng2, bbox);
  let x1 = lng1, y1 = lat1, x2 = lng2, y2 = lat2;

  for (let iter = 0; iter < 20; iter++) {
    if ((code1 | code2) === 0) return true;   // Both inside
    if ((code1 & code2) !== 0) return false;  // Both in same outer region

    const codeOut = code1 !== 0 ? code1 : code2;
    let x: number, y: number;

    if (codeOut & CS_TOP) {
      x = x1 + ((x2 - x1) * (bbox.max_lat - y1)) / ((y2 - y1) || Number.EPSILON);
      y = bbox.max_lat;
    } else if (codeOut & CS_BOTTOM) {
      x = x1 + ((x2 - x1) * (bbox.min_lat - y1)) / ((y2 - y1) || Number.EPSILON);
      y = bbox.min_lat;
    } else if (codeOut & CS_RIGHT) {
      y = y1 + ((y2 - y1) * (bbox.max_lng - x1)) / ((x2 - x1) || Number.EPSILON);
      x = bbox.max_lng;
    } else {
      y = y1 + ((y2 - y1) * (bbox.min_lng - x1)) / ((x2 - x1) || Number.EPSILON);
      x = bbox.min_lng;
    }

    if (codeOut === code1) {
      x1 = x; y1 = y;
      code1 = csOutcode(y1, x1, bbox);
    } else {
      x2 = x; y2 = y;
      code2 = csOutcode(y2, x2, bbox);
    }
  }

  return false;
}

function pointInPolygon(
  point: { lat: number; lng: number },
  polygon: Array<{ lat: number; lng: number }>,
) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function polylineToBbox(
  points: Array<{ lat: number; lng: number }>,
  bufferMiles: number,
) {
  const latitudes = points.map((point) => point.lat);
  const longitudes = points.map((point) => point.lng);
  const latBuffer = bufferMiles / 69;
  const lngBuffer = bufferMiles / 54;
  return {
    min_lat: Math.min(...latitudes) - latBuffer,
    max_lat: Math.max(...latitudes) + latBuffer,
    min_lng: Math.min(...longitudes) - lngBuffer,
    max_lng: Math.max(...longitudes) + lngBuffer,
  };
}

function toGeneratedRoute(route: OsrmRoute, id: string): GeneratedRoute {
  const miles = route.distance / 1609.344;
  const minutes = route.duration / 60;
  const gallons = miles / MPG;

  return {
    id,
    label: "Fastest Route",
    miles,
    minutes,
    gallons,
    fuelCost: gallons * FUEL_PRICE,
    tolls: miles * TOLL_PER_MILE,
    polyline: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    legs: route.legs.map((leg) => ({
      miles: leg.distance / 1609.344,
      minutes: leg.duration / 60,
      tolls: (leg.distance / 1609.344) * TOLL_PER_MILE,
      steps: leg.steps.map((step) => toRouteStep(step)),
    })),
  };
}

function toRouteStep(step: OsrmStep): RouteStep {
  return {
    instruction:
      step.maneuver.instruction ??
      buildInstruction(step.maneuver.type, step.maneuver.modifier, step.name),
    miles: step.distance / 1609.344,
    minutes: step.duration / 60,
    roadName: step.name,
  };
}

function buildInstruction(type?: string, modifier?: string, name?: string) {
  const verbs: Record<string, string> = {
    turn: "Turn",
    "new name": "Continue on",
    depart: "Head",
    arrive: "Arrive at",
    merge: "Merge",
    "on ramp": "Take ramp",
    "off ramp": "Exit",
    fork: "Keep",
    "end of road": "Turn",
    continue: "Continue",
    roundabout: "Take roundabout",
    rotary: "Take roundabout",
  };
  const verb = verbs[type ?? "continue"] ?? "Continue";
  const modifierPart = modifier ? ` ${modifier}` : "";
  const namePart = name ? ` onto ${name}` : "";
  return `${verb}${modifierPart}${namePart}`.trim();
}

function dedupeNearDuplicates(routes: GeneratedRoute[]) {
  if (routes.length <= 1) return routes;
  const sorted = [...routes].sort((a, b) => a.minutes - b.minutes);
  const kept: GeneratedRoute[] = [sorted[0]];
  for (let index = 1; index < sorted.length; index += 1) {
    const candidate = sorted[index];
    const isDuplicate = kept.some(
      (route) =>
        Math.abs(candidate.miles - route.miles) / route.miles < 0.02 &&
        Math.abs(candidate.minutes - route.minutes) / route.minutes < 0.02,
    );
    if (!isDuplicate) kept.push(candidate);
  }
  return kept;
}

function assignLabels(routes: GeneratedRoute[]): GeneratedRoute[] {
  const fastest = [...routes].sort((a, b) => a.minutes - b.minutes)[0];
  const labeled: GeneratedRoute[] = [{ ...fastest, label: "Fastest Route" }];

  const shortest = [...routes]
    .sort((a, b) => a.miles - b.miles)
    .find((route) => route.id !== fastest.id && route.miles < fastest.miles - 0.5);
  if (shortest) labeled.push({ ...shortest, label: "Shortest Route" });

  const usedIds = new Set(labeled.map((route) => route.id));
  const fastestTotal = fastest.fuelCost + fastest.tolls;
  const economical = [...routes]
    .sort((a, b) => a.fuelCost + a.tolls - (b.fuelCost + b.tolls))
    .find(
      (route) =>
        !usedIds.has(route.id) && route.fuelCost + route.tolls < fastestTotal - 0.5,
    );
  if (economical) labeled.push({ ...economical, label: "Most Economical" });

  return labeled;
}

function straightLineMiles(stops: Array<{ latitude: number; longitude: number }>) {
  const radiusMiles = 3958.8;
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  let total = 0;

  for (let index = 1; index < stops.length; index += 1) {
    const start = stops[index - 1];
    const end = stops[index];
    const deltaLat = rad(end.latitude - start.latitude);
    const deltaLng = rad(end.longitude - start.longitude);
    const lat1 = rad(start.latitude);
    const lat2 = rad(end.latitude);
    const h =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
    total += 2 * radiusMiles * Math.asin(Math.sqrt(h));
  }

  return total;
}
