// Pure simulation logic — no DOM, no canvas, no Leaflet.
// Both the teaser (pixels) and the live map (lng/lat) feed it 2D points and read back state.

import { TIMELINE as T, D3, DUR } from "./config";

export type Pt = [number, number];
export type DroneState = {
  pos: Pt;
  state: "idle" | "takeoff" | "spraying" | "rtb" | "refill" | "rejoin" | "rth" | "done";
  spray: boolean;
  speed: number;
  drawn: number; // fraction of lane covered (for trails)
  prog: number; // coverage progress 0..1
};

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const ease = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Boustrophedon (back-and-forth) coverage lanes inside an axis box.
export function boustro(a0: number, a1: number, b0: number, b1: number, lanes: number, axis: "x" | "y"): Pt[] {
  const pts: Pt[] = [];
  const span = b1 - b0;
  for (let i = 0; i < lanes; i++) {
    const b = b0 + (i + 0.5) * (span / lanes);
    const left: Pt = axis === "x" ? [a0, b] : [b, a0];
    const right: Pt = axis === "x" ? [a1, b] : [b, a1];
    if (i % 2 === 0) { pts.push(left, right); } else { pts.push(right, left); }
  }
  return pts;
}

export function pathLen(p: Pt[]) {
  let d = 0;
  for (let i = 1; i < p.length; i++) d += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  return d;
}
export function pointAt(p: Pt[], t: number): Pt {
  if (t <= 0) return [p[0][0], p[0][1]];
  if (t >= 1) return [p[p.length - 1][0], p[p.length - 1][1]];
  const total = pathLen(p), target = t * total;
  let acc = 0;
  for (let i = 1; i < p.length; i++) {
    const seg = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    if (acc + seg >= target) {
      const r = (target - acc) / seg;
      return [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * r, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * r];
    }
    acc += seg;
  }
  return [p[p.length - 1][0], p[p.length - 1][1]];
}

export function progAt(i: number, s: number) {
  const a = T.spray[0], b = T.spray[1];
  if (s <= a) return 0;
  if (s >= b) return 1;
  if (i === 2) {
    const pLow = clamp((D3.low - a) / (b - a), 0, 1);
    if (s < D3.low) return clamp((s - a) / (b - a), 0, 1);
    if (s < D3.rejoin) return pLow;
    return clamp(pLow + ((s - D3.rejoin) / (b - D3.rejoin)) * (1 - pLow), 0, 1);
  }
  return clamp((s - a) / (b - a), 0, 1);
}

// Deterministic drone state at absolute time s. lane in the caller's coord space, base same space.
export function evalDrone(i: number, s: number, lane: Pt[], base: Pt): DroneState {
  const st = lane[0];
  let pos: Pt, state: DroneState["state"], spray = false, speed = 0, drawn = 0, t: number, lp: Pt;
  if (s < T.launch[0]) { pos = [base[0], base[1]]; state = "idle"; }
  else if (s < T.launch[1]) {
    t = ease((s - T.launch[0]) / (T.launch[1] - T.launch[0]));
    pos = [lerp(base[0], st[0], t), lerp(base[1], st[1], t)]; state = "takeoff"; speed = lerp(0, 9.5, t);
  } else if (s < T.spray[1]) {
    if (i === 2 && s >= D3.low && s < D3.rejoin) {
      const frozen = progAt(2, D3.low); lp = pointAt(lane, frozen); drawn = frozen;
      if (s < D3.arrive) { t = ease((s - D3.low) / (D3.arrive - D3.low)); pos = [lerp(lp[0], base[0], t), lerp(lp[1], base[1], t)]; state = "rtb"; speed = 11; }
      else if (s < D3.refillEnd) { pos = [base[0], base[1]]; state = "refill"; speed = 0; }
      else { t = ease((s - D3.refillEnd) / (D3.rejoin - D3.refillEnd)); pos = [lerp(base[0], lp[0], t), lerp(base[1], lp[1], t)]; state = "rejoin"; speed = 11; }
    } else {
      const p = progAt(i, s); drawn = p; pos = pointAt(lane, p); state = "spraying"; spray = true; speed = 9 + Math.sin(s * 2 + i) * 1.1;
    }
  } else if (s < T.rth[0]) { pos = pointAt(lane, 1); drawn = 1; state = "done"; }
  else if (s < T.rth[1]) {
    lp = pointAt(lane, 1); t = ease((s - T.rth[0]) / (T.rth[1] - T.rth[0]));
    pos = [lerp(lp[0], base[0], t), lerp(lp[1], base[1], t)]; drawn = 1; state = "rth"; speed = lerp(11, 0, t);
  } else { pos = [base[0], base[1]]; drawn = 1; state = "done"; }
  return { pos, state, spray, speed, drawn, prog: s < T.spray[0] ? 0 : progAt(i, s) };
}

export function batteryAt(i: number, s: number) {
  if (s <= T.launch[0]) return 100;
  let b = 100 - (Math.min(s, T.rth[1]) - T.launch[0]) * 1.55;
  if (i === 2 && s >= D3.refillEnd) b += 30;
  return clamp(b, 3, 100);
}
export function tankAt(i: number, s: number) {
  if (s <= T.spray[0]) return 100;
  if (i === 2) {
    if (s < D3.low) return clamp(100 - (s - T.spray[0]) * 3.2, 0, 100);
    if (s < D3.refillEnd) return clamp(100 - (D3.low - T.spray[0]) * 3.2, 0, 100);
    return clamp(100 - (s - D3.refillEnd) * 3.2, 0, 100);
  }
  const sp = Math.min(s, T.spray[1]) - T.spray[0];
  return clamp(100 - sp * 2.9, 0, 100);
}

export function phaseText(s: number) {
  if (s >= T.mapin[0] && s < T.plan[0]) return "טעינת מפה · זיהוי אזור יעד";
  if (s >= T.plan[0] && s < T.launch[0]) return "תכנון אוטומטי · חלוקה ל-4 גזרות ומסלולי כיסוי";
  if (s >= T.launch[0] && s < T.spray[0]) return "שיגור צי · העלאת משימות לרחפנים";
  if (s >= T.spray[0] && s < D3.low) return "ריסוס פעיל · כיסוי לפי מסלול";
  if (s >= D3.low && s < D3.rejoin) return "מחזור חכם · D3 חוזר לבסיס, מילוי, וחזרה למשימה";
  if (s >= D3.rejoin && s < T.spray[1]) return "ריסוס פעיל · השלמת כיסוי";
  if (s >= T.done[0] && s < T.rth[0]) return "100% כיסוי · השטח טופל";
  if (s >= T.rth[0] && s < T.rth[1]) return "חזרה לבסיס · סיום משימה";
  return "";
}

export function fmtHM(m: number) { const h = Math.floor(m / 60), mm = m % 60; return h + ":" + (mm < 10 ? "0" : "") + mm; }
export function fmtMS(s: number) { s = Math.floor(s); const m = Math.floor(s / 60), ss = s % 60; return (m < 10 ? "0" : "") + m + ":" + (ss < 10 ? "0" : "") + ss; }

export { DUR };
