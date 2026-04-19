export type PoiCategory = "truck_parking" | "weigh_station" | "fuel" | "rest_area";

export interface RoutePoi {
  id: string;
  name: string;
  category: PoiCategory;
  latitude: number;
  longitude: number;
  routeMile: number;
  offRouteMiles: number;
  rating: number;
  status: "FULL" | "SOME" | "MANY" | "OPEN" | "AVAILABLE";
  lastReportedMinutesAgo: number;
  pumpPrice?: number;
  address: string;
}

const FUEL_BRANDS = ["Pilot Travel Center", "Loves Travel Stop", "TA Travel Center", "Flying J", "QuikTrip", "Sheetz MT JACKSON"];
const REST_NAMES = ["Manassas Safety Rest Area", "Rest Area EB", "Truck Rest Area", "Broadway Rest Area"];
const PARKING_NAMES = ["Smiley's Travel Center", "Petro Raphine", "7-Eleven", "Circle K Truck Parking"];
const WEIGH_NAMES = [
  "SB Troutville Weigh Station",
  "NB Troutville Weigh Station",
  "NB Roanoke Weigh Station",
  "TN DOT I-81 SB Weigh station",
  "EB Knoxville Weigh Station",
];

const STATE_HINTS = ["VA", "WV", "TN", "KY", "MD", "NC", "PA", "OH", "GA"];

export function generatePoisAlongRoute(polyline: [number, number][], totalMiles: number): RoutePoi[] {
  if (polyline.length < 2 || totalMiles < 10) return [];
  const pois: RoutePoi[] = [];
  const step = Math.max(30, totalMiles / 40); // ~30-100mi gaps
  let mileCursor = 20;
  let idx = 0;

  while (mileCursor < totalMiles - 10 && pois.length < 120) {
    const frac = mileCursor / totalMiles;
    const pt = samplePolyline(polyline, frac);
    if (!pt) break;
    const [lat, lng] = pt;

    // rotate categories
    const rotation: PoiCategory[] = ["fuel", "truck_parking", "weigh_station", "rest_area", "fuel", "truck_parking"];
    const category = rotation[idx % rotation.length];

    pois.push(buildPoi(idx, category, lat, lng, mileCursor));

    // weigh stations are rarer — skip some
    const jitter = 0.6 + Math.random() * 0.8;
    mileCursor += step * jitter;
    idx++;
  }
  return pois;
}

function buildPoi(idx: number, category: PoiCategory, lat: number, lng: number, routeMile: number): RoutePoi {
  const rand = pseudoRand(idx);
  const state = STATE_HINTS[Math.floor(rand * STATE_HINTS.length)];
  const offRouteMiles = Math.round(rand * 30) / 100; // 0.00 - 0.30
  const rating = Math.round((2 + rand * 3) * 10) / 10;
  const lastReported = Math.floor(rand * 72 * 60); // up to 72h
  const statusPool: RoutePoi["status"][] =
    category === "truck_parking" ? ["FULL", "SOME", "MANY"] : ["OPEN", "AVAILABLE", "SOME"];
  const status = statusPool[idx % statusPool.length];

  const nameIdx = Math.floor(rand * 1000);
  let name = "Truck Stop";
  let pumpPrice: number | undefined;
  const exit = Math.floor(50 + rand * 400);
  const interstate = ["I-81", "I-40", "I-64", "I-70", "I-95"][idx % 5];
  const address = `${interstate}, EXIT ${exit}, ${state}`;

  switch (category) {
    case "fuel": {
      const brand = FUEL_BRANDS[nameIdx % FUEL_BRANDS.length];
      name = `${brand} #${Math.floor(100 + rand * 9900)}`;
      pumpPrice = Math.round((4.0 + rand * 1.5) * 1000) / 1000;
      break;
    }
    case "rest_area":
      name = REST_NAMES[nameIdx % REST_NAMES.length];
      break;
    case "truck_parking":
      name = PARKING_NAMES[nameIdx % PARKING_NAMES.length];
      break;
    case "weigh_station":
      name = WEIGH_NAMES[nameIdx % WEIGH_NAMES.length];
      break;
  }

  return {
    id: `poi-${idx}`,
    name,
    category,
    latitude: lat + (rand - 0.5) * 0.02,
    longitude: lng + (rand - 0.5) * 0.02,
    routeMile,
    offRouteMiles,
    rating,
    status,
    lastReportedMinutesAgo: lastReported,
    pumpPrice,
    address,
  };
}

function samplePolyline(poly: [number, number][], frac: number): [number, number] | null {
  if (poly.length === 0) return null;
  const target = Math.floor(frac * (poly.length - 1));
  const a = poly[target];
  const b = poly[Math.min(target + 1, poly.length - 1)];
  const local = frac * (poly.length - 1) - target;
  return [a[0] + (b[0] - a[0]) * local, a[1] + (b[1] - a[1]) * local];
}

function pseudoRand(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}
