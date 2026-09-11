import { DRONE_SPEC } from "./config";

// Physics-based mission-time estimate. Pulls in area, fleet size, wind, coverage
// pattern, weight (via payload→speed), transit distance and refills.
// NOTE: the result scales with the map area, which is cinematic in the demo — so
// times are illustrative until the map is rescaled to real field size.
const SPRAY_SPEED = 7;   // m/s ground speed while spraying (T50 class)
const CRUISE_SPEED = 10; // m/s in transit
const APP_RATE_L_PER_DUNAM = 1.5; // spray application rate

export function estimateMissionMin(o: {
  areaDunam: number; nSpray: number; windMps: number; pattern: string;
  transitKm: number; ocean: boolean; payloadFrac?: number;
}): number {
  const n = Math.max(1, o.nSpray);
  const width = DRONE_SPEC.sprayWidthM;
  const patEff = o.pattern === "spiral" ? 0.82 : o.pattern === "grid" ? 0.9 : 1; // boustro = best
  const windFactor = Math.max(0.5, 1 - 0.03 * o.windMps);          // wind slows ground track
  const weightFactor = Math.max(0.8, 1 - 0.15 * (o.payloadFrac ?? 0.6)); // heavier = slower
  const rate = width * SPRAY_SPEED * windFactor * weightFactor * patEff; // m²/s per drone
  const areaM2 = (o.areaDunam * 1000) / n;
  const sprayS = areaM2 / rate;
  const transitS = (o.transitKm * 1000) / CRUISE_SPEED;
  let refillS = 0;
  if (!o.ocean) {
    const dunamPerTank = DRONE_SPEC.tankMaxL / APP_RATE_L_PER_DUNAM;
    const refills = Math.max(0, Math.floor((o.areaDunam / n) / dunamPerTank));
    refillS = refills * 180; // ~3 min per return-refill (land only; sea is one-way)
  }
  return Math.max(1, Math.round((sprayS + transitS + refillS) / 60));
}

export function fmtHM(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}
