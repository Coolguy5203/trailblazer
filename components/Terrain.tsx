"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RigidBody, TrimeshCollider, CuboidCollider, BallCollider } from "@react-three/rapier";
import { buildTerrain, PROPS, terrainHeight, HALF, LAKE } from "@/lib/terrain";

const VOLCANO = { x: 300, z: 900 };

// Glowing, pulsing lava pool in the volcano crater.
function Lava() {
  const y = useMemo(() => terrainHeight(VOLCANO.x, VOLCANO.z) + 1.5, []);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  useFrame((s) => {
    const k = 1.6 + Math.sin(s.clock.elapsedTime * 1.7) * 0.5 + Math.sin(s.clock.elapsedTime * 4.3) * 0.25;
    if (mat.current) mat.current.emissiveIntensity = k;
    if (light.current) light.current.intensity = 90 + k * 40;
  });
  return (
    <group position={[VOLCANO.x, y, VOLCANO.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[58, 36]} />
        <meshStandardMaterial ref={mat} color="#ff5a1f" emissive="#ff7a1f" emissiveIntensity={1.6} roughness={0.6} />
      </mesh>
      <pointLight ref={light} position={[0, 14, 0]} color="#ff7a30" intensity={110} distance={220} decay={1.6} />
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

      {/* Scattered rocks & logs */}
      {PROPS.map((p, i) => {
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
        if (p.type === "tree") {
          // conifer: trunk + stacked foliage cones; thin trunk collider to weave
          const h = p.size;
          return (
            <RigidBody key={i} type="fixed" colliders={false} position={[p.x, y, p.z]} rotation={[0, p.rot, 0]}>
              <mesh castShadow position={[0, h * 0.4, 0]}>
                <cylinderGeometry args={[0.28, 0.38, h * 0.8, 7]} />
                <meshStandardMaterial color="#5a4732" roughness={1} />
              </mesh>
              <mesh castShadow position={[0, h * 0.95, 0]}>
                <coneGeometry args={[h * 0.5, h * 1.0, 8]} />
                <meshStandardMaterial color="#3f5d34" roughness={1} flatShading />
              </mesh>
              <mesh castShadow position={[0, h * 1.45, 0]}>
                <coneGeometry args={[h * 0.36, h * 0.8, 8]} />
                <meshStandardMaterial color="#47683a" roughness={1} flatShading />
              </mesh>
              <CuboidCollider args={[0.4, h, 0.4]} position={[0, h, 0]} />
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
