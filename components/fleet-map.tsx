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

export type MapType = "road" | "hybrid" | "satellite";

interface Props {
  stops: StopPoint[];
  polyline?: [number, number][];
  mapType?: MapType;
}

function FitBounds({ stops, polyline }: { stops: StopPoint[]; polyline?: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    const pts: [number, number][] = [
      ...stops.map((s) => [s.latitude, s.longitude] as [number, number]),
      ...(polyline ?? []),
    ];
    if (pts.length === 0) return;
    if (pts.length === 1) {
      map.setView(pts[0], 10);
      return;
    }
    map.fitBounds(pts as [number, number][], { padding: [60, 60] });
  }, [stops, polyline, map]);
  return null;
}

const tileByType: Record<MapType, { url: string; attribution: string }> = {
  road: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
  },
  hybrid: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap, &copy; CARTO",
  },
};

export default function FleetMap({ stops, polyline, mapType = "road" }: Props) {
  const tiles = tileByType[mapType];
  return (
    <MapContainer
      center={[33.4484, -112.074]}
      zoom={6}
      className="h-full w-full"
      scrollWheelZoom
      zoomControl
    >
      <TileLayer url={tiles.url} attribution={tiles.attribution} />
      {polyline && polyline.length > 1 && (
        <Polyline
          positions={polyline as LatLngExpression[]}
          pathOptions={{ color: "#2563eb", weight: 5, opacity: 0.85 }}
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
      <FitBounds stops={stops} polyline={polyline} />
    </MapContainer>
  );
}
