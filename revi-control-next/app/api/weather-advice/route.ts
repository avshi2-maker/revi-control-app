import { NextResponse } from "next/server";
import { computeAdvice, VERDICT_HE, type WxIn, type Advice } from "@/lib/weather";

export const maxDuration = 30; // allow the Claude call room (Pro plans)

// Haiku = fast, finishes well under the serverless timeout so advice never
// silently falls back to "מחושב". Override with CLAUDE_MODEL env if desired.
const MODEL = process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001";

// GET /api/weather-advice → health check. Reports whether the key is configured
// and, with ?live=1, makes a tiny real call to confirm it actually works.
// Never returns the key itself.
export async function GET(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  const present = !!key;
  const live = new URL(req.url).searchParams.get("live") === "1";
  if (!present) return NextResponse.json({ keyPresent: false, model: MODEL, note: "ANTHROPIC_API_KEY לא מוגדר — היועץ עובד במצב מחושב" });
  if (!live) return NextResponse.json({ keyPresent: true, model: MODEL, note: "מפתח קיים. הוסף ?live=1 לבדיקת חיבור אמיתית" });
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 16, messages: [{ role: "user", content: "reply OK" }] }),
    });
    const ok = r.ok;
    let detail = "";
    if (!ok) { try { detail = JSON.stringify((await r.json())?.error ?? {}); } catch { /* noop */ } }
    return NextResponse.json({ keyPresent: true, apiWorks: ok, status: r.status, model: MODEL, detail });
  } catch (e: any) {
    return NextResponse.json({ keyPresent: true, apiWorks: false, error: String(e?.message ?? e) });
  }
}

// POST { scenario, windSpeed, windDir, temp, humidity, areaDunam }
// → Advice JSON. Deterministic math always fills the numbers; Claude enriches the
// Hebrew reasons + operator tips when ANTHROPIC_API_KEY is set. Never throws to
// the client — falls back to the computed advice on any API error.
export async function POST(req: Request) {
  let body: WxIn;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }

  const base = computeAdvice(body);
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json(base); // fallback: math only

  try {
    const sys =
      "אתה יועץ מבצעי לצי רחפני ריסוס בישראל. קיבלת נתוני מזג אוויר וחישוב סחף דטרמיניסטי. " +
      "החזר אך ורק JSON תקין (ללא טקסט נוסף, ללא markdown) במבנה: " +
      '{"headline":"משפט קצר","reasons":["..."],"operatorTips":["..."]}. ' +
      "היצמד לפסיקת ה-verdict שסופקה. reasons = עד 3 פריטים, כל אחד עד 12 מילים. " +
      "operatorTips = עד 3 פריטים, כל אחד עד 12 מילים, הנחיות מעשיות למניעת סחף תרסיס. " +
      "עברית מקצועית ותמציתית. שמור על התשובה קצרה כדי שה-JSON יהיה שלם.";
    const user = JSON.stringify({
      scenario: body.scenario,
      verdict: base.verdict,
      windSpeed: base.windSpeed,
      windDir: base.windDir,
      windDirHe: base.windDirHe,
      temp: base.temp,
      humidity: base.humidity,
      crabDeg: base.crabDeg,
      upwindOffsetM: base.upwindOffsetM,
      laneAdjPct: base.laneAdjPct,
      passAxisHe: base.passAxisHe,
      areaDunam: body.areaDunam ?? null,
    });

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: sys,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!r.ok) return NextResponse.json(base);
    const data = await r.json();
    const text: string = (data?.content ?? []).map((b: any) => b?.text ?? "").join("").trim();
    // Robust parse: try whole string, then the outermost { … } slice.
    let ai: { headline?: string; reasons?: string[]; operatorTips?: string[] } | null = null;
    try { ai = JSON.parse(text); } catch { /* try slice */ }
    if (!ai) {
      const s0 = text.indexOf("{"), s1 = text.lastIndexOf("}");
      if (s0 >= 0 && s1 > s0) { try { ai = JSON.parse(text.slice(s0, s1 + 1)); } catch { /* give up */ } }
    }
    if (!ai) return NextResponse.json(base);

    const merged: Advice & { headline: string } = {
      ...base,
      source: "ai",
      headline: ai.headline || VERDICT_HE[base.verdict],
      reasons: Array.isArray(ai.reasons) && ai.reasons.length ? ai.reasons : base.reasons,
      operatorTips: Array.isArray(ai.operatorTips) && ai.operatorTips.length ? ai.operatorTips : base.operatorTips,
    };
    return NextResponse.json(merged);
  } catch {
    return NextResponse.json(base); // any failure → safe deterministic advice
  }
}
