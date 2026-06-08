// Named map regions. Single source of truth for both terrain shaping
// (lib/terrain.ts reads the centres) and the on-screen "entering region" popup.
export interface Region {
  id: string;
  name: string;
  tagline: string;
  x: number;
  z: number;
  radius: number;
}

// Spread across the huge 1200u world.
export const REGIONS: Region[] = [
  { id: "home", name: "Home Flats", tagline: "Where every trail begins", x: 0, z: 0, radius: 55 },
  { id: "speedway", name: "Salt Pan Speedway", tagline: "Wide open — let a fast rig fly", x: 360, z: 10, radius: 150 },
  { id: "ascent", name: "Granite Ascent", tagline: "Steep granite — bring the torque", x: -340, z: -330, radius: 175 },
  { id: "dunes", name: "The Dune Sea", tagline: "Roll the waves, catch big air", x: 30, z: 380, radius: 160 },
  { id: "ridge", name: "Switchback Ridge", tagline: "Twisty and technical — all-rounder turf", x: -390, z: 170, radius: 150 },
  { id: "basin", name: "Boulder Basin", tagline: "Crawl the rock garden", x: -380, z: 410, radius: 105 },
  { id: "timber", name: "Timber Hollow", tagline: "Mind the fallen logs", x: 300, z: -360, radius: 150 },
  { id: "proving", name: "The Proving Grounds", tagline: "Ramps and kickers — send it", x: 210, z: 250, radius: 115 },
  { id: "canyon", name: "Echo Canyon", tagline: "Wind through the carved walls", x: 410, z: -170, radius: 135 },
  { id: "mesa", name: "High Mesa", tagline: "Up top — flat, fast and exposed", x: -160, z: -430, radius: 145 },
];

export const WILDS = { id: "wilds", name: "The Backcountry", tagline: "Uncharted territory" };

const byId: Record<string, Region> = Object.fromEntries(REGIONS.map((r) => [r.id, r]));
export function region(id: string): Region | undefined {
  return byId[id];
}

// Nearest region whose circle contains (x, z); null = backcountry/wilds.
export function regionAt(x: number, z: number): Region | null {
  let best: Region | null = null;
  let bestD = Infinity;
  for (const r of REGIONS) {
    const d = Math.hypot(x - r.x, z - r.z);
    if (d <= r.radius && d < bestD) {
      best = r;
      bestD = d;
    }
  }
  return best;
}

export function regionInfo(id: string | null): { name: string; tagline: string } {
  if (!id || id === "wilds") return { name: WILDS.name, tagline: WILDS.tagline };
  const r = byId[id];
  return r ? { name: r.name, tagline: r.tagline } : { name: WILDS.name, tagline: WILDS.tagline };
}
