import { terrainHeight } from "./terrain";

export interface Course {
  id: string;
  name: string;
  region: string; // region id it lives in
  tagline: string;
  checkpoints: [number, number][]; // [x, z]; y is sampled from terrain
  reward: number; // credits for first completion (mirror tb_finish_course SQL)
  par_ms: number; // target time for display
  color: string;
}

// Build checkpoints that follow the spiral ramp up Granite Ascent to the summit.
function summitCheckpoints(): [number, number][] {
  const M = { x: -900, z: -300, R: 285, rTop: 38, turns: 4, phase: Math.PI / 4 };
  const spacing = (M.R - M.rTop) / M.turns;
  const pts: [number, number][] = [];
  const tStart = 0.18,
    tEnd = 3.9,
    n = 10;
  for (let i = 0; i < n; i++) {
    const t = tStart + (tEnd - tStart) * (i / (n - 1));
    const r = M.R - spacing * t;
    const a = t - Math.floor(t);
    const ang = a * Math.PI * 2 + M.phase;
    pts.push([M.x + Math.cos(ang) * r, M.z + Math.sin(ang) * r]);
  }
  return pts;
}

export const COURSES: Course[] = [
  {
    id: "summit",
    name: "Summit Spiral",
    region: "ascent",
    tagline: "Climb the spiral ramp to the very top",
    checkpoints: summitCheckpoints(),
    reward: 400,
    par_ms: 80000,
    color: "#7fdbff",
  },
  {
    id: "saltpan",
    name: "Salt Pan Sprint",
    region: "speedway",
    tagline: "Flat-out across the pan — a Dust Runner's playground",
    checkpoints: [
      [70, 310],
      [170, 288],
      [270, 316],
      [370, 284],
      [470, 310],
      [540, 294],
    ],
    reward: 150,
    par_ms: 26000,
    color: "#ffd24a",
  },
  {
    id: "dunes",
    name: "Dune Dash",
    region: "dunes",
    tagline: "Surf the dunes and mind the air",
    checkpoints: [
      [-420, 760],
      [-360, 800],
      [-300, 850],
      [-240, 810],
      [-210, 880],
      [-290, 940],
    ],
    reward: 200,
    par_ms: 34000,
    color: "#ff7e5f",
  },
  {
    id: "basin",
    name: "Basin Scramble",
    region: "basin",
    tagline: "Pick a clean line through the boulders",
    checkpoints: [
      [-850, 856],
      [-880, 878],
      [-912, 888],
      [-925, 912],
      [-892, 926],
      [-865, 902],
    ],
    reward: 180,
    par_ms: 38000,
    color: "#9b6bff",
  },
];

export function course(id: string | null): Course | undefined {
  return id ? COURSES.find((c) => c.id === id) : undefined;
}

// Checkpoint ground positions as Vec3 (y sampled from terrain).
export function checkpointY(x: number, z: number): number {
  return terrainHeight(x, z);
}

export function formatTime(ms: number): string {
  if (ms <= 0) return "0.00";
  const total = ms / 1000;
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return m > 0 ? `${m}:${s.toFixed(2).padStart(5, "0")}` : s.toFixed(2);
}
