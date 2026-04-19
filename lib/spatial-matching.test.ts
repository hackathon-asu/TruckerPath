import { describe, it, expect } from "vitest";
import { 
  routeIntersectsRestriction, 
  routeIntersectsAvoidArea,
  extractRestrictionOverlayPolyline,
  extractAvoidAreaOverlayPolyline
} from "./truck-routing";
import { NormalizedRouteRestriction, AvoidArea } from "./types";

describe("Precise Spatial Matching", () => {
  const routePolyline: [number, number][] = [
    [40.0, -70.0],
    [41.0, -71.0],
  ];

  describe("Polygon Avoid Areas (Segment Crossing)", () => {
    it("should detect a route crossing a polygon even if no sampled points are inside", () => {
      // A thin polygon that crosses the segment [40, -70] to [41, -71]
      // The segment passes through [40.5, -70.5]
      const area: AvoidArea = {
        area_name: "Thin Cross",
        type: "polygon",
        coordinates: [[
          { lat: 40.4, lng: -70.6 },
          { lat: 40.6, lng: -70.6 },
          { lat: 40.6, lng: -70.4 },
          { lat: 40.4, lng: -70.4 },
        ]]
      };
      
      // Traditional point-in-polygon would fail here because [40, -70] and [41, -71] are outside
      expect(routeIntersectsAvoidArea(routePolyline, area)).toBe(true);
    });

    it("should extract the correct overlay for a crossed polygon", () => {
      const area: AvoidArea = {
        area_name: "Thin Cross",
        type: "polygon",
        coordinates: [[
          { lat: 40.4, lng: -70.6 },
          { lat: 40.6, lng: -70.6 },
          { lat: 40.6, lng: -70.4 },
          { lat: 40.4, lng: -70.4 },
        ]]
      };
      
      const overlay = extractAvoidAreaOverlayPolyline(routePolyline, area);
      // It should include at least the segment that crosses
      expect(overlay.length).toBeGreaterThanOrEqual(2);
      expect(overlay[0]).toEqual([40.0, -70.0]);
      expect(overlay[overlay.length - 1]).toEqual([41.0, -71.0]);
    });
  });

  describe("BBox and Rectangle Overlay Extraction", () => {
    it("should anchor bbox overlays to the crossed segment instead of the route fallback slice", () => {
      const longRoute: [number, number][] = [
        [40.0, -70.0],
        [41.0, -71.0],
        [42.0, -72.0],
      ];
      const bboxRestriction: NormalizedRouteRestriction = {
        id: "bbox-cross",
        source_id: "test",
        title: "Crossed bbox",
        geometry_type: "bbox",
        restriction_type: "truck_prohibited",
        bbox: {
          min_lat: 41.4,
          max_lat: 41.6,
          min_lng: -71.6,
          max_lng: -71.4,
        },
        segment_description: "Test",
        raw_text: "Test",
        verification_status: "official-source",
      };

      const overlay = extractRestrictionOverlayPolyline(longRoute, bboxRestriction);

      expect(overlay).toEqual([
        [40.0, -70.0],
        [41.0, -71.0],
        [42.0, -72.0],
      ]);
    });

    it("should anchor rectangle avoid-area overlays to the crossed segment", () => {
      const longRoute: [number, number][] = [
        [40.0, -70.0],
        [41.0, -71.0],
        [42.0, -72.0],
      ];
      const area: AvoidArea = {
        area_name: "Rectangle Cross",
        type: "rectangle",
        coordinates: [[
          { lat: 41.4, lng: -71.6 },
          { lat: 41.6, lng: -71.6 },
          { lat: 41.6, lng: -71.4 },
          { lat: 41.4, lng: -71.4 },
        ]],
      };

      const overlay = extractAvoidAreaOverlayPolyline(longRoute, area);

      expect(overlay).toEqual([
        [40.0, -70.0],
        [41.0, -71.0],
        [42.0, -72.0],
      ]);
    });
  });

  describe("Polyline Restrictions (Proximity & Buffer)", () => {
    const restriction: NormalizedRouteRestriction = {
      id: "polyline-res",
      source_id: "test",
      title: "Polyline Restriction",
      geometry_type: "polyline",
      restriction_type: "truck_prohibited",
      polyline: {
        coordinates: [
          { lat: 40.5, lng: -70.0 },
          { lat: 40.5, lng: -71.0 },
        ],
        buffer_miles: 5,
      },
      segment_description: "Test",
      raw_text: "Test",
      verification_status: "official-source",
    };

    it("should match a route that passes within the buffer of a restriction polyline", () => {
      // The route goes from [40, -70] to [41, -71].
      // It crosses the line lat=40.5 at lng=-70.5.
      // The restriction is at lat=40.5 from lng=-70 to -71.
      // They intersect at [40.5, -70.5].
      expect(routeIntersectsRestriction(routePolyline, restriction)).toBe(true);
    });

    it("should not match a route that is outside the buffer", () => {
      const farRoute: [number, number][] = [
        [42.0, -70.0],
        [43.0, -71.0],
      ];
      expect(routeIntersectsRestriction(farRoute, restriction)).toBe(false);
    });

    it("should extract the correct overlay for a polyline restriction", () => {
      const overlay = extractRestrictionOverlayPolyline(routePolyline, restriction);
      expect(overlay.length).toBeGreaterThanOrEqual(2);
      expect(overlay[0]).toEqual([40.0, -70.0]);
      expect(overlay[overlay.length - 1]).toEqual([41.0, -71.0]);
    });

    it("should match when the route touches the restriction at an endpoint", () => {
      const endpointRestriction: NormalizedRouteRestriction = {
        ...restriction,
        polyline: {
          coordinates: [
            { lat: 41.0, lng: -71.0 },
            { lat: 42.0, lng: -72.0 },
          ],
          buffer_miles: 0,
        },
      };

      expect(routeIntersectsRestriction(routePolyline, endpointRestriction)).toBe(true);
    });
  });

  describe("BBox Restrictions (Regression)", () => {
    const bboxRestriction: NormalizedRouteRestriction = {
      id: "bbox-res",
      source_id: "test",
      title: "BBox Restriction",
      geometry_type: "bbox",
      restriction_type: "truck_prohibited",
      bbox: {
        min_lat: 40.4,
        max_lat: 40.6,
        min_lng: -70.6,
        max_lng: -70.4,
      },
      segment_description: "Test",
      raw_text: "Test",
      verification_status: "official-source",
    };

    it("should still match bbox restrictions correctly", () => {
      expect(routeIntersectsRestriction(routePolyline, bboxRestriction)).toBe(true);
    });
  });
});
