"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Picture-in-picture "live broadcast" from the camera drone (the Eye):
// a REAL close-up satellite view of the mission area with the spray drones
// animated flying above it. Works over land and sea (same Esri imagery).
export default function CameraFeed({
  center, zoom, sprayCount, label,
}: { center: [number, number]; zoom: number; sprayCount: number; label: string }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const altRef = useRef<HTMLSpanElement>(null);

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

    let raf = 0;
    function frame(now: number) {
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
    const onResize = () => setTimeout(() => map.invalidateSize(), 80);
    window.addEventListener("resize", onResize);
    setTimeout(() => map.invalidateSize(), 100);

    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); map.remove(); };
  }, [center, zoom, sprayCount]);

  return (
    <div className="cf-inner">
      <div ref={mapRef} className="cf-map" />
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
