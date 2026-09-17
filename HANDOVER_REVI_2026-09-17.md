# REVI-CONTROL — SESSION HANDOVER
**Date:** 17/09/2026
**Version live:** v1.10.0
**Repo:** `C:\revi-control-app`  ·  **App root:** `C:\revi-control-app\revi-control-next`
**Deploy:** `npx vercel --prod` from `C:\revi-control-app`
**Live URL:** https://revi-control-app.vercel.app (confirm in Vercel dashboard)
**Stack:** Next.js 15 · TypeScript · Leaflet (client-only) · Open-Meteo · Claude API (claude-sonnet-5) · Vercel

> This file supersedes HANDOVER_REVI_2026-09-11.md for current state. That older file still holds the **deep architecture** (LiveMap internals, wizard flow, physics math) — read it too for anything not covered here.

---

## ⚠️ FIRST THING NEXT SESSION — TEST BASH, THEN FINISH LIVE TESTING

**Bash (Linux shell) was DEAD this entire session** — a Windows update (Sept 8, 2026) broke the workspace file mount. Every `mcp__workspace__bash` call failed with a virtiofs/Plan9 mount error. File tools (Read/Write/Edit) were unaffected, so all code + docs shipped.

**A fresh session usually resets the sandbox and clears this wedge — but not guaranteed** (depends whether the Windows mount is repaired). So:

**STEP 1 — Test bash immediately:**
```
echo "alive" && cd /sessions/*/mnt/revi-control-app/revi-control-next && node -v && npm -v
```
- If it returns cleanly → bash works → do STEP 2 (the live-testing that was blocked).
- If it errors with a mount/virtiofs failure → still broken → skip to the browser-verify fallback below.

**STEP 2 — Live testing that COULD NOT be done this session (needs working bash):**

| Task | Command | Why it was blocked |
|---|---|---|
| **Dependency audit (OWASP A03)** | `cd revi-control-next && npm install && npm audit` | Needs npm — bash dead |
| **Commit lockfile (A03/A08)** | after `npm install`, commit `package-lock.json` | No lockfile exists in repo yet |
| **Local prod build check** | `npm run build` | Verify no build errors before deploy |
| **Verify security headers** | `curl -I https://<live-url>/` | Confirm CSP/HSTS/X-Frame-Options actually served |
| **Native .docx of the reports** | use `docx` skill (node) | Skill needs node/bash — was delivered as HTML instead |

**FALLBACK if bash still broken (browser-only verification, no shell):**
- Open the live site → confirm (1) satellite map tiles load, (2) AI weather advisor returns Hebrew text. If both work, the CSP from v1.9.0 is good.
- `npm audit` / lockfile / native .docx → tell Avshi they still need a working shell; do NOT claim them done.

---

## GOLDEN RULES

1. **Leaflet = client-only always** — `dynamic(() => import(...), { ssr: false })`. Breaking this = white page.
2. **Never run git from Claude** — locks accumulate. Deliver the push block, Avshi runs it.
3. **Bump `APP_VERSION`** in `lib/config.ts` on EVERY deploy. Now `1.10.0`.
4. **All UI text Hebrew (RTL)**; correspondence English. Avshi is not a coder — deliver finished files, don't ask him to edit.
5. **Never paste `sk-ant-...` secrets** in chat or code — only into Vercel's env box.
6. **Don't publish security-vuln details publicly** — attacker roadmap. Buyer-facing pages show posture/status only.

## PUSH BLOCK (paste every deploy)
```powershell
cd C:\revi-control-app
Get-ChildItem -Path .git -Recurse -Filter *.lock -Force -ErrorAction SilentlyContinue | Remove-Item -Force
git add -A
git commit -m "feat: vX.X.X — describe"
git push origin main
npx vercel --prod
```

---

## WHAT WAS BUILT THIS SESSION (v1.7.0 → v1.10.0)

**v1.7.0 — Operator position safety**
- `LiveMap.tsx`: dragging the base (H/boat) into the spray zone snaps it back to the nearest edge + red banner (`#baseinsidewarn`).
- `ShiftWizard.tsx`: `baseInZone` check gates step 4 (`canNext[4] = !baseInZone`); red warning in step 4; summary row in step 7.
- `pitch/page.tsx`: new "בקרת מיקום מפעיל" card + enriched anti-drift card (arcsin formula).

**v1.8.0 — Contact + share**
- Phone `050-5231042` added to wizard footer, pitch footer, and the report HTML footer.
- `Revi-Control_System_Report_HE.html`: added 🖨 print / ✉ mail / 💬 WhatsApp share buttons (mail/WA need the page hosted — they share `location.href`).

**v1.9.0 — SECURITY RELEASE (OWASP Top 10:2025 audit)**
- `next.config.mjs`: added security headers — CSP, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy, HSTS. CSP is permissive on script/style (`unsafe-inline`) to not break Next hydration + Leaflet; locks frame-ancestors, connect-src (self + open-meteo), img-src https:, object-src none. **If the map ever blanks after deploy, widen only the failing directive.**
- `app/api/weather-advice/route.ts`: fail-open rate limiter (30/min/IP) — over-limit callers still get valid deterministic advice, just skip the paid Claude call. Trimmed GET `?live=1` info leak (no more raw Anthropic error bodies; 429 on over-limit).

