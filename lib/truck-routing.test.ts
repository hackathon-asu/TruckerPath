import { describe, it, expect } from "vitest";
import { 
  assessRestriction, 
  evaluateTimeWindow, 
  findFirstIntersectionIndex, 
  estimateMinutesToPoint,
  GeneratedRoute,
  hereToGeneratedRoute,
  HereRoute,
} from "./truck-routing";
import { NormalizedRouteRestriction, RoutingProfile } from "./types";

const mockRoute: GeneratedRoute = {
  id: "test-route",
  label: "Fastest Route",
  miles: 100,
  minutes: 120,
  gallons: 16.6,
  fuelCost: 64,
  tolls: 1,
  polyline: [
    [40, -70],
    [41, -71],
    [42, -72],
    [43, -73],
    [44, -74],
  ],
  legs: [],
};

const mockProfile: RoutingProfile = {
  id: 1,
  name: "Test Profile",
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
  route_policy: {
    enforce_clearance_limits: true,
    enforce_hazmat_restrictions: true,
  },
};

describe("assessRestriction", () => {
  it("should return advisory for advisory-only height restriction", () => {
    const restriction: NormalizedRouteRestriction = {
      id: "res-1",
      source_id: "state-tx",
      title: "Height Advisory",
      geometry_type: "bbox",
      restriction_type: "route_height_limit",
      advisory_only: true,
      vehicle_applicability: { max_height_ft: 12 },
      segment_description: "Test segment",
      raw_text: "Test",
      verification_status: "official-source",
    };
    
    const profile = { ...mockProfile, truck_ft_height: 14 };
    const result = assessRestriction(mockRoute, restriction, profile);
    
    expect(result.violation).toBeUndefined();
    expect(result.advisory).toBeDefined();
    expect(result.advisory?.severity).toBe("warning");
  });

  it("should return violation for hard height restriction", () => {
    const restriction: NormalizedRouteRestriction = {
      id: "res-2",
      source_id: "state-md",
      title: "Hard Height Limit",
      geometry_type: "bbox",
      restriction_type: "bridge_clearance",
      advisory_only: false,
      vehicle_applicability: { max_height_ft: 12 },
      segment_description: "Test segment",
      raw_text: "Test",
      verification_status: "official-source",
    };
    
    const profile = { ...mockProfile, truck_ft_height: 14 };
    const result = assessRestriction(mockRoute, restriction, profile);
    
    expect(result.violation).toBeDefined();
    expect(result.violation?.severity).toBe("critical");
  });

  it("should return violation for hard width restriction", () => {
    const restriction: NormalizedRouteRestriction = {
      id: "res-3",
      source_id: "state-md",
      title: "Hard Width Limit",
      geometry_type: "bbox",
      restriction_type: "route_width_limit",
      advisory_only: false,
      vehicle_applicability: { max_width_ft: 10 },
      segment_description: "Test segment",
      raw_text: "Test",
      verification_status: "official-source",
    };
    
    const profile = { ...mockProfile, truck_ft_width: 12 };
    const result = assessRestriction(mockRoute, restriction, profile);
    
    expect(result.violation).toBeDefined();
    expect(result.violation?.severity).toBe("critical");
  });

  it("should return violation for hard length restriction", () => {
    const restriction: NormalizedRouteRestriction = {
      id: "res-4",
      source_id: "state-vt",
      title: "Hard Length Limit",
      geometry_type: "bbox",
      restriction_type: "route_length_limit",
      advisory_only: false,
      vehicle_applicability: { max_length_ft: 45 },
      segment_description: "Test segment",
      raw_text: "Test",
      verification_status: "official-source",
    };
    
    const profile = { ...mockProfile, truck_ft_length: 53 };
    const result = assessRestriction(mockRoute, restriction, profile);
    
    expect(result.violation).toBeDefined();
    expect(result.violation?.severity).toBe("critical");
  });

  it("should return advisory for state_review_zone", () => {
    const restriction: NormalizedRouteRestriction = {
      id: "res-review",
      source_id: "state-al",
      title: "Review Zone",
      geometry_type: "bbox",
      restriction_type: "state_review_zone",
      segment_description: "Test segment",
      raw_text: "Test",
      verification_status: "needs-review",
    };
    
    const result = assessRestriction(mockRoute, restriction, mockProfile);
    
    expect(result.violation).toBeUndefined();
    expect(result.advisory).toBeDefined();
    expect(result.advisory?.severity).toBe("warning");
  });

  it("should return advisory for advisory-only truck_prohibited", () => {
    const restriction: NormalizedRouteRestriction = {
      id: "res-prohibit-adv",
      source_id: "state-ny",
      title: "Prohibited Advisory",
      geometry_type: "bbox",
      restriction_type: "truck_prohibited",
      advisory_only: true,
      segment_description: "Test segment",
      raw_text: "Test",
      verification_status: "official-source",
    };
    
    const result = assessRestriction(mockRoute, restriction, mockProfile);
    
    expect(result.violation).toBeUndefined();
    expect(result.advisory).toBeDefined();
    expect(result.advisory?.severity).toBe("warning");
  });
});

