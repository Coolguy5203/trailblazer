import * as THREE from "three";
import { REGIONS, type Region } from "./regions";

// --- Map dimensions (large, multi-region world) ---
export const MAP_SIZE = 440; // world units, square, centered on origin
export const SEGMENTS = 220; // grid resolution for visuals + physics trimesh
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

// Region influence weight: ~1 across the inner area, feathering to 0 at the edge.
function w(x: number, z: number, reg: Region) {
  const d = Math.hypot(x - reg.x, z - reg.z);
  if (d >= reg.radius) return 0;
  return smoothstep(reg.radius, reg.radius * 0.25, d);
}

// A simple wedge ramp rising along +x within a small footprint.
function ramp(x: number, z: number, cx: number, cz: number, len: number, wid: number, h: number) {
  const rx = x - cx,
    rz = z - cz;
  if (rx < 0 || rx > len || Math.abs(rz) > wid) return 0;
  return (rx / len) * h * smoothstep(wid, wid * 0.4, Math.abs(rz));
}

/**
 * Terrain height at world (x, z). Built region-by-region so each area suits a
 * different driving style: flat speedway, steep climb, rolling dunes, technical
 * ridge, rock basin, timber hollow and a ramp park. No real-world references.
 */
export function terrainHeight(x: number, z: number): number {
  const dHome = Math.hypot(x - C.home.x, z - C.home.z);

  // gentle global rolling base
  let h =
    Math.sin(x * 0.04) * Math.cos(z * 0.038) * 2.4 +
    Math.sin(x * 0.085 + 1.3) * Math.cos(z * 0.075) * 1.2;

  // flatten the home pad...
  h *= smoothstep(10, 38, dHome);
  // ...and keep the Salt Pan Speedway near dead-flat for top speed
  h *= 1 - 0.9 * w(x, z, C.speedway);

  // --- Granite Ascent: tall, steep, climbable massif (Boulder's strength) ---
  h += bump(x, z, C.ascent.x, C.ascent.z, C.ascent.radius * 0.95, 34);
  h += bump(x, z, C.ascent.x - 28, C.ascent.z + 18, 30, 12); // secondary peak
  h += bump(x, z, C.ascent.x + 22, C.ascent.z + 26, 26, 9);

  // --- The Dune Sea: big rolling waves for speed + air ---
  {
    const wd = w(x, z, C.dunes);
    if (wd > 0) {
      const dune = Math.sin(x * 0.11) * 4.2 + Math.sin((x + z) * 0.07 + 1.0) * 3.0 + Math.cos(z * 0.13) * 2.0;
      h += dune * wd;
    }
  }

  // --- Switchback Ridge: clustered medium hills, twisty technical lines ---
  h += bump(x, z, C.ridge.x + 18, C.ridge.z - 16, 30, 11);
  h += bump(x, z, C.ridge.x - 20, C.ridge.z + 14, 28, 9);
  h += bump(x, z, C.ridge.x + 4, C.ridge.z + 30, 24, 7);
  h += bump(x, z, C.ridge.x - 30, C.ridge.z - 24, 22, 6);

  // --- Timber Hollow: moderate rolling humps (logs are props) ---
  h += bump(x, z, C.timber.x + 14, C.timber.z + 12, 30, 6.5);
  h += bump(x, z, C.timber.x - 22, C.timber.z - 10, 26, 5.5);

  // --- Boulder Basin: shallow bowl so boulders sit in a pit ---
  h += -bump(x, z, C.basin.x, C.basin.z, C.basin.radius * 0.9, 6.0);

  // --- The Proving Grounds: a few terrain kickers/ramps ---
  h += ramp(x, z, C.proving.x - 24, C.proving.z - 6, 16, 5, 6.0);
  h += ramp(x, z, C.proving.x + 2, C.proving.z + 14, 14, 4.5, 5.0);
  h += ramp(x, z, C.proving.x + 20, C.proving.z - 18, 18, 5, 7.0);

  // --- a couple of standalone hills out in the backcountry ---
  h += bump(x, z, 175, -150, 40, 10);
  h += bump(x, z, 160, 170, 30, 7);

  // raised rim border so the map has a soft natural edge
  h += smoothstep(HALF - 34, HALF - 8, Math.abs(x)) * 14;
  h += smoothstep(HALF - 34, HALF - 8, Math.abs(z)) * 14;

  return h;
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
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = terrainHeight(x, z);
    pos.setY(i, y);

    const t = THREE.MathUtils.clamp((y + 3) / 18, 0, 1);
    if (t < 0.45) c.copy(low).lerp(mid, t / 0.45);
    else c.copy(mid).lerp(high, (t - 0.45) / 0.55);
    if (y > 11) c.lerp(rock, smoothstep(11, 18, y));
    // tint sandy regions (speedway + dunes)
    const sandiness = Math.max(w(x, z, C.speedway), w(x, z, C.dunes) * 0.9);
    if (sandiness > 0) c.lerp(sand, sandiness * 0.7);
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
  { type: "rock", x: 18, z: -16, size: 1.3, rot: 0.3 },
  { type: "rock", x: -22, z: 14, size: 1.6, rot: 1.1 },
  { type: "log", x: 14, z: 24, size: 5.0, rot: 0.5 },
  // Boulder Basin rock garden cluster
  { type: "rock", x: -140, z: 150, size: 1.6, rot: 0.2 },
  { type: "rock", x: -152, z: 160, size: 2.2, rot: 1.0 },
  { type: "rock", x: -160, z: 152, size: 1.4, rot: 2.4 },
  { type: "rock", x: -146, z: 168, size: 1.8, rot: 0.6 },
  { type: "rock", x: -158, z: 170, size: 1.3, rot: 1.9 },
  { type: "rock", x: -150, z: 144, size: 2.0, rot: 0.9 },
  { type: "log", x: -138, z: 166, size: 5.0, rot: 0.3 },
  // Granite Ascent — boulders strewn on the lower slopes
  { type: "rock", x: -100, z: -100, size: 2.0, rot: 0.4 },
  { type: "rock", x: -150, z: -95, size: 1.7, rot: 1.3 },
  { type: "rock", x: -95, z: -150, size: 1.9, rot: 2.1 },
  // Timber Hollow — fallen logs
  { type: "log", x: 95, z: -140, size: 6.0, rot: 0.4 },
  { type: "log", x: 110, z: -125, size: 5.5, rot: 1.2 },
  { type: "log", x: 85, z: -155, size: 6.5, rot: -0.3 },
  { type: "log", x: 120, z: -150, size: 5.0, rot: 1.9 },
  { type: "rock", x: 105, z: -160, size: 1.5, rot: 0.7 },
  // Switchback Ridge — a few rocks on the trail
  { type: "rock", x: -150, z: 55, size: 1.6, rot: 1.1 },
  { type: "log", x: -165, z: 70, size: 5.0, rot: 0.6 },
  { type: "rock", x: -140, z: 80, size: 1.4, rot: 2.0 },
];
