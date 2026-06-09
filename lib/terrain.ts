import * as THREE from "three";
import { REGIONS, type Region } from "./regions";

// --- Map dimensions (HUGE grid world: 4x4 cells of 600u) ---
export const MAP_SIZE = 2400; // world units, square, centered on origin
export const SEGMENTS = 400; // grid resolution (cell ~6u) for visuals + physics trimesh
export const HALF = MAP_SIZE / 2;

const C: Record<string, Region> = Object.fromEntries(REGIONS.map((r) => [r.id, r]));

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Radial bump (1 at centre → 0 at radius), smooth.
function bump(x: number, z: number, cx: number, cz: number, r: number, h: number) {
  const d = Math.hypot(x - cx, z - cz);
  if (d > r) return 0;
  const t = 1 - d / r;
  return h * t * t * (3 - 2 * t);
}

// Flat-topped plateau: full height inside ~0.72r, sloping to 0 at r.
function plateau(x: number, z: number, cx: number, cz: number, r: number, h: number) {
  const d = Math.hypot(x - cx, z - cz);
  if (d > r) return 0;
  return h * smoothstep(r, r * 0.72, d);
}

// Region influence weight: ~1 across the inner area, feathering to 0 at the edge.
function w(x: number, z: number, reg: Region) {
  const d = Math.hypot(x - reg.x, z - reg.z);
  if (d >= reg.radius) return 0;
  return smoothstep(reg.radius, reg.radius * 0.25, d);
}

// --- Trail network: smooth packed-dirt roads on the grid lines that run
// through every cell centre (x or z = ±300 / ±900). Off-trail terrain is rough;
// on-trail it's smooth, so trails are the easy way to traverse the map.
const TRAIL_LINES = [-900, -300, 300, 900];
const TRAIL_HALF = 9; // flat width
const TRAIL_BLEND = 7; // feather

export function trailMask(x: number, z: number): number {
  let d = Infinity;
  for (const c of TRAIL_LINES) {
    const dx = Math.abs(x - c);
    if (dx < d) d = dx;
    const dz = Math.abs(z - c);
    if (dz < d) d = dz;
  }
  return smoothstep(TRAIL_HALF + TRAIL_BLEND, TRAIL_HALF, d);
}

// Mid-frequency roughness that makes off-trail driving a real fight.
function roughness(x: number, z: number): number {
  return (
    Math.sin(x * 0.31) * Math.cos(z * 0.29) * 1.1 +
    Math.sin(x * 0.12 + 1.0) * Math.sin(z * 0.14) * 0.9 +
    Math.cos((x + z) * 0.22 + 0.5) * 0.5
  );
}

// --- Forest lake in Whispering Pines ---
export const LAKE = { x: -1000, z: -760, r: 70, waterY: -3.2 };

// A wedge ramp rising along +x within a small footprint.
function ramp(x: number, z: number, cx: number, cz: number, len: number, wid: number, h: number) {
  const rx = x - cx,
    rz = z - cz;
  if (rx < 0 || rx > len || Math.abs(rz) > wid) return 0;
  return (rx / len) * h * smoothstep(wid, wid * 0.4, Math.abs(rz));
}

// --- Granite Ascent: an absolutely humongous mountain built as a continuous
// SPIRAL RAMP (like a parking-garage helix). The ramp has ~zero cross-slope so
// you never slide off, climbs steadily as it winds up (no flat "around-and-
// around" loops), and only the thin seam where each loop overlaps is a steep
// wall (which the trail rounds, never crosses). phase places the gentle entrance
// on the NE face pointing back at Home Flats.
const MTN = { x: -900, z: -300, R: 285, H: 215, turns: 4, rTop: 38, phase: Math.PI / 4 };
const MTN_SPACING = (MTN.R - MTN.rTop) / MTN.turns;
const MTN_PITCH = MTN.H / MTN.turns; // height gained per loop

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

