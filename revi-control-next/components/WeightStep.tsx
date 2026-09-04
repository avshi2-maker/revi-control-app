"use client";
import { useEffect, useState } from "react";
import { DRONE_SPEC as S } from "@/lib/config";

// Weight & balance step. Per-drone load check against the manufacturer MTOW.
// Overweight blocks launch (onValid(false)). 1 L ≈ 1 kg.
export default function WeightStep({ onValid }: { onValid: (v: boolean) => void }) {
  const [tankL, setTankL] = useState(Math.round(S.tankMaxL * 0.6));
  const [sensor, setSensor] = useState(false);

  const payload = tankL + (sensor ? S.sensorKitKg : 0);
  const total = S.dryKg + payload;
  const payloadOver = payload > S.maxPayloadKg;
  const mtowOver = total > S.mtowKg;
  const margin = S.mtowKg - total;
  const nearLimit = !mtowOver && margin <= 5;

  const status = mtowOver ? "over" : nearLimit || payloadOver ? "warn" : "ok";
  const canFly = !mtowOver; // MTOW breach = no launch

  useEffect(() => { onValid(canFly); }, [canFly, onValid]);

  const pct = Math.min(100, Math.round((total / S.mtowKg) * 100));

  return (
    <div className="wz-pane">
      <h2>משקל ואיזון <span className="wz-badge">{S.model}</span></h2>

      <div className="wt-controls">
        <label className="wt-slider">
          <div className="wt-slider-top"><span>מילוי מיכל תרסיס</span><b>{tankL} ל׳</b></div>
          <input type="range" min={0} max={S.tankMaxL} value={tankL} onChange={e => setTankL(+e.target.value)} />
        </label>
        <label className="wt-chk">
          <input type="checkbox" checked={sensor} onChange={e => setSensor(e.target.checked)} />
          ערכת חיישנים נוספת (+{S.sensorKitKg} ק״ג)
        </label>
      </div>

      <div className="wt-grid">
        <div className="wt-row"><span>1 · משקל רחפן (יבש + סוללה)</span><b>{S.dryKg} ק״ג</b></div>
        <div className="wt-row"><span>2 · מטען נוסף (תרסיס + ציוד)</span><b className={payloadOver ? "over" : ""}>{payload.toFixed(1)} ק״ג</b></div>
        <div className="wt-row total"><span>3 · משקל המראה כולל</span><b className={mtowOver ? "over" : ""}>{total.toFixed(1)} ק״ג</b></div>
        <div className="wt-row"><span>4 · מגבלת יצרן (MTOW)</span><b>{S.mtowKg} ק״ג</b></div>
      </div>

      <div className={`wt-gauge ${status}`}>
        <div className="wt-gauge-bar"><i style={{ width: pct + "%" }} /></div>
        <div className="wt-gauge-lbl">{pct}% מ-MTOW · {margin >= 0 ? `שוליים ${margin.toFixed(1)} ק״ג` : `חריגה ${Math.abs(margin).toFixed(1)} ק״ג`}</div>
      </div>

      {status === "ok" && <div className="wt-alert ok">✅ המשקל תקין — מאושר לשיגור</div>}
      {status === "warn" && !mtowOver && <div className="wt-alert warn">⚠ קרוב למגבלה{payloadOver ? " · המטען מעל מקסימום היצרן" : ""} — שקול להפחית מילוי</div>}
      {status === "over" && <div className="wt-alert over">🚫 חריגת משקל — הרחפן חורג מ-MTOW ולא ישוגר. הפחת מילוי תרסיס.</div>}

      <div className="wt-balance">
        <span>איזון מטען:</span>
        <div className="wt-cg"><i /></div>
        <span className="wt-cg-note">מרכז כובד ממורכז (מיכל סימטרי) — תקין</span>
      </div>
    </div>
  );
}
