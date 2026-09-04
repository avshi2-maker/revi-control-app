"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

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
  const [permit, setPermit] = useState({ weather: false, airspace: false, tank: false });

  const isOcean = scenario === "ocean";
  const permitOk = permit.weather && permit.airspace && permit.tank;

  const pickScenario = (s: Scenario) => { setScenario(s); setPad(s === "ocean" ? "boat" : "ground"); };
  const toggleDrone = (n: number, ok: boolean) => {
    if (!ok) return;
    setDrones(p => p.includes(n) ? p.filter(x => x !== n) : [...p, n]);
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
          </div>
        )}

        {/* 3 — Map + pad */}
        {step === 2 && (
          <div className="wz-pane">
            <h2>נקודת שיגור</h2>
            <div className="wz-cards">
              <button className={`wz-card ${pad === "ground" ? "on" : ""}`} onClick={() => setPad("ground")}>
                <div className="wz-ico">🏟</div><b>קרקע</b><p>מנחת יבשתי · שיגור ונחיתה סטנדרטיים</p>
              </button>
              <button className={`wz-card ${pad === "boat" ? "on ocean" : ""}`} onClick={() => setPad("boat")}>
                <div className="wz-ico">⛵</div><b>ספינה</b><p>שיגור מספינה בים · חד-כיווני במשימת ים</p>
              </button>
            </div>
            <p className="wz-note">את גבולות אזור הריסוס ואת מיקום ה{pad === "boat" ? "ספינה" : "בסיס"} ניתן לגרור על המפה החיה לאחר השיגור.</p>
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
              <div><span>אלגוריתם</span><b>{ALGOS.find(a => a.id === algo)?.he}</b></div>
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