describe("hazmat_time_window", () => {
  const restriction: NormalizedRouteRestriction = {
    id: "res-hazmat",
    source_id: "state-ca",
    title: "Hazmat Window",
    geometry_type: "bbox",
    restriction_type: "hazmat_time_window",
    restriction_value: "06:00-09:00",
    hazmat_applicability: { restricted: true, description: "Rush hour ban" },
    bbox: { min_lat: 41.5, max_lat: 42.5, min_long: -72.5, max_long: -71.5 } as any, // Simple overlap with mockRoute point [42, -72]
    segment_description: "Test segment",
    raw_text: "Test",
    verification_status: "official-source",
  };
  // Fix bbox property names if needed (types.ts uses min_lng/max_lng)
  (restriction.bbox as any) = { min_lat: 41.5, max_lat: 42.5, min_lng: -72.5, max_lng: -71.5 };

  it("should block if ETA to segment is outside window", () => {
    const departureTime = "2026-04-19T05:00:00Z"; // 5 AM
    // Point [42, -72] is the 3rd point (index 2) in mockRoute.
    // The bbox is first entered halfway through the segment from index 1 to 2.
    // Total minutes = 120, so ETA to the segment entry is ~45 minutes after departure.
    const earlyDeparture = "2026-04-19T04:00:00"; // Local time for simplicity in test
    const profile = { ...mockProfile, hazmat: true };
    const result = assessRestriction(mockRoute, restriction, profile, earlyDeparture);
    
    expect(result.violation).toBeDefined();
    expect(result.violation?.message).toContain("Estimated arrival at 04:45 falls outside the permitted window");
  });

  it("should allow if ETA to segment is inside window", () => {
    const onTimeDeparture = "2026-04-19T06:00:00"; // 6 AM + 45 min = 6:45 AM -> INSIDE 06:00-09:00
    const profile = { ...mockProfile, hazmat: true };
    const result = assessRestriction(mockRoute, restriction, profile, onTimeDeparture);
    
    expect(result.violation).toBeUndefined();
    expect(result.advisory).toBeDefined();
    expect(result.advisory?.message).toContain("Estimated arrival at 06:45 is within the permitted window");
  });
});

describe("intersection and timing", () => {
  it("should find the correct intersection index", () => {
    const restriction: NormalizedRouteRestriction = {
      id: "res-intersect",
      geometry_type: "bbox",
      bbox: { min_lat: 41.5, max_lat: 42.5, min_lng: -72.5, max_lng: -71.5 },
    } as any;
    
    const index = findFirstIntersectionIndex(mockRoute.polyline, restriction);
    expect(index).toBe(1.5); // halfway through the segment from [41, -71] to [42, -72]
  });

  it("should return a fractional intersection index when a bbox is crossed between sparse points", () => {
    const route: GeneratedRoute = {
      ...mockRoute,
      minutes: 120,
      polyline: [
        [40, -70],
        [42, -72],
      ],
    };
    const restriction: NormalizedRouteRestriction = {
      id: "res-bbox-cross",
      source_id: "state-ca",
      title: "Crossed bbox",
      geometry_type: "bbox",
      restriction_type: "hazmat_time_window",
      bbox: { min_lat: 40.9, max_lat: 41.1, min_lng: -71.1, max_lng: -70.9 },
      segment_description: "Test segment",
      raw_text: "Test",
      verification_status: "official-source",
    } as NormalizedRouteRestriction;

    const index = findFirstIntersectionIndex(route.polyline, restriction);
    expect(index).toBeGreaterThan(0);
    expect(index).toBeLessThan(1);
    expect(estimateMinutesToPoint(route, index)).toBeCloseTo(54, 0);
  });

  it("should estimate minutes to point correctly", () => {
    const index = 2;
    const minutes = estimateMinutesToPoint(mockRoute, index);
    // 5 points, 4 segments. Index 2 is after 2 segments.
    // Since segments are equal length (1 degree lat/lng), it should be exactly 50% of 120 = 60.
    expect(minutes).toBeCloseTo(60, 0);
  });
});