**v1.10.0 — Presentation + copyright**
- `components/FullscreenButton.tsx` (NEW client component): "⛶ מצב מצגת" fullscreen toggle, added to pitch hero CTAs.
- `lib/config.ts`: added `COPYRIGHT` + `LEGAL_NOTICE` constants.
- Copyright + legal notice added to footers: pitch page, verification page, wizard (© tag), report HTML, and the hosted Security & Value page.

**Deliverables produced (not code):**
- `Revi-Control_System_Report_HE.html` — full A-Z system report (cover, 22 features, specs, advantages, transparency, upgrade path). Print-ready A4 Hebrew RTL. Opens in Word.
- **Security & Value hosted page** — Claude artifact at `https://claude.ai/artifact/KNyySenJ6ukYd2mazBRyty` (v2). Buyer-facing: OWASP badge, 6 green security pillars, price anchor ($250k build / $4k-yr SaaS / Revi-Control ready). Private until Avshi shares via the page's Share menu.
- `Revi-Control_NDA_HE.html` — Hebrew NDA/non-use template (parties, confidential info, no-copy/no-reverse-engineer, IP ownership, term, remedies, Israeli jurisdiction, signature blocks). **Template only — needs a lawyer's review before use.**

---

## SECURITY AUDIT — STATUS (OWASP Top 10:2025, official, finalized Jan 2026)

| Cat | Status | Note |
|---|---|---|
| A01 Broken Access Control | 🟡 Partial | Rate limiter added (code-reviewed, not runtime-tested). Prod needs real limiter (Vercel KV/Upstash) + auth |
| A02 Security Misconfiguration | 🟡 Fixed in code | Headers/CSP added — VERIFY on live deploy (map + advisor still load) |
| A03 Software Supply Chain | 🔴 OPEN | No `package-lock.json`; `npm audit` never run — **needs bash** |
| A04 Cryptographic Failures | 🟢 OK | Key server-side only, gitignored, HTTPS |
| A05 Injection | 🟢 OK | No SQL/DB; LLM output React-escaped (no XSS) |
| A06 Insecure Design | 🟡 Partial | Rate limiter; production needs auth |
| A07 Authentication Failures | 🟡 Demo-OK | No auth by design for public demo; CRITICAL before real drone control |
| A08 Software/Data Integrity | 🔴 OPEN | Enable GitHub 2FA + branch protection; commit lockfile |
| A09 Logging & Alerting | 🔴 OPEN | Set Anthropic spend cap + Vercel log alerts |
| A10 Mishandling Exceptions | 🟢 Fixed | Strong try/catch, fail-safe; trimmed health-check leak |

**Open items requiring Avshi's action (not code):**
1. Run `npm audit` + commit lockfile (needs bash).
2. Set Anthropic Console spending cap + billing alert.
3. GitHub: enable 2FA + branch protection on `main`.
4. Before real deployment: add user authentication + server-based rate limiting.

---

## FILE MAP — ADDITIONS THIS SESSION
```
revi-control-next/
├── next.config.mjs                → NOW has security headers (was near-empty)
├── components/FullscreenButton.tsx → NEW — presentation fullscreen toggle
├── lib/config.ts                   → APP_VERSION 1.10.0 + COPYRIGHT + LEGAL_NOTICE
├── app/api/weather-advice/route.ts → rate limiter + trimmed info leak
├── app/pitch/page.tsx              → fullscreen btn + operator card + copyright footer
├── app/verification/page.tsx       → copyright/legal footer + phone
└── components/ShiftWizard.tsx      → base-in-zone gate + © in footer

C:\revi-control-app\ (root, deliverables — gitignore-worthy, not app code):
├── Revi-Control_System_Report_HE.html   → full system report
├── Revi-Control_NDA_HE.html             → NDA template
├── revi-security-value.html             → source of the hosted Security&Value artifact
├── HANDOVER_REVI_2026-09-17.md          → THIS FILE
└── HANDOVER_REVI_2026-09-11.md          → prior (deep architecture)
```

---

## PENDING / NEXT TASKS (priority order)
1. **Deploy v1.10.0** (fullscreen + copyright) — see push block. Not yet confirmed deployed.
2. **Bash live-testing** (STEP 2 above) once a session has a working shell.
3. **npm audit + lockfile commit** (A03).
4. **Anthropic spend cap + GitHub 2FA/branch protection** (A08/A09) — Avshi actions.
5. Optional: native `.docx` versions of the report + NDA (needs docx skill / bash).
6. Consider adding `HANDOVER_*.md` and the root `*.html` deliverables to `.gitignore` to keep the repo clean (Avshi's call).

## FERRARI IDEAS (pitched, not built)
1. **WhatsApp mission-report bot** (quick) — one tap sends the mission summary to a WhatsApp number after completion.
2. **Live telemetry replay** (medium) — scrub recorded GPS tracks over satellite for debrief/regulatory proof.
3. **Real NDVI from Sentinel-2** (big) — replace synthetic NDVI with Copernicus satellite data; makes variable-rate a real commercial feature.

---
*Handover · Revi-Control · 17/09/2026 · v1.10.0 · Bash was down this session — next session must re-test it before claiming any runtime verification.*