export function spiralMountain(x: number, z: number): { hm: number; wm: number; road: number } {
  const dx = x - MTN.x;
  const dz = z - MTN.z;
  const r = Math.hypot(dx, dz);
  if (r > MTN.R) return { hm: 0, wm: 0, road: 0 };

  const wm = smoothstep(MTN.R, MTN.R - 32, r); // blend over base terrain near rim
  if (r <= MTN.rTop) return { hm: MTN.H, wm, road: 0 }; // flat summit

  // Spiral-ramp height: a continuous helicoid. `a` = angular fraction (0..1),
  // `g` = radial loops in from the rim. The ramp surface is pitch*(n + a), where
  // n is the loop index that best matches this radius. dh/dr ≈ 0 (no camber);
  // height rises with `a` as you wind around. The integer step in n is the seam.
  let th = Math.atan2(dz, dx) - MTN.phase;
  th = ((th % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const a = th / (Math.PI * 2);
  const g = (MTN.R - r) / MTN_SPACING;
  const q = g - a;

  // smooth the seam (the n-step) over a small radial band so it's a steep ramp,
  // not a vertical cliff — a determined climber can attack it as a shortcut.
  const f = q - Math.floor(q); // 0..1; 0 = ramp centre, 0.5 = seam
  const nSmooth = Math.floor(q) + smoothstep(0.5 - 0.16, 0.5 + 0.16, f);
  const hm = clamp(MTN_PITCH * (nSmooth + a), 0, MTN.H);

  // tint the drivable ramp (away from the seam) as packed dirt
  const seamProx = Math.abs(f - 0.5); // 0 at seam, 0.5 at ramp centre
  const road = smoothstep(0.18, 0.34, seamProx) * wm;

  return { hm, wm, road };
}

/**
 * Terrain height at world (x, z). Built region-by-region across a huge world so
 * each area suits a different driving style. No real-world references.
 */
export function terrainHeight(x: number, z: number): number {
  const dHome = Math.hypot(x - C.home.x, z - C.home.z);

  // gentle, long-wavelength global rolling base
  let h =
    Math.sin(x * 0.02) * Math.cos(z * 0.018) * 3.2 +
    Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.04) * 1.6;

  // flatten the home pad, Basecamp, and the dead-flat speed pans
  h *= smoothstep(14, 50, dHome);
  h *= 1 - 0.85 * w(x, z, C.basecamp);
  h *= 1 - 0.9 * w(x, z, C.speedway);
  h *= 1 - 0.92 * w(x, z, C.mirage); // Mirage Flats: cracked dry lake, flat

  // --- global off-trail roughness: the map is hard to traverse EXCEPT on the
  // trail network. Suppressed on trails, the flat pans, home/basecamp, and
  // halved in the dunes so the dash stays fun.
  {
    let amp = 1 - trailMask(x, z);
    amp *= smoothstep(14, 50, dHome);
    amp *= 1 - 0.95 * w(x, z, C.basecamp);
    amp *= 1 - 0.95 * w(x, z, C.speedway);
    amp *= 1 - 0.95 * w(x, z, C.mirage);
    amp *= 1 - 0.5 * w(x, z, C.dunes);
    amp *= 1 - 0.6 * w(x, z, C.proving); // keep ramp run-ups usable
    h += roughness(x, z) * amp;
  }

  // (Granite Ascent's humongous spiral mountain is blended in at the end.)

  // --- High Mesa: a big flat-topped plateau, fast and exposed up top ---
  h += plateau(x, z, C.mesa.x, C.mesa.z, C.mesa.radius * 0.95, 26);

  // --- Cinder Cone: a LARGE active volcano — tall cone, deep crater w/ lava ---
  h += bump(x, z, C.cinder.x, C.cinder.z, C.cinder.radius * 0.97, 95);
  h += -bump(x, z, C.cinder.x, C.cinder.z, C.cinder.radius * 0.36, 72); // crater

  // --- Whispering Pines: gentle rolling forest floor (trees are props) ---
  {
    const wp = w(x, z, C.pines);
    if (wp > 0) h += (Math.sin(x * 0.07) * Math.cos(z * 0.06) * 4 + Math.sin(z * 0.04) * 2) * wp;
  }

  // --- The Rift: raised mesa fins with slot canyons carved between them ---
  {
    const wr = w(x, z, C.rift);
    if (wr > 0) {
      const fins = Math.max(0, Math.sin(x * 0.06)) * 16 + Math.max(0, Math.sin(z * 0.055 + 1.1)) * 11;
      h += fins * wr;
    }
  }

  // --- Echo Canyon: a valley floor flanked by raised walls ---
  {
    h += -bump(x, z, C.canyon.x, C.canyon.z, C.canyon.radius * 0.8, 11);
    h += bump(x, z, C.canyon.x, C.canyon.z - 80, 55, 20);
    h += bump(x, z, C.canyon.x, C.canyon.z + 80, 55, 20);
  }

  // --- The Dune Sea: big rolling waves for speed + air ---
  {
    const wd = w(x, z, C.dunes);
    if (wd > 0) {
      const dune = Math.sin(x * 0.09) * 5.2 + Math.sin((x + z) * 0.06 + 1.0) * 3.6 + Math.cos(z * 0.1) * 2.4;
      h += dune * wd;
    }
  }

  // --- Switchback Ridge: clustered medium hills, twisty technical lines ---
  h += bump(x, z, C.ridge.x + 34, C.ridge.z - 30, 55, 16);
  h += bump(x, z, C.ridge.x - 38, C.ridge.z + 26, 50, 13);
  h += bump(x, z, C.ridge.x + 8, C.ridge.z + 52, 44, 10);
  h += bump(x, z, C.ridge.x - 52, C.ridge.z - 44, 40, 9);

  // --- Timber Hollow: moderate rolling humps (logs are props) ---
  h += bump(x, z, C.timber.x + 28, C.timber.z + 22, 58, 8);
  h += bump(x, z, C.timber.x - 40, C.timber.z - 18, 50, 7);

  // --- Boulder Basin: shallow bowl so boulders sit in a pit ---
  h += -bump(x, z, C.basin.x, C.basin.z, C.basin.radius * 0.9, 7.0);

  // --- The Proving Grounds: a few terrain kickers/ramps ---
  h += ramp(x, z, C.proving.x - 40, C.proving.z - 10, 22, 7, 7.0);
  h += ramp(x, z, C.proving.x + 4, C.proving.z + 24, 20, 6, 6.0);
  h += ramp(x, z, C.proving.x + 34, C.proving.z - 30, 24, 7, 8.0);

  // --- The Badlands (+900,+900): brutal jagged fins + heavy chop. Crossable,
  // but realistically only by high-grip/clearance rigs (Boulder/Juggernaut).
  {
    const wb = w(x, z, C.badlands);
    if (wb > 0) {
      const fins =
        Math.abs(Math.sin(x * 0.05)) * 9 +
        Math.abs(Math.sin(z * 0.045 + 1.2)) * 7 +
        roughness(x * 1.7, z * 1.7) * 2.2;
      h += fins * wb * (1 - trailMask(x, z) * 0.8); // the trail stays survivable
    }
  }

  // --- Forest lake in Whispering Pines: a bowl below the waterline ---
  h += -bump(x, z, LAKE.x, LAKE.z, LAKE.r, 9);

  // raised rim border so the map has a soft natural edge
  h += smoothstep(HALF - 95, HALF - 22, Math.abs(x)) * 24;
  h += smoothstep(HALF - 95, HALF - 22, Math.abs(z)) * 24;

  // blend the humongous spiral mountain over the base terrain
  const m = spiralMountain(x, z);
  return h * (1 - m.wm) + m.hm * m.wm;
}

export interface TerrainData {
  geometry: THREE.BufferGeometry;
  vertices: Float32Array;
  indices: Uint32Array;
}

let cached: TerrainData | null = null;

export function buildTerrain(): TerrainData {
  if (cached) return cached;
  const geo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, SEGMENTS, SEGMENTS);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors: number[] = [];
  const low = new THREE.Color("#6f5a3a"); // dirt
  const mid = new THREE.Color("#7c8b4e"); // scrub
  const high = new THREE.Color("#9aa861"); // dry grass
  const rock = new THREE.Color("#8a8276");
  const sand = new THREE.Color("#cdb079"); // dunes / salt pan / dry lake
  const roadCol = new THREE.Color("#a8895c"); // packed-dirt spiral trail
  const pine = new THREE.Color("#4d6b3f"); // forest floor
  const cinderCol = new THREE.Color("#3a3230"); // volcanic ash
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = terrainHeight(x, z);
    pos.setY(i, y);

    const t = THREE.MathUtils.clamp((y + 4) / 26, 0, 1);
    if (t < 0.45) c.copy(low).lerp(mid, t / 0.45);
    else c.copy(mid).lerp(high, (t - 0.45) / 0.55);
    if (y > 16) c.lerp(rock, smoothstep(16, 28, y));
    const sandiness = Math.max(w(x, z, C.speedway), w(x, z, C.dunes) * 0.9, w(x, z, C.mirage));
    if (sandiness > 0) c.lerp(sand, sandiness * 0.72);
    const forest = w(x, z, C.pines);
    if (forest > 0) c.lerp(pine, forest * 0.6);
    const ash = w(x, z, C.cinder) * smoothstep(25, 60, y); // dark ash up the cone
    if (ash > 0) c.lerp(cinderCol, ash * 0.85);
    const bad = w(x, z, C.badlands);
    if (bad > 0) c.lerp(rock, bad * 0.65);
    const lakeBed = smoothstep(LAKE.r, LAKE.r * 0.5, Math.hypot(x - LAKE.x, z - LAKE.z));
    if (lakeBed > 0) c.lerp(new THREE.Color("#3d4a3a"), lakeBed * 0.6);
    const trail = trailMask(x, z);
    if (trail > 0) c.lerp(roadCol, trail * 0.85);
    const road = spiralMountain(x, z).road;
    if (road > 0) c.lerp(roadCol, road * 0.9);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const vertices = new Float32Array(pos.array as Float32Array);
  const indices = new Uint32Array(geo.index!.array as ArrayLike<number>);

  cached = { geometry: geo, vertices, indices };
  return cached;
}

