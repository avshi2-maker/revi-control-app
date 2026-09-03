"use client";
import { useEffect } from "react";
import { COLORS, NAMES, TIMELINE as T, D3, STATE_HE } from "@/lib/config";
import {
  DUR, clamp, ease, lerp, boustro, pathLen, pointAt, evalDrone,
  batteryAt, tankAt, progAt, phaseText, fmtHM, fmtMS, type Pt,
} from "@/lib/simulation";

// Teaser: stylized animated command center on a <canvas>. All imperative drawing
// lives in the effect; the JSX only provides the containers.
export default function Teaser() {
  useEffect(() => {
    const RECORD = /[?&]record=1/.test(location.search);
    if (RECORD) document.body.classList.add("record");

    const cv = document.getElementById("map") as HTMLCanvasElement;
    const ctx = cv.getContext("2d")!;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0;
    const L: any = {};
    let drones: any[] = [];

    function buildDrones() {
      drones = [];
      const z = L.zone, strips = 4, pad = z.w * 0.012;
      for (let i = 0; i < strips; i++) {
        const x0 = z.x + i * (z.w / strips) + pad;
        const x1 = z.x + (i + 1) * (z.w / strips) - pad;
        const lane = boustro(x0, x1, z.y + z.h * 0.06, z.y + z.h * 0.94, 6, "x");
        drones.push({ id: i, name: NAMES[i], color: COLORS[i], lane, heading: -Math.PI / 2, _px: null, _py: null });
      }
    }
    function layout() {
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * DPR; cv.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      L.coastY = H * 0.8;
      L.base = { x: W * 0.5, y: H * 0.885 };
      const zw = Math.min(W * 0.68, 900), zh = Math.min(H * 0.52, 430);
      L.zone = { x: (W - zw) / 2, y: H * 0.14, w: zw, h: zh };
      buildDrones();
    }

    const hexA = (hex: string, a: number) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
    const baseP = (): Pt => [L.base.x, L.base.y];
    const laneW = () => (L.zone.h * 0.88 / 6) * 0.9;

    function drawPartial(p: Pt[], rev: number, col: string, lw: number, dash: number[] | null) {
      if (rev <= 0) return;
      const total = pathLen(p), target = rev * total; let acc = 0;
      ctx.strokeStyle = col; ctx.lineWidth = lw; if (dash) ctx.setLineDash(dash);
      ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
      for (let i = 1; i < p.length; i++) {
        const seg = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
        if (acc + seg <= target) ctx.lineTo(p[i][0], p[i][1]);
        else { const r = (target - acc) / seg; ctx.lineTo(p[i - 1][0] + (p[i][0] - p[i - 1][0]) * r, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * r); break; }
        acc += seg;
      }
      ctx.stroke(); if (dash) ctx.setLineDash([]);
    }
    function roundRect(x: number, y: number, w: number, h: number, r: number) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

    function drawMap(s: number) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#08243a"); g.addColorStop(0.55, "#0a2033"); g.addColorStop(1, "#081726");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(120,170,210,.05)"; ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.strokeStyle = "rgba(120,190,220,.06)";
      for (let i = 0; i < 5; i++) {
        const yy = H * 0.15 + i * H * 0.12 + Math.sin(s * 0.6 + i) * 6;
        ctx.beginPath();
        for (let xx = 0; xx <= W; xx += 24) ctx.lineTo(xx, yy + Math.sin(xx * 0.02 + s * 0.8 + i) * 4);
        ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, L.coastY);
      for (let xx = 0; xx <= W; xx += 40) ctx.lineTo(xx, L.coastY + Math.sin(xx * 0.012) * 10 + 8);
      ctx.lineTo(W, H); ctx.closePath();
      const lg = ctx.createLinearGradient(0, L.coastY, 0, H);
      lg.addColorStop(0, "#123024"); lg.addColorStop(1, "#0c2119");
      ctx.fillStyle = lg; ctx.fill();
      ctx.strokeStyle = "rgba(80,220,150,.25)"; ctx.lineWidth = 1.5; ctx.stroke();
    }
    function drawZone(s: number) {
      const z = L.zone;
      const pin = clamp((s - T.mapin[0]) / (T.mapin[1] - T.mapin[0]), 0, 1);
      const plan = clamp((s - T.plan[0]) / (T.plan[1] - T.plan[0]), 0, 1);
      ctx.save(); ctx.globalAlpha = ease(pin);
      for (let i = 0; i < 4; i++) {
        const sx = z.x + i * (z.w / 4), sw = z.w / 4;
        const a = ease(clamp((plan - i * 0.12) / 0.5, 0, 1)) * 0.1;
        ctx.fillStyle = hexA(COLORS[i], a); ctx.fillRect(sx, z.y, sw, z.h);
        if (plan > 0) { ctx.strokeStyle = hexA(COLORS[i], 0.35 * ease(plan)); ctx.lineWidth = 1; ctx.strokeRect(sx, z.y, sw, z.h); }
      }
      ctx.setLineDash([9, 7]); ctx.lineDashOffset = -s * 22;
      ctx.strokeStyle = "rgba(34,211,238,.85)"; ctx.lineWidth = 2; ctx.strokeRect(z.x, z.y, z.w, z.h); ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(34,211,238,.95)"; ctx.lineWidth = 3;
      const c = 16, cn = [[z.x, z.y, 1, 1], [z.x + z.w, z.y, -1, 1], [z.x, z.y + z.h, 1, -1], [z.x + z.w, z.y + z.h, -1, -1]];
      cn.forEach((k) => { ctx.beginPath(); ctx.moveTo(k[0] + c * k[2], k[1]); ctx.lineTo(k[0], k[1]); ctx.lineTo(k[0], k[1] + c * k[3]); ctx.stroke(); });
      ctx.globalAlpha = ease(pin);
      ctx.fillStyle = "rgba(34,211,238,.9)"; ctx.font = "600 13px Segoe UI, sans-serif";
      ctx.textAlign = "right"; ctx.fillText("אזור יעד · 420 דונם", z.x + z.w - 6, z.y - 9);
      ctx.restore();
      if (plan > 0) for (let d = 0; d < 4; d++) { const rev = ease(clamp((plan - d * 0.08) / 0.7, 0, 1)); drawPartial(drones[d].lane, rev, hexA(COLORS[d], 0.5), 1.5, [5, 5]); }
    }
    function drawTrails(states: any[]) {
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      for (let i = 0; i < drones.length; i++) { const dr = states[i].drawn; if (dr <= 0) continue; drawPartial(drones[i].lane, dr, "rgba(56,224,138,.16)", laneW() * 1.0, null); drawPartial(drones[i].lane, dr, "rgba(56,224,138,.34)", laneW() * 0.5, null); }
    }
    function drawBase() {
      const b = L.base; ctx.save();
      ctx.shadowColor = "rgba(34,211,238,.7)"; ctx.shadowBlur = 14;
      ctx.fillStyle = "#0e1b2a"; ctx.strokeStyle = "#22d3ee"; ctx.lineWidth = 2;
      roundRect(b.x - 15, b.y - 15, 30, 30, 7); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
      ctx.fillStyle = "#22d3ee"; ctx.font = "700 15px Segoe UI"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("H", b.x, b.y + 1); ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "rgba(200,230,255,.85)"; ctx.font = "600 11px Segoe UI"; ctx.fillText("בסיס", b.x, b.y + 28); ctx.restore();
    }
    function drawDrone(d: any, st: any, s: number) {
      const x = st.pos[0], y = st.pos[1]; ctx.save();
      if (st.spray) { ctx.fillStyle = "rgba(56,224,138,.14)"; ctx.beginPath(); ctx.arc(x, y, laneW() * 0.55, 0, Math.PI * 2); ctx.fill(); }
      ctx.translate(x, y); ctx.rotate(d.heading + Math.PI / 2);
      const pulse = 0.5 + 0.5 * Math.sin(s * 10 + d.id);
      ctx.strokeStyle = hexA(d.color, 0.35 + 0.25 * pulse); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = d.color; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 4); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill();
      ctx.fillStyle = hexA(d.color, 0.9);
      [[-9, -7], [9, -7], [-9, 7], [9, 7]].forEach((r) => { ctx.beginPath(); ctx.arc(r[0], r[1], 2.4, 0, Math.PI * 2); ctx.fill(); });
      ctx.restore();
      ctx.fillStyle = hexA(d.color, 0.95); ctx.font = "700 11px Segoe UI"; ctx.textAlign = "center"; ctx.fillText(d.name, x, y - 16);
      if (st.state === "rtb" || st.state === "rejoin") { ctx.strokeStyle = "rgba(245,158,11,.8)"; ctx.setLineDash([4, 4]); ctx.lineDashOffset = -s * 30; ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
    }

    // panel
    let cardEls: any[] = [], panelBuilt = false;
    function buildPanel() {
      const wrap = document.getElementById("drones")!; wrap.innerHTML = ""; cardEls = [];
      drones.forEach((d) => {
        const el = document.createElement("div"); el.className = "card"; el.style.setProperty("--dc", d.color);
        el.innerHTML =
          `<div class="row1"><div class="did">${d.name}</div><div class="name">רחפן ${d.name}</div><div class="state idle" data-state>בהמתנה</div></div>` +
          `<div class="metrics">` +
          `<div class="m"><div class="mt"><span>סוללה</span><b data-bat>100%</b></div><div class="bar"><i data-batbar style="width:100%;background:var(--good)"></i></div></div>` +
          `<div class="m"><div class="mt"><span>מיכל תרסיס</span><b data-tank>100%</b></div><div class="bar"><i data-tankbar style="width:100%;background:var(--accent)"></i></div></div></div>` +
          `<div class="foot"><span class="spraytag" data-spray><i></i>ריסוס כבוי</span><span>מהירות <b data-spd>0.0</b> מ/ש</span><span>סיום <b data-eta>--</b></span></div>`;
        wrap.appendChild(el);
        cardEls.push({ el, state: el.querySelector("[data-state]"), bat: el.querySelector("[data-bat]"), batbar: el.querySelector("[data-batbar]"), tank: el.querySelector("[data-tank]"), tankbar: el.querySelector("[data-tankbar]"), spray: el.querySelector("[data-spray]"), spd: el.querySelector("[data-spd]"), eta: el.querySelector("[data-eta]") });
      });
      panelBuilt = true;
    }
    const g = (id: string) => document.getElementById(id)!;
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
      for (let i = 0; i < drones.length; i++) {
        const st = evalDrone(i, s, drones[i].lane, baseP()); states[i] = st;
        const d = drones[i];
        if (d._px != null) { const dx = st.pos[0] - d._px, dy = st.pos[1] - d._py; if (Math.hypot(dx, dy) > 0.3) d.heading = Math.atan2(dy, dx); }
        d._px = st.pos[0]; d._py = st.pos[1];
        covSum += st.prog;
        if (["takeoff", "spraying", "rtb", "rejoin", "rth"].includes(st.state)) active++;
      }
      const agg = { coverage: clamp(covSum / drones.length, 0, 1), active: Math.min(4, active) };
      drawMap(s); drawZone(s);
      if (s >= T.launch[0]) drawTrails(states);
      drawBase();
      if (s >= T.launch[0]) for (let j = 0; j < drones.length; j++) drawDrone(drones[j], states[j], s);
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
    function reset() { simTime = 0; finished = false; lastTs = null; setPlaying(true); layout(); buildPanel(); g("titlecard").classList.remove("hidden"); g("endcard").classList.add("hidden"); g("phase").classList.remove("show"); lastPhase = ""; render(0); }

    const onReplay = () => reset();
    g("replay").addEventListener("click", onReplay);
    g("endReplay").addEventListener("click", onReplay);
    let dragging = false;
    const scrubTo = (ev: any) => { const el = g("scrub"); const r = el.getBoundingClientRect(); const x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left; seek((x / r.width) * DUR); };
    const onDown = (e: any) => { dragging = true; setPlaying(false); scrubTo(e); };
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
    let rt: any;
    const onResize = () => { clearTimeout(rt); rt = setTimeout(() => { const keep = simTime, kf = finished; layout(); buildPanel(); simTime = keep; finished = kf; render(simTime); }, 150); };
    window.addEventListener("resize", onResize);

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
    };
  }, []);

  return (
    <div id="app">
      <aside id="panel">
        <div className="p-head">
          <h2>מרכז שליטה — צי ריסוס אוטונומי</h2>
          <div className="mission">משימה: ריסוס אזור ימי — מפרץ צפוני</div>
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
        <canvas id="map" />
        <div id="topbar">
          <div className="brand">
            <div className="logo" />
            <div><b>Revi-Control</b><span>Autonomous Spray Fleet Command Center</span></div>
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
          <div className="tag">מרכז שליטה לצי ריסוס אוטונומי</div>
          <div className="desc">תכנון, שיגור ובקרה של מספר רחפנים לכיסוי שטחים גדולים בזמן קצוב — ממסך אחד.</div>
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
        <a className="navlink" href="/map">מפה חיה ←</a>
        <a className="navlink navlink2" href="/select">בחר רחפנים ←</a>
        <div id="hint">רווח <b>=</b> השהה · <b>← →</b> דילוג · <b>R</b> מהתחלה</div>
        <div id="scrub"><div className="track" /><div className="fill" /><div className="knob" /></div>
      </div>
    </div>
  );
}
