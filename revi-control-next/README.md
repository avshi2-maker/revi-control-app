# Revi-Control (Next.js)

Command-center teaser + live Tel Aviv satellite map. Clean Next.js app-router project.

## Structure
- `app/page.tsx` → teaser (`/`)
- `app/map/page.tsx` → live satellite map (`/map`)
- `components/Teaser.tsx` → canvas simulation
- `components/LiveMap.tsx` → Leaflet + Esri satellite
- `lib/config.ts` → **tweak everything here** (colors, timeline, Tel Aviv coordinates)
- `lib/simulation.ts` → pure timeline/drone logic (shared by both pages)

## Run / deploy
- Local: `npm install` then `npm run dev` → http://localhost:3000
- Deploy: push to GitHub → import in Vercel (it auto-detects Next.js, no config).

## Routes
- `/` teaser · `/map` live map · add `?record=1` to either for a clean 16:9 capture.

## Change the target area
Edit `GEO` in `lib/config.ts` (base lng/lat, zone box, map center/zoom). One place, both pages follow.
