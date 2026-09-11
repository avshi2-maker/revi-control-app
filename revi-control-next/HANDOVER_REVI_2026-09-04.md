# HANDOVER — Revi-Control · 04/09/2026

## Repo & Deploy
- GitHub: `avshi2-maker/revi-control-app` (only correct repo)
- Local: `C:\revi-control-app` (Next.js root: `revi-control-next`)
- Vercel project: `revi-control-app` (team: sapirim) — root directory: `revi-control-next`
- Live: https://revi-control-app.vercel.app
- **Workflow with Avshi:** Claude WRITES files into the folder, does NOT run git. Avshi copy-pastes a PowerShell push block into Cursor. Never run git from the tool side (it leaves `.git/*.lock` files that only Avshi can clear).
- **.gitignore exists** at repo root — ignores `node_modules/` and `.next/`. Never `git add -A` without it (endless loop on 494MB node_modules).
- Standard push block:
  ```
  cd C:\revi-control-app
  Get-ChildItem -Path .git -Recurse -Filter *.lock -Force -ErrorAction SilentlyContinue | Remove-Item -Force
  git add <specific files by name>
  git commit -m "..."
  git push origin main
  ```

---

## Environment variables (Vercel → Settings → Environment Variables)
- `ANTHROPIC_API_KEY` = the `sk-ant-...` secret (Secret type, Production). **Required** for the AI weather advisor. Verified working.
- `CLAUDE_MODEL` (optional) — overrides the advisor model. Default is `claude-haiku-4-5-20251001` (fast, stays under Vercel timeout).
- After changing any env var → **Redeploy** (Deployments → ⋯ → Redeploy).
- Health check: `GET /api/weather-advice?live=1` → `{"keyPresent":true,"apiWorks":true}`.

---

## Routes
| Route | What it is |
|---|---|
| `/` | Operator entry = the shift wizard (was the raw map before 04/09) |
| `/cockpit` | Same cockpit client (wizard → live map + transport bar) |
| `/map` | Raw live map (direct, no wizard) |
| `/select` | 50-drone grid picker (land/ocean + pad) |
| `/station` | Camera-drone command view (simulated live feed + HUD + telemetry) |
| `/api/weather-advice` | POST = advisor (math + Claude). GET = health check. |

---

## What was built this session (04/09/2026)

### Shift wizard (`components/ShiftWizard.tsx`) — 9 steps
0 תרחיש (land/ocean) · 1 מזג אוויר (AI advisor) · 2 רחפנים · 3 משקל ואיזון · 4 מפה+שיגור · 5 אישור · 6 אלגוריתם · 7 סיכום · 8 שיגור.
- Header: **live clock+date** (dd/mm/yyyy HH:MM:SS) + two name boxes **מפעיל** + **אחראי משמרת** (carried to mission via `?op=` `&sup=`).
- Launch URL: `/cockpit?drones=..&pad=..&algo=..&scenario=ocean&eye=N&op=..&sup=..&base=lng,lat&zone=w,e,s,n`.

### AI weather advisor (`components/WeatherStep.tsx` + `app/api/weather-advice/route.ts` + `lib/weather.ts`)
- Pulls live Open-Meteo forecast for the zone; timestamp shown dd/mm/yyyy + "זמן אמת" + source.
- Deterministic MATH core = go/no-go thresholds (land 3/6, ocean 2/4 m/s), crab angle `asin(wind/10)`, upwind offset, lane tightening, drift estimate.
- Claude (`claude-haiku-4-5`) enriches Hebrew reasons + operator tips. Falls back to "מחושב" if key/call fails.
- **Confirm/abort gate** — must tick to proceed; NO-GO turns red.

### Weight & balance (`components/WeightStep.tsx`, spec in `lib/config.ts` → `DRONE_SPEC`)
- Dry weight + tank fill slider + sensor kit → total vs **MTOW 90kg**. Overweight = red + **blocks launch**.

### Battery / range gate (summary step)
- Fleet coverage vs zone area; weakest drone's battery. Too few drones / too big zone = **blocks launch**.

### Camera drone "the Eye"
- Wizard step 2 designates one drone as 🎥 Eye (gold). Launches first, orbits overwatch, no spray.
- **Land: returns to base after spray** ("חוזר לבסיס" → "נחת בבסיס"). Ocean: keeps observing.
- `/station` command view: simulated top-down feed + REC/ALT/coverage HUD + telemetry rail. 📹 link shows on live map when Eye assigned.

### Live map (`components/LiveMap.tsx`)
- Real wall clock + date in topbar.
- Flight timer + battery-remaining minutes (from launch), green→amber→red.
- **Land safe-return warning** — per-drone battery-range vs distance-home ×1.2; red card + pulsing banner if a drone can't get back.
- Live per-drone weight in each card (drops as tank drains).
- **Anti-drift crab overlay** — red wind arrow + crab-triangle HUD (crab°, wind, drift) + drones yaw into the wind while spraying. Toggle "🌬 דפוס נגד סחף".
- Zone editing: **SW/NE corners resize, ✥ center moves, H/⛵ = launch point** (corner-resize bug fixed 04/09).
- Detailed quadcopter icons (X-frame + rotor discs); Eye = gold gimbal.
- End-of-mission report (`components/MissionReport.tsx`): 14 fields incl. operator/supervisor, ocean cost, email/WhatsApp/print. Dates dd/mm/yyyy.

---

## Config knobs (`lib/config.ts`)
- `DRONE_SPEC` — model, dryKg 38, maxPayloadKg 40, mtowKg 90, tankMaxL 45, sensorKitKg 1.5, coverageDunamFull 400, flightMinutesFull 25, rangeKmFull 20, returnReserve 1.2.
- `OCEAN_UNIT_COST` 4200 ₪/expendable drone.
- `GEO` / `GEO_OCEAN` — default base + zone + center + zoom.
- `STATE_HE` — Hebrew state labels (incl. splash, camera).

---

## Architecture rules (do not break)
1. **Leaflet ssr:false** — LiveMap always via `dynamic(() => import("@/components/LiveMap"), { ssr:false })`.
2. `/`, `/cockpit`, `/map` behavior above — keep in sync intentionally.
3. `useSearchParams` needs a `<Suspense>` wrapper (CockpitClient/StationClient already do).
4. **Verify build before every push:** copy source to a Linux-native dir, `npm install`, `npm run build`. Never build on the mounted Windows folder (too slow, times out).
5. Corner-resize handles must NOT `setLatLng` the handle being dragged (fights Leaflet → snaps back).

---

## TASKS AFTER BREAK (priority order)

### 🔴 Task 1 — "Select all available" + camera-first rule
In the drones step (wizard step 2) and/or `/select`:
- Add a **bulk pick / tick: "בחר את כל הרחפנים הזמינים"** button (select all launch-ready drones at once).
- **Always indicate to start with the camera drone** — when bulk-selecting, prompt/auto-suggest designating the first available drone as the 🎥 Eye, and show a hint: "מומלץ לשגר תחילה את רחפן הצילום (עין)".
- Keep the existing single-pick + Eye selector working.

### 🟡 Task 2 — Ideas parked
- Battery-vs-distance range shown live per-drone in the fleet rail during flight (pre-flight gate already exists).
- Real WebRTC video for `/station` (hardware track — only when a drone actually streams).
- Multi-mission history at `/missions` (save runs to Supabase/localStorage).

---

## Context for next bot
- Avshi is not a coder — deliver complete files, English correspondence, Hebrew UI (RTL).
- Read this handover + `README.md` before building.
- The camera drone (Eye) is the valuable asset — it returns home on land; never treat it as expendable except visually at sea.
