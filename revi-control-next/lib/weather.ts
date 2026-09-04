// Deterministic flight/spray advisory core. The numbers here are physics, not AI —
// the /api/weather-advice route enriches the wording via Claude, but always falls
// back to these computed values so the advisor works even with no API key.

export type Verdict = "GO" | "CAUTION" | "NO_GO";

export interface WxIn {
  scenario: "land" | "ocean";
  windSpeed: number;   // m/s
  windDir: number;     // degrees, meteorological (direction wind comes FROM)
  temp: number;        // °C
  humidity: number;    // %
  areaDunam?: number;
}

export interface Advice {
  verdict: Verdict;
  windSpeed: number;
  windDir: number;
  windDirHe: string;
  temp: number;
  humidity: number;
  crabDeg: number;        // heading offset into wind to hold ground track
  passAxisHe: string;     // recommended spray-pass orientation
  laneAdjPct: number;     // tighten lane spacing by this % to counter drift
  upwindOffsetM: number;  // shift release line upwind by this many metres
  driftM: number;         // estimated droplet drift at spray height
  reasons: string[];
  operatorTips: string[];
  source: "fallback" | "ai";
}

const AIRSPEED = 10; // typical spray-drone airspeed, m/s

export function windDirHe(deg: number): string {
  const dirs = ["צפון", "צפון-מזרח", "מזרח", "דרום-מזרח", "דרום", "דרום-מערב", "מערב", "צפון-מערב"];
  return dirs[Math.round(deg / 45) % 8];
}

export function computeAdvice(inp: WxIn): Advice {
  const ocean = inp.scenario === "ocean";
  const caution = ocean ? 2 : 3;
  const nogo = ocean ? 4 : 6;
  const w = inp.windSpeed;

  const verdict: Verdict = w < caution ? "GO" : w < nogo ? "CAUTION" : "NO_GO";
  const crabDeg = Math.round((Math.asin(Math.min(1, w / AIRSPEED)) * 180) / Math.PI);
  const driftM = Math.round(w * 2); // ~2 m drift per m/s at ~30 m spray height
  const upwindOffsetM = driftM;
  const laneAdjPct = verdict === "GO" ? 0 : Math.min(30, Math.round(w * 4));
  const dHe = windDirHe(inp.windDir);

  const passAxisHe =
    verdict === "GO"
      ? "כל כיוון — רוח חלשה, סחף זניח"
      : `לאורך ציר הרוח (${dHe}) — הלוך-חזור מול/עם הרוח, לא לרוחבה`;

  const reasons: string[] = [];
  if (verdict === "GO") reasons.push(`רוח ${w.toFixed(1)} מ/ש — מתחת לסף ${caution} מ/ש, תנאי ריסוס טובים`);
  if (verdict === "CAUTION") reasons.push(`רוח ${w.toFixed(1)} מ/ש (${dHe}) — בין ${caution} ל-${nogo} מ/ש: סחף תרסיס אפשרי, נדרשת תאורת סחף`);
  if (verdict === "NO_GO") reasons.push(`רוח ${w.toFixed(1)} מ/ש (${dHe}) — מעל סף ${nogo} מ/ש: סחף גבוה, הריסוס עלול להחטיא את היעד`);
  if (inp.temp >= 32) reasons.push(`חום ${inp.temp}° — אידוי מהיר של הטיפות, מומלץ לרסס בשעות קרירות`);
  if (inp.humidity < 40) reasons.push(`לחות נמוכה ${inp.humidity}% — מגבירה אידוי וסחף`);
  if (ocean) reasons.push("משימת ים: מצב הים משני למהירות הרוח — הרוח היא הגורם המכריע לסחף");

  const operatorTips: string[] = [];
  if (verdict !== "GO") {
    operatorTips.push(`טוס בזווית סחיפה (crab) של כ-${crabDeg}° אל תוך הרוח כדי לשמור על מסלול הקרקע`);
    operatorTips.push(`הזז את קו השחרור ${upwindOffsetM} מ׳ נגד כיוון הרוח — הטיפות יסחפו בחזרה אל היעד`);
    operatorTips.push(`צמצם מרווח בין נתיבים ב-${laneAdjPct}% למניעת פערים בכיסוי`);
    operatorTips.push("רסס רק ברגל שנגד הרוח; דלג על רגל החזרה עם הרוח");
  } else {
    operatorTips.push("תנאים טובים — כיסוי סטנדרטי, אין צורך בתיקון סחף");
  }
  if (verdict === "NO_GO") operatorTips.push("שקול דחייה עד להתמתנות הרוח, או צמצם את חלון הריסוס לפינה המוגנת בלבד");

  return {
    verdict, windSpeed: w, windDir: inp.windDir, windDirHe: dHe,
    temp: inp.temp, humidity: inp.humidity,
    crabDeg, passAxisHe, laneAdjPct, upwindOffsetM, driftM,
    reasons, operatorTips, source: "fallback",
  };
}

export const VERDICT_HE: Record<Verdict, string> = {
  GO: "אישור טיסה — GO",
  CAUTION: "זהירות — CAUTION",
  NO_GO: "אסור לשגר — NO-GO",
};
