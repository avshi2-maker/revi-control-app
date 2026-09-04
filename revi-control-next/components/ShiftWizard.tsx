"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { Geo } from "@/components/ZonePicker";

// Leaflet touches window at import — client only.
const ZonePicker = dynamic(() => import("@/components/ZonePicker"), { ssr: false });

// dunam estimate for a lat/lng bounding box (1 dunam = 1000 m²).
function dunam(z: Geo["zone"]) {
  const midLat = (z.s + z.n) / 2;
  const wM = (z.e - z.w) * 111320 * Math.cos((midLat * Math.PI) / 180);
  const hM = (z.n - z.s) * 111320;
  return Math.max(0, Math.round((wM * hM) / 1000));
}

// 7-step shift wizard. Holds all mission config in React state, then on GO
// navigates to /cockpit?scenario=..&drones=..&pad=..&algo=.. — LiveMap reads
// those params from location.search and mounts inside the cockpit shell.

type Scenario = "land" | "ocean";
type Pad = "ground" | "boat";
type Algo = "boustro" | "spiral" | "grid";

// Compact deterministic fleet (same rules as DroneSelector).
function avail(n: number) {
  const isMaint = n % 9 === 0;
  const isCharge = !isMaint && n % 7 === 0;
  return { n, ok: !isMaint && !isCharge, status: isMaint ? "maint" : isCharge ? "charge" : "avail" };
}
const FLEET = Array.from({ length: 50 }, (_, i) => avail(i + 1));

const STEPS = ["תרחיש", "רחפנים", "מפה + שיגור", "אישור", "אלגוריתם", "סיכום", "שיגור"];

const ALGOS: { id: Algo; he: string; desc: string }[] = [
  { id: "boustro", he: "מעברים מקבילים", desc: "כיסוי שורה-אחר-שורה (בוסטרופדון) — יעיל לשטח מלבני" },
  { id: "spiral", he: "ספירלה", desc: "מהיקף פנימה — טוב למוקד מרכזי" },
  { id: "grid", he: "רשת", desc: "חלוקה לתאים — כיסוי אחיד עם חפיפה מינימלית" },
];

