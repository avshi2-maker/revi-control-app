"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { GEO, GEO_OCEAN, MAX_ZONE_DUNAM } from "@/lib/config";

// Live satellite zone-picker for the wizard. Operator drags the base marker and
// the SW/NE corner handles to shape the spray zone before launch. Emits geometry
// upward so the wizard can pass ?base=..&zone=.. into the mission.
export type Geo = { base: { lng: number; lat: number }; zone: { w: number; e: number; s: number; n: number } };

export default function ZonePicker({
  scenario,
  value,
  onChange,
}: {
  scenario: "land" | "ocean";
  value: Geo | null;
  onChange: (g: Geo) => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  useEffect(() => {
    const G = scenario === "ocean" ? GEO_OCEAN : GEO;
    const init: Geo = value ?? { base: { ...G.base }, zone: { ...G.zone } };
    const ocean = scenario === "ocean";
    const rectColor = ocean ? "#38bdf8" : "#22d3ee";

    const map = L.map(elRef.current!, { zoomControl: true, attributionControl: false })
      .setView([(init.zone.s + init.zone.n) / 2, (init.zone.w + init.zone.e) / 2], G.zoom);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
    }).addTo(map);

    let z = { ...init.zone };
    let b = { ...init.base };

    const rect = L.rectangle([[z.s, z.w], [z.n, z.e]], {
      color: rectColor, weight: 2, fillOpacity: 0.14, dashArray: "6 5",
    }).addTo(map);

    const handle = (html: string, cls = "") =>
      L.divIcon({ className: "zp-handle " + cls, html, iconSize: [30, 30], iconAnchor: [15, 15] });

    const swM = L.marker([z.s, z.w], { draggable: true, icon: handle("SW") }).addTo(map);
    const neM = L.marker([z.n, z.e], { draggable: true, icon: handle("NE") }).addTo(map);
    const baseM = L.marker([b.lat, b.lng], { draggable: true, icon: handle(ocean ? "⛵" : "H", "base") }).addTo(map);
    // Center grip — drag to MOVE the whole zone (keeps its size).
    const moveM = L.marker([(z.s + z.n) / 2, (z.w + z.e) / 2], { draggable: true, icon: handle("✥", "move") }).addTo(map);

    const emit = () => cbRef.current({ base: { ...b }, zone: { ...z } });
    const center = (): [number, number] => [(z.s + z.n) / 2, (z.w + z.e) / 2];

    // Max area cap → max side length (metres), split square so each span is bounded.
    const maxDunam = (MAX_ZONE_DUNAM as any)[scenario] ?? 200000;
    const sideM = Math.sqrt(maxDunam * 1000);
    const maxLatSpan = sideM / 111320;
    const maxLngSpan = (lat: number) => sideM / (111320 * Math.cos((lat * Math.PI) / 180));

    // Corner drag = resize, capped so the zone can't be oversized. Snap the dragged
    // handle back only when it hits the cap; otherwise let Leaflet drag freely.
    swM.on("drag", (e: any) => {
      const p = e.target.getLatLng();
      let s = Math.min(p.lat, z.n - 0.002), w = Math.min(p.lng, z.e - 0.002);
      let capped = false;
      if (z.n - s > maxLatSpan) { s = z.n - maxLatSpan; capped = true; }
      if (z.e - w > maxLngSpan(z.n)) { w = z.e - maxLngSpan(z.n); capped = true; }
      z.s = s; z.w = w;
      rect.setBounds([[z.s, z.w], [z.n, z.e]]);
      moveM.setLatLng(center());
      if (capped) swM.setLatLng([z.s, z.w]);
    });
    neM.on("drag", (e: any) => {
      const p = e.target.getLatLng();
      let n = Math.max(p.lat, z.s + 0.002), ee = Math.max(p.lng, z.w + 0.002);
      let capped = false;
      if (n - z.s > maxLatSpan) { n = z.s + maxLatSpan; capped = true; }
      if (ee - z.w > maxLngSpan(z.s)) { ee = z.w + maxLngSpan(z.s); capped = true; }
      z.n = n; z.e = ee;
      rect.setBounds([[z.s, z.w], [z.n, z.e]]);
      moveM.setLatLng(center());
      if (capped) neM.setLatLng([z.n, z.e]);
    });
    let mc = { lat: (z.s + z.n) / 2, lng: (z.w + z.e) / 2 };
    moveM.on("dragstart", () => { mc = { lat: (z.s + z.n) / 2, lng: (z.w + z.e) / 2 }; });
    moveM.on("drag", (e: any) => {
      const p = e.target.getLatLng();
      const dLat = p.lat - mc.lat, dLng = p.lng - mc.lng;
      mc = { lat: p.lat, lng: p.lng };
      z.s += dLat; z.n += dLat; z.w += dLng; z.e += dLng;
      rect.setBounds([[z.s, z.w], [z.n, z.e]]);
      swM.setLatLng([z.s, z.w]); neM.setLatLng([z.n, z.e]);
    });
    baseM.on("drag", (e: any) => { const p = e.target.getLatLng(); b = { lng: p.lng, lat: p.lat }; });
    swM.on("dragend", emit); neM.on("dragend", emit); baseM.on("dragend", emit); moveM.on("dragend", emit);

    // Emit initial geometry once so the wizard has a value even without dragging.
    emit();
    // Zoom so the WHOLE zone + both corner handles are comfortably on screen —
    // otherwise big zones push the corners off the edge and only "move" works.
    setTimeout(() => {
      map.invalidateSize();
      map.fitBounds(rect.getBounds(), { padding: [55, 55], maxZoom: G.zoom + 2 });
    }, 80);

    return () => { map.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario]);

  return <div ref={elRef} className="zp-map" />;
}
