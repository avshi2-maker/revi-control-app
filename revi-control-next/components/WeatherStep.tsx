"use client";
import { useEffect, useState } from "react";
import { GEO, GEO_OCEAN } from "@/lib/config";
import { VERDICT_HE, type Advice } from "@/lib/weather";

type AdviceX = Advice & { headline?: string };

// Step 2: live forecast for the mission area → AI + math flight advisory, with a
// confirm/abort gate. Fetches Open-Meteo, then /api/weather-advice.
export default function WeatherStep({
  scenario,
  areaDunam,
  confirmed,
  onConfirm,
}: {
  scenario: "land" | "ocean";
  areaDunam?: number;
  confirmed: boolean;
  onConfirm: (v: boolean) => void;
}) {
  const [advice, setAdvice] = useState<AdviceX | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true); setErr(false); setAdvice(null);
    const c = scenario === "ocean" ? GEO_OCEAN.center : GEO.center;
    (async () => {
      try {
        const wr = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${c[0]}&longitude=${c[1]}&current=temperature_2m,windspeed_10m,winddirection_10m,relativehumidity_2m&windspeed_unit=ms&timezone=auto`
        );
        const wd = await wr.json();
        const cur = wd.current;
        const ar = await fetch("/api/weather-advice", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            scenario,
            windSpeed: cur.windspeed_10m,
            windDir: cur.winddirection_10m,
            temp: Math.round(cur.temperature_2m),
            humidity: Math.round(cur.relativehumidity_2m),
            areaDunam,
          }),
        });
        const a = await ar.json();
        if (alive) { setAdvice(a); setLoading(false); }
      } catch {
        if (alive) { setErr(true); setLoading(false); }
      }
    })();
    return () => { alive = false; };
  }, [scenario, areaDunam]);

  const v = advice?.verdict;
  const vcls = v === "GO" ? "go" : v === "CAUTION" ? "caution" : v === "NO_GO" ? "nogo" : "";

  return (
    <div className="wz-pane">
      <h2>מזג אוויר ואישור טיסה</h2>

      {loading && <div className="wx-load">טוען תחזית ומריץ יועץ טיסה…</div>}
      {err && <div className="wz-warn">שגיאה בטעינת התחזית. ניתן להמשיך, אך בדוק תנאים ידנית.</div>}

      {advice && (
        <>
          <div className={`wx-verdict ${vcls}`}>
            <div className="wx-v-badge">{VERDICT_HE[advice.verdict]}</div>
            <div className="wx-v-head">{advice.headline || ""}</div>
            <div className="wx-src">{advice.source === "ai" ? "🤖 יועץ AI" : "מחושב"}</div>
          </div>

          <div className="wx-chips">
            <div className="wx-chip">🌬 <b>{advice.windSpeed.toFixed(1)}</b> מ/ש · {advice.windDirHe}</div>
            <div className="wx-chip">🌡 <b>{advice.temp}</b>°C</div>
            <div className="wx-chip">💧 <b>{advice.humidity}</b>%</div>
          </div>

          <div className="wx-block">
            <h3>הערכת תנאים</h3>
            <ul className="wx-list">{advice.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
          </div>

          {advice.verdict !== "GO" && (
            <div className="wx-block">
              <h3>דפוס טיסה נגד סחף</h3>
              <div className="wx-pattern">
                <div><span>זווית סחיפה (crab)</span><b>{advice.crabDeg}°</b></div>
                <div><span>היסט נגד הרוח</span><b>{advice.upwindOffsetM} מ׳</b></div>
                <div><span>צמצום מרווח נתיבים</span><b>{advice.laneAdjPct}%</b></div>
                <div><span>סחף משוער</span><b>{advice.driftM} מ׳</b></div>
                <div className="wx-axis"><span>ציר מעברים מומלץ</span><b>{advice.passAxisHe}</b></div>
              </div>
            </div>
          )}

          <div className="wx-block">
            <h3>הנחיות לטייס</h3>
            <ul className="wx-list tips">{advice.operatorTips.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </div>

          <label className={`wz-chk wx-confirm ${vcls}`}>
            <input type="checkbox" checked={confirmed} onChange={e => onConfirm(e.target.checked)} />
            {advice.verdict === "NO_GO"
              ? "אני מאשר/ת יציאה למשימה למרות האזהרה — באחריות המפעיל"
              : "בדקתי את התנאים ואני מאשר/ת יציאה למשימה"}
          </label>
        </>
      )}
    </div>
  );
}
