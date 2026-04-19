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
  equipment?: string;
  weight: number; // lbs
  rate: number; // dollars
  miles: number;
  pickupWindow: { start: string; end: string }; // ISO times
  deliveryWindow: { start: string; end: string };
  shipper: string;
  receiver: string;
  status: LoadStatus;
  urgency?: "low" | "medium" | "high" | "critical";
  customer?: string;
  docsRequired?: string[];
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
  truckUnit?: string;
  vehicleId?: string;
  equipmentCompatibility?: string[];
  maintenanceScore?: number;
  maintenanceRisk?: "low" | "medium" | "high";
  csaScore?: number;
  safetyScore?: number;
  profitabilityScore?: number;
  currentFuelPercent?: number;
  mpgLoaded?: number;
  mpgEmpty?: number;
  tomorrowAvailableAt?: string;
  downstreamDependencyIds?: string[];
  eldProvider?: string;
  eldErrorCode?: string | null;
  idleSince?: string | null;
  breakdownStatus?: "none" | "investigating" | "confirmed";
  repairEtaHours?: number | null;
  readinessExplanation?: string;
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
  components?: DriverReadinessBreakdown[];
}

export interface DispatchRecommendation {
  loadId: string;
  rankedDrivers: RankedDriver[];
  bestDriver: RankedDriver | null;
  confidenceScore: number; // 0-100
  explanation: string;
  generatedAt?: string;
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

export type DriverReadinessFactorKey =
  | "deadhead"
  | "hos"
  | "trip_time"
  | "equipment"
  | "maintenance"
  | "tomorrow_impact"
  | "stranded_risk"
  | "fuel_plan"
  | "parking_viability";

export interface DriverReadinessBreakdown {
  key: DriverReadinessFactorKey;
  label: string;
  weight: number;
  rawScore: number;
  weightedScore: number;
  explanation: string;
}

export type DashboardKpiKey =
  | "trucks_on_road"
  | "loads_today"
  | "on_time_rate"
  | "revenue_today"
  | "cost_per_mile"
  | "open_loads";

export type DispatcherMode = "demo" | "live";

export interface DashboardKpi {
  key: DashboardKpiKey;
  label: string;
  value: string;
  rawValue: number;
  change: string;
  tone: "neutral" | "positive" | "warning" | "critical";
}

export interface EntityRef {
  type: "driver" | "load" | "trip" | "customer" | "vehicle" | "facility";
  id: string;
  label: string;
}

export interface DispatcherTask {
  id: string;
  category: "urgent" | "alerts" | "ai";
  title: string;
  whyItMatters: string;
  severity: "urgent" | "attention" | "healthy";
  effortMinutes: number;
  confidence?: number;
  tags: string[];
  related: EntityRef[];
  primaryCta: string;
  primaryAction:
    | "assign"
    | "message"
    | "reroute"
    | "review"
    | "resolve"
    | "open_driver"
    | "open_load"
    | "open_trip"
    | "open_docs";
  operationalReasons: string[];
  status: "open" | "snoozed" | "dismissed" | "completed";
}

export interface OperationalAlert {
  id: string;
  scope: "dispatcher" | "driver";
  type:
    | "reroute"
    | "delay"
    | "detention"
    | "weather"
    | "road_closure"
    | "law_change"
    | "market_surge"
    | "downstream_impact"
    | "idle_stop"
    | "breakdown"
    | "eld_sync"
    | "doc_missing";
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  related: EntityRef[];
  actionLabel: string;
  draftMessage?: string;
  status: "new" | "acknowledged" | "snoozed";
  effectiveDate?: string;
  sourceUrl?: string;
}

export interface RouteChoice {
  id: string;
  label: "Cheapest" | "Fastest" | "Shortest" | "Recommended";
  miles: number;
  etaMinutes: number;
  fuelCost: number;
  tolls: number;
  fuelPartnerSavings: number;
  leftoverHosHours: number;
  parkingViability: number;
  legalityScore: number;
  weatherRisk: "low" | "medium" | "high";
  closureRisk: "low" | "medium" | "high";
  detentionSensitivity: "low" | "medium" | "high";
  lastMileConfidence: number;
  permitted: boolean;
  stateWarnings: string[];
  explanation: string;
}

export interface DriverProfileStat {
  label: string;
  value: string;
  tone?: "default" | "good" | "warning" | "danger";
}

export interface DriverInsight {
  summary: string;
  recommendations: string[];
  readyForOtrNow: boolean;
  readyExplanation: string;
}

export interface OperationsDriverProfile {
  bio: string;
  phone: string;
  email: string;
  historicalTrips: string[];
  incidents: string[];
  hosTrend: string;
  fuelEfficiency: string;
  averageTripDuration: string;
  averageMargin: string;
  safetyStats: string[];
  inspections: string[];
  violations: string[];
  overview: DriverInsight;
  futureCommitments: string[];
}

export interface OperationsDriver {
  id: string;
  firstName: string;
  lastName: string;
  unit: string;
  truckType: string;
  terminal: string;
  status: "active" | "available" | "detained" | "maintenance" | "breakdown";
  currentCity: string;
  currentLat: number;
  currentLng: number;
  currentRoute: string;
  currentLoadId?: string;
  currentTripId?: string;
  hosRemainingHours: number;
  deadheadMiles: number;
  readinessScore: number;
  maintenanceScore: number;
  csaScore: number;
  profitabilityScore: number;
  currentFuelPercent: number;
  mpgLoaded: number;
  mpgEmpty: number;
  maintenanceRisk: "low" | "medium" | "high";
  downstreamImpact: string;
  eldProvider: string;
  eldErrorCode?: string;
  idleSince?: string;
  breakdownStatus: "none" | "investigating" | "confirmed";
  repairEtaHours?: number;
  readinessBreakdown: DriverReadinessBreakdown[];
  profile: OperationsDriverProfile;
}

export interface OperationsVehicle {
  id: string;
  unit: string;
  equipment: string;
  status: "active" | "available" | "maintenance" | "breakdown";
  assignedDriverId?: string;
  currentFuelPercent: number;
  maintenanceScore: number;
  mpgLoaded: number;
  mpgEmpty: number;
}

export interface TripTimelineEvent {
  id: string;
  label: string;
  timestamp: string;
  tone: "default" | "warning" | "danger" | "good";
}

export interface CurrentTrip {
  id: string;
  driverId: string;
  driverName: string;
  truckUnit: string;
  loadId: string;
  origin: string;
  destination: string;
  liveHosHours: number;
  liveEta: string;
  routeHealth: "healthy" | "watch" | "risk";
  fuelStatus: string;
  parkingStopPlan: string;
  detentionState: string;
  alertCount: number;
  routeOptionsSummary: string[];
  timeline: TripTimelineEvent[];
  weatherIncidents: string[];
  detentionClockMinutes: number;
  customerSlaRisk: string;
  downstreamImpact: string;
  nudgesSent: string[];
  lastMilePlan: string;
  routeChoices: RouteChoice[];
}

export interface LoadBoardRecord {
  id: string;
  lane: string;
  origin: string;
  destination: string;
  pickupWindow: string;
  deliveryWindow: string;
  equipment: string;
  miles: number;
  rate: number;
  assignedDriverId?: string;
  urgency: "low" | "medium" | "high" | "critical";
  bestMatchDriverId?: string;
  bestMatchDriverName?: string;
  marginProjection: number;
  docsRequired: string[];
  detentionTerms: string;
  aiAssignmentRecommendation: string;
  customer: string;
  routeChoices: RouteChoice[];
}

export interface LastMileInsight {
  facilityId: string;
  facilityName: string;
  recommendedEntrance: string;
  parkingArea: string;
  avoidNotes: string[];
  confidence: number;
  reasoning: string;
  imageRefs: string[];
}

export interface DetentionCase {
  id: string;
  loadId: string;
  tripId: string;
  facility: string;
  minutes: number;
  clockState: string;
  invoiceDraftReady: boolean;
  aiAlternatives: string[];
  tomorrowImpact: string;
  marginImpact: string;
}

export interface CostTrendPoint {
  label: string;
  revenue: number;
  margin: number;
  costPerMile: number;
}

export interface SafetyCase {
  id: string;
  title: string;
  status: string;
  owner: string;
  dueText: string;
}

export interface DocumentBillingCase {
  id: string;
  loadId: string;
  driverName: string;
  customer: string;
  missingDocs: string[];
  reconciliationStatus: "blocked" | "review" | "approved";
  invoiceMatchConfidence: number;
  aiExplanation: string;
}

export interface RepairShopOption {
  id: string;
  name: string;
  city: string;
  distanceMiles: number;
  capability: string;
}

export interface DispatcherSnapshot {
  mode: DispatcherMode;
  modeNotice: string | null;
  greeting: string;
  fleetHeadline: string;
  lastRefresh: string;
  kpis: DashboardKpi[];
  urgentBand: OperationalAlert[];
  tasks: DispatcherTask[];
  drivers: OperationsDriver[];
  vehicles: OperationsVehicle[];
  trips: CurrentTrip[];
  loads: LoadBoardRecord[];
  alerts: OperationalAlert[];
  detentions: DetentionCase[];
  lastMileInsights: LastMileInsight[];
  documentCases: DocumentBillingCase[];
  safetyCases: SafetyCase[];
  repairShops: RepairShopOption[];
  costTrend: CostTrendPoint[];
}
