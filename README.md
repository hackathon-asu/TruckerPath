# NavPro Fleets

A Next.js trucking operations app with:

- NavPro-backed fleet pages and trip planning
- InsForge-backed CoPilot data for loads, drivers, parking stops, detention events, and alerts
- Gemini-backed dispatch scoring and alert analysis

## Setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Required Environment

| Variable | Purpose |
| --- | --- |
| `NAVPRO_API_BASE_URL` | NavPro API base URL |
| `NAVPRO_API_BEARER_TOKEN` | Server-only NavPro bearer token |
| `NEXT_PUBLIC_INSFORGE_URL` | InsForge project URL |
| `NEXT_PUBLIC_INSFORGE_ANON_KEY` | InsForge anon key |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini API key |
| `GEMINI_MODEL` | Optional Gemini model override. Defaults to `gemini-2.5-flash-lite` |
| `NEXT_PUBLIC_MAP_PROVIDER` | `osm` or `here` |
| `NEXT_PUBLIC_HERE_API_KEY` | HERE key when using HERE tiles |

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Notes

- `/copilot` is now live-data-only. It does not seed or fall back to demo loads/drivers.
- Gemini calls run in server route handlers.
- InsForge URL and anon key are expected in the browser because the client reads live tables directly.
