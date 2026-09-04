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

// Drone hardware spec (demo manufacturer figures) for weight & balance checks.
// 1 L of spray liquid ≈ 1 kg. MTOW = max takeoff weight = the warranty limit.
export const DRONE_SPEC = {
  model: "Revi-Spray X40",
  dryKg: 38,          // empty weight incl. battery
  maxPayloadKg: 40,   // manufacturer max payload
  mtowKg: 90,         // max takeoff weight (warranty / safety limit)
  tankMaxL: 45,       // spray tank capacity
  sensorKitKg: 1.5,   // optional extra sensor package
};

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
