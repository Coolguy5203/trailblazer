"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Physics, RigidBody, CuboidCollider, type RapierRigidBody } from "@react-three/rapier";
import { Sky, Environment, AdaptiveDpr } from "@react-three/drei";
import * as THREE from "three";
import Terrain from "./Terrain";
import Truck from "./Truck";
import Checkpoints from "./Checkpoints";
import StoryMarkers from "./StoryMarkers";
import type { Objective } from "@/lib/story";
import { attachInput, setScheme } from "@/lib/input";
import { useGame } from "@/lib/store";
import { truckSpec } from "@/lib/shop";

export interface RemotePlayer {
  id: string;
  name: string;
  color: string;
  truckId: string;
  pos: [number, number, number];
  quat: [number, number, number, number];
  emote?: string;
  emoteAt?: number;
}

// Floating name tag (canvas sprite — no font downloads) + emote bubble.
function NameTag({ name, emote, emoteAt, height }: { name: string; emote?: string; emoteAt?: number; height: number }) {
  const [showEmote, setShowEmote] = useState(false);
  useEffect(() => {
    if (!emoteAt) return;
    setShowEmote(true);
    const t = setTimeout(() => setShowEmote(false), 3000);
    return () => clearTimeout(t);
  }, [emoteAt]);

  const text = showEmote && emote ? `${emote} ${name}` : name;
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.roundRect(8, 10, 240, 44, 12);
    ctx.fill();
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(text.slice(0, 16), 128, 33);
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 2;
    return tex;
  }, [text]);
  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <sprite position={[0, height, 0]} scale={[5.6, 1.4, 1]}>
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
}

// Directional "sun" whose shadow frustum follows the player, so shadows stay
// crisp anywhere on the huge map without a giant shadow texture.
function SunLight({ target }: { target: React.MutableRefObject<RapierRigidBody | null> }) {
  const light = useRef<THREE.DirectionalLight>(null);
  const tgt = useRef(new THREE.Object3D());
  const { scene } = useThree();

  useEffect(() => {
    scene.add(tgt.current);
    return () => {
      scene.remove(tgt.current);
    };
  }, [scene]);

  useFrame(() => {
    const b = target.current;
    const l = light.current;
    if (!b || !l) return;
    const t = b.translation();
    l.position.set(t.x + 90, t.y + 150, t.z + 70);
    tgt.current.position.set(t.x, t.y, t.z);
    l.target = tgt.current;
  });

  return (
    <directionalLight
      ref={light}
      castShadow
      intensity={2.1}
      shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-90}
      shadow-camera-right={90}
      shadow-camera-top={90}
      shadow-camera-bottom={-90}
      shadow-camera-near={1}
      shadow-camera-far={420}
      shadow-bias={-0.0004}
    />
  );
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

    // camera sits behind the truck (local -Z, the bed/tailgate side) and above
    const offset = tmp.current.set(0, 3.8, -9).applyQuaternion(q);
    const desired = new THREE.Vector3(t.x + offset.x, t.y + offset.y, t.z + offset.z);
    const k = 1 - Math.pow(0.0015, dt); // frame-rate independent smoothing
    curPos.current.lerp(desired, k);
    camera.position.copy(curPos.current);

    lookAt.current.lerp(new THREE.Vector3(t.x, t.y + 1.2, t.z), k);
    camera.lookAt(lookAt.current);
  });
  return null;
}

