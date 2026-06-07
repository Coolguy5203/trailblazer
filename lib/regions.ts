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

export const REGIONS: Region[] = [
  { id: "home", name: "Home Flats", tagline: "Where every trail begins", x: 0, z: 0, radius: 44 },
  { id: "speedway", name: "Salt Pan Speedway", tagline: "Wide open — let a fast rig fly", x: 150, z: 0, radius: 82 },
  { id: "ascent", name: "Granite Ascent", tagline: "Steep granite — bring the torque", x: -130, z: -130, radius: 88 },
  { id: "dunes", name: "The Dune Sea", tagline: "Roll the waves, catch big air", x: 5, z: 160, radius: 80 },
  { id: "ridge", name: "Switchback Ridge", tagline: "Twisty and technical — all-rounder turf", x: -155, z: 60, radius: 72 },
  { id: "basin", name: "Boulder Basin", tagline: "Crawl the rock garden", x: -150, z: 160, radius: 56 },
  { id: "timber", name: "Timber Hollow", tagline: "Mind the fallen logs", x: 100, z: -140, radius: 74 },
  { id: "proving", name: "The Proving Grounds", tagline: "Ramps and kickers — send it", x: 75, z: 100, radius: 54 },
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
