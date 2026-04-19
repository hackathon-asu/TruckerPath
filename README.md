# TruckerPath Dispatcher OS

Dispatcher-focused Next.js 14 App Router app for route planning, fleet operations, exception management, and assignment workflows.

The product now has two primary surfaces:

- `/` keeps the existing map and route-planning workflow intact.
- `/reports` is the dispatcher HQ dashboard with KPI filtering, urgent actions, smart to-do, fleet map preview, trip/load/driver drill-downs, route comparison, detention handling, safety/compliance, and docs/billing reconciliation.

`/copilot` no longer exists as a standalone product surface. It now redirects to `/reports`, and the useful CoPilot logic has been folded into the new operations dashboard.

## Stack

- Next.js 14 App Router
- Tailwind CSS 3.4
- Leaflet map stack with existing provider toggle (`osm` or `here`)
- InsForge for operational data
- Gemini via `@ai-sdk/google` for explainability and assistive flows
- Vitest + Playwright for verification

## Setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

The app runs on [http://localhost:3030](http://localhost:3030).

## Environment

| Variable | Purpose |
| --- | --- |
| `NAVPRO_API_BASE_URL` | NavPro API base URL |
| `NAVPRO_API_BEARER_TOKEN` | Server-only NavPro bearer token |
| `NEXT_PUBLIC_INSFORGE_URL` | InsForge project URL |
| `NEXT_PUBLIC_INSFORGE_ANON_KEY` | InsForge anon key |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini API key |
| `GEMINI_MODEL` | Optional Gemini model override. Defaults to `gemini-2.5-flash-lite` |
| `NEXT_PUBLIC_MAP_PROVIDER` | `osm` or `here` |
| `NEXT_PUBLIC_HERE_API_KEY` | HERE tile key when using HERE tiles |

## Demo vs Live

The dispatcher dashboard is intentionally demo-first when the expanded InsForge schema is not available yet.

- `Live mode` is used when InsForge is configured and the backing schema/data are present.
- `Demo mode` is used when the live stack is missing or incomplete. The UI keeps the same contracts and behavior, and interactions persist locally in browser storage so the dashboard remains fully interactive.

Current implementation details:

- `/reports` fetches the dispatcher HQ contract from `/api/dispatcher-hq`.
- The returned snapshot is seeded with realistic scenario data for loads, drivers, trips, alerts, docs, detention, repair, and last-mile guidance.
- Task completion, alert acknowledgement, document review state, and demo assignments persist locally.
- The dashboard UI clearly labels demo/live state and last refresh timestamp.

## Key Workflow

The main dispatch workflow is:

1. Open `/reports`.
2. Use the KPI strip, urgent action band, or smart to-do board to find the next operational issue.
3. Open a load from the load board and choose `Assign driver`.
4. The app navigates to `/` with dispatch context in the URL.
5. On the map page, route options are calculated using the existing route-planning flow.
6. After a route is chosen, ranked drivers appear in dispatch mode with deterministic readiness scoring.
7. Assigning a driver writes the result back to the shared demo state and returns the dispatcher to an immediately updated Reports dashboard.

This keeps a single route-planning product instead of creating a second planner inside Reports.

## Schema and Seed Data

The expanded schema lives in [schema.sql](/C:/Users/sidds/OneDrive/Documents/GitHub/TruckerPath/schema.sql).

It extends the original model with dispatcher OS entities including:

- `vehicles`
- `trips`
- `trip_stops`
- `trip_events`
- `route_plans`
- `route_options`
- `driver_readiness_scores`
- `hos_snapshots`
- `eld_events`
- `maintenance_events`
- `repair_shops`
- `repair_estimates`
- `driver_incidents`
- `safety_scores`
- `compliance_events`
- `law_change_alerts`
- `road_condition_alerts`
- `market_alerts`
- `dispatcher_tasks`
- `ai_recommendations`
- `driver_notifications`
- `dispatcher_notifications`
- `document_requirements`
- `load_documents`
- `invoice_drafts`
- `invoice_reconciliation`
- `detention_invoice_drafts`
- `customer_notifications`
- `facility_entry_points`
- `facility_entry_images`
- `fuel_partner_locations`
- `fuel_price_snapshots`
- `downstream_load_links`
- `assignment_audit_log`

The seed section includes the named scenario pack coverage used by the new Reports experience, including Patel urgent assignment, Ramirez fuel/HOS pressure, Nguyen delay, Chen ELD issue, Williams billing blocker, Martinez breakdown, Okafor relay, Reed downstream tradeoff, excessive detention, law-change alerting, market surge, and last-mile entrance guidance.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm test
npm run test:browser
```

## Verification

The implementation was validated with:

```bash
npm run build
npm test
npm run test:browser
```

## Project Notes

- Tailwind stays on `3.4.x`.
- The map tab remains the full route-planning workspace.
- The Reports dashboard uses production-shaped states: loading, empty, error, demo/live, drill-downs, and inline actions.
- Gemini enhances explanations and prioritization, but deterministic scoring and route gating remain the source of truth.
- Seeded last-mile image references live under [`public/facilities`](/C:/Users/sidds/OneDrive/Documents/GitHub/TruckerPath/public/facilities).