// A friend's truck: their REAL rig (spec proportions + paint), a name tag, and
// a kinematic collider so you can actually bump and push each other.
function RemoteTruck({ p }: { p: RemotePlayer }) {
  const spec = truckSpec(p.truckId);
  const body = useRef<RapierRigidBody | null>(null);
  const cur = useRef({ pos: new THREE.Vector3(...p.pos), quat: new THREE.Quaternion(...p.quat) });
  const targetPos = useRef(new THREE.Vector3(...p.pos));
  const targetQuat = useRef(new THREE.Quaternion(...p.quat));

  useEffect(() => {
    targetPos.current.set(...p.pos);
    targetQuat.current.set(...p.quat);
  }, [p.pos, p.quat]);

  useFrame((_, dt) => {
    const b = body.current;
    if (!b) return;
    const k = 1 - Math.pow(0.0001, dt);
    cur.current.pos.lerp(targetPos.current, k);
    cur.current.quat.slerp(targetQuat.current, k);
    b.setNextKinematicTranslation(cur.current.pos);
    b.setNextKinematicRotation(cur.current.quat);
  });

  const R = spec.wheelRadius;
  const wheels = [
    [spec.trackWidth, spec.wheelbaseFront],
    [-spec.trackWidth, spec.wheelbaseFront],
    [spec.trackWidth, -spec.wheelbaseRear],
    [-spec.trackWidth, -spec.wheelbaseRear],
  ];

  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={p.pos}>
      <CuboidCollider args={spec.colliderHalf} position={[0, 0.1, 0]} />
      <group scale={spec.bodyScale}>
        <mesh castShadow position={[0, 0, 0]}>
          <boxGeometry args={[2.0, 0.7, 4.7]} />
          <meshStandardMaterial color={p.color} metalness={0.4} roughness={0.5} />
        </mesh>
        <mesh castShadow position={[0, 0.45, 1.45]}>
          <boxGeometry args={[1.95, 0.45, 1.7]} />
          <meshStandardMaterial color={p.color} metalness={0.4} roughness={0.5} />
        </mesh>
        <mesh castShadow position={[0, 0.75, 0]}>
          <boxGeometry args={[1.85, 0.9, 1.6]} />
          <meshStandardMaterial color={p.color} metalness={0.4} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.78, 0.05]}>
          <boxGeometry args={[1.7, 0.6, 1.4]} />
          <meshStandardMaterial color="#16252e" metalness={0.6} roughness={0.2} />
        </mesh>
        <mesh castShadow position={[0, 0.35, -1.7]}>
          <boxGeometry args={[2.0, 0.5, 1.5]} />
          <meshStandardMaterial color={p.color} metalness={0.4} roughness={0.5} />
        </mesh>
        <mesh castShadow position={[0, -0.1, 2.45]}>
          <boxGeometry args={[2.05, 0.35, 0.3]} />
          <meshStandardMaterial color={spec.accent} metalness={0.7} roughness={0.4} />
        </mesh>
      </group>
      {wheels.map(([x, z], i) => (
        <mesh key={i} position={[x, -spec.suspensionRest + 0.1, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[R, R, 0.4, 14]} />
          <meshStandardMaterial color="#1b1b1b" />
        </mesh>
      ))}
      <NameTag name={p.name} emote={p.emote} emoteAt={p.emoteAt} height={2.6 * spec.bodyScale[1] + 0.8} />
    </RigidBody>
  );
}

interface SceneProps {
  color?: string;
  truckId?: string;
  spawn?: [number, number, number];
  spawnYaw?: number;
  remotes?: RemotePlayer[];
  checkpoints?: [number, number][];
  cpIndex?: number;
  cpColor?: string;
  story?: { objective: Objective; hits: number[]; step: number; color: string };
  onFrame?: (pos: THREE.Vector3, quat: THREE.Quaternion, speedKmh: number) => void;
}

export default function Scene({ color, truckId, spawn, spawnYaw, remotes = [], checkpoints, cpIndex = 0, cpColor = "#7fdbff", story, onFrame }: SceneProps) {
  const chassis = useRef<RapierRigidBody | null>(null);
  const scheme = useGame((s) => s.scheme);

  useEffect(() => attachInput(), []);
  useEffect(() => setScheme(scheme), [scheme]);

  return (
    <Canvas shadows camera={{ position: [0, 8, 14], fov: 60, near: 0.3, far: 3500 }} dpr={[1, 1.75]}>
      <color attach="background" args={["#bcd4e6"]} />
      <fog attach="fog" args={["#bcd4e6", 260, 1150]} />
      <Sky sunPosition={[120, 80, 40]} turbidity={6} rayleigh={1.2} />
      <hemisphereLight intensity={0.6} groundColor="#5a4a32" color="#cfe3f2" />
      <SunLight target={chassis} />
      <Environment preset="park" />

      <Physics gravity={[0, -20, 0]} timeStep={1 / 60}>
        <Terrain />
        <Truck ref={chassis} truckId={truckId} color={color} spawn={spawn} spawnYaw={spawnYaw} onFrame={onFrame} />
        {remotes.map((p) => (
          <RemoteTruck key={p.id} p={p} />
        ))}
      </Physics>

      {checkpoints && checkpoints.length > 0 && (
        <Checkpoints checkpoints={checkpoints} cpIndex={cpIndex} color={cpColor} />
      )}
      {story && <StoryMarkers objective={story.objective} hits={story.hits} step={story.step} color={story.color} />}

      <FollowCamera target={chassis} />
      <AdaptiveDpr pixelated />
    </Canvas>
  );
}
