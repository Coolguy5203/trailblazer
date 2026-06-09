"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RigidBody, TrimeshCollider, CuboidCollider, BallCollider } from "@react-three/rapier";
import { buildTerrain, PROPS, terrainHeight, HALF, LAKE, LAVA } from "@/lib/terrain";

// Ember boulders strewn on the volcano's flanks — solid, faintly glowing.
const EMBERS = [
  { x: 360, z: 760, size: 1.8, rot: 0.4 },
  { x: 218, z: 792, size: 1.4, rot: 1.3 },
  { x: 420, z: 960, size: 2.1, rot: 2.2 },
  { x: 252, z: 1030, size: 1.6, rot: 0.9 },
  { x: 168, z: 902, size: 1.5, rot: 1.7 },
  { x: 392, z: 1052, size: 1.3, rot: 0.2 },
];

const TREES = PROPS.filter((p) => p.type === "tree");
const GROUND_PROPS = PROPS.filter((p) => p.type !== "tree");

// Dense forests: ONE instanced mesh for all trees (merged trunk+foliage geometry
// with vertex colors), plus invisible per-tree trunk colliders.
function Forest() {
  const { geometry, matrices } = useMemo(() => {
    const paint = (g: THREE.BufferGeometry, hex: string) => {
      const c = new THREE.Color(hex);
      const n = g.attributes.position.count;
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        arr[i * 3] = c.r;
        arr[i * 3 + 1] = c.g;
        arr[i * 3 + 2] = c.b;
      }
      g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
      return g;
    };
    // normalized tree (size = 1), scaled per-instance
    const trunk = paint(new THREE.CylinderGeometry(0.07, 0.1, 0.8, 6).translate(0, 0.4, 0), "#5a4732");
    const cone1 = paint(new THREE.ConeGeometry(0.5, 1.0, 7).translate(0, 0.95, 0), "#3f5d34");
    const cone2 = paint(new THREE.ConeGeometry(0.36, 0.8, 7).translate(0, 1.45, 0), "#47683a");
    const parts = [trunk, cone1, cone2].map((g) => g.toNonIndexed());
    // manual merge (all parts share position/normal/uv/color attributes)
    const total = parts.reduce((s, g) => s + g.attributes.position.count, 0);
    const merged = new THREE.BufferGeometry();
    for (const name of ["position", "normal", "color"]) {
      const arr = new Float32Array(total * 3);
      let off = 0;
      for (const g of parts) {
        arr.set(g.attributes[name].array as Float32Array, off);
        off += g.attributes[name].count * 3;
      }
      merged.setAttribute(name, new THREE.BufferAttribute(arr, 3));
    }
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const mats = TREES.map((p) => {
      q.setFromEuler(new THREE.Euler(0, p.rot, 0));
      return m
        .clone()
        .compose(new THREE.Vector3(p.x, terrainHeight(p.x, p.z), p.z), q.clone(), new THREE.Vector3(p.size, p.size, p.size));
    });
    return { geometry: merged, matrices: mats };
  }, []);

  return (
    <group>
      <instancedMesh
        args={[geometry, undefined, matrices.length]}
        castShadow
        receiveShadow
        ref={(im) => {
          if (!im) return;
          matrices.forEach((m, i) => im.setMatrixAt(i, m));
          im.instanceMatrix.needsUpdate = true;
        }}
      >
        <meshStandardMaterial vertexColors roughness={1} flatShading />
      </instancedMesh>
      {/* trunk colliders only (no draw cost) */}
      {TREES.map((p, i) => (
        <RigidBody key={i} type="fixed" colliders={false} position={[p.x, terrainHeight(p.x, p.z), p.z]}>
          <CuboidCollider args={[0.12 * p.size, p.size, 0.12 * p.size]} position={[0, p.size, 0]} />
        </RigidBody>
      ))}
    </group>
  );
}

