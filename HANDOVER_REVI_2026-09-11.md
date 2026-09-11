# REVI-CONTROL — SESSION HANDOVER
**Date:** 11/09/2026  
**Version live:** v1.7.0  
**Repo:** `C:\revi-control-app`  
**App root:** `C:\revi-control-app\revi-control-next`  
**Deploy:** `npx vercel --prod` from `C:\revi-control-app`  
**Live URL:** https://revi-control-app.vercel.app (or cash.marble-art.co.il equivalent — check Vercel dashboard)  
**Stack:** Next.js 15 App Router · TypeScript · Leaflet (client-only via `dynamic` + `ssr:false`) · Open-Meteo (free, no key) · Claude API (claude-sonnet-5) · Vercel

---

## GOLDEN RULES — READ FIRST

1. **Leaflet = client-only always.** Every component that uses Leaflet must use `dynamic(() => import(...), { ssr: false })`. Breaking this = white page crash.
2. **Bash is permanently wedged** (virtiofs mount failure — 10 consecutive fails). Do NOT try bash. All file edits go through Read/Edit/Write tools. Deploy via push command block below.
3. **Version bump on EVERY deploy.** Edit `lib/config.ts` → `APP_VERSION`. Format: `"1.X.0"`. Currently `"1.7.0"`.
4. **Never run git from Claude** — locks accumulate. Always paste the push block below and user runs it.
5. **All UI text = Hebrew (RTL).** Correspondence = English only.
6. **Deliver finished files directly into `C:\revi-control-app`**. No intermediate steps for user.

---

## PUSH COMMAND (paste this every deploy)

```powershell
cd C:\revi-control-app
Get-ChildItem -Path .git -Recurse -Filter *.lock -Force -ErrorAction SilentlyContinue | Remove-Item -Force
git add -A
git commit -m "feat: vX.X.X — describe changes"
git push origin main
npx vercel --prod
```

---

## FILE MAP — COMPLETE

```
revi-control-next/
├── app/
│   ├── page.tsx                   → root = <CockpitClient> (the wizard)
│   ├── layout.tsx                 → root layout, RTL dir
│   ├── globals.css                → ALL styles (one file, no modules)
│   ├── cockpit/page.tsx           → /cockpit — cockpit shell wrapping LiveMap
│   ├── pitch/page.tsx             → /pitch — sales presentation (15 feature cards)
│   ├── verification/page.tsx      → /verification — data transparency page
│   ├── station/page.tsx           → /station — camera drone command view
│   ├── map/page.tsx               → /map — legacy standalone map (unused)
│   ├── select/page.tsx            → /select — legacy drone selector (unused)
│   └── api/weather-advice/route.ts → POST → Claude AI weather advisor
├── components/
│   ├── ShiftWizard.tsx            → 9-step pre-flight wizard (ROOT ENTRY POINT)
│   ├── LiveMap.tsx                → live Leaflet cockpit map (most complex file)
│   ├── CockpitClient.tsx          → client shell: wizard → cockpit transition
│   ├── ZonePicker.tsx             → Leaflet zone editor in wizard step 4
│   ├── ZoneWeather.tsx            → live weather widget for exact zone center
│   ├── WeatherStep.tsx            → wizard step 1: AI weather advisor UI
│   ├── WeightStep.tsx             → wizard step 3: weight & balance gate
│   ├── MissionReport.tsx          → PDF-style mission report modal
│   ├── CameraFeed.tsx             → /station camera view (Leaflet satellite + overlay)
│   └── StationClient.tsx          → /station client shell
└── lib/
    ├── config.ts                  → SINGLE SOURCE OF TRUTH (all constants, APP_VERSION)
    ├── simulation.ts              → physics math (clamp, ease, boustro, evalDrone, batteryAt…)
    ├── estimate.ts                → mission-time estimator (estimateMissionMin, fmtHM)
    └── weather.ts                 → deterministic weather math (computeAdvice)
```

---

## lib/config.ts — KEY VALUES

