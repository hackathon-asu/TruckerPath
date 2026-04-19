// FMCSA ELD mock dataset — based on provided driver/CMV/event data
// Event type 1 (Duty Status Change) codes:
//   1 = Off Duty  |  2 = Sleeper Berth  |  3 = Driving  |  4 = On Duty (Not Driving)

export interface EldDriver {
  driverId: string;      // e.g. "DRV001"
  name: string;
  initials: string;
  status: "IN_TRANSIT" | "AVAILABLE" | "INACTIVE";
  homeBase: string;
  lastSeen: string;      // relative e.g. "5m ago"
  phone: string;
  email: string;
  currentLocation: string;
  userOrderNumber: number;
}

export interface EldCmv {
  userOrderNumber: number;
  powerUnitNumber: string;  // e.g. "TRK201"
  vin: string;
}

export type EldDutyStatus = "OFF_DUTY" | "SLEEPER" | "DRIVING" | "ON_DUTY";

export interface EldEvent {
  sequenceId: string;
  date: string;          // "YYMMDD" → "260419"
  time: string;          // "HHMMSS" → "081000"
  driverId: string;
  userOrderNumber: number;
  cmvOrderNumber: number;
  eventType: number;     // 1 = duty status change
  eventCode: number;     // 1=off-duty, 2=sleeper, 3=driving, 4=on-duty
  eventStatus: number;
  eventOrigin: number;
  totalVehicleMiles: number;
  totalEngineHours: number;
  location: string;
  remarks: string;
  // Derived for display
  dutyStatus: EldDutyStatus;
  timestampMs: number;   // absolute JS timestamp (mocked relative to now)
}

// --- Driver Directory ---
export const eldDrivers: EldDriver[] = [
  {
    driverId: "DRV001",
    name: "Jordan Reyes",
    initials: "JR",
    status: "IN_TRANSIT",
    homeBase: "Phoenix Hub",
    lastSeen: "5m ago",
    phone: "602-555-0142",
    email: "jordan.reyes@fleet.example",
    currentLocation: "I-10 E, Casa Grande, AZ",
    userOrderNumber: 1,
  },
  {
    driverId: "DRV002",
    name: "Priya Shah",
    initials: "PS",
    status: "IN_TRANSIT",
    homeBase: "Utah Steel",
    lastSeen: "12m ago",
    phone: "435-555-0121",
    email: "priya.shah@fleet.example",
    currentLocation: "Cedar City, UT",
    userOrderNumber: 2,
  },
  {
    driverId: "DRV003",
    name: "Alex Novak",
    initials: "AN",
    status: "AVAILABLE",
    homeBase: "Phoenix Hub",
    lastSeen: "20m ago",
    phone: "480-555-0199",
    email: "alex.novak@fleet.example",
    currentLocation: "Tempe, AZ",
    userOrderNumber: 3,
  },
  {
    driverId: "DRV004",
    name: "Mia Okonkwo",
    initials: "MO",
    status: "AVAILABLE",
    homeBase: "Las Vegas Yard",
    lastSeen: "2h ago",
    phone: "702-555-0108",
    email: "mia.o@fleet.example",
    currentLocation: "Las Vegas, NV",
    userOrderNumber: 4,
  },
  {
    driverId: "DRV005",
    name: "Sam Chen",
    initials: "SC",
    status: "INACTIVE",
    homeBase: "Tucson Depot",
    lastSeen: "2d ago",
    phone: "520-555-0166",
    email: "sam.chen@fleet.example",
    currentLocation: "Tucson, AZ",
    userOrderNumber: 5,
  },
];

// --- CMV list ---
export const eldCmvs: EldCmv[] = [
  { userOrderNumber: 1, powerUnitNumber: "TRK201", vin: "1HGCM82633A123451" },
  { userOrderNumber: 2, powerUnitNumber: "TRK202", vin: "1FTFW1ET5EFA23452" },
  { userOrderNumber: 3, powerUnitNumber: "TRK203", vin: "1N4AL3AP8GC345653" },
  { userOrderNumber: 4, powerUnitNumber: "TRK204", vin: "2FTRX18W1XCA45674" },
  { userOrderNumber: 5, powerUnitNumber: "TRK205", vin: "3GNFK16Z96G567895" },
];

// Helper: convert "HHMMSS" offset (hours from shift start) to an absolute mock timestamp
// We anchor the "today" shift start at T-8h from now so odometer/HOS values are realistic
function shiftTs(hoursFromShiftStart: number): number {
  const SHIFT_ANCHOR = Date.now() - 8 * 3600_000; // shift started 8h ago
  return SHIFT_ANCHOR + hoursFromShiftStart * 3600_000;
}

function codeToStatus(code: number): EldDutyStatus {
  const map: Record<number, EldDutyStatus> = {
    1: "OFF_DUTY",
    2: "SLEEPER",
    3: "DRIVING",
    4: "ON_DUTY",
  };
  return map[code] ?? "OFF_DUTY";
}

