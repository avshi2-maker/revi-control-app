"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { GEO, GEO_OCEAN } from "@/lib/config";

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

    // Corner drag = resize. Never setLatLng the handle being dragged (that fights
    // Leaflet's drag and snaps it back) — only the rect + the OTHER handles.
    swM.on("drag", (e: any) => {
      const p = e.target.getLatLng();
      z.s = Math.min(p.lat, z.n - 0.002);
      z.w = Math.min(p.lng, z.e - 0.002);
      rect.setBounds([[z.s, z.w], [z.n, z.e]]);
      moveM.setLatLng(center());
    });
    neM.on("drag", (e: any) => {
      const p = e.target.getLatLng();
      z.n = Math.max(p.lat, z.s + 0.002);
      z.e = Math.max(p.lng, z.w + 0.002);
      rect.setBounds([[z.s, z.w], [z.n, z.e]]);
      moveM.setLatLng(center());
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
    setTimeout(() => map.invalidateSize(), 60);

    return () => { map.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario]);

  return <div ref={elRef} className="zp-map" />;
}