```ts
export const APP_VERSION = "1.7.0";   // ← bump every deploy

export const DRONE_SPEC = {
  model: "DJI Agras T50",
  dryKg: 52, maxPayloadKg: 40, mtowKg: 92, tankMaxL: 40,
  sensorKitKg: 1.5, windMaxMps: 6, minAltM: 1.5, maxAltM: 8,
  sprayWidthM: 11,
  // Demo-scale (cinematic map):
  coverageDunamFull: 90000, flightMinutesFull: 9,
  rangeKmFull: 20, returnReserve: 1.2,
};

export const MAX_ZONE_DUNAM = { land: 150000, ocean: 650000 };
export const OCEAN_UNIT_COST = 4200;  // ₪ per expendable drone

export const GEO = {
  base: { lng: 34.895, lat: 32.355 },          // Sharon Valley depot
  zone: { w: 34.862, e: 34.935, s: 32.315, n: 32.392 }, // citrus grove
};
export const GEO_OCEAN = {
  base: { lng: 34.580, lat: 31.840 },           // ⛵ off Ashdod
  zone: { w: 34.380, e: 34.560, s: 31.740, n: 31.940 },
};
```

---

## WIZARD FLOW (ShiftWizard.tsx)

9 steps, indexed 0–8:

| Step | Name | Gate (canNext) |
|------|------|----------------|
| 0 | תרחיש (scenario) | always |
| 1 | מזג אוויר (weather) | `weatherOk` — AI advisor must confirm |
| 2 | רחפנים (drones) | `drones.length > 0` |
| 3 | משקל ואיזון (weight) | `weightOk` |
| 4 | מפה + שיגור (map + pad) | `!baseInZone` — NEW: base must be outside spray zone |
| 5 | אישורי שיגור (permits) | `permit.airspace && permit.tank` |
| 6 | אלגוריתם (algorithm) | always |
| 7 | סיכום (summary) | `rangeOk` — battery/range must cover zone |
| 8 | שיגור (launch) | button launches |

**Launch URL built:**
`/cockpit?drones=1,2,3&pad=ground&algo=boustro&scenario=ocean&eye=N&op=name&sup=name&alt=X&base=lng,lat&zone=w,e,s,n`

**Key computed values in wizard:**
- `baseInZone` — NEW v1.7.0: base lng/lat inside zone bounds → blocks step 4 + shows red warning
- `areaDunam` — zone area in dunam
- `baseDistKm` — distance base→nearest zone edge (not center)
- `transitKm` — baseDistKm × 2 (land, RTB) or × 1 (ocean, one-way)
- `budgetKm` — DRONE_SPEC.rangeKmFull × (minBat/100)
- `rangeOk` — sprayKm × coverage-per-km ≥ perDroneDunam

---

## LIVEMAP.tsx — KEY ARCHITECTURE

LiveMap reads URL params, mounts Leaflet, runs animation loop.

**URL params read:**
- `?drones=1,2,3` — which drone numbers fly
- `?scenario=ocean` — ocean mode (expendable drones, boat)
- `?pad=boat` — pad type
- `?algo=boustro|spiral|grid` — coverage pattern
- `?alt=6` — spray altitude (meters) → `flyAltM` state
- `?eye=N` — camera drone number → `eyeIdx`
- `?op=name&sup=name` — crew names
- `?base=lng,lat&zone=w,e,s,n` — wizard-set geometry

**React state:**
`isOcean, droneCount, pad, reportOpen, hasEye, eyeNum, showFeed, feedGeo, missionArea, windSpeed, transitKm, algo, flyAltM, query, crew`

**Computed in render:**
`durationHM = fmtDurHM(estimateMissionMin({ areaDunam, nSpray, windMps, pattern, transitKm, ocean }))`

**Base marker safety (v1.7.0 NEW):**
On drag: if base enters zone bounds → snap to nearest edge + show red banner "מיקום המפעיל חייב להיות מחוץ לאזור הריסוס" (auto-hides after 3.5s).

**Anti-drift crab overlay:**
- `crabDeg = arcsin(min(1, windMps/10)) × 180/π`
- `crabYaw` = rotates drone bodies visually while spraying
- `crabbox` div shows SVG vector diagram (green=track, blue=heading, red=wind)
- Toggle: `#crabtoggle` button

**NDVI overlay:**
- 6×6 deterministic grid (`Math.sin` pattern) → green/yellow/red
- `ndviLayer` LayerGroup, toggle `#ndvitoggle`
- `#ndvibox` shows legend + chemical savings %

