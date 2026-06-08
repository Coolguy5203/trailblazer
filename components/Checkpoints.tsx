"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { checkpointY } from "@/lib/courses";

const RING_R = 6;

function Gate({
  x,
  z,
  yaw,
  status,
  color,
}: {
  x: number;
  z: number;
  yaw: number;
  status: "next" | "future" | "done";
  color: string;
}) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const y = useMemo(() => checkpointY(x, z), [x, z]);

  useFrame((state) => {
    if (status === "next" && matRef.current) {
      matRef.current.emissiveIntensity = 1.0 + Math.sin(state.clock.elapsedTime * 4) * 0.5;
    }
  });

  if (status === "done") return null;
  const c = status === "next" ? color : "#8893a0";

  return (
    <group position={[x, y + RING_R * 0.55, z]} rotation={[0, yaw, 0]}>
      {/* vertical hoop you drive through (axis along local Z = travel dir) */}
      <mesh>
        <torusGeometry args={[RING_R, 0.5, 10, 28]} />
        <meshStandardMaterial
          ref={matRef}
          color={c}
          emissive={c}
          emissiveIntensity={status === "next" ? 1.2 : 0.25}
          transparent
          opacity={status === "next" ? 0.95 : 0.45}
        />
      </mesh>
      {/* ground beacon so it's visible from afar */}
      {status === "next" && (
        <mesh position={[0, -RING_R * 0.55 + 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[RING_R * 0.7, RING_R, 24]} />
          <meshBasicMaterial color={color} transparent opacity={0.4} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

export default function Checkpoints({
  checkpoints,
  cpIndex,
  color,
}: {
  checkpoints: [number, number][];
  cpIndex: number;
  color: string;
}) {
  // precompute each gate's facing yaw (toward the next checkpoint)
  const yaws = useMemo(() => {
    return checkpoints.map((p, i) => {
      const nxt = checkpoints[i + 1] ?? checkpoints[i - 1] ?? p;
      const dx = nxt[0] - p[0];
      const dz = nxt[1] - p[1];
      return Math.atan2(dx, dz);
    });
  }, [checkpoints]);

  return (
    <group>
      {checkpoints.map((p, i) => (
        <Gate
          key={i}
          x={p[0]}
          z={p[1]}
          yaw={yaws[i]}
          color={color}
          status={i < cpIndex ? "done" : i === cpIndex ? "next" : "future"}
        />
      ))}
    </group>
  );
}
