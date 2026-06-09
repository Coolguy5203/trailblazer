// Named map regions. Single source of truth for both terrain shaping
// (lib/terrain.ts reads the centres) and the on-screen "entering region" popup.
//
// The world is a 4x4 grid of equal, non-overlapping 600x600 cells (map 2400u).
// `radius` is the half-extent of the square cell (300). 15 regions fill 15
// cells; the 16th cell (+900,+900) is left as open Backcountry.
export interface Region {
  id: string;
  name: string;
  tagline: string;
  x: number;
  z: number;
  radius: number; // half-extent of the square cell
}

export const CELL = 600;
const H = CELL / 2; // 300

export const REGIONS: Region[] = [
  // row z = -900
  { id: "pines", name: "Whispering Pines", tagline: "Deep woods — weave the trees", x: -900, z: -900, radius: H },
  { id: "mesa", name: "High Mesa", tagline: "Up top — flat, fast and exposed", x: -300, z: -900, radius: H },
  { id: "timber", name: "Timber Hollow", tagline: "Tight lines through the pines", x: 300, z: -900, radius: H },
  { id: "mirage", name: "Mirage Flats", tagline: "A cracked dry lake, flat to the horizon", x: 900, z: -900, radius: H },
  // row z = -300
  { id: "ascent", name: "Granite Ascent", tagline: "Spiral the ramp all the way to the summit", x: -900, z: -300, radius: H },
  { id: "home", name: "Home Flats", tagline: "Where every trail begins", x: -300, z: -300, radius: H },
  { id: "basecamp", name: "Basecamp", tagline: "The expedition's home base", x: 300, z: -300, radius: H },
  { id: "canyon", name: "Echo Canyon", tagline: "Wind through the carved walls", x: 900, z: -300, radius: H },
  // row z = 300
  { id: "ridge", name: "Switchback Ridge", tagline: "Twisty and technical — all-rounder turf", x: -900, z: 300, radius: H },
  { id: "proving", name: "The Proving Grounds", tagline: "Ramps and kickers — send it", x: -300, z: 300, radius: H },
  { id: "speedway", name: "Salt Pan Speedway", tagline: "Wide open — let a fast rig fly", x: 300, z: 300, radius: H },
  { id: "rift", name: "The Rift", tagline: "A maze of slot canyons", x: 900, z: 300, radius: H },
  // row z = 900
  { id: "basin", name: "Boulder Basin", tagline: "Crawl the rock garden", x: -900, z: 900, radius: H },
  { id: "dunes", name: "The Dune Sea", tagline: "Roll the waves, catch big air", x: -300, z: 900, radius: H },
  { id: "cinder", name: "Cinder Cone", tagline: "An active volcano — mind the lava", x: 300, z: 900, radius: H },
  { id: "badlands", name: "The Badlands", tagline: "Brutal ground — only the toughest rigs survive", x: 900, z: 900, radius: H },
];

export const WILDS = { id: "wilds", name: "The Backcountry", tagline: "Uncharted territory" };

const byId: Record<string, Region> = Object.fromEntries(REGIONS.map((r) => [r.id, r]));
export function region(id: string): Region | undefined {
  return byId[id];
}

// The square cell containing (x, z); null = backcountry/wilds (spare cell + rim).
export function regionAt(x: number, z: number): Region | null {
  for (const r of REGIONS) {
    if (Math.abs(x - r.x) <= r.radius && Math.abs(z - r.z) <= r.radius) return r;
  }
  return null;
}

export function regionInfo(id: string | null): { name: string; tagline: string } {
  if (!id || id === "wilds") return { name: WILDS.name, tagline: WILDS.tagline };
  const r = byId[id];
  return r ? { name: r.name, tagline: r.tagline } : { name: WILDS.name, tagline: WILDS.tagline };
}
