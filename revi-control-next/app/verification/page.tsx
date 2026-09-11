import { DRONE_SPEC as S, MAX_ZONE_DUNAM } from "@/lib/config";

export const metadata = { title: "אימות נתונים — Revi-Control" };

// Transparency page. Reads values live from config so it always matches the app.
export default function VerificationPage() {
  const real: [string, string, string][] = [
    ["דגם רחפן", S.model, "מפרט יצרן רשמי"],
    ["משקל (כולל סוללה)", `${S.dryKg} ק״ג`, "39.9 ק״ג גוף + 12.1 ק״ג סוללה"],
    ["משקל המראה מרבי (MTOW)", `${S.mtowKg} ק״ג`, "ריסוס · גובה פני הים"],
    ["מטען ריסוס מרבי", `${S.maxPayloadKg} ק״ג`, "Operating payload"],
    ["נפח מיכל תרסיס", `${S.tankMaxL} ליטר`, "Dual atomizing system"],
    ["עמידות רוח מרבית", `${S.windMaxMps} מ/ש`, "תואם לסף ה-NO-GO היבשתי"],
    ["גובה ריסוס", `${S.minAltM}–${S.maxAltM} מ׳`, "ייצוב ראדאר · חלון ריסוס מציאותי"],
    ["רוחב ריסוס אפקטיבי", `${S.sprayWidthM} מ׳`, "בגובה 3 מ׳ (4–11 מ׳)"],
  ];
  const demo: [string, string, string][] = [
    ["טווח טיסה לחישוב", `${S.rangeKmFull} ק״מ`, "הרדיוס האמיתי: 2,000 מ׳. המפה בקנה-מידה קולנועי להמחשה."],
    ["כיסוי לרחפן", `${S.coverageDunamFull.toLocaleString("he-IL")} דונם`, "מכויל לגודל המפה שבהדגמה, לא לשדה אמיתי."],
    ["זמן טיסה בעומס", `${S.flightMinutesFull} דק׳`, "T50 ריאלי ≈ 7–9 דק׳; מוצג לצורך המחשה."],
    ["משך משימה", "מחושב", "אומדן פיזיקלי אמיתי (שטח, מהירות, רוח, דפוס, מעבר, מילויים) — אך נגזר מהשטח הקולנועי, לכן להמחשה עד לכיול המפה."],
    ["שטח אזור מרבי", `${MAX_ZONE_DUNAM.land.toLocaleString("he-IL")} / ${MAX_ZONE_DUNAM.ocean.toLocaleString("he-IL")} דונם`, "גבול הדגמה (יבשה/ים)."],
    ["שידור מצלמת ה'עין'", "מדומה", "מפה חיה + הדמיית פני-ים. אינו וידאו אמיתי מרחפן."],
    ["מפת בריאות (NDVI)", "נתונים מדומים", "שכבת ריסוס מדויק להמחשה. בפריסה: NDVI אמיתי ממיפוי/לוויין (Sentinel)."],
    ["מעקב תבליט (LiDAR)", "חיווי סטטוס", "היכולת אמיתית בחומרת T50 (ראדאר מערך-מדורג); המערכת מציגה סטטוס, לא נתוני גובה חיים."],
    ["תרחיש ימי", "המחשה", "התאמת פלטפורמה יבשתית — אינו מוצר מדף."],
  ];
  const upgrade = [
    "טעינת מפרט הרחפן האמיתי שברשותכם — כל שדה בטבלת הנתונים האמיתיים.",
    "כיול המפה לגודל שדה אמיתי — טווחים, כיסוי וזמני טיסה הופכים לליטרליים.",
    "חיבור טלמטריה וטיסה אמיתית דרך ה-SDK של היצרן / MAVLink.",
    "שידור וידאו חי אמיתי מרחפן הצילום (WebRTC / RTMP).",
    "אינטגרציית תחזית ורגולציה מקומית (רת״א / אישורי מרחב אווירי).",
    "שמירת היסטוריית משימות, דוחות וחשבוניות בענן.",
  ];

  const Table = ({ rows, kind }: { rows: [string, string, string][]; kind: "real" | "demo" }) => (
    <div className="dv-tablewrap">
      <table className="dv-table">
        <thead>
          <tr className={kind}>
            <th>פרמטר</th><th>ערך במערכת</th><th>מקור / הערה</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, v, note], i) => (
            <tr key={k} className={i % 2 ? "alt" : ""}>
              <td className="dv-k">{k}</td>
              <td className="dv-v">{v}</td>
              <td className="dv-n">{note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="dv" dir="rtl">
      <div className="dv-head">
        <div>
          <div className="dv-logo" />
          <h1>אימות נתונים</h1>
          <p>הדגמה מול פריסה אמיתית · שקיפות מלאה</p>
        </div>
        <a className="dv-back" href="/">← חזרה למערכת</a>
      </div>

      <div className="dv-body">
        <div className="dv-intro">
          אנו מאמינים בשקיפות מלאה מול לקוחות ומשקיעים. חלק מהנתונים במערכת הם <b>מפרט יצרן אמיתי</b> (DJI Agras T50),
          וחלקם <b>ערכי הדגמה להמחשה</b> — משום שהמפה מוצגת בקנה-מידה קולנועי. הטבלאות הבאות מפרידות בין השניים באופן מלא.
        </div>

        <h2 className="dv-h2 real">✅ נתונים אמיתיים — {S.model}</h2>
        <Table rows={real} kind="real" />

        <h2 className="dv-h2 demo">🎬 ערכי הדגמה — להמחשה בלבד</h2>
        <Table rows={demo} kind="demo" />

        <div className="dv-upgrade">
          <h2 className="dv-h2 up">🚀 שדרוג מהדגמה לפריסה אמיתית</h2>
          <p>בפריסה מסחרית, כל ערכי ההדגמה הופכים לאמיתיים ומחוברים לחומרה:</p>
          <ul className="dv-list">{upgrade.map((u, i) => <li key={i}>{u}</li>)}</ul>
          <div className="dv-cta">
            <b>מוכנים לשדרג?</b>
            <span>אבשי ספיר · avshi2@gmail.com · להדגמה חיה ולשיחת התאמה</span>
          </div>
        </div>
      </div>
    </div>
  );
}
