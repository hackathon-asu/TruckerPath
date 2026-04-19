import type {
  AlertType,
  CopilotAlert,
  DispatchDriver,
  Load,
  LoadStatus,
  ParkingStop,
} from "./types";

type JsonLocation = {
  lat?: number | string;
  lng?: number | string;
  name?: string;
} | null;

type JsonWindow = {
  start?: string;
  end?: string;
} | null;

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function mapLocation(location: JsonLocation, fallbackName: string) {
  return {
    lat: asNumber(location?.lat),
    lng: asNumber(location?.lng),
    name: asString(location?.name, fallbackName),
  };
}

function mapWindow(window: JsonWindow) {
  return {
    start: asString(window?.start, new Date().toISOString()),
    end: asString(window?.end, new Date().toISOString()),
  };
}

export function mapLoadRow(row: Record<string, unknown>): Load {
  return {
    id: asString(row.id),
    origin: mapLocation((row.origin as JsonLocation) ?? null, "Unknown origin"),
    destination: mapLocation((row.destination as JsonLocation) ?? null, "Unknown destination"),
    commodity: asString(row.commodity, "Unspecified"),
    weight: asNumber(row.weight),
    rate: asNumber(row.rate),
    miles: asNumber(row.miles),
    pickupWindow: mapWindow((row.pickup_window as JsonWindow) ?? null),
    deliveryWindow: mapWindow((row.delivery_window as JsonWindow) ?? null),
    shipper: asString(row.shipper),
    receiver: asString(row.receiver),
    status: asString(row.status, "pending") as LoadStatus,
    assignedDriverId:
      row.assigned_driver_id === null || row.assigned_driver_id === undefined
        ? undefined
        : asNumber(row.assigned_driver_id),
    notes: asString(row.notes) || undefined,
  };
}

export function mapDriverRow(row: Record<string, unknown>): DispatchDriver {
  return {
    driverId: asNumber(row.driver_id),
    firstName: asString(row.first_name),
    lastName: asString(row.last_name),
    phone: asString(row.phone) || undefined,
    email: asString(row.email) || undefined,
    terminal: asString(row.terminal),
    currentLat: asNumber(row.current_lat),
    currentLng: asNumber(row.current_lng),
    currentCity: asString(row.current_city),
    hosRemaining: asNumber(row.hos_remaining),
    hosDriveRemaining: asNumber(row.hos_drive_remaining),
    status: asString(row.status, "INACTIVE") as DispatchDriver["status"],
    readiness: asString(row.readiness, "unavailable") as DispatchDriver["readiness"],
    truckType: asString(row.truck_type),
    costPerMile: asNumber(row.cost_per_mile),
  };
}

export function mapParkingStopRow(row: Record<string, unknown>): ParkingStop {
  return {
    id: asString(row.id),
    name: asString(row.name),
    lat: asNumber(row.lat),
    lng: asNumber(row.lng),
    city: asString(row.city),
    type: asString(row.type, "truck_stop") as ParkingStop["type"],
    totalSpaces: asNumber(row.total_spaces),
    occupancyPercent: asNumber(row.occupancy_percent),
    reservable: asBoolean(row.reservable),
    amenities: Array.isArray(row.amenities)
      ? row.amenities.map((item) => asString(item)).filter(Boolean)
      : [],
    milesFromOrigin: asNumber(row.miles_from_origin),
  };
}

export function mapAlertRow(row: Record<string, unknown>): CopilotAlert {
  return {
    id: asString(row.id),
    type: asString(row.type, "eta_update") as AlertType,
    severity: asString(row.severity, "info") as CopilotAlert["severity"],
    title: asString(row.title),
    message: asString(row.message),
    loadId: asString(row.load_id) || undefined,
    driverId:
      row.driver_id === null || row.driver_id === undefined ? undefined : asNumber(row.driver_id),
    timestamp: asString(row.timestamp, new Date().toISOString()),
    actionLabel: asString(row.action_label) || undefined,
    dismissed: asBoolean(row.dismissed),
  };
}
