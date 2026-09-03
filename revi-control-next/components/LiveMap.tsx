"use client";
import { useEffect, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { COLORS, NAMES, GEO, GEO_OCEAN, TIMELINE as T, STATE_HE } from "@/lib/config";
import {
  DUR, clamp, ease, boustro, pathLen, pointAt, evalDrone,
  batteryAt, tankAt, phaseText, fmtHM, fmtMS, type Pt,
} from "@/lib/simulation";

// Live map: real Esri satellite tiles + drones on GPS coordinates.
// URL params:
//   ?drones=1,2,3     — which drones to fly (default D1–D4)
//   ?scenario=ocean   — ocean bacteria-spray mode (expendable drones, boat launch)
export default function LiveMap() {
  // Expose isOcean to JSX (set early in useEffect since we're ssr:false)
  const [isOcean, setIsOcean] = useState(false);

  useEffect(() => {
    const RECORD = /[?&]record=1/.test(location.search);
    if (RECORD) document.body.classList.add("record");
    const g = (id: string) => document.getElementById(id)!;

    // Scenario detection — ocean mode swaps GEO, boat marker, disables RTB
    const ocean = new URLSearchParams(location.search).get("scenario") === "ocean";
    setIsOcean(ocean);
    const activeGEO = ocean ? GEO_OCEAN : GEO;

    // Which drones fly — from ?drones=1,2,3 ; default D1–D4.
    const rawSel = new URLSearchParams(location.search).get("drones");
    let droneNums = rawSel
      ? rawSel.split(",").map((s) => parseInt(s, 10)).filter((n) => Number.isFinite(n) && n > 0)
      : [];
    if (droneNums.length === 0) droneNums = [1, 2, 3, 4];
    const N = droneNums.length;
    const colorFor = (k: number) => COLORS[k] ?? `hsl(${(k * 47) % 360} 85% 62%)`;

    let base: Pt = [activeGEO.base.lng, activeGEO.base.lat];
    let Z = { ...activeGEO.zone }; // { w, e, s, n } — mutable so corners can reshape it

    const map = L.map("map", { zoomControl: true, attributionControl: true, preferCanvas: true })
      .setView(activeGEO.center, activeGEO.zoom);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      attribution: ocean
        ? "© Esri World Imagery · Revi-Control (ריסוס ימי — סימולציה)"
        : "© Esri World Imagery · Revi-Control (סימולציה)",
    }).addTo(map);

    // lanes (lng,lat)
    const drones: any[] = [];
    const padF = 0.06;
    function buildLanes() {
      const wspan = (Z.e - Z.w) / N;
      for (let i = 0; i < N; i++) {
        const a = Z.w + i * wspan + wspan * padF, b = Z.w + (i + 1) * wspan - wspan * padF;
        const lane = boustro(a, b, Z.s + (Z.n - Z.s) * 0.04, Z.n - (Z.n - Z.s) * 0.04, 6, "x");
        if (drones[i]) { drones[i].lane = lane; drones[i]._px = null; drones[i]._py = null; }
        else drones.push({ id: i, name: "D" + droneNums[i], color: colorFor(i), lane, heading: 0, _px: null, _py: null });
      }
    }
    buildLanes();

    // Ocean mode: track last spray position per drone so we can freeze at splash point
    const lastSprayPos: (Pt | null)[] = Array(N).fill(null);
    const lastDrawn: number[] = Array(N).fill(0);

    const sampleLane = (lane: Pt[], frac: number, M: number): [number, number][] => {
      const out: [number, number][] = []; if (frac <= 0) return out;
      for (let k = 0; k <= M; k++) { const pt = pointAt(lane, (frac * k) / M); out.push([pt[1], pt[0]]); }
      return out;
    };

    // layers
    const zoneRect = L.rectangle([[Z.s, Z.w], [Z.n, Z.e]], {
      color: ocean ? "#38bdf8" : "#22d3ee", weight: 2, dashArray: "9,7", fill: false,
    }).addTo(map);
    const substrips: any[] = [], routeLines: any[] = [], trailOuter: any[] = [], trailInner: any[] = [], droneMarkers: any[] = [];
    const wspan0 = (Z.e - Z.w) / N;
    const trailColor = ocean ? "#22d3ee" : "#38e08a"; // cyan trails for ocean, green for land
    for (let i = 0; i < N; i++) {
      const a = Z.w + i * wspan0, b = Z.w + (i + 1) * wspan0;
      substrips.push(L.rectangle([[Z.s, a], [Z.n, b]], { color: colorFor(i), weight: 1, opacity: 0, fillColor: colorFor(i), fillOpacity: 0 }).addTo(map));
      routeLines.push(L.polyline([], { color: colorFor(i), weight: 1.5, opacity: 0, dashArray: "5,6" }).addTo(map));
      trailOuter.push(L.polyline([], { color: trailColor, weight: 16, opacity: 0.16, lineCap: "round", lineJoin: "round" }).addTo(map));
      trailInner.push(L.polyline([], { color: trailColor, weight: 8, opacity: 0.34, lineCap: "round", lineJoin: "round" }).addTo(map));
    }

    // Base marker: helipad H for land, amber boat icon for ocean
    const baseIconHtml = ocean
      ? `<div class="base-ic"><div class="sq" style="background:#f5b301;color:#04121a;font-size:15px;line-height:32px">⛵</div><div class="t">ספינה · שיגור</div></div>`
      : `<div class="base-ic"><div class="sq">H</div><div class="t">בסיס · גרור</div></div>`;
    const baseIcon = L.divIcon({ className: "", html: baseIconHtml, iconSize: [40, 46], iconAnchor: [20, 15] });
    const baseMarker = L.marker([base[1], base[0]], { icon: baseIcon, draggable: true, zIndexOffset: 200 }).addTo(map);

    for (const d of drones) {
      const html = `<div class="drone-ic" style="--dc:${d.color}"><div class="halo"></div><div class="ring"></div><div class="lbl">${d.name}</div>` +
        `<svg class="body" viewBox="-14 -14 28 28"><g>` +
        `<circle cx="-9" cy="-7" r="2.6" fill="${d.color}"/><circle cx="9" cy="-7" r="2.6" fill="${d.color}"/>` +
        `<circle cx="-9" cy="7" r="2.6" fill="${d.color}"/><circle cx="9" cy="7" r="2.6" fill="${d.color}"/>` +
        `<path d="M0 -9 L6 7 L0 4 L-6 7 Z" fill="${d.color}"/></g></svg></div>`;
      const mk = L.marker([base[1], base[0]], { icon: L.divIcon({ className: "", html, iconSize: [26, 26], iconAnchor: [13, 13] }), interactive: false, zIndexOffset: 400 }).addTo(map);
      droneMarkers.push(mk);
    }

    // Draggable base + reshapeable zone corners + live coordinate readout
    let lastMouse: { lat: number; lng: number } | null = null;
    function updateCoordBox() {
      const cb = document.getElementById("coordbox"); if (!cb) return;
      const area = zoneAreaDunam();
      const baseLabel = ocean ? "ספינה" : "בסיס";
      const areaUnit = ocean ? "דונם ימי" : "דונם";
      cb.innerHTML =
        `<div style="opacity:.7;margin-bottom:3px">קואורדינטות (WGS84)</div>` +
        `<div><b style="color:#22d3ee">${baseLabel}</b> ${base[1].toFixed(5)}, ${base[0].toFixed(5)}</div>` +
        `<div><b style="color:#22d3ee">אזור</b> ${Z.s.toFixed(4)},${Z.w.toFixed(4)} ↔ ${Z.n.toFixed(4)},${Z.e.toFixed(4)}</div>` +
        `<div><b style="color:#22d3ee">שטח</b> ~${area.toLocaleString()} ${areaUnit}</div>` +
        (ocean ? `<div style="color:#fb5a6a;margin-top:2px"><b>מצב</b> חד-כיווני · רחפנים מתכלים</div>` : "") +
        (lastMouse ? `<div style="opacity:.8"><b>עכבר</b> ${lastMouse.lat.toFixed(5)}, ${lastMouse.lng.toFixed(5)}</div>` : "");
    }
    function zoneAreaDunam() {
      const midLat = ((Z.s + Z.n) / 2) * Math.PI / 180;
      const h = (Z.n - Z.s) * 111320;
      const w = (Z.e - Z.w) * 111320 * Math.cos(midLat);
      return Math.max(0, Math.round((h * w) / 1000));
    }
    function relayout() {
      const wspan = (Z.e - Z.w) / N;
      for (let i = 0; i < N; i++) substrips[i].setBounds([[Z.s, Z.w + i * wspan], [Z.n, Z.w + (i + 1) * wspan]]);
      zoneRect.setBounds([[Z.s, Z.w], [Z.n, Z.e]]);
      buildLanes();
    }
    baseMarker.on("drag", (e: any) => { base = [e.latlng.lng, e.latlng.lat]; updateCoordBox(); });
    const handleIcon = L.divIcon({ className: "", html: `<div style="width:16px;height:16px;border-radius:50%;background:#22d3ee;border:2px solid #06202e;box-shadow:0 0 8px #22d3ee;cursor:move"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] });
    const swH = L.marker([Z.s, Z.w], { icon: handleIcon, draggable: true, zIndexOffset: 600 }).addTo(map);
    const neH = L.marker([Z.n, Z.e], { icon: handleIcon, draggable: true, zIndexOffset: 600 }).addTo(map);
    const onHandle = () => {
      const sw = swH.getLatLng(), ne = neH.getLatLng();
      Z = { w: Math.min(sw.lng, ne.lng), e: Math.max(sw.lng, ne.lng), s: Math.min(sw.lat, ne.lat), n: Math.max(sw.lat, ne.lat) };
      relayout(); updateCoordBox();
    };
    swH.on("drag", onHandle); neH.on("drag", onHandle);
    map.on("mousemove", (e: any) => { lastMouse = { lat: e.latlng.lat, lng: e.latlng.lng }; updateCoordBox(); });
    updateCoordBox();

    // panel
    let cardEls: any[] = [], panelBuilt = false;
    function buildPanel() {
      const wrap = g("drones"); wrap.innerHTML = ""; cardEls = [];
      drones.forEach((d) => {
        const el = document.createElement("div"); el.className = "card"; el.style.setProperty("--dc", d.color);
        el.innerHTML =
          `<div class="row1"><div class="did">${d.name}</div><div class="name">רחפן ${d.name}</div><div class="state idle" data-state>בהמתנה</div></div>` +
          `<div class="metrics"><div class="m"><div class="mt"><span>סוללה</span><b data-bat>100%</b></div><div class="bar"><i data-batbar style="width:100%;background:var(--good)"></i></div></div>` +
          `<div class="m"><div class="mt"><span>מיכל תרסיס</span><b data-tank>100%</b></div><div class="bar"><i data-tankbar style="width:100%;background:var(--accent)"></i></div></div></div>` +
          `<div class="foot"><span class="spraytag" data-spray><i></i>ריסוס כבוי</span><span>מהירות <b data-spd>0.0</b> מ/ש</span><span>סיום <b data-eta>--</b></span></div>`;
        wrap.appendChild(el);
        cardEls.push({ el, state: el.querySelector("[data-state]"), bat: el.querySelector("[data-bat]"), batbar: el.querySelector("[data-batbar]"), tank: el.querySelector("[data-tank]"), tankbar: el.querySelector("[data-tankbar]"), spray: el.querySelector("[data-spray]"), spd: el.querySelector("[data-spd]"), eta: el.querySelector("[data-eta]") });
      });
      panelBuilt = true;
    }
    function updatePanel(s: number, states: any[], agg: any) {
      if (!panelBuilt) buildPanel();
      for (let i = 0; i < drones.length; i++) {
        const st = states[i], c = cardEls[i];
        c.state.textContent = STATE_HE[st.state] ?? st.state;
        // splash = ocean expendable — dim, not warning
        const isSplash = st.state === "splash";
        const isWarn = !isSplash && (st.state === "rtb" || st.state === "refill" || st.state === "rejoin");
        c.state.className = "state" + (st.state === "idle" ? " idle" : isWarn ? " warn" : isSplash ? " splash" : "");
        const bat = isSplash ? 0 : Math.round(batteryAt(i, s));
        const tank = isSplash ? 0 : Math.round(tankAt(i, s));
        c.bat.textContent = bat + "%"; c.batbar.style.width = bat + "%";
        c.batbar.style.background = bat < 25 ? "var(--bad)" : bat < 50 ? "var(--warn)" : "var(--good)";
        c.tank.textContent = tank + "%"; c.tankbar.style.width = tank + "%";
        c.tankbar.style.background = tank < 20 ? "var(--warn)" : "var(--accent)";
        c.spd.textContent = isSplash ? "0.0" : st.speed.toFixed(1);
        c.spray.className = "spraytag" + (st.spray ? " on" : "");
        c.spray.innerHTML = "<i></i>" + (isSplash ? "ריסוס הושלם" : st.spray ? "ריסוס פעיל" : "ריסוס כבוי");
        const etaMin = (st.state === "done" || isSplash) ? 0 : Math.max(0, Math.round((1 - st.prog) * 46));
        c.eta.textContent = (st.state === "done" || isSplash) ? "✓" : etaMin + " דק׳";
        c.el.classList.toggle("alert", isWarn);
        c.el.classList.toggle("splash", isSplash);
      }
      g("kCov").textContent = Math.round(agg.coverage * 100) + "%";
      g("kActive").textContent = agg.active + "/" + N;
      g("kTime").textContent = fmtHM(Math.max(12, 120 - Math.round(agg.coverage * 108)));
      g("clock").textContent = fmtMS(s);
      g("fleetState").textContent = s < T.launch[0] ? "בהמתנה" : s < T.spray[1] ? "משימה פעילה" : s < T.rth[1] ? (ocean ? "רחפנים נספו בים" : "חוזרים לבסיס") : "הושלם";
    }
    let lastPhase = "";
    function phase(s: number) {
      let p = phaseText(s);
      // Override RTH phase text for ocean
      if (ocean && s >= T.spray[1]) p = "בקטריות הוזרקו · רחפנים נספו בים";
      if (p !== lastPhase) { lastPhase = p; g("phaseTxt").textContent = p; g("phase").classList.toggle("show", !!p); }
    }
    function overlays(s: number) { g("titlecard").classList.toggle("hidden", s >= T.title[1]); g("endcard").classList.toggle("hidden", !(s >= T.end[0])); }

    let simTime = 0, playing = true, finished = false, lastTs: number | null = null, raf = 0;
    const scrubFill = () => g("scrub").querySelector(".fill") as HTMLElement;
    const scrubKnob = () => g("scrub").querySelector(".knob") as HTMLElement;

    function render(s: number) {
      const states: any[] = []; let covSum = 0, active = 0;
      const plan = clamp((s - T.plan[0]) / (T.plan[1] - T.plan[0]), 0, 1);
      for (let i = 0; i < drones.length; i++) {
        const st = evalDrone(i, s, drones[i].lane, base);
        const d = drones[i];

        // ─── Ocean mode: track last spray position, freeze drones at splash point ───
        let displayState = st.state;
        let displayPos: Pt = st.pos;
        let displayDrawn = st.drawn;
        if (ocean) {
          if (st.state === "spraying") {
            // Save position while actively spraying
            lastSprayPos[i] = st.pos;
            lastDrawn[i] = st.drawn;
          } else if (["rtb", "refill", "rejoin", "rth", "done"].includes(st.state)) {
            // Override: drone stays at last spray position — it splashed
            displayState = "splash";
            displayPos = lastSprayPos[i] ?? st.pos;
            displayDrawn = lastDrawn[i];
          }
        }
        // ─── End ocean override ───

        if (d._px != null) { const dx = displayPos[0] - d._px, dy = displayPos[1] - d._py; if (Math.hypot(dx, dy) > 1e-6) d.heading = Math.atan2(-dy, dx); }
        d._px = displayPos[0]; d._py = displayPos[1];

        // Position marker at display position (boat's lat/lng directly = correct Leaflet coords)
        droneMarkers[i].setLatLng([displayPos[1], displayPos[0]]);
        const el = droneMarkers[i].getElement();
        if (el) {
          const ic = el.querySelector(".drone-ic"), body = el.querySelector(".body") as HTMLElement;
          if (body) body.style.transform = `rotate(${d.heading + Math.PI / 2}rad)`;
          if (ic) {
            ic.classList.toggle("spray", st.spray);
            ic.classList.toggle("warn", displayState === "rtb" || displayState === "rejoin");
            // Fade out splashed drones slightly
            ic.classList.toggle("splash", displayState === "splash");
          }
          (el as HTMLElement).style.opacity = s >= T.launch[0] ? (displayState === "splash" ? "0.45" : "1") : "0";
        }

        const pts = s >= T.launch[0] ? sampleLane(d.lane, displayDrawn, 64) : [];
        trailOuter[i].setLatLngs(pts); trailInner[i].setLatLngs(pts);
        const rr = ease(clamp((plan - i * 0.08) / 0.7, 0, 1));
        routeLines[i].setStyle({ opacity: plan > 0 && s < T.spray[0] ? 0.55 * rr : 0 });
        if (plan > 0 && s < T.spray[0]) routeLines[i].setLatLngs(sampleLane(d.lane, rr, 40));
        const sa = ease(clamp((plan - i * 0.12) / 0.5, 0, 1));
        substrips[i].setStyle({ opacity: 0.35 * sa * (s < T.rth[1] ? 1 : 0.4), fillOpacity: 0.09 * sa * (s < T.rth[1] ? 1 : 0.5) });

        covSum += ocean ? (displayState === "splash" ? 1 : st.prog) : st.prog;
        // Splash drones are not "active" — they've already completed
        if (!ocean && ["takeoff", "spraying", "rtb", "rejoin", "rth"].includes(st.state)) active++;
        if (ocean && ["takeoff", "spraying"].includes(displayState)) active++;

        states[i] = { ...st, state: displayState, pos: displayPos, drawn: displayDrawn };
      }
      zoneRect.setStyle({ opacity: ease(clamp((s - T.mapin[0]) / (T.mapin[1] - T.mapin[0]), 0, 1)) });
      const agg = { coverage: clamp(covSum / drones.length, 0, 1), active: Math.min(N, active) };
      updatePanel(s, states, agg); phase(s); overlays(s);
      const pct = clamp(s / DUR, 0, 1); scrubFill().style.width = pct * 100 + "%"; scrubKnob().style.left = pct * 100 + "%";
    }
    function frame(ts: number) {
      if (lastTs === null) lastTs = ts; let dt = (ts - lastTs) / 1000; lastTs = ts; if (dt > 0.25) dt = 0.25;
      if (playing && !finished) { simTime += dt; if (simTime >= DUR) { simTime = DUR; finished = true; } }
      render(simTime); raf = requestAnimationFrame(frame);
    }
    function setPlaying(v: boolean) { playing = v; g("pausebadge").classList.toggle("show", !v); g("scrub").classList.toggle("paused", !v); }
    function seek(to: number) { simTime = clamp(to, 0, DUR); finished = simTime >= DUR; render(simTime); }
    function reset() {
      simTime = 0; finished = false; lastTs = null;
      // Reset ocean tracking arrays
      for (let i = 0; i < N; i++) { lastSprayPos[i] = null; lastDrawn[i] = 0; }
      setPlaying(true); buildPanel();
      g("titlecard").classList.remove("hidden"); g("endcard").classList.add("hidden");
      g("phase").classList.remove("show"); lastPhase = ""; render(0);
    }

    // Weather widget (Open-Meteo, no API key needed)
    const bearingToHe = (deg: number) => {
      const dirs = ["צפון","צ-מ","מזרח","ד-מ","דרום","ד-מ","מערב","צ-מ"];
      return dirs[Math.round(deg / 45) % 8];
    };
    (async () => {
      try {
        const center = activeGEO.center;
        const r = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${center[0]}&longitude=${center[1]}&current=temperature_2m,windspeed_10m,winddirection_10m,relativehumidity_2m&windspeed_unit=ms&timezone=auto`
        );
        const d = await r.json();
        const c = d.current;
        const ws: number = c.windspeed_10m;
        const temp = Math.round(c.temperature_2m);
        const hum = Math.round(c.relativehumidity_2m);
        const wdir = bearingToHe(c.winddirection_10m);
        // Ocean has stricter wind threshold (Beaufort 2 = ~3 m/s for marine ops)
        const ok = ocean
          ? (ws < 2 ? "✅ ים שקט — שיגור תקין" : ws < 4 ? "⚠️ גלים קלים — בזהירות" : "🚫 ים סוער — לא לשגר")
          : (ws < 3 ? "✅ מתאים לריסוס" : ws < 6 ? "⚠️ רוח מתונה — זהירות" : "🚫 רוח חזקה — לא לרסס");
        const col = ws < (ocean ? 2 : 3) ? "var(--good)" : ws < (ocean ? 4 : 6) ? "var(--warn)" : "var(--bad)";
        const wEl = g("weather");
        if (wEl) {
          wEl.innerHTML = `<div class="w-row"><span>🌡 ${temp}°C</span><span>💧 ${hum}%</span></div><div class="w-row"><span>🌬 ${ws.toFixed(1)} מ/ש ${wdir}</span></div><div class="w-proto" style="color:${col}">${ok}</div>`;
          wEl.classList.add("loaded");
        }
      } catch { /* silent */ }
    })();

    const onReplay = () => reset();
    g("replay").addEventListener("click", onReplay);
    g("endReplay").addEventListener("click", onReplay);
    let dragging = false;
    const scrubTo = (ev: any) => { const el = g("scrub"); const r = el.getBoundingClientRect(); const x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left; seek((x / r.width) * DUR); };
    const onDown = (e: any) => { dragging = true; setPlaying(false); scrubTo(e); e.stopPropagation(); };
    const onMove = (e: any) => { if (dragging) scrubTo(e); };
    const onUp = () => { dragging = false; };
    const onKey = (e: KeyboardEvent) => {
      if (RECORD) return;
      if (e.code === "Space") { e.preventDefault(); setPlaying(!playing); }
      else if (e.code === "ArrowRight") { e.preventDefault(); setPlaying(false); seek(simTime + 2); }
      else if (e.code === "ArrowLeft") { e.preventDefault(); setPlaying(false); seek(simTime - 2); }
      else if (e.key === "r" || e.key === "R") reset();
    };
    if (!RECORD) {
      g("scrub").addEventListener("mousedown", onDown);
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      document.addEventListener("keydown", onKey);
    }
    const onResize = () => setTimeout(() => map.invalidateSize(), 120);
    window.addEventListener("resize", onResize);
    setTimeout(() => map.invalidateSize(), 200);

    reset();
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      g("replay")?.removeEventListener("click", onReplay);
      g("endReplay")?.removeEventListener("click", onReplay);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("record");
      map.remove();
    };
  }, []);

  return (
    <div id="app">
      <aside id="panel">
        <div className="p-head">
          <h2>מרכז שליטה — צי ריסוס אוטונומי</h2>
          {isOcean ? (
            <>
              <div className="mission" style={{ color: "var(--accent)" }}>משימה: ריסוס בקטריות — ים תיכון</div>
              <div className="sub">
                <span>שטח יעד: <b>~1,240 דונם ימי</b></span>
                <span style={{ color: "var(--bad)" }}>⚠ רחפנים מתכלים</span>
              </div>
              <div className="sub" style={{ fontSize: "11px", color: "var(--muted)", marginTop: 4, lineHeight: 1.5 }}>
                שיגור חד-כיווני · הרחפנים מתכלים בים עם סיום המשימה · עלות מוכרת בחוזה
              </div>
            </>
          ) : (
            <>
              <div className="mission">משימה: ריסוס פרדסים — עמק השרון</div>
              <div className="sub">
                <span>שטח יעד: <b>420 דונם</b></span>
                <span>רחפנים: <b>4</b></span>
                <span>חלון זמן: <b>2:00 שעות</b></span>
              </div>
            </>
          )}
        </div>
        <div id="drones" />
        <div className="p-foot">
          <span className="fleet">מצב צי: <b id="fleetState">בהמתנה</b></span>
          <span id="clock">00:00</span>
        </div>
      </aside>

      <div id="stage">
        <div id="map" />
        <div id="topbar">
          <div className="brand">
            <div className="logo" />
            <div><b>Revi-Control</b><span>{isOcean ? "Bacteria Spray · Mediterranean" : "Autonomous Spray Fleet · Live Map"}</span></div>
          </div>
          <div className="kpis">
            <div className="kpi cov"><div className="v" id="kCov">0%</div><div className="l">כיסוי</div></div>
            <div className="kpi"><div className="v" id="kActive">0/4</div><div className="l">פעילים</div></div>
            <div className="kpi time"><div className="v" id="kTime">2:00</div><div className="l">זמן שנותר</div></div>
            <div className="livebadge"><span className="livedot" />LIVE</div>
          </div>
        </div>
        <div id="phase"><span id="phaseTxt" /><span className="dotp" /></div>
        <div id="pausebadge">⏸ מושהה — מצב הדגמה</div>

        <div className="overlay" id="titlecard">
          <div className="biglogo" />
          <h1>Revi-Control</h1>
          {isOcean ? (
            <>
              <div className="tag">ריסוס בקטריות ימי · ים תיכון</div>
              <div className="desc">שיגור חד-כיווני מספינה · ריסוס שטח ימי · רחפנים מתכלים — עלות מוכרת על-פי הסכם חוזי.</div>
            </>
          ) : (
            <>
              <div className="tag">מרכז שליטה לצי ריסוס אוטונומי · עמק השרון</div>
              <div className="desc">תכנון, שיגור ובקרה של מספר רחפנים לכיסוי שטחים גדולים בזמן קצוב — על מפת לוויין חיה.</div>
            </>
          )}
        </div>
        <div className="overlay hidden" id="endcard">
          <div className="biglogo" />
          <h1>{isOcean ? "הריסוס הושלם" : "המשימה הושלמה"}</h1>
          <div className="tag">100% כיסוי · אפס התערבות ידנית</div>
          {isOcean ? (
            <div className="endrow">
              <div className="stat"><div className="n">~1,240</div><div className="c">דונם ימי</div></div>
              <div className="stat"><div className="n">1:48</div><div className="c">שעות בפועל</div></div>
              <div className="stat" style={{ color: "var(--bad)" }}><div className="n">4</div><div className="c">רחפנים נספו</div></div>
            </div>
          ) : (
            <div className="endrow">
              <div className="stat"><div className="n">420</div><div className="c">דונם טופלו</div></div>
              <div className="stat"><div className="n">1:48</div><div className="c">שעות בפועל</div></div>
              <div className="stat"><div className="n">4</div><div className="c">רחפנים</div></div>
            </div>
          )}
          <div className="contact"><b>Revi-Control</b> · תוכנת מרכז השליטה · צרו קשר להדגמה</div>
          <button className="endcard-btn" id="endReplay">
            <svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z" /></svg>
            הפעל שוב
          </button>
        </div>

        <button id="replay" title="הפעל שוב">
          <svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z" /></svg>
          הפעל שוב
        </button>
        <a className="navlink" href="/">← תצוגת סקיצה</a>
        <a className="navlink navlink2" href="/select">← בחר רחפנים</a>
        <div id="weather" />
        <div id="coordbox" style={{ position: "absolute", left: 12, bottom: 74, zIndex: 700, background: "rgba(8,20,32,.85)", color: "#d6ecff", font: "12px/1.6 'Segoe UI', sans-serif", padding: "8px 11px", borderRadius: 10, border: "1px solid rgba(120,190,220,.28)", direction: "ltr", pointerEvents: "none", minWidth: 200, boxShadow: "0 6px 20px rgba(0,0,0,.35)" }} />
        <div id="hint">רווח <b>=</b> השהה · <b>← →</b> דילוג · <b>R</b> מהתחלה · גרור את <b>{isOcean ? "הספינה" : "הבסיס"}</b> ואת <b>פינות האזור</b></div>
        <div id="scrub"><div className="track" /><div className="fill" /><div className="knob" /></div>
      </div>
    </div>
  );
}
