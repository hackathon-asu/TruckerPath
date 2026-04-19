export type WorkStatus = "AVAILABLE" | "IN_TRANSIT" | "INACTIVE";

export type DriverType =
  | "OWNER_OPERATOR_OO"
  | "COMPANY_DRIVER_CM"
  | "LEASE_OWNER_LO"
  | "COMPANY_DRIVER_C"
  | "OTHER";

export interface RouteCoordinate {
  lat: number;
  lng: number;
}

export interface AvoidArea {
  area_name: string;
  type: "rectangle" | "polygon";
  coordinates: RouteCoordinate[][];
}

export interface AvoidBridgeRule {
  state: string;
  rules: string[];
}

export interface RoutePolicy {
  enforce_permitted_network?: boolean;
  enforce_hazmat_restrictions?: boolean;
  enforce_clearance_limits?: boolean;
}

export type RoutingSourceJurisdiction = "federal" | "state";
export type RoutingSourceType =
  | "statute"
  | "map"
  | "dataset"
  | "registry"
  | "state-dot-portal"
  | "arcgis-service"
  | "pdf";
export type RoutingIngestionMethod =
  | "federal-baseline"
  | "state-portal"
  | "structured-geometry"
  | "pdf-extraction"
  | "manual-review";
export type RoutingCoverageLevel = "generic-only" | "federal-only" | "state-overlay-screened";
export type RoutingConfidence = "low" | "medium" | "high";
export type RouteRestrictionType =
  | "federal_network"
  | "bridge_clearance"
  | "bridge_weight"
  | "tunnel_clearance"
  | "tunnel_hazmat"
  | "state_hazmat"
  | "route_height_limit"
  | "route_weight_limit"
  | "route_width_limit"
  | "route_length_limit"
  | "truck_prohibited"
  | "hazmat_time_window"
  | "inspection_checkpoint"
  | "state_review_zone"
  | "escort_requirement"
  | "avoid_area"
  | "avoid_bridge_rule";
export type RestrictionVerificationStatus =
  | "official-source"
  | "normalized-reviewed"
  | "needs-review";
export type RestrictionGeometryType = "bbox" | "polyline";

export interface RoutingSourceRegistryEntry {
  id: string;
  jurisdiction_level: RoutingSourceJurisdiction;
  state?: string;
  agency: string;
  title: string;
  source_url: string;
  source_type: RoutingSourceType;
  publish_date?: string;
  effective_date?: string;
  last_checked_at: string;
  ingestion_method: RoutingIngestionMethod;
  notes?: string;
}

export interface RouteRestrictionVehicleApplicability {
  min_height_ft?: number;
  max_height_ft?: number;
  min_weight_lb?: number;
  max_weight_lb?: number;
  max_width_ft?: number;
  min_width_ft?: number;
  max_length_ft?: number;
  min_length_ft?: number;
  max_trailers?: number;
  min_axles?: number;
}

export interface RouteRestrictionHazmatApplicability {
  restricted: boolean;
  description?: string;
}

export interface RouteRestrictionBoundingBox {
  min_lat: number;
  max_lat: number;
  min_lng: number;
  max_lng: number;
}

export interface RouteRestrictionPolylineGeometry {
  coordinates: RouteCoordinate[];
  buffer_miles: number;
}

export interface NormalizedRouteRestriction {
  id: string;
  source_id: string;
  state?: string;
  title: string;
  route_id?: string;
  geometry_type: RestrictionGeometryType;
  segment_description: string;
  begin_mp?: number;
  end_mp?: number;
  restriction_type: RouteRestrictionType;
  restriction_value?: number | string | boolean;
  restriction_units?: string;
  applies_to_vehicle_class?: "all-trucks" | "hazmat" | "oversize" | "overweight" | "custom";
  vehicle_applicability?: RouteRestrictionVehicleApplicability;
  hazmat_applicability?: RouteRestrictionHazmatApplicability;
  directionality?: "both" | "forward" | "reverse";
  permit_required?: boolean;
  local_approval_required?: boolean;
  raw_text: string;
  verification_status: RestrictionVerificationStatus;
  bbox?: RouteRestrictionBoundingBox;
  polyline?: RouteRestrictionPolylineGeometry;
  rule_label?: string;
  advisory_only?: boolean;
}

export interface Driver {
  driver_id: number;
  driver_first_name: string;
  driver_last_name: string;
  driver_phone_number?: string;
  driver_email?: string;
  carrier?: string;
  work_status: WorkStatus;
  driver_owner?: string;
  terminal?: string;
  driver_type?: DriverType;
  last_known_location?: string;
  latest_update?: number;
}

export interface RoutingProfile {
  id: number;
  name: string;
  truck_ft_length: number;
  truck_in_length: number;
  truck_ft_width: number;
  truck_in_width: number;
  truck_ft_height: number;
  truck_in_height: number;
  weight_limit: number;
  weight_per_axle: number;
  axles: number;
  trailers: number;
  hazmat?: boolean;
  avoid_areas?: AvoidArea[];
  avoid_bridges?: AvoidBridgeRule[];
  route_policy?: RoutePolicy;
}