// --- ELD Event list ---
// Anchored relative to now so HOS calculations are always fresh
export const eldEvents: EldEvent[] = [
  // DRV001 Jordan Reyes — on duty at shift start (8h ago), driving 7.5h ago
  {
    sequenceId: "0002",
    date: "260419", time: "074500",
    driverId: "DRV001", userOrderNumber: 1, cmvOrderNumber: 1,
    eventType: 1, eventCode: 4, eventStatus: 1, eventOrigin: 1,
    totalVehicleMiles: 148180, totalEngineHours: 4209.6,
    location: "Phoenix, AZ",
    remarks: "Jordan Reyes went on duty",
    dutyStatus: "ON_DUTY",
    timestampMs: shiftTs(0),       // on duty at shift start
  },
  {
    sequenceId: "0001",
    date: "260419", time: "081000",
    driverId: "DRV001", userOrderNumber: 1, cmvOrderNumber: 1,
    eventType: 1, eventCode: 3, eventStatus: 1, eventOrigin: 1,
    totalVehicleMiles: 148220, totalEngineHours: 4210.4,
    location: "I-10 E, Casa Grande, AZ",
    remarks: "Jordan Reyes in transit from Phoenix Hub",
    dutyStatus: "DRIVING",
    timestampMs: shiftTs(0.5),     // started driving 30min into shift
  },

  // DRV002 Priya Shah — on duty at shift start, driving 7h ago
  {
    sequenceId: "0004",
    date: "260419", time: "071500",
    driverId: "DRV002", userOrderNumber: 2, cmvOrderNumber: 2,
    eventType: 1, eventCode: 4, eventStatus: 1, eventOrigin: 1,
    totalVehicleMiles: 99172, totalEngineHours: 3011.1,
    location: "Cedar City, UT",
    remarks: "Priya Shah went on duty",
    dutyStatus: "ON_DUTY",
    timestampMs: shiftTs(0),
  },
  {
    sequenceId: "0003",
    date: "260419", time: "082500",
    driverId: "DRV002", userOrderNumber: 2, cmvOrderNumber: 2,
    eventType: 1, eventCode: 3, eventStatus: 1, eventOrigin: 1,
    totalVehicleMiles: 99210, totalEngineHours: 3011.9,
    location: "Cedar City, UT",
    remarks: "Priya Shah in transit from Utah Steel",
    dutyStatus: "DRIVING",
    timestampMs: shiftTs(1),       // started driving 1h into shift
  },

  // DRV003 Alex Novak — on duty only (no driving yet)
  {
    sequenceId: "0005",
    date: "260419", time: "080000",
    driverId: "DRV003", userOrderNumber: 3, cmvOrderNumber: 3,
    eventType: 1, eventCode: 4, eventStatus: 1, eventOrigin: 1,
    totalVehicleMiles: 120554, totalEngineHours: 3567.2,
    location: "Tempe, AZ",
    remarks: "Alex Novak available at Phoenix Hub",
    dutyStatus: "ON_DUTY",
    timestampMs: shiftTs(0),
  },

  // DRV004 Mia Okonkwo — on duty, available (2h ago = later shift start)
  {
    sequenceId: "0006",
    date: "260419", time: "060000",
    driverId: "DRV004", userOrderNumber: 4, cmvOrderNumber: 4,
    eventType: 1, eventCode: 4, eventStatus: 1, eventOrigin: 1,
    totalVehicleMiles: 87643, totalEngineHours: 2874.8,
    location: "Las Vegas, NV",
    remarks: "Mia Okonkwo available at Las Vegas Yard",
    dutyStatus: "ON_DUTY",
    timestampMs: shiftTs(0),
  },

  // DRV005 Sam Chen — off duty (2 days ago)
  {
    sequenceId: "0007",
    date: "260417", time: "090000",
    driverId: "DRV005", userOrderNumber: 5, cmvOrderNumber: 5,
    eventType: 1, eventCode: 1, eventStatus: 1, eventOrigin: 1,
    totalVehicleMiles: 110902, totalEngineHours: 3320.5,
    location: "Tucson, AZ",
    remarks: "Sam Chen off duty / inactive at Tucson Depot",
    dutyStatus: "OFF_DUTY",
    timestampMs: Date.now() - 48 * 3600_000, // 2 days ago
  },
];

// Lookup helpers
export function getDriverEvents(driverId: string): EldEvent[] {
  return eldEvents
    .filter((e) => e.driverId === driverId)
    .sort((a, b) => b.timestampMs - a.timestampMs); // newest first
}

export function getDriverCmv(userOrderNumber: number): EldCmv | undefined {
  return eldCmvs.find((c) => c.userOrderNumber === userOrderNumber);
}

export function getEldDriver(driverId: string): EldDriver | undefined {
  return eldDrivers.find((d) => d.driverId === driverId);
}
