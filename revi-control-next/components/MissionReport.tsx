"use client";
import { OCEAN_UNIT_COST } from "@/lib/config";

// End-of-mission report modal. Rendered by LiveMap; opened from the endcard.
// Uses the live computed duration + real area.
export type MissionReportProps = {
  open: boolean;
  onClose: () => void;
  scenario: "land" | "ocean";
  droneCount: number;
  pad: "ground" | "boat";
  operator?: string;
  supervisor?: string;
  durationHM?: string;
  areaDunam?: number;
};

export default function MissionReport({ open, onClose, scenario, droneCount, pad, operator, supervisor, durationHM = "1:48", areaDunam = 420 }: MissionReportProps) {
  if (!open) return null;
  const ocean = scenario === "ocean";
  const areaStr = `${areaDunam.toLocaleString("he-IL")} דונם${ocean ? " ימי" : ""}`;
  const [dh, dm] = durationHM.split(":").map(Number);
  const durMin = (dh || 0) * 60 + (dm || 0);

  const now = new Date();
  const p2 = (x: number) => String(x).padStart(2, "0");
  const dateStr = `${p2(now.getDate())}/${p2(now.getMonth() + 1)}/${now.getFullYear()}`;
  const endStr = now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  const start = new Date(now.getTime() - durMin * 60 * 1000);
  const startStr = start.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });

  const cost = ocean ? droneCount * OCEAN_UNIT_COST : 0;
  const costStr = ocean ? `₪${cost.toLocaleString("he-IL")}` : "—";

  const rows: [string, string][] = [
    ["סוג משימה", ocean ? "🌊 ריסוס בקטריאלי (ים)" : "🌿 ריסוס יבשתי"],
    ["מפעיל", operator || "—"],
    ["אחראי משמרת", supervisor || "—"],
    ["תאריך", dateStr],
    ["שעת התחלה", startStr],
    ["שעת סיום", endStr],
    ["משך משוער (מחושב)", `${durationHM} שעות`],
    ["נקודת שיגור", pad === "boat" ? "⛵ ספינה" : "🏟 קרקע"],
    ["שטח יעד", areaStr],
    ["שטח שטופל", areaStr],
    ["כיסוי", "100%"],
    ["מספר רחפנים", String(droneCount)],
    ["סטטוס רחפנים", ocean ? `${droneCount} נספו בים 💦` : `${droneCount} חזרו לבסיס ✓`],
    ["עלות מתכלים", ocean ? `${costStr}  (${droneCount} × ₪${OCEAN_UNIT_COST.toLocaleString("he-IL")})` : "—"],
  ];

  // Plain-text body for email / WhatsApp export.
  const lines = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
  const subject = ocean ? "דוח משימת ריסוס ימי — Revi-Control" : "דוח משימת ריסוס — Revi-Control";
  const body = `${subject}\n${"—".repeat(20)}\n${lines}\n\nהופק ע״י Revi-Control · מרכז שליטה לצי ריסוס אוטונומי`;

  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(body)}`;

  return (
    <div className="mr-backdrop" onClick={onClose}>
      <div className="mr-modal" onClick={(e) => e.stopPropagation()} dir="rtl">
        <div className="mr-head">
          <div>
            <div className="mr-logo" />
            <h2>{ocean ? "דוח משימת ריסוס ימי" : "דוח משימת ריסוס"}</h2>
            <span className="mr-sub">Revi-Control · מרכז שליטה לצי ריסוס אוטונומי</span>
          </div>
          <button className="mr-x" onClick={onClose} aria-label="סגור">✕</button>
        </div>

        <div className="mr-grid">
          {rows.map(([k, v]) => (
            <div className="mr-cell" key={k}>
              <div className="mr-k">{k}</div>
              <div className="mr-v">{v}</div>
            </div>
          ))}
        </div>

        <div className="mr-actions">
          <a className="mr-btn" href={mailto}>✉ אימייל</a>
          <a className="mr-btn" href={whatsapp} target="_blank" rel="noopener noreferrer">💬 וואטסאפ</a>
          <button className="mr-btn" onClick={() => window.print()}>🖨 הדפסה / PDF</button>
          <button className="mr-btn ghost" onClick={onClose}>סגור</button>
        </div>
      </div>
    </div>
  );
}
