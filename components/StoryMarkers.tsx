"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { terrainHeight } from "@/lib/terrain";
import type { Objective } from "@/lib/story";
import Checkpoints from "./Checkpoints";

function Beacon({ x, z, color }: { x: number; z: number; color: string }) {
  const y = useMemo(() => terrainHeight(x, z), [x, z]);
  const ring = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (ring.current) {
      const k = 1 + Math.sin(s.clock.elapsedTime * 3) * 0.12;
      ring.current.scale.set(k, k, k);
    }
  });
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 20, 0]}>
        <cylinderGeometry args={[1.1, 1.1, 40, 10]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.4} transparent opacity={0.5} />
      </mesh>
      <mesh ref={ring} position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[6, 8, 28]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Flag({ x, z, color }: { x: number; z: number; color: string }) {
  const y = useMemo(() => terrainHeight(x, z), [x, z]);
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s, dt) => {
    if (ref.current) {
      ref.current.rotation.y += dt * 1.6;
      ref.current.position.y = y + 3 + Math.sin(s.clock.elapsedTime * 2) * 0.4;
    }
  });
  return (
    <group position={[x, 0, z]}>
      <mesh ref={ref} position={[0, y + 3, 0]}>
        <octahedronGeometry args={[1.6, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.1} />
      </mesh>
      <mesh position={[0, y + 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.4, 3.2, 20]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export default function StoryMarkers({
  objective,
  hits,
  step,
  color,
}: {
  objective: Objective;
  hits: number[];
  step: number;
  color: string;
}) {
  if (objective.kind === "reach") {
    return <Beacon x={objective.target[0]} z={objective.target[1]} color={color} />;
  }
  if (objective.kind === "collect") {
    return (
      <group>
        {objective.points.map((p, i) => (hits.includes(i) ? null : <Flag key={i} x={p[0]} z={p[1]} color={color} />))}
      </group>
    );
  }
  if (objective.kind === "gates") {
    return <Checkpoints checkpoints={objective.points} cpIndex={step} color={color} />;
  }
  return null; // bigair has no world marker
}