export interface StopPoint {
  id: string;
  latitude: number;
  longitude: number;
  address_name: string;
  appointment_time?: string;
  dwell_time?: number;
  notes?: string;
}

export interface Trip {
  trip_id: string;
  scheduled_start_time: string;
  stop_points: StopPoint[];
  driver_id?: number;
  routing_profile_id?: number;
  total_miles?: number;
  total_minutes?: number;
  tolls?: number;
  fuel_gal?: number;
}

export interface Vehicle {
  vehicle_id: number;
  vehicle_name: string;
  vehicle_plate?: string;
  status: "ACTIVE" | "INACTIVE";
  assigned_driver?: string;
}

export interface Terminal {
  terminal_id: number;
  terminal_name: string;
  location?: string;
  member_count?: number;
}

export interface PoiInfo {
  poi_id: number;
  name: string;
  latitude: number;
  longitude: number;
  type: string;
}

export interface ApiEnvelope<T> {
  code: number;
  success: boolean;
  msg?: string;
  data?: T;
}

// ─── Dispatcher CoPilot Domain Types ────────────────────────────

export type LoadStatus = "pending" | "assigned" | "in_transit" | "delivered" | "cancelled";

export interface Load {
  id: string;
  origin: { lat: number; lng: number; name: string };
  destination: { lat: number; lng: number; name: string };
  commodity: string;
  weight: number; // lbs
  rate: number; // dollars
  miles: number;
  pickupWindow: { start: string; end: string }; // ISO times
  deliveryWindow: { start: string; end: string };
  shipper: string;
  receiver: string;
  status: LoadStatus;
  assignedDriverId?: number;
  notes?: string;
}

export interface DispatchDriver {
  driverId: number;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  terminal: string;
  currentLat: number;
  currentLng: number;
  currentCity: string;
  hosRemaining: number; // hours
  hosDriveRemaining: number; // hours
  status: WorkStatus;
  readiness: "immediate" | "30min" | "1hr" | "unavailable";
  truckType: string;
  costPerMile: number;
}

export interface ParkingStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  city: string;
  type: "truck_stop" | "rest_area" | "private";
  totalSpaces: number;
  occupancyPercent: number; // 0-100
  reservable: boolean;
  amenities: string[];
  milesFromOrigin: number; // along-route distance from trip origin
}

export interface DetentionEvent {
  id: string;
  loadId: string;
  location: "pickup" | "delivery";
  facilityName: string;
  delayMinutes: number;
  startedAt: string; // ISO
  costPerHour: number;
}

export type AlertSeverity = "info" | "warning" | "critical";
export type AlertType =
  | "detention_delay"
  | "parking_risk"
  | "hos_violation_risk"
  | "traffic_delay"
  | "better_driver"
  | "detention_cost"
  | "late_delivery_risk"
  | "eta_update";

export interface CopilotAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  loadId?: string;
  driverId?: number;
  timestamp: string; // ISO
  actionLabel?: string;
  dismissed: boolean;
}

export interface RankedDriver {
  driver: DispatchDriver;
  score: number; // 0-100
  deadheadMiles: number;
  deadheadMinutes: number;
  etaToPickup: string; // ISO
  etaToDelivery: string; // ISO
  tripFeasible: boolean;
  hosAfterTrip: number; // remaining hours
  estimatedCost: number;
  reasoning: string;
}

export interface DispatchRecommendation {
  loadId: string;
  rankedDrivers: RankedDriver[];
  bestDriver: RankedDriver | null;
  confidenceScore: number; // 0-100
  explanation: string;
}

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface ParkingRiskResult {
  loadId: string;
  primaryStop: ParkingStop | null;
  backupStop: ParkingStop | null;
  riskLevel: RiskLevel;
  arrivalTime: string; // ISO — when driver would arrive at primary stop
  reserveRecommendation: boolean;
  explanation: string;
}

export interface DetentionImpactResult {
  loadId: string;
  originalEta: string;
  updatedEta: string;
  delayMinutes: number;
  onTimeFeasible: boolean;
  hosImpact: {
    before: number;
    after: number;
    violationRisk: boolean;
  };
  parkingImpact: {
    previousRisk: RiskLevel;
    newRisk: RiskLevel;
    primaryStillViable: boolean;
    suggestedBackup: ParkingStop | null;
  };
  notifyCustomer: boolean;
  considerRelay: boolean;
  costImpact: {
    detentionCost: number;
    additionalFuel: number;
    totalAdded: number;
  };
  explanation: string;
}

export interface CostBreakdown {
  fuelEstimate: number;
  tollEstimate: number;
  deadheadCost: number;
  detentionCost: number;
  laborCost: number;
  totalCost: number;
  revenue: number;
  estimatedMargin: number;
  costPerMile: number;
}