**Battery-low land warning:**
```ts
const battLow = launched && !ocean && s < T.rth[1] && (minBat < 22 || mins <= 2);
```
→ `p-timer.lowbat` class → pulsing red animation

**Distance-from-base low-return warning:**
```ts
lowReturn = rangeKm < distKm * DRONE_SPEC.returnReserve
```
→ per-drone card goes red + `#rtbwarn` banner: "⚠ N רחפנים — סוללה נמוכה לחזרה בטוחה לבסיס"

**Transit = nearest zone edge (not center):**
```ts
const nLng = Math.min(Math.max(base[0], Z.w), Z.e);
const nLat = Math.min(Math.max(base[1], Z.s), Z.n);
return kmBetween(base, [nLng, nLat]) * (ocean ? 1 : 2);
```

**Camera drone (Eye):**
- Orbit center at radius 30% of zone span
- After spray ends (land only): flies RTB home and lands
- Ocean: orbits until end (no RTB — nowhere to go)
- Gold color (`#ffd54a`), camera icon in SVG body

**Ocean mode:**
- Drones "splash" after completing spray lane (freeze at last spray position)
- No RTB, no low-battery return check
- Expendable cost = `droneCount × OCEAN_UNIT_COST` shown in mission report

**Zone resize handles:**
- `swH` (SW corner), `neH` (NE corner), `moveH` (center ✥)
- Cap: `MAX_ZONE_DUNAM[scenario]` → max lat/lng span computed
- CRITICAL: do NOT call `swH.setLatLng()` or `neH.setLatLng()` while dragging them (causes snap bug) — only update on cap

**Wall clock:** `setInterval(tickClock, 1000)` → `#wcTime` (HH:MM:SS) + `#wcDate` (dd/mm/yyyy)

**Weather:** fetches Open-Meteo for exact zone center `(Z.s+Z.n)/2, (Z.w+Z.e)/2` after map loads → feeds `windSpeed` state + `windDeg/windMps/crabDeg/crabYaw`

**Mission complete signal:**
```ts
window.dispatchEvent(new CustomEvent("revi:mission", { detail: { done } }));
```
CockpitClient.tsx listens and shows "✓ המשימה הושלמה" bar.

---

## WEATHER SYSTEM

**Two-level weather:**
1. **Step 1 wizard (WeatherStep.tsx)** — regional advisory, fetches for GEO center, calls `/api/weather-advice` (Claude + deterministic math) → GO/CAUTION/NO-GO + recommended altitude `recAltM`
2. **Step 4 map (ZoneWeather.tsx)** — re-fetches for EXACT zone center after user positions it → warns if different from regional

**API route: `app/api/weather-advice/route.ts`**
- `export const maxDuration = 30`
- Model: `process.env.CLAUDE_MODEL || "claude-sonnet-5"` (NOT haiku — produces garbled Hebrew)
- GET: health check
- POST: deterministic math first (`lib/weather.ts → computeAdvice`), then Claude enrichment
- Hebrew prompt requires: "כתוב עברית מקצועית ותקנית בלבד — מונחים חקלאיים/תעופתיים נכונים. אסור להשתמש במילים לא סטנדרטיות."
- Robust JSON parse: try whole text, then outermost `{}`
- Falls back to deterministic `base` on any error

**`lib/weather.ts → computeAdvice(inp)`**
- `recAltM = Math.round(ALT_MAX - (ALT_MAX - ALT_MIN) × clamp(w/nogo, 0, 1))`
- Has LOCAL `clamp` (cannot import from simulation.ts — circular)
- Returns: `{ go, caution, nogo, recAltM, crabDeg, driftM }`

---

## MISSION TIME ESTIMATION (lib/estimate.ts)

```ts
estimateMissionMin({ areaDunam, nSpray, windMps, pattern, transitKm, ocean })
```

Physics:
- `sprayMin = areaDunam / (sprayWidthM × speedMs × windFactor × weightFactor × patEff) / nSpray / 60`
- `windFactor` = clamp(1 - windMps/20, 0.5, 1)
- `weightFactor` = 0.87 (loaded)
- `patEff`: boustro=1.0, grid=0.9, spiral=0.82
- Transit: `transitKm / speedMs / 60`
- Refills: `Math.floor(areaDunam / (tankMaxL × appRate))` stops × 3 min each