// The active volcano: a big molten pool (impassable — Truck scorch-respawns on
// contact), bubbling lava, rising smoke, glowing streams down the flanks, and
// ember boulders. All visuals pulse together for a "breathing" mountain.
function Lava() {
  const poolMat = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  const bubbles = useRef<THREE.Mesh[]>([]);
  const smoke = useRef<THREE.Mesh[]>([]);
  const streamMats = useRef<THREE.MeshStandardMaterial[]>([]);

  // precompute each flank stream's placement: a glowing ribbon from just below
  // the rim down to the foot of the cone, tilted to hug the slope
  const streams = useMemo(
    () =>
      LAVA.streams.map((ang) => {
        const r0 = 115; // just outside the rim crest
        const r1 = 268; // foot of the cone
        const y0 = terrainHeight(LAVA.x + Math.cos(ang) * r0, LAVA.z + Math.sin(ang) * r0);
        const y1 = terrainHeight(LAVA.x + Math.cos(ang) * r1, LAVA.z + Math.sin(ang) * r1);
        const rm = (r0 + r1) / 2;
        const len = Math.hypot(r1 - r0, y0 - y1);
        return {
          pos: [LAVA.x + Math.cos(ang) * rm, (y0 + y1) / 2 + 0.4, LAVA.z + Math.sin(ang) * rm] as [number, number, number],
          yaw: -ang + Math.PI / 2, // plane's local Z runs radially after this yaw
          tilt: Math.atan2(y0 - y1, r1 - r0),
          len,
        };
      }),
    []
  );

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    const k = 1.7 + Math.sin(t * 1.7) * 0.5 + Math.sin(t * 4.3) * 0.3;
    if (poolMat.current) poolMat.current.emissiveIntensity = k;
    if (light.current) light.current.intensity = 110 + k * 50;
    streamMats.current.forEach((m, i) => {
      if (m) m.emissiveIntensity = 1.1 + Math.sin(t * 2.1 + i * 1.8) * 0.4;
    });
    // lava bubbles: bob up out of the pool and sink back
    bubbles.current.forEach((b, i) => {
      if (!b) return;
      const ph = (t * (0.5 + i * 0.13) + i * 1.7) % 2;
      b.position.y = LAVA.y + (ph < 1 ? ph : 2 - ph) * 2.2 - 0.6;
      const sc = 0.8 + Math.sin(t * 3 + i) * 0.2;
      b.scale.setScalar(sc);
    });
    // smoke puffs: rise from the crater, grow and fade, loop
    smoke.current.forEach((p, i) => {
      if (!p) return;
      const ph = ((t * 0.18 + i * 0.34) % 1 + 1) % 1;
      p.position.y = LAVA.y + 8 + ph * 70;
      const sc = 6 + ph * 16;
      p.scale.setScalar(sc);
      const m = p.material as THREE.MeshBasicMaterial;
      m.opacity = 0.3 * (1 - ph);
    });
  });

  return (
    <group>
      {/* molten pool */}
      <group position={[LAVA.x, LAVA.y, LAVA.z]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[LAVA.r, 40]} />
          <meshStandardMaterial ref={poolMat} color="#ff4a14" emissive="#ff7a1f" emissiveIntensity={1.7} roughness={0.55} />
        </mesh>
        {/* hot inner core */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.25, 0]}>
          <circleGeometry args={[LAVA.r * 0.45, 28]} />
          <meshStandardMaterial color="#ffc24a" emissive="#ffd86b" emissiveIntensity={2.6} roughness={0.4} />
        </mesh>
        <pointLight ref={light} position={[0, 16, 0]} color="#ff7a30" intensity={130} distance={260} decay={1.6} />
        {/* bubbles */}
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh
            key={i}
            ref={(m) => {
              if (m) bubbles.current[i] = m;
            }}
            position={[Math.cos(i * 1.9) * LAVA.r * 0.5, 0, Math.sin(i * 1.9) * LAVA.r * 0.5]}
          >
            <sphereGeometry args={[2.2, 10, 10]} />
            <meshStandardMaterial color="#ff6a1f" emissive="#ffb24a" emissiveIntensity={2.2} roughness={0.5} />
          </mesh>
        ))}
        {/* smoke column */}
        {[0, 1, 2].map((i) => (
          <mesh
            key={`s${i}`}
            ref={(m) => {
              if (m) smoke.current[i] = m;
            }}
            position={[Math.cos(i * 2.4) * 10, 20, Math.sin(i * 2.4) * 10]}
          >
            <sphereGeometry args={[1, 8, 8]} />
            <meshBasicMaterial color="#5a5350" transparent opacity={0.25} depthWrite={false} />
          </mesh>
        ))}
      </group>

      {/* glowing streams down the flanks */}
      {streams.map((st, i) => (
        <group key={i} position={st.pos} rotation={[0, st.yaw, 0]}>
          <mesh rotation={[-Math.PI / 2 + st.tilt, 0, 0]}>
            <planeGeometry args={[7, st.len]} />
            <meshStandardMaterial
              ref={(m) => {
                if (m) streamMats.current[i] = m;
              }}
              color="#ff4a14"
              emissive="#ff8a2f"
              emissiveIntensity={1.2}
              roughness={0.6}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      ))}

      {/* ember boulders on the flanks (solid) */}
      {EMBERS.map((e, i) => {
        const y = terrainHeight(e.x, e.z);
        return (
          <RigidBody key={i} type="fixed" colliders={false} position={[e.x, y + e.size * 0.25, e.z]} rotation={[0, e.rot, 0]}>
            <mesh castShadow>
              <dodecahedronGeometry args={[e.size, 0]} />
              <meshStandardMaterial color="#2c211d" emissive="#ff5a1f" emissiveIntensity={0.45} roughness={0.9} flatShading />
            </mesh>
            <BallCollider args={[e.size * 0.85]} />
          </RigidBody>
        );
      })}
    </group>
  );
}

