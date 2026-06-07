import * as THREE from "three";

// --- Map dimensions (enlarged) ---
export const MAP_SIZE = 300; // world units, square, centered on origin
export const SEGMENTS = 180; // grid resolution for visuals + physics trimesh
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
 * Terrain height at world (x, z). The center ~30u is kept gentle for learning;
 * the larger surrounding area rolls into hills, ramps, a mogul field, a steep
 * hill climb, and a rock-crawl basin. Gradients stay surmountable so a capable
 * truck can climb most of it. No real-world references.
 */
export function terrainHeight(x: number, z: number): number {
  const d = Math.hypot(x, z);

  // gentle rolling base across the whole map
  let h =
    Math.sin(x * 0.045) * Math.cos(z * 0.04) * 3.0 +
    Math.sin(x * 0.1 + 1.7) * Math.cos(z * 0.09) * 1.4;

  // keep the central learning pad flat
  h *= smoothstep(10, 34, d);

  // --- scattered hills across the bigger world ---
  h += bump(x, z, 60, -55, 30, 9.0); // big hill NE
  h += bump(x, z, -70, -45, 26, 7.0); // hill NW
  h += bump(x, z, -60, 65, 24, 6.0); // hill SW
  h += bump(x, z, 95, 30, 28, 8.0); // far-E hill
  h += bump(x, z, 20, 100, 22, 5.5); // far-S hill
  h += bump(x, z, -110, 10, 26, 7.5); // far-W hill

  // --- launch ramp (rising toward +x) just east of the pad ---
  {
    const rx = x - 26,
      rz = z - 30;
    if (rx > 0 && rx < 18 && Math.abs(rz) < 5.5) {
      h += (rx / 18) * 6.0 * smoothstep(5.5, 2.5, Math.abs(rz));
    }
  }

  // --- steep hill climb: a tall, climbable cone in the NW quadrant ---
  h += bump(x, z, -45, -100, 30, 18.0);

  // --- mogul / whoops field SE: rows of small bumps to absorb with suspension ---
  {
    const inField = x > 40 && x < 90 && z > 55 && z < 100;
    if (inField) {
      const m = Math.sin(x * 0.9) * Math.cos(z * 0.9);
      h += m * 1.6 * smoothstep(40, 50, x) * smoothstep(100, 90, z);
    }
  }

  // --- rock-crawl basin SW: a shallow dip so scattered boulders sit in a bowl ---
  h += -bump(x, z, -95, 95, 28, 5.0);

  // raised rim border so the map has a soft natural edge (scales with map size)
  h += smoothstep(HALF - 30, HALF - 6, Math.abs(x)) * 12;
  h += smoothstep(HALF - 30, HALF - 6, Math.abs(z)) * 12;

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
    const t = THREE.MathUtils.clamp((y + 3) / 16, 0, 1);
    if (t < 0.45) c.copy(low).lerp(mid, t / 0.45);
    else c.copy(mid).lerp(high, (t - 0.45) / 0.55);
    if (y > 9) c.lerp(rock, smoothstep(9, 14, y));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const vertices = new Float32Array(pos.array as Float32Array);
  const indices = new Uint32Array(geo.index!.array as ArrayLike<number>);

  cached = { geometry: geo, vertices, indices };
  return cached;
}

// Fixed obstacle props. Rocks are low, rounded boulders the truck can climb
// over; logs are crossable. Spread across the larger map, with a cluster in the
// SW rock-crawl basin.
export interface Prop {
  type: "rock" | "log";
  x: number;
  z: number;
  size: number;
  rot: number;
}

export const PROPS: Prop[] = [
  // near the pad — easy first obstacles
  { type: "rock", x: 16, z: -14, size: 1.3, rot: 0.3 },
  { type: "rock", x: -20, z: 12, size: 1.6, rot: 1.1 },
  { type: "log", x: 12, z: 22, size: 5.0, rot: 0.5 },
  { type: "log", x: -28, z: -10, size: 6.0, rot: -0.4 },
  { type: "rock", x: 34, z: 8, size: 1.4, rot: 0.7 },
  // scattered across the world
  { type: "rock", x: 70, z: -20, size: 1.8, rot: 1.5 },
  { type: "log", x: 0, z: 40, size: 6.0, rot: 1.57 },
  { type: "rock", x: -80, z: 30, size: 1.7, rot: 2.0 },
  { type: "log", x: 60, z: 70, size: 5.5, rot: 0.9 },
  // SW rock-crawl basin cluster
  { type: "rock", x: -88, z: 88, size: 1.5, rot: 0.2 },
  { type: "rock", x: -98, z: 96, size: 2.0, rot: 1.0 },
  { type: "rock", x: -104, z: 90, size: 1.3, rot: 2.4 },
  { type: "rock", x: -92, z: 102, size: 1.7, rot: 0.6 },
  { type: "rock", x: -100, z: 104, size: 1.2, rot: 1.9 },
  { type: "log", x: -96, z: 84, size: 5.0, rot: 0.3 },
];
