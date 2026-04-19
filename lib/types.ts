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
