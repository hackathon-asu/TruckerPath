export type WorkStatus = "AVAILABLE" | "IN_TRANSIT" | "INACTIVE";

export type DriverType =
  | "OWNER_OPERATOR_OO"
  | "COMPANY_DRIVER_CM"
  | "LEASE_OWNER_LO"
  | "COMPANY_DRIVER_C"
  | "OTHER";

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
