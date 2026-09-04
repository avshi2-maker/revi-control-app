"use client";
import { useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";

// Dedicated command station — the live feed from the camera drone (the Eye).
// The video pane is SIMULATED here (top-down aerial POV rendered on canvas) as a
// placeholder for the real drone stream. Swap the canvas for a <video>/WebRTC
// element when the hardware link exists; the HUD + telemetry rail stay as-is.
function StationInner() {
  const sp = useSearchParams();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);

  const ocean = sp.get("scenario") === "ocean";
  const droneList = (sp.get("drones") || "1,2,3,4").split(",").map(Number).filter(Boolean);
  const eyeNum = parseInt(sp.get("eye") || "", 10);
  const sprayDrones = droneList.filter((n) => n !== eyeNum);
  const N = Math.max(1, sprayDrones.length);

  useEffect(() => {
    const cv = canvasRef.current!, ctx = cv.getContext("2d")!;
    let raf = 0, t0 = performance.now();
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    const fit = () => { cv.width = cv.clientWidth * DPR; cv.height = cv.clientHeight * DPR; };
    fit(); window.addEventListener("resize", fit);

    const CYCLE = 42; // seconds per demo pass, then loops
    const lane = (i: number) => (i + 0.5) / N;

    function draw(now: number) {
      const t = ((now - t0) / 1000) % CYCLE;
      const prog = Math.min(1, t / (CYCLE * 0.82)); // coverage progress 0..1
      const W = cv.width, H = cv.height;
      ctx.clearRect(0, 0, W, H);

      // subtle camera drift + breathe (handheld overwatch feel)
      const dx = Math.sin(now / 2600) * 6 * DPR, dy = Math.cos(now / 3100) * 5 * DPR;
      ctx.save(); ctx.translate(dx, dy);

      // ── ground / water ──
      if (ocean) {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#062033"); g.addColorStop(1, "#0a3350");
        ctx.fillStyle = g; ctx.fillRect(-20, -20, W + 40, H + 40);
        ctx.strokeStyle = "rgba(120,190,230,.10)"; ctx.lineWidth = 2 * DPR;
        for (let y = 0; y < H; y += 34 * DPR) {
          ctx.beginPath();
          for (let x = -20; x < W + 20; x += 10 * DPR)
            ctx.lineTo(x, y + Math.sin((x / (60 * DPR)) + now / 900) * 5 * DPR);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = "#132a17"; ctx.fillRect(-20, -20, W + 40, H + 40);
        ctx.strokeStyle = "rgba(60,120,60,.22)"; ctx.lineWidth = 1 * DPR;
        for (let x = 0; x < W; x += 26 * DPR) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        // orchard dots
        ctx.fillStyle = "rgba(40,90,40,.5)";
        for (let x = 12 * DPR; x < W; x += 26 * DPR)
          for (let y = 16 * DPR; y < H; y += 30 * DPR) { ctx.beginPath(); ctx.arc(x, y, 4 * DPR, 0, 7); ctx.fill(); }
      }

      // ── target zone frame ──
      const m = 46 * DPR, zx = m, zy = m, zw = W - 2 * m, zh = H - 2 * m;
      ctx.strokeStyle = ocean ? "rgba(56,189,248,.8)" : "rgba(34,211,238,.8)";
      ctx.lineWidth = 2 * DPR; ctx.setLineDash([9 * DPR, 7 * DPR]);
      ctx.strokeRect(zx, zy, zw, zh); ctx.setLineDash([]);

      // ── coverage swaths + spray drones ──
      const swColor = ocean ? "rgba(34,211,238,.20)" : "rgba(56,224,138,.22)";
      for (let i = 0; i < N; i++) {
        const cx = zx + lane(i) * zw;
        const lp = Math.min(1, Math.max(0, prog * 1.15 - i * 0.04));
        // covered swath grows top->bottom
        ctx.fillStyle = swColor;
        ctx.fillRect(cx - (zw / N) * 0.42, zy, (zw / N) * 0.84, zh * lp);
        // drone marker at spray head
        const dyp = zy + zh * lp;
        const col = ["#38bdf8", "#a78bfa", "#fb7185", "#facc15"][i % 4];
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(cx, dyp, 4.5 * DPR, 0, 7); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 1 * DPR;
        ctx.beginPath(); ctx.arc(cx, dyp, 8 * DPR + Math.sin(now / 200 + i) * 2 * DPR, 0, 7); ctx.stroke();
      }

      // ── camera crosshair (center of overwatch) ──
      ctx.strokeStyle = "rgba(255,213,74,.7)"; ctx.lineWidth = 1.4 * DPR;
      const ccx = W / 2, ccy = H / 2, r = 18 * DPR;
      ctx.beginPath(); ctx.arc(ccx, ccy, r, 0, 7); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ccx - r - 8 * DPR, ccy); ctx.lineTo(ccx - 6 * DPR, ccy);
      ctx.moveTo(ccx + 6 * DPR, ccy); ctx.lineTo(ccx + r + 8 * DPR, ccy);
      ctx.moveTo(ccx, ccy - r - 8 * DPR); ctx.lineTo(ccx, ccy - 6 * DPR);
      ctx.moveTo(ccx, ccy + 6 * DPR); ctx.lineTo(ccx, ccy + r + 8 * DPR);
      ctx.stroke();
      ctx.restore();

      // ── vignette + scan flicker ──
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.55)");
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

      // live HUD text
      if (hudRef.current) {
        const cov = Math.round(prog * 100);
        const alt = 118 + Math.round(Math.sin(now / 1500) * 3);
        const clock = new Date().toLocaleTimeString("he-IL");
        hudRef.current.querySelector("[data-cov]")!.textContent = cov + "%";
        hudRef.current.querySelector("[data-alt]")!.textContent = alt + " מ׳";
        hudRef.current.querySelector("[data-clk]")!.textContent = clock;
      }
      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", fit); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ocean, N]);

  return (
    <div className="st-shell" dir="rtl">
      <div className="st-top">
        <div className="st-brand"><div className="st-logo" /><b>Revi-Control</b><span>תחנת פיקוד · שידור חי</span></div>
        <div className="st-live"><span className="st-rec" />LIVE · {ocean ? "ריסוס ימי" : "ריסוס יבשתי"}</div>
        <div className="st-lat">חביון ~0.4 שנ׳ · 1080p</div>
      </div>

      <div className="st-body">
        <div className="st-feed">
          <canvas ref={canvasRef} className="st-canvas" />
          <div className="st-scan" />
          <div className="st-hud" ref={hudRef}>
            <div className="st-hud-tl"><span className="st-rec" /> REC · <b data-clk>--:--</b></div>
            <div className="st-hud-tr">CAM · עין 📹 {Number.isFinite(eyeNum) ? "D" + eyeNum : ""}</div>
            <div className="st-hud-bl">גובה <b data-alt>118 מ׳</b> · זווית 90°</div>
            <div className="st-hud-br">כיסוי <b data-cov>0%</b></div>
          </div>
        </div>

        <aside className="st-rail">
          <h3>טלמטריית עין 📹</h3>
          <div className="st-tel"><span>מצב</span><b style={{ color: "#ffd54a" }}>משדר</b></div>
          <div className="st-tel"><span>גובה תצפית</span><b data-alt>118 מ׳</b></div>
          <div className="st-tel"><span>איכות קו</span><b style={{ color: "var(--good)" }}>████░ חזק</b></div>
          <div className="st-tel"><span>סוללה</span><b style={{ color: "var(--good)" }}>92%</b></div>
          <div className="st-divider" />
          <h3>מבצע</h3>
          <div className="st-tel"><span>רחפני ריסוס</span><b>{N}</b></div>
          <div className="st-tel"><span>כיסוי</span><b data-cov style={{ color: "var(--accent)" }}>0%</b></div>
          <div className="st-tel"><span>סוג</span><b>{ocean ? "🌊 בקטריאלי" : "🌿 יבשתי"}</b></div>
          <div className="st-tel"><span>שעה</span><b data-clk>--:--</b></div>
          <div className="st-note">📡 שידור מדומה לצורך הדגמה. חיבור וידאו אמיתי (WebRTC / RTMP) מתחבר כאן עם החומרה.</div>
          <a className="st-back" href={`/cockpit${sp.toString() ? "?" + sp.toString() : ""}`}>↩ חזרה לחדר הבקרה</a>
        </aside>
      </div>
    </div>
  );
}

export default function StationClient() {
  return <Suspense fallback={null}><StationInner /></Suspense>;
}
