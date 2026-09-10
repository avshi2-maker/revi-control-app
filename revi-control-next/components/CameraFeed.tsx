"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Picture-in-picture "live broadcast" from the camera drone (the Eye):
// a REAL close-up satellite view of the mission area with the spray drones
// animated flying above it. Works over land and sea (same Esri imagery).
export default function CameraFeed({
  center, zoom, sprayCount, label, ocean = false,
}: { center: [number, number]; zoom: number; sprayCount: number; label: string; ocean?: boolean }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const altRef = useRef<HTMLSpanElement>(null);
  const waveRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const N = Math.max(1, sprayCount);
    const cols = ["#38bdf8", "#a78bfa", "#fb7185", "#facc15"];
    const map = L.map(mapRef.current!, {
      center, zoom, zoomControl: false, attributionControl: false,
      dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
      boxZoom: false, keyboard: false, touchZoom: false,
    } as any);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
    }).addTo(map);

    const droneIcon = (c: string) =>
      L.divIcon({
        className: "", iconSize: [22, 22], iconAnchor: [11, 11],
        html:
          `<svg viewBox="-12 -12 24 24" width="22" height="22">` +
          `<g stroke="${c}" stroke-width="2" stroke-linecap="round">` +
          `<line x1="-7" y1="-7" x2="7" y2="7"/><line x1="7" y1="-7" x2="-7" y2="7"/></g>` +
          `<g fill="${c}" opacity="0.35"><circle cx="-8" cy="-8" r="4"/><circle cx="8" cy="-8" r="4"/>` +
          `<circle cx="-8" cy="8" r="4"/><circle cx="8" cy="8" r="4"/></g>` +
          `<circle cx="0" cy="0" r="2.6" fill="${c}"/></svg>`,
      });
    const markers = Array.from({ length: N }, (_, i) =>
      L.marker(center, { icon: droneIcon(cols[i % 4]), interactive: false, zIndexOffset: 500 }).addTo(map));

    // Ocean wave overlay — open sea shows as a flat blue block on any satellite,
    // so we paint a moving water surface to convey a real low-altitude sea view.
    const wc = waveRef.current;
    const wctx = ocean && wc ? wc.getContext("2d") : null;
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    const fitWave = () => { if (wc) { wc.width = wc.clientWidth * DPR; wc.height = wc.clientHeight * DPR; } };
    if (wctx) fitWave();

    let raf = 0;
    function frame(now: number) {
      if (wctx && wc) {
        const W = wc.width, H = wc.height;
        wctx.clearRect(0, 0, W, H);
        const scroll = (now / 40) % (26 * DPR);
        wctx.strokeStyle = "rgba(180,225,255,.18)"; wctx.lineWidth = 1.4 * DPR;
        for (let y = -26 * DPR; y < H + 26; y += 13 * DPR) {
          wctx.beginPath();
          for (let x = -10; x < W + 10; x += 7 * DPR)
            wctx.lineTo(x, y + scroll + Math.sin(x / (22 * DPR) + now / 650 + y) * 4 * DPR);
          wctx.stroke();
        }
        // sun-glint speckle
        wctx.fillStyle = "rgba(220,240,255,.12)";
        for (let i = 0; i < 26; i++) {
          const gx = (Math.sin(i * 12.9 + now / 1400) * 0.5 + 0.5) * W;
          const gy = (Math.cos(i * 7.7 + now / 1700) * 0.5 + 0.5) * H;
          wctx.beginPath(); wctx.arc(gx, gy, 1.5 * DPR, 0, 7); wctx.fill();
        }
      }
      const b = map.getBounds();
      const w = b.getEast() - b.getWest(), h = b.getNorth() - b.getSouth();
      const cLat = (b.getNorth() + b.getSouth()) / 2, cLng = (b.getEast() + b.getWest()) / 2;
      for (let i = 0; i < N; i++) {
        const fx = (i + 0.5) / N - 0.5;                    // spread across the frame
        const lng = cLng + fx * w * 0.66 + Math.sin(now / 1300 + i) * w * 0.03;
        const lat = cLat - h * 0.06 + Math.sin(now / 900 + i * 1.7) * h * 0.05;
        markers[i].setLatLng([lat, lng]);
      }
      if (altRef.current) altRef.current.textContent = (118 + Math.round(Math.sin(now / 1500) * 3)) + " מ׳";
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    const onResize = () => setTimeout(() => { map.invalidateSize(); fitWave(); }, 80);
    window.addEventListener("resize", onResize);
    setTimeout(() => map.invalidateSize(), 100);

    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); map.remove(); };
  }, [center, zoom, sprayCount, ocean]);

  return (
    <div className="cf-inner">
      <div ref={mapRef} className="cf-map" />
      {ocean && <canvas ref={waveRef} className="cf-waves" />}
      <div className="cf-scan" />
      <div className="cf-cross" />
      <div className="cf-hud">
        <span className="cf-rec"><span className="cf-dot" /> REC</span>
        <span className="cf-alt" ref={altRef}>118 מ׳</span>
      </div>
      <div className="cf-cam">📹 {label}</div>
    </div>
  );
}