export default function ShiftWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [scenario, setScenario] = useState<Scenario>("land");
  const [pad, setPad] = useState<Pad>("ground");
  const [drones, setDrones] = useState<number[]>([]);
  const [algo, setAlgo] = useState<Algo>("boustro");
  const [eye, setEye] = useState<number | null>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [permit, setPermit] = useState({ weather: false, airspace: false, tank: false });

  const isOcean = scenario === "ocean";
  const permitOk = permit.weather && permit.airspace && permit.tank;

  const pickScenario = (s: Scenario) => {
    setScenario(s);
    setPad(s === "ocean" ? "boat" : "ground");
    setGeo(null); // geometry differs per scenario — repick on the map
  };
  const toggleDrone = (n: number, ok: boolean) => {
    if (!ok) return;
    setDrones(p => {
      const next = p.includes(n) ? p.filter(x => x !== n) : [...p, n];
      if (!next.includes(n) && eye === n) setEye(null); // deselecting the Eye clears it
      return next;
    });
  };

  // Per-step gate for the Next button.
  const canNext = [
    true,                    // scenario always chosen
    drones.length > 0,       // at least one drone
    true,                    // pad always chosen
    permitOk,                // all clearances
    true,                    // algo always chosen
    true,                    // summary
    true,
  ][step];

  const launch = () => {
    const q = [...drones].sort((a, b) => a - b).join(",");
    const params = new URLSearchParams({ drones: q, pad, algo });
    if (isOcean) params.set("scenario", "ocean");
    if (eye && drones.includes(eye)) params.set("eye", String(eye));
    if (geo) {
      const b = geo.base, z = geo.zone;
      params.set("base", `${b.lng.toFixed(5)},${b.lat.toFixed(5)}`);
      params.set("zone", `${z.w.toFixed(5)},${z.e.toFixed(5)},${z.s.toFixed(5)},${z.n.toFixed(5)}`);
    }
    router.push(`/cockpit?${params.toString()}`);
  };

  return (
    <div className="wz">
      <div className="wz-top">
        <div className="wz-brand"><div className="wz-logo" /><b>Revi-Control</b><span>אשף פתיחת משמרת</span></div>
        <div className="wz-steps">
          {STEPS.map((s, i) => (
            <div key={s} className={`wz-step ${i === step ? "on" : ""} ${i < step ? "done" : ""}`}>
              <span className="wz-num">{i < step ? "✓" : i + 1}</span>{s}
            </div>
          ))}
        </div>
      </div>

      <div className="wz-body">
        {/* 1 — Scenario */}
        {step === 0 && (
          <div className="wz-pane">
            <h2>בחר סוג משימה</h2>
            <div className="wz-cards">
              <button className={`wz-card ${!isOcean ? "on" : ""}`} onClick={() => pickScenario("land")}>
                <div className="wz-ico">🌿</div><b>ריסוס יבשתי</b>
                <p>ריסוס פרדסים ושדות · שיגור מקרקע · רחפנים חוזרים לבסיס</p>
              </button>
              <button className={`wz-card ${isOcean ? "on ocean" : ""}`} onClick={() => pickScenario("ocean")}>
                <div className="wz-ico">🌊</div><b>ריסוס בקטריאלי (ים)</b>
                <p>ריסוס שטח ימי · שיגור מספינה · רחפנים מתכלים — עלות מוכרת בחוזה</p>
              </button>
            </div>
          </div>
        )}

        {/* 2 — Drones */}
        {step === 1 && (
          <div className="wz-pane">
            <h2>בחר רחפנים <span className="wz-badge">{drones.length} נבחרו</span></h2>
            <div className="wz-fleet">
              {FLEET.map(d => (
                <button
                  key={d.n}
                  className={`wz-d ${d.status} ${drones.includes(d.n) ? "sel" : ""}`}
                  disabled={!d.ok}
                  onClick={() => toggleDrone(d.n, d.ok)}
                >
                  {String(d.n).padStart(2, "0")}
                </button>
              ))}
            </div>
            {drones.length > 0 && (
              <div className="wz-eye">
                <span className="wz-eye-lbl">🎥 רחפן צילום (עין):</span>
                <button className={`wz-eye-b ${eye === null ? "on" : ""}`} onClick={() => setEye(null)}>ללא</button>
                {[...drones].sort((a, b) => a - b).map(n => (
                  <button key={n} className={`wz-eye-b ${eye === n ? "on" : ""}`} onClick={() => setEye(n)}>D{n}</button>
                ))}
                <p className="wz-note">הרחפן הנבחר יצא ראשון, ימריא גבוה מעל הצי ויסרוק בשידור חי — ללא ריסוס. צפייה בתחנת הפיקוד.</p>
              </div>
            )}
          </div>
        )}

        {/* 3 — Map + pad */}
        {step === 2 && (
          <div className="wz-pane">
            <h2>נקודת שיגור ואזור ריסוס</h2>
            <div className="wz-cards">
              <button className={`wz-card ${pad === "ground" ? "on" : ""}`} onClick={() => setPad("ground")}>
                <div className="wz-ico">🏟</div><b>קרקע</b><p>מנחת יבשתי · שיגור ונחיתה סטנדרטיים</p>
              </button>
              <button className={`wz-card ${pad === "boat" ? "on ocean" : ""}`} onClick={() => setPad("boat")}>
                <div className="wz-ico">⛵</div><b>ספינה</b><p>שיגור מספינה בים · חד-כיווני במשימת ים</p>
              </button>
            </div>
            <div className="wz-mapwrap">
              <ZonePicker scenario={scenario} value={geo} onChange={setGeo} />
              <div className="wz-maptag">
                גרור את <b>{pad === "boat" ? "⛵ הספינה" : "H הבסיס"}</b> ואת פינות <b>SW / NE</b> לעיצוב אזור הריסוס
                {geo && <span className="wz-area"> · שטח נבחר: <b>{dunam(geo.zone).toLocaleString("he-IL")} דונם</b></span>}
              </div>
            </div>
          </div>
        )}

        {/* 4 — Permission */}
        {step === 3 && (
          <div className="wz-pane">
            <h2>אישורי שיגור</h2>
            <label className="wz-chk"><input type="checkbox" checked={permit.weather} onChange={e => setPermit(p => ({ ...p, weather: e.target.checked }))} /> תנאי מזג אוויר נבדקו ומתאימים</label>
            <label className="wz-chk"><input type="checkbox" checked={permit.airspace} onChange={e => setPermit(p => ({ ...p, airspace: e.target.checked }))} /> המרחב האווירי פנוי ומאושר</label>
            <label className="wz-chk"><input type="checkbox" checked={permit.tank} onChange={e => setPermit(p => ({ ...p, tank: e.target.checked }))} /> מיכלי התרסיס מלאים ותקינים</label>
            {isOcean && <div className="wz-warn">⚠ משימת ים — הרחפנים לא יחזרו. עלות המתכלים תיזקף לחוזה.</div>}
          </div>
        )}

        {/* 5 — Algorithm */}
        {step === 4 && (
          <div className="wz-pane">
            <h2>אלגוריתם כיסוי</h2>
            <div className="wz-algos">
              {ALGOS.map(a => (
                <button key={a.id} className={`wz-algo ${algo === a.id ? "on" : ""}`} onClick={() => setAlgo(a.id)}>
                  <b>{a.he}</b><p>{a.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 6 — Summary */}
        {step === 5 && (
          <div className="wz-pane">
            <h2>סיכום משימה</h2>
            <div className="wz-sum">
              <div><span>סוג משימה</span><b>{isOcean ? "🌊 ריסוס בקטריאלי (ים)" : "🌿 ריסוס יבשתי"}</b></div>
              <div><span>נקודת שיגור</span><b>{pad === "boat" ? "⛵ ספינה" : "🏟 קרקע"}</b></div>
              <div><span>רחפנים</span><b>{drones.length} · {[...drones].sort((a, b) => a - b).map(n => "D" + n).join(", ") || "—"}</b></div>
              <div><span>רחפן צילום</span><b>{eye ? `📹 D${eye}` : "ללא"}</b></div>
              <div><span>אלגוריתם</span><b>{ALGOS.find(a => a.id === algo)?.he}</b></div>
              <div><span>אזור ריסוס</span><b>{geo ? `${dunam(geo.zone).toLocaleString("he-IL")} דונם` : "ברירת מחדל"}</b></div>
              <div><span>אישורים</span><b style={{ color: "var(--good)" }}>✓ הושלמו</b></div>
            </div>
          </div>
        )}

        {/* 7 — Launch */}
        {step === 6 && (
          <div className="wz-pane wz-launch">
            <div className="wz-golauncher">
              <div className="wz-ico big">{isOcean ? "🌊" : "🌿"}</div>
              <h2>מוכן לשיגור</h2>
              <p>{drones.length} רחפנים · {isOcean ? "משימת ים חד-כיוונית" : "ריסוס יבשתי"} · {ALGOS.find(a => a.id === algo)?.he}</p>
              <button className="wz-go" onClick={launch}>🚀 שגר משימה</button>
            </div>
          </div>
        )}
      </div>

      <div className="wz-foot">
        <button className="wz-nav" disabled={step === 0} onClick={() => setStep(s => s - 1)}>→ הקודם</button>
        <a className="wz-nav ghost" href="/">חזרה למפה</a>
        {step < 6 && (
          <button className="wz-nav primary" disabled={!canNext} onClick={() => setStep(s => s + 1)}>הבא ←</button>
        )}
      </div>
    </div>
  );
}
