import type {
  RouteRestrictionType,
  RoutingConfidence,
  RoutingCoverageLevel,
  RoutingProfile,
} from "./types";

export type RouteLabel = "Fastest Route" | "Shortest Route" | "Most Economical" | "Alternative Route" | string;
export type RoutingBackendName = "osrm" | "here";
export type RouteBasis = "generic-driving" | "federal-backbone-screened" | "state-overlay-screened";
export type RouteNoticeSeverity = "info" | "warning" | "critical";
export type RouteOverlayStatus = "screened" | "advisory" | "violation";

export interface RouteCalcStop {
  latitude: number;
  longitude: number;
}

export interface RouteCalcRequest {
  stops: RouteCalcStop[];
  profile?: RoutingProfile;
  departure_time?: string; // ISO-8601 — used for time-window restriction evaluation
}

export interface RouteComplianceNotice {
  id: string;
  type: RouteRestrictionType | "coverage";
  severity: RouteNoticeSeverity;
  title: string;
  message: string;
  sourceIds: string[];
  states: string[];
  restrictionIds: string[];
}

export interface RouteOverlaySegment {
  id: string;
  restrictionId?: string;
  type: RouteRestrictionType;
  status: RouteOverlayStatus;
  severity: RouteNoticeSeverity;
  title: string;
  message: string;
  polyline: [number, number][];
  sourceIds: string[];
  states: string[];
}

export interface RouteStep {
  instruction: string;
  miles: number;
  minutes: number;
  roadName?: string;
}

export interface RouteLeg {
  miles: number;
  minutes: number;
  tolls: number;
  steps: RouteStep[];
}

export interface RouteAlt {
  id: string;
  label: RouteLabel;
  miles: number;
  minutes: number;
  gallons: number;
  fuelCost: number;
  tolls: number;
  polyline: [number, number][];
  legs: RouteLeg[];
  backend: RoutingBackendName;
  routeBasis: RouteBasis;
  coverageLevel: RoutingCoverageLevel;
  screeningConfidence: RoutingConfidence;
  complianceScore: number;
  blocked: boolean;
  screenedRestrictionIds: string[];
  violations: RouteComplianceNotice[];
  advisories: RouteComplianceNotice[];
  overlays: RouteOverlaySegment[];
}
