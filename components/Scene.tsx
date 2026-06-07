"use client";
import { useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Physics, type RapierRigidBody } from "@react-three/rapier";
import { Sky, Environment, AdaptiveDpr } from "@react-three/drei";
import * as THREE from "three";
import Terrain from "./Terrain";
import Truck from "./Truck";
import { attachInput, setScheme } from "@/lib/input";
import { useGame } from "@/lib/store";

export interface RemotePlayer {
  id: string;
  name: string;
  color: string;
  pos: [number, number, number];
  quat: [number, number, number, number];
}

function FollowCamera({ target }: { target: React.MutableRefObject<RapierRigidBody | null> }) {
  const { camera } = useThree();
  const curPos = useRef(new THREE.Vector3(0, 8, 14));
  const lookAt = useRef(new THREE.Vector3());
  const tmp = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    const body = target.current;
    if (!body) return;
    const t = body.translation();
    const r = body.rotation();
    const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);

    // camera sits behind (+Z local) and above the truck
    const offset = tmp.current.set(0, 4.2, 9).applyQuaternion(q);
    const desired = new THREE.Vector3(t.x + offset.x, t.y + offset.y, t.z + offset.z);
    const k = 1 - Math.pow(0.0015, dt); // frame-rate independent smoothing
    curPos.current.lerp(desired, k);
    camera.position.copy(curPos.current);

    lookAt.current.lerp(new THREE.Vector3(t.x, t.y + 1.2, t.z), k);
    camera.lookAt(lookAt.current);
  });
  return null;
}

function RemoteTruck({ p }: { p: RemotePlayer }) {
  const group = useRef<THREE.Group>(null);
  const targetPos = useRef(new THREE.Vector3(...p.pos));
  const targetQuat = useRef(new THREE.Quaternion(...p.quat));

  useEffect(() => {
    targetPos.current.set(...p.pos);
    targetQuat.current.set(...p.quat);
  }, [p.pos, p.quat]);

  useFrame((_, dt) => {
    if (!group.current) return;
    const k = 1 - Math.pow(0.0001, dt);
    group.current.position.lerp(targetPos.current, k);
    group.current.quaternion.slerp(targetQuat.current, k);
  });

  return (
    <group ref={group}>
      <mesh castShadow position={[0, 0.35, 0]}>
        <boxGeometry args={[2.0, 0.7, 4.7]} />
        <meshStandardMaterial color={p.color} metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh castShadow position={[0, 1.1, 0]}>
        <boxGeometry args={[1.85, 0.9, 1.6]} />
        <meshStandardMaterial color={p.color} metalness={0.4} roughness={0.5} />
      </mesh>
      {[
        [1.05, 1.5],
        [-1.05, 1.5],
        [1.05, -1.55],
        [-1.05, -1.55],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.1, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.55, 0.55, 0.4, 14]} />
          <meshStandardMaterial color="#1b1b1b" />
        </mesh>
      ))}
    </group>
  );
}

interface SceneProps {
  color?: string;
  spawn?: [number, number, number];
  remotes?: RemotePlayer[];
  onFrame?: (pos: THREE.Vector3, quat: THREE.Quaternion, speedKmh: number) => void;
}

export default function Scene({ color, spawn, remotes = [], onFrame }: SceneProps) {
  const chassis = useRef<RapierRigidBody | null>(null);
  const scheme = useGame((s) => s.scheme);

  useEffect(() => attachInput(), []);
  useEffect(() => setScheme(scheme), [scheme]);

  return (
    <Canvas shadows camera={{ position: [0, 8, 14], fov: 60, near: 0.3, far: 600 }} dpr={[1, 1.75]}>
      <color attach="background" args={["#bcd4e6"]} />
      <fog attach="fog" args={["#bcd4e6", 90, 320]} />
      <Sky sunPosition={[60, 40, 20]} turbidity={6} rayleigh={1.2} />
      <hemisphereLight intensity={0.6} groundColor="#5a4a32" color="#cfe3f2" />
      <directionalLight
        castShadow
        position={[60, 70, 30]}
        intensity={2.1}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-120}
        shadow-camera-right={120}
        shadow-camera-top={120}
        shadow-camera-bottom={-120}
        shadow-camera-near={1}
        shadow-camera-far={300}
        shadow-bias={-0.0004}
      />
      <Environment preset="park" />

      <Physics gravity={[0, -20, 0]} timeStep={1 / 60}>
        <Terrain />
        <Truck ref={chassis} color={color} spawn={spawn} onFrame={onFrame} />
        {remotes.map((p) => (
          <RemoteTruck key={p.id} p={p} />
        ))}
      </Physics>

      <FollowCamera target={chassis} />
      <AdaptiveDpr pixelated />
    </Canvas>
  );
}
