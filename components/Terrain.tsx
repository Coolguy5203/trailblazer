"use client";
import { useMemo } from "react";
import { RigidBody, TrimeshCollider, CuboidCollider, BallCollider } from "@react-three/rapier";
import { buildTerrain, PROPS, terrainHeight, HALF } from "@/lib/terrain";

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
