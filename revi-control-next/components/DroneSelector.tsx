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

export default function DroneSelector() {
  const [selected, setSelected] = useState<number[]>([]);
  const router = useRouter();

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
    router.push(`/map?drones=${q}`);
  };

  return (
    <div className="sel-page">
      <div className="sel-topbar">
        <div className="logo" />
        <div>
          <h1>בחר רחפנים למשימה</h1>
          <p>ריסוס עמק השרון · בחר עד {AVAILABLE.length} רחפנים זמינים</p>
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
