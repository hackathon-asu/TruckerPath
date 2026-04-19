"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { api } from "@/lib/client";
import type { MapType } from "@/components/fleet-map";
import type { RouteAlt } from "@/lib/route";
import type { RoutePoi } from "@/lib/poi-along-route";
import type { RoutingProfile, StopPoint } from "@/lib/types";
import { IconRail } from "@/components/icon-rail";
import { TopHeader } from "@/components/top-header";
import { TripPlanner } from "@/components/trip-planner";
import { TripReport } from "@/components/trip-report";
import { DirectionsPanel } from "@/components/directions-panel";
import { PoisPanel } from "@/components/pois-panel";
import { FuelPlanPanel } from "@/components/fuel-plan-panel";
import { WeatherPanel } from "@/components/weather-panel";
import { DocumentsPanel } from "@/components/documents-panel";
import { DriversPanel } from "@/components/drivers-panel";
import { MapLayerPopover } from "@/components/map-layer-popover";
import { RoutingProfileDialog } from "@/components/routing-profile-dialog";
import { CommandPalette } from "@/components/command-palette";
import { useToast } from "@/components/toast";

const FleetMap = dynamic(() => import("@/components/fleet-map"), { ssr: false });

type LeftTab = "search" | "drivers";

export default function HomePage() {
  const [tab, setTab] = useState<LeftTab>("search");
  const [stops, setStops] = useState<StopPoint[]>([]);
  const [routes, setRoutes] = useState<RouteAlt[]>([]);
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const activeRoute = routes.find((r) => r.id === activeRouteId) ?? routes[0] ?? null;
  const [profiles, setProfiles] = useState<RoutingProfile[]>([]);
  const [profile, setProfile] = useState<RoutingProfile | undefined>();
  const [profileDialog, setProfileDialog] = useState(false);
  const [drawer, setDrawer] = useState<null | "report" | "directions" | "pois" | "fuel" | "weather" | "documents">(null);
  const [overlayPois, setOverlayPois] = useState<RoutePoi[]>([]);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [mapType, setMapType] = useState<MapType>("road");
  const [weather, setWeather] = useState(false);
  const [showDrivers, setShowDrivers] = useState(true);
  const [sending, setSending] = useState(false);
  const { show, Toast } = useToast();

  // Load routing profiles
  useEffect(() => {
    api.listProfiles().then((r) => {
      setProfiles(r.profiles);
      setProfile(r.profiles[0]);
    });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen(true);
      }
      if (e.key === "Escape") {
        setCmdOpen(false);
        setProfileDialog(false);
        setDrawer(null);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d === "drivers" || d === "search") setTab(d);
    };
    window.addEventListener("navpro:switch-tab", on);
    return () => window.removeEventListener("navpro:switch-tab", on);
  }, []);

  const sendRoute = useCallback(async () => {
    if (!profile || stops.length < 2) return;
    setSending(true);
    try {
      const res = await api.createTrip({
        driver_id: 1001,
        scheduled_start_time: new Date(Date.now() + 30 * 60_000).toISOString().replace(/\.\d+Z$/, "Z"),
        routing_profile_id: profile.id,
        stop_points: stops.map((s) => ({
          latitude: s.latitude,
          longitude: s.longitude,
          address_name: s.address_name,
          appointment_time: s.appointment_time,
          dwell_time: s.dwell_time,
          notes: s.notes,
        })),
      });
      show(`Trip ${res.trip.trip_id} dispatched · ${res.live ? "live" : "demo"} mode`);
    } catch {
      show("Could not send route");
    } finally {
      setSending(false);
    }
  }, [profile, stops, show]);

  const miles = activeRoute?.miles ?? 0;
  const minutes = activeRoute?.minutes ?? 0;

  const leftPanel = useMemo(() => {
    const hasRoute = activeRoute && stops.length >= 2;
    if (drawer === "report" && profile && hasRoute) {
      return (
        <TripReport
          stops={stops}
          route={activeRoute}
          profile={profile}
          onClose={() => setDrawer(null)}
        />
      );
    }
    if (drawer === "directions" && hasRoute && activeRoute) {
      return <DirectionsPanel route={activeRoute} stops={stops} onClose={() => setDrawer(null)} />;
    }
    if (drawer === "pois" && hasRoute && activeRoute) {
      return (
        <PoisPanel
          route={activeRoute}
          onClose={() => setDrawer(null)}
          onAdd={(s) => setStops([...stops, s])}
          onPoisChange={setOverlayPois}
        />
      );
    }
    if (drawer === "fuel" && hasRoute && activeRoute) {
      return (
        <FuelPlanPanel
          route={activeRoute}
          onClose={() => setDrawer(null)}
          onApply={(extra) => setStops([...stops, ...extra])}
        />
      );
    }
    if (drawer === "weather" && hasRoute && activeRoute) {
      return <WeatherPanel route={activeRoute} onClose={() => setDrawer(null)} />;
    }
    if (drawer === "documents") {
      return <DocumentsPanel onClose={() => setDrawer(null)} />;
    }
    return (
      <div className="flex h-full flex-col" style={{ width: "var(--panel-w)" }}>
        <div className="flex items-center gap-6 border-b border-ink-200 bg-white px-4">
          {[
            { id: "search", label: "Search Locations" },
            { id: "drivers", label: "Find Drivers" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as LeftTab)}
              className={cn(
                "relative py-3 text-sm font-medium",
                tab === t.id
                  ? "text-brand-500 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand-500"
                  : "text-ink-500 hover:text-ink-900",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-hidden">
          {tab === "search" ? (
            <TripPlanner
              profiles={profiles}
              profile={profile}
              setProfile={setProfile}
              stops={stops}
              setStops={setStops}
              routes={routes}
              setRoutes={setRoutes}
              activeRouteId={activeRouteId}
              setActiveRouteId={setActiveRouteId}
              onOpenReport={() => setDrawer("report")}
              onOpenDirections={() => setDrawer("directions")}
              onOpenPois={() => setDrawer("pois")}
              onOpenFuel={() => setDrawer("fuel")}
              onOpenWeather={() => setDrawer("weather")}
              onOpenDocuments={() => setDrawer("documents")}
              onOpenAddProfile={() => setProfileDialog(true)}
              onSendRoute={sendRoute}
              sending={sending}
            />
          ) : (
            <DriversPanel />
          )}
        </div>
      </div>
    );
  }, [drawer, profile, stops, miles, minutes, tab, profiles, routes, activeRoute, activeRouteId, setActiveRouteId, sending, sendRoute]);

  return (
    <div className="flex h-screen flex-col">
      <TopHeader onOpenCmd={() => setCmdOpen(true)} />
      <div className="flex flex-1 overflow-hidden">
        <IconRail />
        {leftPanel}
        <div className="relative flex-1 bg-ink-100">
          <FleetMap
            stops={stops}
            routes={routes.map((r) => ({
              id: r.id,
              polyline: r.polyline,
              active: r.id === (activeRoute?.id ?? ""),
              overlays: r.id === (activeRoute?.id ?? "") ? r.overlays : [],
            }))}
            pois={drawer === "pois" ? overlayPois.map((p) => ({
              id: p.id,
              latitude: p.latitude,
              longitude: p.longitude,
              name: p.name,
              category: p.category,
              subtitle: p.pumpPrice != null ? `$${p.pumpPrice.toFixed(3)}/gal` : p.address,
            })) : undefined}
            mapType={mapType}
          />
          <MapLayerPopover
            mapType={mapType}
            onMapType={setMapType}
            weatherAlerts={weather}
            onWeather={setWeather}
            showDrivers={showDrivers}
            onShowDrivers={setShowDrivers}
          />
        </div>
      </div>

      <RoutingProfileDialog
        open={profileDialog}
        onClose={() => setProfileDialog(false)}
        onCreated={(p) => {
          setProfiles((arr) => [...arr, p]);
          setProfile(p);
          show(`Profile “${p.name}” saved`);
        }}
      />
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
      <Toast />
    </div>
  );
}
