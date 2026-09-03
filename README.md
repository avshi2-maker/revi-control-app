# revi-control-app

Live: https://revi-control-app.vercel.app

Autonomous spray-fleet command center. Next.js (App Router) + Leaflet + Esri satellite. Hebrew RTL.

---

## READ BEFORE DEPLOYING — deploy guardrail

A wrong-repo / wrong-page mix-up caused a multi-hour bug on 2026-09-03. Do not repeat it.

- CORRECT GitHub repo: **avshi2-maker/revi-control-app**  (there was an old decoy `avshi2-maker/Revi-control` — deleted, do not recreate).
- Vercel project: **revi-control-app** (team: sapirim). There must be only ONE Vercel project on this repo.
- Vercel **Root Directory** must be: **revi-control-next**
- Branch: **main**. Every push to `main` auto-deploys to production.
- After any deploy, verify at the live URL above. If the build shows Error in Vercel, the OLD version stays live — check the build log, do not assume cache.

## App structure — two screens that must stay in sync

| URL | File | Renders |
|-----|------|---------|
| `/` | `app/page.tsx` | `<LiveMap/>` (client-only) |
| `/map` | `app/map/page.tsx` | `<LiveMap/>` (client-only) |
| `/select` | `app/select/page.tsx` | `<DroneSelector/>` → sends picks to `/map?drones=1,2,3` |

Both `/` and `/map` render the SAME `LiveMap`. A map feature appears on both. Never let a feature land on only one of them (that was the 2026-09-03 bug: home showed an old screen while `/map` was new).

## Key files

- `components/LiveMap.tsx` — satellite map, drones, weather widget, draggable base + zone, live coordinates.
- `components/DroneSelector.tsx` — 50-drone fleet grid (pick any number).
- `lib/config.ts` — `GEO` (base + zone coordinates), timeline, colors. **Change the mission area here.**
- `lib/simulation.ts` — pure flight math (no DOM / no Leaflet).
- `app/globals.css` — all styles.

## Leaflet rule (build-breaker)

Leaflet touches `window` at import time, so `LiveMap` must be loaded client-only:

```tsx
const LiveMap = dynamic(() => import("@/components/LiveMap"), { ssr: false });
```

Importing `LiveMap` directly in a page breaks the build with `ReferenceError: window is not defined`.