describe("HERE Backend Conversion", () => {
  // Simple flexible polyline for testing (represents roughly [40.0, -70.0])
  const simplePolyline = "BFoz5xJ67i1B"; 

  it("should convert a single-section HERE route into a single leg", () => {
    const hereRoute: HereRoute = {
      sections: [
        {
          summary: { length: 16093.44, duration: 600 }, // 10 miles, 10 minutes
          polyline: simplePolyline,
          turnByTurnActions: [
            {
              action: "depart",
              duration: 100,
              length: 1000,
              instruction: "Head east on Main St",
              offset: 0,
              nextRoad: { name: [{ value: "Main St", language: "en" }] }
            },
            {
              action: "turn",
              duration: 500,
              length: 15093.44,
              instruction: "Turn left onto High St",
              offset: 1,
              nextRoad: { name: [{ value: "High St", language: "en" }] }
            }
          ]
        }
      ]
    };

    const result = hereToGeneratedRoute(hereRoute, "h0");

    expect(result.legs).toHaveLength(1);
    expect(result.legs[0].miles).toBeCloseTo(10, 1);
    expect(result.legs[0].minutes).toBe(10);
    expect(result.legs[0].steps).toHaveLength(2);
    expect(result.legs[0].steps[0].instruction).toBe("Head east on Main St");
    expect(result.legs[0].steps[0].roadName).toBe("Main St");
    expect(result.legs[0].steps[1].instruction).toBe("Turn left onto High St");
    expect(result.legs[0].steps[1].roadName).toBe("High St");
  });

  it("should handle multiple HERE sections and preserve total metrics", () => {
    const hereRoute: HereRoute = {
      sections: [
        {
          summary: { length: 8046.72, duration: 300 }, // 5 miles, 5 minutes
          polyline: simplePolyline
        },
        {
          summary: { length: 8046.72, duration: 300 }, // 5 miles, 5 minutes
          polyline: simplePolyline
        }
      ]
    };

    const result = hereToGeneratedRoute(hereRoute, "h1");

    expect(result.legs).toHaveLength(2);
    expect(result.miles).toBeCloseTo(10, 1);
    expect(result.minutes).toBe(10);
    expect(result.legs[0].steps).toHaveLength(1); // Fallback step
    expect(result.legs[0].steps[0].instruction).toBe("Continue on route");
  });

  it("should support both actions and turnByTurnActions in HERE route", () => {
    const hereRoute: HereRoute = {
      sections: [
        {
          summary: { length: 16093.44, duration: 600 },
          polyline: simplePolyline,
          actions: [
            {
              action: "turn",
              duration: 100,
              length: 1000,
              instruction: "Turn from actions",
              offset: 0,
              nextRoad: { name: ["High St"] }
            }
          ]
        }
      ]
    };

    const result = hereToGeneratedRoute(hereRoute, "h2");

    expect(result.legs[0].steps[0].instruction).toBe("Turn from actions");
    expect(result.legs[0].steps[0].roadName).toBe("High St");
  });

  it("should prefer turnByTurnActions when actions is present but empty", () => {
    const hereRoute: HereRoute = {
      sections: [
        {
          summary: { length: 16093.44, duration: 600 },
          polyline: simplePolyline,
          actions: [],
          turnByTurnActions: [
            {
              action: "turn",
              duration: 100,
              length: 1000,
              instruction: "Turn from turnByTurnActions",
              offset: 0,
              nextRoad: { name: [{ value: "Broadway", language: "en" }] },
            },
          ],
        },
      ],
    };

    const result = hereToGeneratedRoute(hereRoute, "h3");

    expect(result.legs[0].steps).toHaveLength(1);
    expect(result.legs[0].steps[0].instruction).toBe("Turn from turnByTurnActions");
    expect(result.legs[0].steps[0].roadName).toBe("Broadway");
  });
});
