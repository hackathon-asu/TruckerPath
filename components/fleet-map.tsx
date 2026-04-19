"use client";
import { useEffect } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L, { type LatLngExpression } from "leaflet";

import type { StopPoint } from "@/lib/types";

// Fix default icon paths for Leaflet in bundled context.
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const startIcon = L.divIcon({
  className: "",
  html: `<div style="background:#1d4ed8;color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:12px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.2)">A</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});
const endIcon = L.divIcon({
  className: "",
  html: `<div style="background:#0f172a;color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:12px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.2)">B</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const poiStyle: Record<MapPoi["category"], { bg: string; letter: string }> = {
  fuel: { bg: "#e11d48", letter: "F" },
  truck_parking: { bg: "#f59e0b", letter: "P" },
  weigh_station: { bg: "#0284c7", letter: "W" },
  rest_area: { bg: "#059669", letter: "R" },
};
function poiIcon(cat: MapPoi["category"]) {
  const s = poiStyle[cat];
  return L.divIcon({
    className: "",
    html: `<div style="background:${s.bg};color:#fff;width:20px;height:20px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:10px;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3)">${s.letter}</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

export type MapType = "road" | "hybrid" | "satellite";

export interface RouteLine {
  id: string;
  polyline: [number, number][];
  active?: boolean;
}

export interface MapPoi {
  id: string;
  latitude: number;
  longitude: number;
  name: string;
  category: "truck_parking" | "weigh_station" | "fuel" | "rest_area";
  subtitle?: string;
}

interface Props {
  stops: StopPoint[];
  routes?: RouteLine[];
  pois?: MapPoi[];
  mapType?: MapType;
}

function FitBounds({ stops, routes }: { stops: StopPoint[]; routes?: RouteLine[] }) {
  const map = useMap();
  useEffect(() => {
    const activePoly = routes?.find((r) => r.active)?.polyline ?? routes?.[0]?.polyline ?? [];
    const pts: [number, number][] = [
      ...stops.map((s) => [s.latitude, s.longitude] as [number, number]),
      ...activePoly,
    ];
    if (pts.length === 0) return;
    if (pts.length === 1) {
      map.setView(pts[0], 10);
      return;
    }
    map.fitBounds(pts as [number, number][], { padding: [60, 60] });
  }, [stops, routes, map]);
  return null;
}

const HERE_KEY = process.env.NEXT_PUBLIC_HERE_API_KEY ?? "";
const PROVIDER = (process.env.NEXT_PUBLIC_MAP_PROVIDER ?? "osm").toLowerCase();
const USE_HERE = PROVIDER === "here" && !!HERE_KEY;

const hereTile = (style: string) =>
  `https://maps.hereapi.com/v3/base/mc/{z}/{x}/{y}/png8?style=${style}&size=512&ppi=400&apiKey=${HERE_KEY}`;

type TileSpec = { url: string; attribution: string; tileSize?: number; zoomOffset?: number; maxZoom?: number };

const osmTiles: Record<MapType, TileSpec> = {
  road: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap",
    maxZoom: 19,
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
    maxZoom: 19,
  },
  hybrid: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap, &copy; CARTO",
    maxZoom: 19,
  },
};

const hereTiles: Record<MapType, TileSpec> = {
  road: { url: hereTile("explore.day"), attribution: "&copy; HERE", tileSize: 512, zoomOffset: -1, maxZoom: 20 },
  satellite: { url: hereTile("satellite.day"), attribution: "&copy; HERE", tileSize: 512, zoomOffset: -1, maxZoom: 20 },
  hybrid: { url: hereTile("explore.satellite.day"), attribution: "&copy; HERE", tileSize: 512, zoomOffset: -1, maxZoom: 20 },
};

const tileByType: Record<MapType, TileSpec> = USE_HERE ? hereTiles : osmTiles;

export default function FleetMap({ stops, routes, pois, mapType = "road" }: Props) {
  const tiles = tileByType[mapType];
  const inactive = (routes ?? []).filter((r) => !r.active);
  const active = (routes ?? []).find((r) => r.active) ?? (routes ?? [])[0];
  return (
    <MapContainer
      center={[33.4484, -112.074]}
      zoom={6}
      className="h-full w-full"
      scrollWheelZoom
      zoomControl
    >
      <TileLayer
        key={tiles.url}
        url={tiles.url}
        attribution={tiles.attribution}
        {...(tiles.tileSize ? { tileSize: tiles.tileSize } : {})}
        {...(tiles.zoomOffset != null ? { zoomOffset: tiles.zoomOffset } : {})}
        {...(tiles.maxZoom ? { maxZoom: tiles.maxZoom } : {})}
      />
      {inactive.map((r) => (
        <Polyline
          key={r.id}
          positions={r.polyline as LatLngExpression[]}
          pathOptions={{ color: "#94a3b8", weight: 4, opacity: 0.55 }}
        />
      ))}
      {active && active.polyline.length > 1 && (
        <Polyline
          positions={active.polyline as LatLngExpression[]}
          pathOptions={{ color: "#2563eb", weight: 5, opacity: 0.9 }}
        />
      )}
      {stops.map((s, i) => (
        <Marker
          key={s.id}
          position={[s.latitude, s.longitude]}
          icon={i === 0 ? startIcon : i === stops.length - 1 ? endIcon : defaultIcon}
        >
          <Popup>
            <div className="text-sm font-medium">{s.address_name}</div>
            {s.appointment_time && (
              <div className="text-xs text-ink-500">{s.appointment_time}</div>
            )}
          </Popup>
        </Marker>
      ))}
      {pois?.map((p) => (
        <Marker key={p.id} position={[p.latitude, p.longitude]} icon={poiIcon(p.category)}>
          <Popup>
            <div className="text-xs font-semibold">{p.name}</div>
            {p.subtitle && <div className="text-[11px] text-ink-500">{p.subtitle}</div>}
          </Popup>
        </Marker>
      ))}
      <FitBounds stops={stops} routes={routes} />
    </MapContainer>
  );
}
