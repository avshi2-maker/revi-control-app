// config (lib/config.ts) · updated 17.09.2026 19:45 (Asia/Jerusalem)
// App version — bump on every deploy so the footer shows what's live.
export const APP_VERSION = "1.10.1";

// Legal — copyright + usage notice shown in footers across the app.
export const COPYRIGHT = "© 2026 אבשי ספיר · Revi-Control · כל הזכויות שמורות";
export const LEGAL_NOTICE =
  "תוכנה זו, קוד המקור, העיצוב וכל רכיביה מוגנים בזכויות יוצרים. " +
  "אין להעתיק, לשכפל, להפיץ, לבצע הנדסה חוזרת או לעשות כל שימוש — מסחרי או אחר — " +
  "ללא הסכם רישוי בכתב, חתום ומאושר מראש. כל הפרה תיאכף במלוא חומרת הדין.";

// Single place to tweak the whole simulation.

export const COLORS = ["#38bdf8", "#a78bfa", "#fb7185", "#facc15"];
export const NAMES = ["D1", "D2", "D3", "D4"];

// Mission timeline (seconds). Change here to retime the whole show.
export const TIMELINE = {
  title: [0, 4],
  mapin: [4, 10],
  plan: [10, 16],
  launch: [16, 18.5],
  spray: [18.5, 45],
  done: [45, 49],
  rth: [49, 55],
  end: [55, 61],
} as const;

export const DUR = 61;

// Drone D3 smart-cycle (return-to-base + refill) timings, inside the spray window.
export const D3 = { low: 29, arrive: 32, refillEnd: 35, rejoin: 38 } as const;

// Live map geography — Sharon Valley agricultural area (orange/citrus orchards north of Tel Aviv).
// Visible as green fields on Esri satellite. Change to any target area here.
export const GEO = {
  base: { lng: 34.895, lat: 32.355 }, // farm depot near Netanya / Sharon Valley
  zone: { w: 34.862, e: 34.935, s: 32.315, n: 32.392 }, // citrus grove spray zone
  center: [32.353, 34.898] as [number, number],
  zoom: 13,
};

// Ocean bacteria-spray mission — Mediterranean, launch from boat near Ashdod coast.
// Boat sits at the east edge of the spray zone (coast side); zone extends west into open water.
export const GEO_OCEAN = {
  base: { lng: 34.580, lat: 31.840 }, // ⛵ boat launch point, Mediterranean off Ashdod
  zone: { w: 34.380, e: 34.560, s: 31.740, n: 31.940 }, // ocean bacteria spray zone
  center: [31.840, 34.470] as [number, number],
  zoom: 11,
};

// Drone hardware spec — real DJI Agras T50 figures (spraying config).
// 1 L of spray liquid ≈ 1 kg. MTOW = max takeoff weight = the warranty/safety limit.
export const DRONE_SPEC = {
  model: "DJI Agras T50",
  dryKg: 52,          // weight incl. battery (39.9 kg excl. battery + 12.1 kg battery)
  maxPayloadKg: 40,   // operating spray payload
  mtowKg: 92,         // max takeoff weight, spraying, sea level
  tankMaxL: 40,       // spray tank volume (L)
  sensorKitKg: 1.5,   // optional extra sensor package (not a T50 stock item)
  windMaxMps: 6,      // max wind resistance (matches the land no-go threshold)
  minAltM: 1.5,       // spray altitude — radar stabilization min
  maxAltM: 8,         // realistic spray ceiling (airframe/radar capable to 30 m)
  sprayWidthM: 11,    // effective spray width at 3 m height (4–11 m)
  // ── Illustrative demo-scale values (the map area is cinematic, not literal) ──
  coverageDunamFull: 90000, // area one drone covers per battery — tuned so ~10 drones cover the max zone
  flightMinutesFull: 9,     // realistic loaded flight time (T50 ≈ 7–9 min)
  rangeKmFull: 20,          // range budget for the gate (real configurable radius: 2000 m)
  returnReserve: 1.2,       // safety factor on the distance needed to get home
};

// Max spray-zone area allowed when resizing (dunam), per scenario — blocks oversizing.
export const MAX_ZONE_DUNAM = { land: 150000, ocean: 650000 };

// Ocean mission economics — expendable drones are a contracted, recognized cost.
export const OCEAN_UNIT_COST = 4200; // ₪ per expendable drone lost at sea

// Mission report reference figures (match the endcard).
export const REPORT = {
  land:  { areaLabel: "420 דונם",   areaTreated: "420 דונם",       durationHM: "1:48" },
  ocean: { areaLabel: "~1,240 דונם ימי", areaTreated: "~1,240 דונם ימי", durationHM: "1:48" },
} as const;

// Hebrew state labels.
export const STATE_HE: Record<string, string> = {
  idle: "בהמתנה",
  takeoff: "המראה",
  spraying: "מרסס",
  rtb: "חוזר לבסיס",
  refill: "מילוי מחדש",
  rejoin: "חוזר למשימה",
  rth: "נחיתה בבסיס",
  done: "הושלם",
  // ocean-only state
  splash: "נספה בים 💦",
  // camera drone (the Eye)
  camera: "📹 תצפית · משדר",
};