// Fixed props. Rocks are low rounded boulders the truck climbs over; logs are
// crossable; trees are thin trunks you weave between. Clustered by region.
export interface Prop {
  type: "rock" | "log" | "tree" | "bush" | "cactus" | "arch";
  x: number;
  z: number;
  size: number;
  rot: number;
}

// Deterministic scatter (stable across reloads).
function scatter(type: Prop["type"], cx: number, cz: number, r: number, count: number, seed: number, sizeBase: number, sizeVar: number): Prop[] {
  let s = seed % 233280;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const out: Prop[] = [];
  for (let i = 0; i < count; i++) {
    const ang = rnd() * Math.PI * 2;
    const rad = Math.sqrt(rnd()) * r;
    out.push({ type, x: cx + Math.cos(ang) * rad, z: cz + Math.sin(ang) * rad, size: sizeBase + rnd() * sizeVar, rot: rnd() * Math.PI * 2 });
  }
  return out;
}

const RAW_PROPS: Prop[] = [
  // near home (-300,-300) — easy first obstacles
  { type: "rock", x: -280, z: -318, size: 1.3, rot: 0.3 },
  { type: "rock", x: -324, z: -284, size: 1.6, rot: 1.1 },
  { type: "log", x: -284, z: -272, size: 5.0, rot: 0.5 },
  // Boulder Basin rock garden (-900, 900)
  { type: "rock", x: -890, z: 888, size: 1.6, rot: 0.2 },
  { type: "rock", x: -908, z: 902, size: 2.4, rot: 1.0 },
  { type: "rock", x: -918, z: 892, size: 1.5, rot: 2.4 },
  { type: "rock", x: -896, z: 914, size: 1.9, rot: 0.6 },
  { type: "rock", x: -912, z: 918, size: 1.3, rot: 1.9 },
  { type: "rock", x: -882, z: 906, size: 2.1, rot: 0.9 },
  { type: "log", x: -880, z: 886, size: 5.5, rot: 0.3 },
  // Timber Hollow — fallen logs (300, -900)
  { type: "log", x: 290, z: -900, size: 6.5, rot: 0.4 },
  { type: "log", x: 318, z: -880, size: 6.0, rot: 1.2 },
  { type: "log", x: 274, z: -924, size: 7.0, rot: -0.3 },
  { type: "log", x: 336, z: -912, size: 5.5, rot: 1.9 },
  { type: "rock", x: 308, z: -936, size: 1.6, rot: 0.7 },
  // Switchback Ridge — rocks on the trail (-900, 300)
  { type: "rock", x: -890, z: 290, size: 1.7, rot: 1.1 },
  { type: "log", x: -920, z: 318, size: 5.5, rot: 0.6 },
  { type: "rock", x: -870, z: 326, size: 1.5, rot: 2.0 },
  // Echo Canyon floor — boulders (900, -300)
  { type: "rock", x: 890, z: -300, size: 1.9, rot: 0.8 },
  { type: "rock", x: 914, z: -286, size: 1.5, rot: 1.6 },
  { type: "rock", x: 900, z: -318, size: 2.0, rot: 0.2 },
  // The Rift — scattered boulders on the canyon floors (900, 300)
  { type: "rock", x: 890, z: 320, size: 2.2, rot: 0.5 },
  { type: "rock", x: 920, z: 300, size: 1.6, rot: 1.4 },
  { type: "rock", x: 872, z: 344, size: 1.8, rot: 2.2 },
  // Forests
  ...scatter("tree", -900, -900, 255, 60, 12345, 3, 2.6), // Whispering Pines
  ...scatter("tree", 300, -900, 200, 18, 9981, 3, 2.6), // Timber Hollow
  // Greenery & desert flora across the map (bushes have no collider — fun, not hard)
  ...scatter("bush", -300, -300, 220, 14, 311, 1.0, 0.8), // home
  ...scatter("bush", 300, -300, 200, 12, 412, 1.0, 0.8), // basecamp
  ...scatter("bush", -900, 300, 230, 16, 513, 1.0, 0.9), // ridge
  ...scatter("bush", -300, 300, 200, 10, 614, 1.0, 0.7), // proving
  ...scatter("bush", -900, -300, 120, 8, 715, 1.0, 0.7), // ascent foothills
  ...scatter("cactus", 900, -900, 230, 14, 816, 2.2, 1.4), // mirage
  ...scatter("cactus", 300, 300, 210, 8, 917, 2.0, 1.2), // speedway fringe
  ...scatter("cactus", 900, 900, 220, 10, 1018, 2.4, 1.4), // badlands
  // landmark rock arches over the canyon/rift floors
  { type: "arch", x: 900, z: -340, size: 9, rot: 0.4 },
  { type: "arch", x: 940, z: 260, size: 8, rot: 1.8 },
  { type: "arch", x: 860, z: 940, size: 10, rot: 0.9 }, // badlands gateway
];

// keep flora out of the lake
export const PROPS: Prop[] = RAW_PROPS.filter(
  (p) => Math.hypot(p.x - LAKE.x, p.z - LAKE.z) > 82 || p.type === "rock" || p.type === "log"
);
