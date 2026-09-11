"use client";
import { useEffect, useState } from "react";

// Live weather for the ACTUAL positioned zone centre — updates whenever the
// operator moves the zone. Confirms conditions over the real operation area
// (e.g. stronger northern winds), not just the regional pre-check in step 2.
const V = { GO: "GO", CAUTION: "זהירות", NO_GO: "NO-GO" } as const;

export default function ZoneWeather({
  center, scenario,
}: { center: [number, number]; scenario: "land" | "ocean" }) {
  const [wx, setWx] = useState<null | { ws: number; temp: number; dir: string; verdict: keyof typeof V }>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true; setLoading(true);
    (async () => {
      try {
        const r = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${center[0]}&longitude=${center[1]}&current=temperature_2m,windspeed_10m,winddirection_10m&windspeed_unit=ms&timezone=auto`
        );
        const d = await r.json(); const c = d.current;
        const ws = c.windspeed_10m as number;
        const caution = scenario === "ocean" ? 2 : 3, nogo = scenario === "ocean" ? 4 : 6;
        const verdict: keyof typeof V = ws < caution ? "GO" : ws < nogo ? "CAUTION" : "NO_GO";
        const dirs = ["צפון", "צפון-מזרח", "מזרח", "דרום-מזרח", "דרום", "דרום-מערב", "מערב", "צפון-מערב"];
        const dir = dirs[Math.round(c.winddirection_10m / 45) % 8];
        if (alive) { setWx({ ws, temp: Math.round(c.temperature_2m), dir, verdict }); setLoading(false); }
      } catch { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [center[0], center[1], scenario]);

  const cls = wx ? (wx.verdict === "GO" ? "go" : wx.verdict === "CAUTION" ? "caution" : "nogo") : "";

  return (
    <div className={`zw ${cls}`}>
      <span className="zw-title">🛰 מזג אוויר באזור הנבחר <span className="zw-live"><span className="zw-dot" />חי</span></span>
      {loading && <span className="zw-load">טוען…</span>}
      {wx && !loading && (
        <>
          <span>🌬 <b>{wx.ws.toFixed(1)}</b> מ/ש · {wx.dir}</span>
          <span>🌡 <b>{wx.temp}</b>°C</span>
          <span className="zw-verdict">{V[wx.verdict]}</span>
          {wx.verdict !== "GO" && <span className="zw-warn">⚠ תנאי האזור שונים מהתחזית האזורית — ודא שליטה מלאה</span>}
        </>
      )}
    </div>
  );
}
