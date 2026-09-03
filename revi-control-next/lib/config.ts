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

// Live map (map/page) geography — Tel Aviv coast. Replace with the real target area.
export const GEO = {
  base: { lng: 34.768, lat: 32.094 }, // shoreline base
  zone: { w: 34.701, e: 34.748, s: 32.06, n: 32.12 }, // sea target box
  center: [32.092, 34.735] as [number, number],
  zoom: 13,
};

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
};
