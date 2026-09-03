"use client";
import { useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { COLORS, NAMES, GEO, TIMELINE as T, STATE_HE } from "@/lib/config";
import {
  DUR, clamp, ease, boustro, pathLen, pointAt, evalDrone,
  batteryAt, tankAt, phaseText, fmtHM, fmtMS, type Pt,
} from "@/lib/simulation";

// Live map: real Esri satellite tiles + drones on GPS coordinates.
export default function LiveMap() {
  useEffect(() => {
    const RECORD = /[?&]record=1/.test(location.search);
    if (RECORD) document.body.classList.add("record");
    const g = (id: string) => document.getElementById(id)!;

    const base: Pt = [GEO.base.lng, GEO.base.lat];
    const Z = GEO.zone;

    const map = L.map("map", { zoomControl: true, attributionControl: true, preferCanvas: true }).setView(GEO.center, GEO.zoom);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19, attribution: "© Esri World Imagery · Revi-Control (סימולציה)",
    }).addTo(map);

    // lanes (lng,lat)
    const drones: any[] = [];
    const strips = 4, wspan = (Z.e - Z.w) / strips, padF = 0.06;
    for (let i = 0; i < strips; i++) {
      const a = Z.w + i * wspan + wspan * padF, b = Z.w + (i + 1) * wspan - wspan * padF;
      const lane = boustro(a, b, Z.s + (Z.n - Z.s) * 0.04, Z.n - (Z.n - Z.s) * 0.04, 6, "x");
      drones.push({ id: i, name: NAMES[i], color: COLORS[i], lane, heading: 0, _px: null, _py: null });
    }
    const sampleLane = (lane: Pt[], frac: number, N: number): [number, number][] => {
      const out: [number, number][] = []; if (frac <= 0) return out;
      for (let k = 0; k <= N; k++) { const pt = pointAt(lane, (frac * k) / N); out.push([pt[1], pt[0]]); }
      return out;
    };

    // layers
    const zoneRect = L.rectangle([[Z.s, Z.w], [Z.n, Z.e]], { color: "#22d3ee", weight: 2, dashArray: "9,7", fill: false }).addTo(map);
    const substrips: any[] = [], routeLines: any[] = [], trailOuter: any[] = [], trailInner: any[] = [], droneMarkers: any[] = [];
    for (let i = 0; i < strips; i++) {
      const a = Z.w + i * wspan, b = Z.w + (i + 1) * wspan;
      substrips.push(L.rectangle([[Z.s, a], [Z.n, b]], { color: COLORS[i], weight: 1, opacity: 0, fillColor: COLORS[i], fillOpacity: 0 }).addTo(map));
      routeLines.push(L.polyline([], { color: COLORS[i], weight: 1.5, opacity: 0, dashArray: "5,6" }).addTo(map));
      trailOuter.push(L.polyline([], { color: "#38e08a", weight: 16, opacity: 0.16, lineCap: "round", lineJoin: "round" }).addTo(map));
      trailInner.push(L.polyline([], { color: "#38e08a", weight: 8, opacity: 0.34, lineCap: "round", lineJoin: "round" }).addTo(map));
    }
    const baseIcon = L.divIcon({ className: "", html: `<div class="base-ic"><div class="sq">H</div><div class="t">בסיס</div></div>`, iconSize: [40, 46], iconAnchor: [20, 15] });
    L.marker([base[1], base[0]], { icon: baseIcon, interactive: false, zIndexOffset: 200 }).addTo(map);
    for (const d of drones) {
      const html = `<div class="drone-ic" style="--dc:${d.color}"><div class="halo"></div><div class="ring"></div><div class="lbl">${d.name}</div>` +
        `<svg class="body" viewBox="-14 -14 28 28"><g>` +
        `<circle cx="-9" cy="-7" r="2.6" fill="${d.color}"/><circle cx="9" cy="-7" r="2.6" fill="${d.color}"/>` +
        `<circle cx="-9" cy="7" r="2.6" fill="${d.color}"/><circle cx="9" cy="7" r="2.6" fill="${d.color}"/>` +
        `<path d="M0 -9 L6 7 L0 4 L-6 7 Z" fill="${d.color}"/></g></svg></div>`;
      const mk = L.marker([base[1], base[0]], { icon: L.divIcon({ className: "", html, iconSize: [26, 26], iconAnchor: [13, 13] }), interactive: false, zIndexOffset: 400 }).addTo(map);
      droneMarkers.push(mk);
    }

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
        c.state.textContent = STATE_HE[st.state];
        c.state.className = "state" + (st.state === "idle" ? " idle" : (st.state === "rtb" || st.state === "refill" || st.state === "rejoin") ? " warn" : "");
        const bat = Math.round(batteryAt(i, s)), tank = Math.round(tankAt(i, s));
        c.bat.textContent = bat + "%"; c.batbar.style.width = bat + "%";
        c.batbar.style.background = bat < 25 ? "var(--bad)" : bat < 50 ? "var(--warn)" : "var(--good)";
        c.tank.textContent = tank + "%"; c.tankbar.style.width = tank + "%";
        c.tankbar.style.background = tank < 20 ? "var(--warn)" : "var(--accent)";
        c.spd.textContent = st.speed.toFixed(1);
        c.spray.className = "spraytag" + (st.spray ? " on" : "");
        c.spray.innerHTML = "<i></i>" + (st.spray ? "ריסוס פעיל" : "ריסוס כבוי");
        const etaMin = st.state === "done" ? 0 : Math.max(0, Math.round((1 - st.prog) * 46));
        c.eta.textContent = st.state === "done" ? "✓" : etaMin + " דק׳";
        c.el.classList.toggle("alert", st.state === "rtb" || st.state === "refill" || st.state === "rejoin");
      }
      g("kCov").textContent = Math.round(agg.coverage * 100) + "%";
      g("kActive").textContent = agg.active + "/4";
      g("kTime").textContent = fmtHM(Math.max(12, 120 - Math.round(agg.coverage * 108)));
      g("clock").textContent = fmtMS(s);
      g("fleetState").textContent = s < T.launch[0] ? "בהמתנה" : s < T.spray[1] ? "משימה פעילה" : s < T.rth[1] ? "חוזרים לבסיס" : "הושלם";
    }
    let lastPhase = "";
    function phase(s: number) { const p = phaseText(s); if (p !== lastPhase) { lastPhase = p; g("phaseTxt").textContent = p; g("phase").classList.toggle("show", !!p); } }
    function overlays(s: number) { g("titlecard").classList.toggle("hidden", s >= T.title[1]); g("endcard").classList.toggle("hidden", !(s >= T.end[0])); }

    let simTime = 0, playing = true, finished = false, lastTs: number | null = null, raf = 0;
    const scrubFill = () => g("scrub").querySelector(".fill") as HTMLElement;
    const scrubKnob = () => g("scrub").querySelector(".knob") as HTMLElement;

    function render(s: number) {
      const states: any[] = []; let covSum = 0, active = 0;
      const plan = clamp((s - T.plan[0]) / (T.plan[1] - T.plan[0]), 0, 1);
      for (let i = 0; i < drones.length; i++) {
        const st = evalDrone(i, s, drones[i].lane, base); states[i] = st;
        const d = drones[i];
        if (d._px != null) { const dx = st.pos[0] - d._px, dy = st.pos[1] - d._py; if (Math.hypot(dx, dy) > 1e-6) d.heading = Math.atan2(-dy, dx); }
        d._px = st.pos[0]; d._py = st.pos[1];
        droneMarkers[i].setLatLng([st.pos[1], st.pos[0]]);
        const el = droneMarkers[i].getElement();
        if (el) {
          const ic = el.querySelector(".drone-ic"), body = el.querySelector(".body") as HTMLElement;
          if (body) body.style.transform = `rotate(${d.heading + Math.PI / 2}rad)`;
          if (ic) { ic.classList.toggle("spray", st.spray); ic.classList.toggle("warn", st.state === "rtb" || st.state === "rejoin"); }
          (el as HTMLElement).style.opacity = s >= T.launch[0] ? "1" : "0";
        }
        const pts = s >= T.launch[0] ? sampleLane(d.lane, st.drawn, 64) : [];
        trailOuter[i].setLatLngs(pts); trailInner[i].setLatLngs(pts);
        const rr = ease(clamp((plan - i * 0.08) / 0.7, 0, 1));
        routeLines[i].setStyle({ opacity: plan > 0 && s < T.spray[0] ? 0.55 * rr : 0 });
        if (plan > 0 && s < T.spray[0]) routeLines[i].setLatLngs(sampleLane(d.lane, rr, 40));
        const sa = ease(clamp((plan - i * 0.12) / 0.5, 0, 1));
        substrips[i].setStyle({ opacity: 0.35 * sa * (s < T.rth[1] ? 1 : 0.4), fillOpacity: 0.09 * sa * (s < T.rth[1] ? 1 : 0.5) });
        covSum += st.prog;
        if (["takeoff", "spraying", "rtb", "rejoin", "rth"].includes(st.state)) active++;
      }
      zoneRect.setStyle({ opacity: ease(clamp((s - T.mapin[0]) / (T.mapin[1] - T.mapin[0]), 0, 1)) });
      const agg = { coverage: clamp(covSum / drones.length, 0, 1), active: Math.min(4, active) };
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
    function reset() { simTime = 0; finished = false; lastTs = null; setPlaying(true); buildPanel(); g("titlecard").classList.remove("hidden"); g("endcard").classList.add("hidden"); g("phase").classList.remove("show"); lastPhase = ""; render(0); }

    // Weather widget (Open-Meteo, no API key needed)
    const bearingToHe = (deg: number) => {
      const dirs = ["צפון","צ-מ","מזרח","ד-מ","דרום","ד-מ","מערב","צ-מ"];
      return dirs[Math.round(deg / 45) % 8];
    };
    (async () => {
      try {
        const r = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${GEO.center[0]}&longitude=${GEO.center[1]}&current=temperature_2m,windspeed_10m,winddirection_10m,relativehumidity_2m&windspeed_unit=ms&timezone=auto`
        );
        const d = await r.json();
        const c = d.current;
        const ws: number = c.windspeed_10m;
        const temp = Math.round(c.temperature_2m);
        const hum = Math.round(c.relativehumidity_2m);
        const wdir = bearingToHe(c.winddirection_10m);
        const ok = ws < 3 ? "✅ מתאים לריסוס" : ws < 6 ? "⚠️ רוח מתונה — זהירות" : "🚫 רוח חזקה — לא לרסס";
        const col = ws < 3 ? "var(--good)" : ws < 6 ? "var(--warn)" : "var(--bad)";
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
          <div className="mission">משימה: ריסוס פרדסים — עמק השרון</div>
          <div className="sub">
            <span>שטח יעד: <b>420 דונם</b></span>
            <span>רחפנים: <b>4</b></span>
            <span>חלון זמן: <b>2:00 שעות</b></span>
          </div>
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
            <div><b>Revi-Control</b><span>Autonomous Spray Fleet · Live Map</span></div>
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
          <div className="tag">מרכז שליטה לצי ריסוס אוטונומי · עמק השרון</div>
          <div className="desc">תכנון, שיגור ובקרה של מספר רחפנים לכיסוי שטחים גדולים בזמן קצוב — על מפת לוויין חיה.</div>
        </div>
        <div className="overlay hidden" id="endcard">
          <div className="biglogo" />
          <h1>המשימה הושלמה</h1>
          <div className="tag">100% כיסוי · אפס התערבות ידנית</div>
          <div className="endrow">
            <div className="stat"><div className="n">420</div><div className="c">דונם טופלו</div></div>
            <div className="stat"><div className="n">1:48</div><div className="c">שעות בפועל</div></div>
            <div className="stat"><div className="n">4</div><div className="c">רחפנים</div></div>
          </div>
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
        <div id="hint">רווח <b>=</b> השהה · <b>← →</b> דילוג · <b>R</b> מהתחלה · אפשר לגרור ולהתקרב במפה</div>
        <div id="scrub"><div className="track" /><div className="fill" /><div className="knob" /></div>
      </div>
    </div>
  );
}