`fmtHM(min)` → "H:MM" string

---

## PAGES SUMMARY

| Route | File | Purpose |
|-------|------|---------|
| `/` | `app/page.tsx` → `CockpitClient` | Pre-flight wizard |
| `/cockpit` | `cockpit/page.tsx` | LiveMap cockpit |
| `/station` | `station/page.tsx` | Camera drone command view |
| `/pitch` | `pitch/page.tsx` | Sales presentation (15 cards) |
| `/verification` | `verification/page.tsx` | Data transparency (reads config live) |

---

## CSS ARCHITECTURE (globals.css — one file)

Key classes to know:
- `.wz-*` — wizard classes (all ShiftWizard UI)
- `.card`, `.drone-ic`, `.eye` — drone panel cards
- `.p-timer.lowbat` — pulsing red animation when battery critical
- `.crabbox` — anti-drift HUD panel (top-right of map)
- `.ndvibox` — NDVI legend panel
- `.terrain-badge` — altitude + terrain-follow badge (bottom-right)
- `.camfeed` — camera feed overlay
- `.pitch` — /pitch page (height:100vh; overflow-y:auto — needed for scroll)
- `.dv` — /verification page (same scroll fix)
- `.rtbwarn` — red return-to-base warning banner
- `@keyframes rec` — blinking red used for both REC dot and lowbat

---

## KNOWN BUGS / CONSTRAINTS

| Issue | Status | Notes |
|-------|--------|-------|
| Bash wedged | Permanent this session | Start new session to fix. File tools work fine. |
| GitHub auto-deploy broken | Bypassed | Use `npx vercel --prod` always |
| git index.lock accumulation | Mitigated | Use `Get-ChildItem … *.lock … Remove-Item` before every commit |
| Vercel filter stuck | UI bug | Click X on individual filters, not clear-all; or just go to Deployments tab |

---

## WHAT WAS BUILT — COMPLETE FEATURE LIST (v1.0 → v1.7.0)

1. **9-Step ShiftWizard** — scenario, weather/AI, drones, weight, map, permits, algo, summary, launch
2. **LiveMap cockpit** — real Esri satellite, animated drone fleet, boustro/spiral/grid patterns
3. **AI Weather Advisor** — Claude Sonnet-5 + Open-Meteo, GO/CAUTION/NO-GO, recommended altitude
4. **Weight & Balance Gate** — blocks launch if MTOW exceeded (real T50 spec)
5. **Battery/Range Gate** — wizard summary checks fleet can cover zone + return
6. **Camera Drone (Eye)** — gold drone, orbit overwatch, RTB on land, /station command view
7. **ZonePicker** — draggable SW/NE corners + center move, resize cap, fitBounds on load
8. **ZoneWeather** — live weather for exact positioned zone (not just regional)
9. **Anti-Drift Crab Pattern** — live crab angle from wind, drone bodies rotate, SVG HUD diagram
10. **NDVI Variable-Rate Overlay** — 6×6 health grid, chemical savings %, toggleable
11. **Terrain-Follow Badge** — live altitude display "🛰 גובה X מ׳ · מעקב תבליט פעיל"
12. **Live Wall Clock** — dd/mm/yyyy HH:MM:SS in cockpit topbar
13. **Flight Timer + Battery Remaining** — elapsed since launch + remaining minutes countdown
14. **Land Low-Battery Time Alert** — pulsing red timer when <22% or ≤2 min remaining (land only)
15. **Distance-Based Safe-Return Warning** — per-drone check, red banner when battery too low to return
16. **Mission Time Estimate (physics)** — real area/speed/wind/pattern/transit/refills calculation
17. **Mission Report** — auto popup with crew, times, area, cost (ocean), duration
18. **Ocean Mode** — expendable drones, boat launch, drones freeze at splash, one-way economics
19. **/pitch Presentation** — 15 feature cards, advantages table, CTAs, scrollable
20. **/verification Transparency** — reads config live, real vs demo separation, upgrade path
21. **APP_VERSION in footers** — wizard footer + map topbar + pitch footer
22. **Operator Position Safety (NEW v1.7.0)** — base blocked inside spray zone in wizard + live map snap

