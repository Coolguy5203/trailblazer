import * as THREE from "three";
import { REGIONS, type Region } from "./regions";

// --- Map dimensions (HUGE multi-region world) ---
export const MAP_SIZE = 1700; // world units, square, centered on origin
export const SEGMENTS = 360; // grid resolution (cell ~4.7u) for visuals + physics trimesh
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
const MTN = { x: -240, z: -240, R: 285, H: 215, turns: 4, rTop: 38, phase: Math.PI / 4 };
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

  // (Granite Ascent's humongous spiral mountain is blended in at the end.)

  // --- High Mesa: a big flat-topped plateau, fast and exposed up top ---
  h += plateau(x, z, C.mesa.x, C.mesa.z, C.mesa.radius * 0.95, 26);

  // --- Cinder Cone: a small volcano with a crater dip in the middle ---
  h += bump(x, z, C.cinder.x, C.cinder.z, C.cinder.radius * 0.92, 58);
  h += -bump(x, z, C.cinder.x, C.cinder.z, C.cinder.radius * 0.34, 40); // crater

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

  // --- standalone hills out in the backcountry to break up the open space ---
  h += bump(x, z, 700, 640, 110, 20);
  h += bump(x, z, -720, -660, 100, 18);
  h += bump(x, z, 760, -700, 90, 16);
  h += bump(x, z, -700, 700, 90, 15);
  h += bump(x, z, 250, -300, 70, 9);
  h += bump(x, z, -300, 60, 60, 8);

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
    const ash = w(x, z, C.cinder) * smoothstep(20, 45, y); // dark ash up the cone
    if (ash > 0) c.lerp(cinderCol, ash * 0.8);
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
  type: "rock" | "log" | "tree";
  x: number;
  z: number;
  size: number;
  rot: number;
}

// Deterministic scatter for forests (so trees are stable across reloads).
function scatterTrees(cx: number, cz: number, r: number, count: number, seed: number): Prop[] {
  let s = seed % 233280;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const out: Prop[] = [];
  for (let i = 0; i < count; i++) {
    const ang = rnd() * Math.PI * 2;
    const rad = Math.sqrt(rnd()) * r;
    out.push({ type: "tree", x: cx + Math.cos(ang) * rad, z: cz + Math.sin(ang) * rad, size: 3 + rnd() * 2.6, rot: rnd() * Math.PI * 2 });
  }
  return out;
}

export const PROPS: Prop[] = [
  // near home — easy first obstacles
  { type: "rock", x: 20, z: -18, size: 1.3, rot: 0.3 },
  { type: "rock", x: -24, z: 16, size: 1.6, rot: 1.1 },
  { type: "log", x: 16, z: 28, size: 5.0, rot: 0.5 },
  // Boulder Basin rock garden (-520, 560)
  { type: "rock", x: -510, z: 548, size: 1.6, rot: 0.2 },
  { type: "rock", x: -528, z: 562, size: 2.4, rot: 1.0 },
  { type: "rock", x: -538, z: 552, size: 1.5, rot: 2.4 },
  { type: "rock", x: -516, z: 574, size: 1.9, rot: 0.6 },
  { type: "rock", x: -532, z: 578, size: 1.3, rot: 1.9 },
  { type: "rock", x: -502, z: 566, size: 2.1, rot: 0.9 },
  { type: "log", x: -500, z: 546, size: 5.5, rot: 0.3 },
  // Timber Hollow — fallen logs (440, -500)
  { type: "log", x: 430, z: -500, size: 6.5, rot: 0.4 },
  { type: "log", x: 458, z: -480, size: 6.0, rot: 1.2 },
  { type: "log", x: 414, z: -524, size: 7.0, rot: -0.3 },
  { type: "log", x: 476, z: -512, size: 5.5, rot: 1.9 },
  { type: "rock", x: 448, z: -536, size: 1.6, rot: 0.7 },
  // Switchback Ridge — rocks on the trail (-540, 240)
  { type: "rock", x: -530, z: 230, size: 1.7, rot: 1.1 },
  { type: "log", x: -560, z: 258, size: 5.5, rot: 0.6 },
  { type: "rock", x: -510, z: 266, size: 1.5, rot: 2.0 },
  // Echo Canyon floor — boulders (560, -240)
  { type: "rock", x: 550, z: -240, size: 1.9, rot: 0.8 },
  { type: "rock", x: 574, z: -226, size: 1.5, rot: 1.6 },
  { type: "rock", x: 560, z: -258, size: 2.0, rot: 0.2 },
  // The Rift — scattered boulders on the canyon floors (640, 320)
  { type: "rock", x: 630, z: 320, size: 2.2, rot: 0.5 },
  { type: "rock", x: 660, z: 300, size: 1.6, rot: 1.4 },
  { type: "rock", x: 612, z: 344, size: 1.8, rot: 2.2 },
  // Forests
  ...scatterTrees(-660, -80, 165, 46, 12345), // Whispering Pines
  ...scatterTrees(440, -500, 150, 16, 9981), // Timber Hollow
];
