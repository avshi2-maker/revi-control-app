import { NextResponse } from "next/server";
import { computeAdvice, VERDICT_HE, type WxIn, type Advice } from "@/lib/weather";

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
      '{"headline":"משפט קצר בעברית","reasons":["..."],"operatorTips":["..."]}. ' +
      "הנחיות: היצמד לפסיקת ה-verdict שסופקה. reasons = 2-4 סיבות ענייניות. " +
      "operatorTips = 2-4 הנחיות מעשיות לטייס למניעת סחף תרסיס והחטאת היעד, בהתבסס על זווית הסחיפה, " +
      "היסט נגד הרוח וכיוון המעברים שסופקו. עברית מקצועית, תמציתית.";
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
        model: "claude-sonnet-5",
        max_tokens: 700,
        system: sys,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!r.ok) return NextResponse.json(base);
    const data = await r.json();
    const text: string = data?.content?.[0]?.text ?? "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return NextResponse.json(base);
    const ai = JSON.parse(m[0]) as { headline?: string; reasons?: string[]; operatorTips?: string[] };

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