---

## PENDING TASKS (in priority order)

### P1 — Deploy v1.7.0 (last built, NOT YET DEPLOYED)
The operator-position safety feature (v1.7.0) was built but bash is wedged — user must run:
```powershell
cd C:\revi-control-app
Get-ChildItem -Path .git -Recurse -Filter *.lock -Force -ErrorAction SilentlyContinue | Remove-Item -Force
git add -A
git commit -m "feat: v1.7.0 — operator position safety gate + anti-drift spec in pitch"
git push origin main
npx vercel --prod
```

### P2 — Professional Word Document / PDF
User asked early in session for "full detailed pro report A-Z describing this system + advantages table". Build as `.docx` using the docx skill. Cover: system overview, full feature list, real specs table, advantages, upgrade path, contact.

### P3 — Session Handover (this file) → needs to be in repo
This handover file should be gitignored (already: `revi-control-next/HANDOVER_REVI_2026-09-03.md` is gitignored, add `HANDOVER_REVI_2026-09-11.md` to .gitignore too).

### P4 — Verify deployed v1.7.0 features
After deploy, test:
- [ ] Drag base (H) marker INTO zone → should snap to edge + show red banner
- [ ] In wizard step 4, move base inside zone → should block "הבא" + show red warning
- [ ] Step 7 summary shows "מיקום מפעיל ✓ מחוץ לאזור — בטוח"
- [ ] /pitch page shows new "בקרת מיקום מפעיל" card
- [ ] /pitch anti-drift card shows full technical explanation with arcsin formula
- [ ] Version shows v1.7.0 in wizard footer and map topbar

### P5 — Ferrari Ideas (discussed, not built)
These were pitched but not started:

**1. Live Telemetry Replay** (medium)  
After mission: scrub through recorded GPS tracks overlaid on real satellite. Benefit: operator debrief + regulatory proof.

**2. WhatsApp Mission Report Bot** (quick)  
After mission complete → one tap sends mission summary to WhatsApp number. Benefit: instant client delivery, no PDF hassle.

**3. Real NDVI from Sentinel Satellite** (big)  
Replace synthetic NDVI with Copernicus Sentinel-2 API data for the actual zone. Benefit: variable-rate prescription becomes real commercial feature.

---

## ENVIRONMENT NOTES

- **Vercel project:** linked via `npx vercel login` (avshi2@gmail.com). Run `npx vercel --prod` from `C:\revi-control-app` root (NOT from `revi-control-next` subfolder — that doubles the path and breaks the build).
- **CLAUDE_MODEL env var:** set in Vercel dashboard to `claude-sonnet-5`. Never paste `sk-ant-...` keys in chat.
- **Open-Meteo:** free, no API key, fetched client-side in LiveMap and server-side in weather-advice route.
- **Leaflet CDN:** standard NPM install, already in `package.json`. No CDN links.

---

## QUICK DEBUG GUIDE

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| White page / no map | Leaflet imported with SSR | Wrap in `dynamic(..., {ssr:false})` |
| "clamp not defined" in weather | Tried to import from simulation.ts | Add local `const clamp = (v,lo,hi) => Math.max(lo, Math.min(hi, v))` |
| AI returns garbled Hebrew ("דוש קצרים") | Wrong model (haiku) | Set `CLAUDE_MODEL=claude-sonnet-5` in Vercel env |
| Zone corner snapping back on drag | `setLatLng` called on handle being dragged | Only call `setLatLng` on cap, not during normal drag |
| Base "too far" transit calc | Measuring to zone center not edge | Use `Math.min(Math.max(base, Z.w), Z.e)` clamp |
| Endcard drone count wrong | Hardcoded number in JSX | Use `{droneCount}` from React state |
| Vercel stuck on old commit | GitHub auto-deploy broken | Always use `npx vercel --prod` manually |
| git push fails with lock error | Claude left locks from previous session | Run the lock-cleanup block before every commit |

---

*Handover written by Claude · Revi-Control · 11/09/2026 · v1.7.0*