// Still water surface over the forest lake bowl.
function Lake() {
  return (
    <mesh position={[LAKE.x, LAKE.waterY, LAKE.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[LAKE.r, 36]} />
      <meshStandardMaterial color="#2e6a8f" transparent opacity={0.78} roughness={0.15} metalness={0.4} />
    </mesh>
  );
}

export default function Terrain() {
  const { geometry, vertices, indices } = useMemo(() => buildTerrain(), []);

  return (
    <group>
      {/* Terrain surface: one trimesh collider that exactly matches the visual mesh */}
      <RigidBody type="fixed" colliders={false} friction={1.1}>
        <mesh geometry={geometry} receiveShadow castShadow>
          <meshStandardMaterial vertexColors roughness={0.95} metalness={0.0} />
        </mesh>
        <TrimeshCollider args={[vertices, indices]} />
      </RigidBody>

      <Lava />
      <Lake />
      <Forest />

      {/* Invisible boundary walls so you can't drive off the world */}
      {([
        [0, HALF, [HALF, 8, 1]],
        [0, -HALF, [HALF, 8, 1]],
        [HALF, 0, [1, 8, HALF]],
        [-HALF, 0, [1, 8, HALF]],
      ] as [number, number, [number, number, number]][]).map(([x, z, args], i) => (
        <RigidBody key={i} type="fixed" position={[x, terrainHeight(x, z) + 4, z]}>
          <CuboidCollider args={args} />
        </RigidBody>
      ))}

      {/* Scattered rocks, logs, flora & landmarks (trees are instanced above) */}
      {GROUND_PROPS.map((p, i) => {
        const y = terrainHeight(p.x, p.z);
        if (p.type === "rock") {
          // Rounded, partly-buried boulder: the wheels roll up and over it
          // instead of slamming into a vertical wall.
          return (
            <RigidBody key={i} type="fixed" colliders={false} position={[p.x, y + p.size * 0.2, p.z]} rotation={[0, p.rot, 0]}>
              <mesh castShadow receiveShadow>
                <dodecahedronGeometry args={[p.size, 0]} />
                <meshStandardMaterial color="#857d70" roughness={1} flatShading />
              </mesh>
              <BallCollider args={[p.size * 0.88]} />
            </RigidBody>
          );
        }
        if (p.type === "bush") {
          // soft scrub — no collider, drive right through
          return (
            <mesh key={i} position={[p.x, y + p.size * 0.45, p.z]} rotation={[0, p.rot, 0]} castShadow>
              <icosahedronGeometry args={[p.size * 0.7, 0]} />
              <meshStandardMaterial color="#5a7a44" roughness={1} flatShading />
            </mesh>
          );
        }
        if (p.type === "cactus") {
          const h = p.size;
          return (
            <RigidBody key={i} type="fixed" colliders={false} position={[p.x, y, p.z]} rotation={[0, p.rot, 0]}>
              <mesh castShadow position={[0, h * 0.5, 0]}>
                <cylinderGeometry args={[0.32, 0.38, h, 8]} />
                <meshStandardMaterial color="#4f7c3c" roughness={0.9} />
              </mesh>
              <mesh castShadow position={[0.55, h * 0.55, 0]} rotation={[0, 0, -0.5]}>
                <cylinderGeometry args={[0.2, 0.22, h * 0.45, 7]} />
                <meshStandardMaterial color="#4f7c3c" roughness={0.9} />
              </mesh>
              <CuboidCollider args={[0.35, h / 2, 0.35]} position={[0, h / 2, 0]} />
            </RigidBody>
          );
        }
        if (p.type === "arch") {
          // natural rock arch: two pillars + lintel, drive underneath
          const s = p.size;
          return (
            <RigidBody key={i} type="fixed" colliders={false} position={[p.x, y, p.z]} rotation={[0, p.rot, 0]}>
              {[-s * 0.6, s * 0.6].map((ox) => (
                <mesh key={ox} castShadow position={[ox, s * 0.45, 0]}>
                  <boxGeometry args={[s * 0.28, s * 0.9, s * 0.3]} />
                  <meshStandardMaterial color="#8a7a66" roughness={1} flatShading />
                </mesh>
              ))}
              <mesh castShadow position={[0, s * 0.97, 0]}>
                <boxGeometry args={[s * 1.5, s * 0.26, s * 0.34]} />
                <meshStandardMaterial color="#8a7a66" roughness={1} flatShading />
              </mesh>
              <CuboidCollider args={[s * 0.14, s * 0.45, s * 0.15]} position={[-s * 0.6, s * 0.45, 0]} />
              <CuboidCollider args={[s * 0.14, s * 0.45, s * 0.15]} position={[s * 0.6, s * 0.45, 0]} />
              <CuboidCollider args={[s * 0.75, s * 0.13, s * 0.17]} position={[0, s * 0.97, 0]} />
            </RigidBody>
          );
        }
        // log — lower & crossable; the truck climbs over with its long travel
        return (
          <RigidBody key={i} type="fixed" colliders={false} position={[p.x, y + 0.45, p.z]} rotation={[0, p.rot, Math.PI / 2]}>
            <mesh castShadow receiveShadow>
              <cylinderGeometry args={[0.45, 0.45, p.size, 12]} />
              <meshStandardMaterial color="#5b4631" roughness={1} />
            </mesh>
            <CuboidCollider args={[0.45, p.size / 2, 0.45]} />
          </RigidBody>
        );
      })}
    </group>
  );
}
