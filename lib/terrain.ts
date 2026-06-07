import * as THREE from "three";

// --- Starter map dimensions ---
export const MAP_SIZE = 180; // world units, square, centered on origin
export const SEGMENTS = 120; // grid resolution for visuals + physics trimesh
export const HALF = MAP_SIZE / 2;

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Smooth, deterministic bump used to plant hills/ramps at fixed spots.
function bump(x: number, z: number, cx: number, cz: number, r: number, h: number) {
  const d = Math.hypot(x - cx, z - cz);
  if (d > r) return 0;
  const t = 1 - d / r;
  return h * t * t * (3 - 2 * t);
}

/**
 * Terrain height at world (x, z). Center ~25u radius is kept gentle so new
 * drivers can learn; further out it rolls into hills, a launch ramp, a berm and
 * a bowl for practicing jumps and recoveries.
 */
export function terrainHeight(x: number, z: number): number {
  const d = Math.hypot(x, z);
  // gentle rolling base
  let h =
    Math.sin(x * 0.06) * Math.cos(z * 0.055) * 2.2 +
    Math.sin(x * 0.13 + 1.7) * Math.cos(z * 0.11) * 1.0;

  // keep the central learning pad flat
  h *= smoothstep(8, 30, d);

  // named playground features (no real-world references)
  h += bump(x, z, 40, -38, 22, 7.5); // big hill, NE
  h += bump(x, z, -45, -30, 18, 5.5); // medium hill, NW
  h += bump(x, z, -38, 45, 16, 4.5); // hill, SW

  // a long launch ramp on the east side: ramp rising toward +x
  const ramp = (() => {
    const rx = x - 22,
      rz = z - 28;
    if (rx > 0 && rx < 16 && Math.abs(rz) < 5) {
      return (rx / 16) * 5.5 * smoothstep(5, 2.5, Math.abs(rz));
    }
    return 0;
  })();
  h += ramp;

  // shallow bowl / berm in the south-east for carving
  h += -bump(x, z, 48, 40, 20, 4.0);

  // raise the rim so the map has a soft natural border
  h += smoothstep(HALF - 22, HALF - 4, Math.abs(x)) * 9;
  h += smoothstep(HALF - 22, HALF - 4, Math.abs(z)) * 9;

  return h;
}

export interface TerrainData {
  geometry: THREE.BufferGeometry;
  vertices: Float32Array; // for rapier trimesh
  indices: Uint32Array;
}

let cached: TerrainData | null = null;

export function buildTerrain(): TerrainData {
  if (cached) return cached;
  const geo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, SEGMENTS, SEGMENTS);
  geo.rotateX(-Math.PI / 2); // lie flat in XZ, Y up

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors: number[] = [];
  const low = new THREE.Color("#6f5a3a"); // dirt
  const mid = new THREE.Color("#7c8b4e"); // scrub
  const high = new THREE.Color("#9aa861"); // dry grass
  const rock = new THREE.Color("#8a8276");
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = terrainHeight(x, z);
    pos.setY(i, y);

    // vertex color by elevation for a natural, model-free look
    const t = THREE.MathUtils.clamp((y + 2) / 11, 0, 1);
    if (t < 0.45) c.copy(low).lerp(mid, t / 0.45);
    else c.copy(mid).lerp(high, (t - 0.45) / 0.55);
    if (y > 6.5) c.lerp(rock, smoothstep(6.5, 9, y));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const vertices = new Float32Array(pos.array as Float32Array);
  const indices = new Uint32Array(geo.index!.array as ArrayLike<number>);

  cached = { geometry: geo, vertices, indices };
  return cached;
}

// Fixed obstacle props (rocks & logs) scattered for terrain variety.
export interface Prop {
  type: "rock" | "log";
  x: number;
  z: number;
  size: number;
  rot: number;
}

export const PROPS: Prop[] = [
  { type: "rock", x: 18, z: -14, size: 2.2, rot: 0.3 },
  { type: "rock", x: -22, z: 10, size: 3.0, rot: 1.1 },
  { type: "rock", x: -8, z: -28, size: 1.6, rot: 2.0 },
  { type: "rock", x: 30, z: 6, size: 2.6, rot: 0.7 },
  { type: "log", x: 12, z: 20, size: 5.0, rot: 0.5 },
  { type: "log", x: -30, z: -8, size: 6.0, rot: -0.4 },
  { type: "rock", x: 44, z: -10, size: 2.0, rot: 1.5 },
  { type: "log", x: 0, z: 34, size: 5.5, rot: 1.57 },
];
