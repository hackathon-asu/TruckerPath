# NavPro Fleets — hackathon clone

A modern, working clone of the Trucker Path **Fleets** web app, built against the
[NavPro API](https://api.truckerpath.com/navpro).

## What was cloned

- Global shell: brand rail, top `Map / Reports` tabs, user avatar, quick search.
- Map view with Leaflet + OSM tiles (no API key required), driver markers, route polyline.
- Search Locations + Find Drivers sidebar tabs.
- Routing profile card with live dimensions & axle count.
- Multi-stop trip planner (add/remove stops, live route distance + duration via OSRM).
- Recent / Saved / Shared trip tabs.
- Route summary card with drive time, miles, fuel estimate.
- Trip Report panel (truck settings, road options, itinerary, trip cost calculator).
- Map Layer popover (Map Display, Road/Hybrid/Satellite, Weather Alert toggle).
- Add Routing Profile modal — Name, Height, Width, Length, Weight, Axles, Trailers, Hazmat.
- Drivers panel with search + status filter + invite dialog.

## What was simplified

- Single "fastest" routing option (no side-by-side alternates yet).
- Driver tracking trail uses mocked GPS pings instead of live NavPro dispatch polling.
- Vehicles / Documents / POIs pages are represented in the Reports dashboard only.

## Original features added

1. **Reports dashboard (`/reports`)** — server-rendered snapshot of active drivers, fleet
   utilization, terminals, driver roster with status pills, vehicle list.
2. **AI Trip Insights** — the Trip Report panel runs a heuristic analyzer (HOS breaks,
   hazmat warnings, low-clearance alerts, fuel cost). Swappable for a real Claude call.
3. **Saved Routes** — localStorage-backed favorites with one-click re-load.
4. **Command Palette (⌘K)** — keyboard-first navigation between Map, Reports, Drivers.

## Tech stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- Leaflet + OpenStreetMap tiles (no map API key needed)
- OSRM demo router + Nominatim geocoder (keyless) — both proxied via `/api/route-calc`
  and `/api/geocode` so origin domains stay clean.
- Server route handlers under `/app/api/navpro/*` proxy the real NavPro API and inject
  `Authorization: Bearer $NAVPRO_API_BEARER_TOKEN` server-side.
- A **mock fallback layer** (`lib/mock.ts`) returns realistic data whenever the live
  token is absent or rejected, so the demo runs offline.

## Getting started

```bash
cp .env.example .env.local
# Paste your NavPro bearer token (optional — mock data used if empty)
pnpm install        # or npm install
pnpm dev            # http://localhost:3030
```

### Environment

| Variable                 | Purpose                                    |
| ------------------------ | ------------------------------------------ |
| `NAVPRO_API_BASE_URL`    | Defaults to `https://api.truckerpath.com/navpro`. |
| `NAVPRO_API_BEARER_TOKEN`| Server-only. Enables "live" mode.          |
| `NAVPRO_FORCE_MOCK`      | `true` to force mock data even with token. |

Tokens live only on the server and are injected by `lib/navpro.ts` inside
Next route handlers — they never reach the browser.

## Scripts

```bash
pnpm dev     # local dev on :3030
pnpm build   # production build
pnpm start   # start prod server
pnpm lint    # next lint
```

## Deploy on Vercel

The entire app is Vercel-ready — import the repo and set `NAVPRO_API_BEARER_TOKEN`
in the Vercel project settings (server-only env).

## Project layout

```
app/
  api/navpro/*            server proxies → NavPro endpoints (drivers, trips, ...)
  api/geocode, route-calc keyless mapping helpers
  api/trip-insights       local heuristic for AI insights
  reports/                server-rendered analytics dashboard
  page.tsx                main Map experience
components/               React UI (map, planner, report, drivers, dialogs)
lib/
  navpro.ts               server-only fetch wrapper + safe mock fallback
  client.ts               typed fetch helpers for the browser
  types.ts, mock.ts, format.ts, saved-routes.ts
```
