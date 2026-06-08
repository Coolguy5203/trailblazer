// Story mode — the Trailblazer Expedition charting an uncharted frontier,
// opening one region at a time. Original lore (no real-world references).

export type Objective =
  | { kind: "reach"; target: [number, number]; radius: number; minY?: number; hint: string }
  | { kind: "bigair"; seconds: number; hint: string }
  | { kind: "collect"; points: [number, number][]; hint: string }
  | { kind: "gates"; points: [number, number][]; hint: string };

export interface Chapter {
  n: number; // 1-based order; chapter is unlocked when story_progress >= n-1
  id: string;
  title: string;
  region: string;
  blurb: string;
  objective: Objective;
  reward: number; // credits on first completion (mirror tb_story_complete SQL)
  spawn: [number, number]; // where the player is dropped to begin
}

export const CHAPTERS: Chapter[] = [
  {
    n: 1,
    id: "first-tracks",
    title: "First Tracks",
    region: "basecamp",
    blurb:
      "Every expedition starts somewhere. Roll out from Home Flats and report in at Basecamp — the team's waiting on you.",
    objective: { kind: "reach", target: [150, 150], radius: 13, hint: "Drive to the Basecamp beacon" },
    reward: 100,
    spawn: [0, 0],
  },
  {
    n: 2,
    id: "salt-and-speed",
    title: "Salt & Speed",
    region: "speedway",
    blurb: "The Salt Pan stretches out flat and fast. Run the survey markers end to end and clock the route.",
    objective: {
      kind: "gates",
      points: [
        [350, 4],
        [420, -20],
        [490, 18],
        [560, -14],
        [612, 6],
      ],
      hint: "Blast through every marker in order",
    },
    reward: 150,
    spawn: [300, 10],
  },
  {
    n: 3,
    id: "into-the-pines",
    title: "Into the Pines",
    region: "pines",
    blurb: "Whispering Pines swallowed our last survey team's flags. Weave the trees and recover all five.",
    objective: {
      kind: "collect",
      points: [
        [-650, -70],
        [-705, -25],
        [-615, -135],
        [-740, -115],
        [-585, -30],
      ],
      hint: "Recover all 5 survey flags",
    },
    reward: 180,
    spawn: [-560, -60],
  },
  {
    n: 4,
    id: "big-air",
    title: "Big Air",
    region: "dunes",
    blurb: "The Dune Sea is one giant launch ramp. Hit a crest with speed and get the rig properly airborne.",
    objective: { kind: "bigair", seconds: 2.0, hint: "Catch 2.0s of airtime off a dune" },
    reward: 200,
    spawn: [40, 470],
  },
  {
    n: 5,
    id: "the-rift-run",
    title: "The Rift Run",
    region: "rift",
    blurb: "A maze of slot canyons swallows anyone without a route. Thread the markers and map a way through The Rift.",
    objective: {
      kind: "gates",
      points: [
        [600, 300],
        [642, 338],
        [684, 304],
        [700, 352],
        [654, 384],
        [618, 356],
      ],
      hint: "Find the line through every canyon marker",
    },
    reward: 220,
    spawn: [560, 300],
  },
  {
    n: 6,
    id: "cone-patrol",
    title: "Cone Patrol",
    region: "cinder",
    blurb: "Cinder Cone has been grumbling. Climb its flank and plant a sensor on the crater rim.",
    objective: { kind: "reach", target: [-160, 638], radius: 15, minY: 30, hint: "Climb to the crater rim" },
    reward: 240,
    spawn: [-160, 560],
  },
  {
    n: 7,
    id: "the-summit",
    title: "The Summit",
    region: "ascent",
    blurb:
      "One peak remains uncharted. Take the spiral ramp all the way up Granite Ascent and stand on the roof of the frontier.",
    objective: { kind: "reach", target: [-240, -240], radius: 22, minY: 180, hint: "Reach the mountain summit" },
    reward: 500,
    spawn: [-30, -30],
  },
];

export function chapter(n: number | null): Chapter | undefined {
  return n ? CHAPTERS.find((c) => c.n === n) : undefined;
}

// How many discrete steps the objective needs (for HUD progress).
export function objectiveGoal(o: Objective): number {
  if (o.kind === "collect" || o.kind === "gates") return o.points.length;
  return 1;
}
