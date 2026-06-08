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

// Spread across the huge 1700u world. (Granite Ascent stays at -240,-240 to match
// the spiral-mountain constants in terrain.ts.)
export const REGIONS: Region[] = [
  { id: "home", name: "Home Flats", tagline: "Where every trail begins", x: 0, z: 0, radius: 60 },
  { id: "basecamp", name: "Basecamp", tagline: "The expedition's home base", x: 150, z: 150, radius: 90 },
  { id: "speedway", name: "Salt Pan Speedway", tagline: "Wide open — let a fast rig fly", x: 480, z: 20, radius: 180 },
  { id: "ascent", name: "Granite Ascent", tagline: "Spiral the ramp all the way to the summit", x: -240, z: -240, radius: 330 },
  { id: "dunes", name: "The Dune Sea", tagline: "Roll the waves, catch big air", x: 60, z: 520, radius: 200 },
  { id: "ridge", name: "Switchback Ridge", tagline: "Twisty and technical — all-rounder turf", x: -540, z: 240, radius: 180 },
  { id: "basin", name: "Boulder Basin", tagline: "Crawl the rock garden", x: -520, z: 560, radius: 140 },
  { id: "timber", name: "Timber Hollow", tagline: "Tight lines through the pines", x: 440, z: -500, radius: 190 },
  { id: "proving", name: "The Proving Grounds", tagline: "Ramps and kickers — send it", x: 300, z: 360, radius: 150 },
  { id: "canyon", name: "Echo Canyon", tagline: "Wind through the carved walls", x: 560, z: -240, radius: 170 },
  { id: "mesa", name: "High Mesa", tagline: "Up top — flat, fast and exposed", x: 620, z: -560, radius: 180 },
  // --- new regions ---
  { id: "pines", name: "Whispering Pines", tagline: "Deep woods — weave the trees", x: -660, z: -80, radius: 185 },
  { id: "mirage", name: "Mirage Flats", tagline: "A cracked dry lake, flat to the horizon", x: 250, z: -640, radius: 185 },
  { id: "rift", name: "The Rift", tagline: "A maze of slot canyons", x: 640, z: 320, radius: 175 },
  { id: "cinder", name: "Cinder Cone", tagline: "Skirt the crater of a sleeping cone", x: -160, z: 690, radius: 155 },
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
