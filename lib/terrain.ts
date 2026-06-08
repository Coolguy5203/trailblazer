import * as THREE from "three";
import { REGIONS, type Region } from "./regions";

// --- Map dimensions (HUGE multi-region world) ---
export const MAP_SIZE = 1200; // world units, square, centered on origin
export const SEGMENTS = 320; // grid resolution (cell ~3.75u) for visuals + physics trimesh
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

// --- Granite Ascent: an absolutely humongous mountain with a spiral switchback
// trail cut into it. The cone face is a ~45° wall (unclimbable straight up), but
// the carved road winds ~7 times around at a gentle 1–9° grade to a flat summit.
// phase = π/4 puts the trail entrance on the NE face, pointing back at Home Flats.
const MTN = { x: -270, z: -270, R: 270, H: 255, turns: 7, rTop: 33, roadHalf: 12, roadBlend: 5, phase: Math.PI / 4 };

export function spiralMountain(x: number, z: number): { hm: number; wm: number; road: number } {
  const dx = x - MTN.x;
  const dz = z - MTN.z;
  const r = Math.hypot(dx, dz);
  if (r > MTN.R) return { hm: 0, wm: 0, road: 0 };

  // blend the mountain over the base terrain near its rim
  const wm = smoothstep(MTN.R, MTN.R - 24, r);

  // flat summit cap above the top of the trail
  if (r <= MTN.rTop) return { hm: MTN.H * (1 - MTN.rTop / MTN.R), wm, road: 0 };

  const coneH = MTN.H * (1 - r / MTN.R); // steep cone surface

  // nearest spiral loop (loops are evenly spaced in radius)
  let th = Math.atan2(dz, dx) - MTN.phase;
  th = ((th % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  let bestDr = Infinity;
  let roadH = coneH;
  for (let k = 0; k < MTN.turns; k++) {
    const phi = th + Math.PI * 2 * k;
    const rc = MTN.R - (MTN.R - MTN.rTop) * (phi / (Math.PI * 2 * MTN.turns));
    if (rc < MTN.rTop || rc > MTN.R) continue;
    const dr = Math.abs(r - rc);
    if (dr < bestDr) {
      bestDr = dr;
      roadH = MTN.H * (1 - rc / MTN.R);
    }
  }

  // Flare the trail into a broad, easy on-ramp at the home-facing base so it's
  // simple to find and get onto; taper to normal width as you climb.
  const thPi = th > Math.PI ? th - Math.PI * 2 : th; // -π..π from the entrance
  const entrance = smoothstep(0.7, 0.15, Math.abs(thPi)) * smoothstep(MTN.R * 0.62, MTN.R, r);
  const roadHalf = MTN.roadHalf + 12 * entrance;

  const road = smoothstep(roadHalf + MTN.roadBlend, roadHalf, bestDr);
  // road cross-section: flat bench with a low berm at the edges to keep you on
  const berm = 1.4 * Math.pow(Math.min(bestDr / roadHalf, 1), 2);
  const surface = roadH + berm;
  const hm = coneH * (1 - road) + surface * road;
  return { hm, wm, road: road * wm };
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

  // flatten the home pad...
  h *= smoothstep(14, 50, dHome);
  // ...and keep the Salt Pan Speedway near dead-flat for top speed
  h *= 1 - 0.9 * w(x, z, C.speedway);

  // (Granite Ascent's humongous spiral mountain is blended in at the end.)

  // --- High Mesa: a big flat-topped plateau, fast and exposed up top ---
  h += plateau(x, z, C.mesa.x, C.mesa.z, C.mesa.radius * 0.95, 26);

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
  h += bump(x, z, 470, -460, 90, 16);
  h += bump(x, z, 480, 470, 70, 12);
  h += bump(x, z, -470, -480, 80, 14);
  h += bump(x, z, 150, -150, 55, 7);
  h += bump(x, z, -120, 120, 50, 6);

  // raised rim border so the map has a soft natural edge
  h += smoothstep(HALF - 70, HALF - 16, Math.abs(x)) * 18;
  h += smoothstep(HALF - 70, HALF - 16, Math.abs(z)) * 18;

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
  const sand = new THREE.Color("#cdb079"); // dunes / salt pan
  const roadCol = new THREE.Color("#a8895c"); // packed-dirt spiral trail
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
    const sandiness = Math.max(w(x, z, C.speedway), w(x, z, C.dunes) * 0.9);
    if (sandiness > 0) c.lerp(sand, sandiness * 0.7);
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

// Fixed obstacle props. Rocks are low rounded boulders the truck climbs over;
// logs are crossable. Clustered into the regions that suit them.
export interface Prop {
  type: "rock" | "log";
  x: number;
  z: number;
  size: number;
  rot: number;
}

export const PROPS: Prop[] = [
  // near home — easy first obstacles
  { type: "rock", x: 20, z: -18, size: 1.3, rot: 0.3 },
  { type: "rock", x: -24, z: 16, size: 1.6, rot: 1.1 },
  { type: "log", x: 16, z: 28, size: 5.0, rot: 0.5 },
  // Boulder Basin rock garden cluster (around -380, 410)
  { type: "rock", x: -370, z: 400, size: 1.6, rot: 0.2 },
  { type: "rock", x: -388, z: 412, size: 2.4, rot: 1.0 },
  { type: "rock", x: -398, z: 402, size: 1.5, rot: 2.4 },
  { type: "rock", x: -376, z: 424, size: 1.9, rot: 0.6 },
  { type: "rock", x: -392, z: 428, size: 1.3, rot: 1.9 },
  { type: "rock", x: -362, z: 416, size: 2.1, rot: 0.9 },
  { type: "log", x: -360, z: 396, size: 5.5, rot: 0.3 },
  // (Granite Ascent is the spiral mountain — no props on it, they'd block the trail)
  // Timber Hollow — fallen logs (around 300,-360)
  { type: "log", x: 290, z: -360, size: 6.5, rot: 0.4 },
  { type: "log", x: 318, z: -340, size: 6.0, rot: 1.2 },
  { type: "log", x: 274, z: -384, size: 7.0, rot: -0.3 },
  { type: "log", x: 336, z: -372, size: 5.5, rot: 1.9 },
  { type: "rock", x: 308, z: -396, size: 1.6, rot: 0.7 },
  { type: "log", x: 256, z: -344, size: 6.0, rot: 0.9 },
  // Switchback Ridge — rocks on the trail (around -390,170)
  { type: "rock", x: -380, z: 160, size: 1.7, rot: 1.1 },
  { type: "log", x: -410, z: 188, size: 5.5, rot: 0.6 },
  { type: "rock", x: -360, z: 196, size: 1.5, rot: 2.0 },
  // Echo Canyon floor — a few boulders (around 410,-170)
  { type: "rock", x: 400, z: -170, size: 1.9, rot: 0.8 },
  { type: "rock", x: 424, z: -156, size: 1.5, rot: 1.6 },
  { type: "rock", x: 410, z: -188, size: 2.0, rot: 0.2 },
];
