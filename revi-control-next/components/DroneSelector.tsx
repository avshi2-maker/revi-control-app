"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// Deterministic drone fleet data (no random, always same layout)
function droneData(n: number) {
  const isMaint = n % 9 === 0;                             // 9,18,27,36,45
  const isCharge = !isMaint && n % 7 === 0;                // 7,14,21,28,35,42,49
  const battery = isMaint ? 0 : 70 + ((n * 17 + 3) % 30); // 70-99 %
  const status = isMaint ? "maint" : isCharge ? "charge" : "avail";
  const statusHe = isMaint ? "תחזוקה" : isCharge ? "טעינה" : "זמין";
  return { n, battery, status, statusHe, disabled: isMaint || isCharge };
}

const FLEET = Array.from({ length: 50 }, (_, i) => droneData(i + 1));
const AVAILABLE = FLEET.filter(d => !d.disabled).map(d => d.n); // all launch-ready drones

type Scenario = "land" | "ocean";
type Pad = "ground" | "boat";

export default function DroneSelector() {
  const [selected, setSelected] = useState<number[]>([]);
  const [scenario, setScenario] = useState<Scenario>("land");
  const [pad, setPad] = useState<Pad>("ground");
  const router = useRouter();

  // Picking a scenario auto-sets the natural launch pad (user can still override).
  const pickScenario = (s: Scenario) => {
    setScenario(s);
    setPad(s === "ocean" ? "boat" : "ground");
  };

  const toggle = (n: number, disabled: boolean) => {
    if (disabled) return;
    setSelected(prev =>
      prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]
    );
  };

  const selectAll = () => setSelected(AVAILABLE);
  const clearAll = () => setSelected([]);

  const launch = () => {
    if (selected.length === 0) return;
    const q = [...selected].sort((a, b) => a - b).join(",");
    const params = new URLSearchParams({ drones: q, pad });
    if (scenario === "ocean") params.set("scenario", "ocean");
    router.push(`/map?${params.toString()}`);
  };

  const isOcean = scenario === "ocean";

  return (
    <div className="sel-page">
      <div className="sel-topbar">
        <div className="logo" />
        <div>
          <h1>בחר רחפנים למשימה</h1>
          <p>
            {isOcean ? "ריסוס בקטריאלי · ים תיכון מול אשדוד" : "ריסוס עמק השרון"} · בחר עד {AVAILABLE.length} רחפנים זמינים
          </p>
        </div>
        <div className="sel-count">
          <span className="sel-badge">נבחרו {selected.length} / {AVAILABLE.length}</span>
          <button className="sel-launch" style={{ background: "transparent", border: "1px solid rgba(120,190,220,.35)" }} onClick={selectAll}>
            בחר הכל
          </button>
          <button className="sel-launch" style={{ background: "transparent", border: "1px solid rgba(120,190,220,.35)" }} disabled={selected.length === 0} onClick={clearAll}>
            נקה
          </button>
          <button className="sel-launch" disabled={selected.length === 0} onClick={launch}>
            ← צא למשימה
          </button>
        </div>
        <a className="sel-back" href="/">← חזור</a>
      </div>

      <div className="sel-body">
        {/* Mission scenario + launch pad */}
        <div className="sel-scen">
          <div className="scen-group">
            <span className="scen-label">סוג משימה</span>
            <button className={`scen-btn ${!isOcean ? "on" : ""}`} onClick={() => pickScenario("land")}>
              🌿 ריסוס יבשתי
            </button>
            <button className={`scen-btn ${isOcean ? "on ocean" : ""}`} onClick={() => pickScenario("ocean")}>
              🌊 ריסוס בקטריאלי (ים)
            </button>
          </div>
          <div className="scen-group">
            <span className="scen-label">נקודת שיגור</span>
            <button className={`scen-btn ${pad === "ground" ? "on" : ""}`} onClick={() => setPad("ground")}>
              🏟 קרקע
            </button>
            <button className={`scen-btn ${pad === "boat" ? "on ocean" : ""}`} onClick={() => setPad("boat")}>
              ⛵ ספינה
            </button>
          </div>
          {isOcean && (
            <div className="scen-warn">⚠ במשימת ים הרחפנים אינם חוזרים — שיגור חד-כיווני</div>
          )}
        </div>

        <div className="sel-legend">
          <div className="leg"><div className="leg-dot" style={{background:"var(--good)"}} />זמין לשיגור</div>
          <div className="leg"><div className="leg-dot" style={{background:"var(--warn)"}} />בטעינה</div>
          <div className="leg"><div className="leg-dot" style={{background:"var(--bad)"}} />תחזוקה</div>
        </div>
        <div className="drone-grid">
          {FLEET.map(d => {
            const sel = selected.includes(d.n);
            const selIdx = selected.indexOf(d.n) + 1;
            return (
              <div
                key={d.n}
                className={`dc ${d.status === "maint" ? "maintenance" : d.status === "charge" ? "charging" : ""} ${sel ? "selected" : ""}`}
                onClick={() => toggle(d.n, d.disabled)}
              >
                <div className="chk">{selIdx || ""}</div>
                <div className="dnum" style={{color: sel ? "var(--accent)" : "var(--ink)"}}>
                  {String(d.n).padStart(2, "0")}
                </div>
                <div className="dname">רחפן D{d.n}</div>
                <div className={`dstatus ${d.status}`}>{d.statusHe}</div>
                {d.status !== "maint" && (
                  <div className="dbat">סוללה <b>{d.battery}%</b></div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
