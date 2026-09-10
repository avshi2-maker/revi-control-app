"use client";
import { useEffect, useRef } from "react";

// Small picture-in-picture "live broadcast" from the camera drone (the Eye):
// a simulated top-down view panning over the spray drones and the land/sea below.
// Self-contained canvas animation — embedded on the live map when an Eye is set.
export default function CameraFeed({
  ocean, sprayCount, label,
}: { ocean: boolean; sprayCount: number; label: string }) {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const altRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const cv = cvRef.current!, ctx = cv.getContext("2d")!;
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    const fit = () => { cv.width = cv.clientWidth * DPR; cv.height = cv.clientHeight * DPR; };
    fit();
    let raf = 0, t0 = performance.now();
    const N = Math.max(1, sprayCount);
    const cols = ["#38bdf8", "#a78bfa", "#fb7185", "#facc15"];

    function draw(now: number) {
      const t = (now - t0) / 1000;
      const W = cv.width, H = cv.height;
      ctx.clearRect(0, 0, W, H);

      // gentle camera drift (handheld overwatch)
      const dx = Math.sin(now / 2400) * 5 * DPR, dy = Math.cos(now / 2900) * 4 * DPR;
      ctx.save(); ctx.translate(dx, dy);

      const scroll = (t * 22 * DPR) % (44 * DPR); // forward-flight texture scroll

      if (ocean) {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#062033"); g.addColorStop(1, "#0a3654");
        ctx.fillStyle = g; ctx.fillRect(-10, -10, W + 20, H + 20);
        ctx.strokeStyle = "rgba(120,190,230,.12)"; ctx.lineWidth = 1.5 * DPR;
        for (let y = -44 * DPR; y < H + 44; y += 22 * DPR) {
          ctx.beginPath();
          for (let x = -10; x < W + 10; x += 8 * DPR)
            ctx.lineTo(x, y + scroll + Math.sin(x / (26 * DPR) + now / 700) * 4 * DPR);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = "#14301a"; ctx.fillRect(-10, -10, W + 20, H + 20);
        ctx.strokeStyle = "rgba(70,130,70,.28)"; ctx.lineWidth = 1 * DPR;
        for (let x = 0; x < W; x += 22 * DPR) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        ctx.fillStyle = "rgba(45,95,45,.55)";
        for (let x = 10 * DPR; x < W; x += 22 * DPR)
          for (let y = -30 * DPR; y < H + 30; y += 26 * DPR) { ctx.beginPath(); ctx.arc(x, (y + scroll), 3.4 * DPR, 0, 7); ctx.fill(); }
      }

      // spray drones passing below, in a spread formation
      for (let i = 0; i < N; i++) {
        const lx = ((i + 0.5) / N) * W + Math.sin(now / 1300 + i) * 10 * DPR;
        const ly = H * 0.62 + Math.sin(now / 900 + i * 1.7) * 16 * DPR;
        const col = cols[i % 4];
        // spray mist
        ctx.fillStyle = ocean ? "rgba(34,211,238,.16)" : "rgba(56,224,138,.18)";
        ctx.beginPath(); ctx.ellipse(lx, ly + 8 * DPR, 13 * DPR, 6 * DPR, 0, 0, 7); ctx.fill();
        // quad body
        ctx.strokeStyle = col; ctx.lineWidth = 1.8 * DPR;
        ctx.beginPath();
        ctx.moveTo(lx - 6 * DPR, ly - 6 * DPR); ctx.lineTo(lx + 6 * DPR, ly + 6 * DPR);
        ctx.moveTo(lx + 6 * DPR, ly - 6 * DPR); ctx.lineTo(lx - 6 * DPR, ly + 6 * DPR);
        ctx.stroke();
        ctx.fillStyle = col;
        for (const [ox, oy] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) {
          ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(lx + ox * DPR, ly + oy * DPR, 4 * DPR, 0, 7); ctx.fill();
          ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(lx + ox * DPR, ly + oy * DPR, 1.6 * DPR, 0, 7); ctx.fill();
        }
      }

      // crosshair
      ctx.strokeStyle = "rgba(255,213,74,.7)"; ctx.lineWidth = 1.2 * DPR;
      const cx = W / 2, cy = H / 2, r = 12 * DPR;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - r - 5 * DPR, cy); ctx.lineTo(cx - 4 * DPR, cy);
      ctx.moveTo(cx + 4 * DPR, cy); ctx.lineTo(cx + r + 5 * DPR, cy);
      ctx.moveTo(cx, cy - r - 5 * DPR); ctx.lineTo(cx, cy - 4 * DPR);
      ctx.moveTo(cx, cy + 4 * DPR); ctx.lineTo(cx, cy + r + 5 * DPR);
      ctx.stroke();
      ctx.restore();

      // vignette
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.7);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.5)");
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

      if (altRef.current) altRef.current.textContent = (118 + Math.round(Math.sin(now / 1500) * 3)) + " מ׳";
      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    window.addEventListener("resize", fit);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", fit); };
  }, [ocean, sprayCount]);

  return (
    <div className="cf-inner">
      <canvas ref={cvRef} className="cf-canvas" />
      <div className="cf-scan" />
      <div className="cf-hud">
        <span className="cf-rec"><span className="cf-dot" /> REC</span>
        <span className="cf-alt" ref={altRef}>118 מ׳</span>
      </div>
      <div className="cf-cam">📹 {label}</div>
    </div>
  );
}
