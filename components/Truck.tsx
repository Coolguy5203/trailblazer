"use client";
import { forwardRef, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CuboidCollider, useRapier, type RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { readInput } from "@/lib/input";
import { useGame } from "@/lib/store";
import { truckSpec, type TruckSpec } from "@/lib/shop";
import { LAVA, terrainHeight } from "@/lib/terrain";

const MAX_STEER = 0.55;

export interface TruckProps {
  truckId?: string;
  spawn?: [number, number, number];
  spawnYaw?: number;
  color?: string;
  onFrame?: (pos: THREE.Vector3, quat: THREE.Quaternion, speedKmh: number) => void;
}

const Truck = forwardRef<RapierRigidBody, TruckProps>(function Truck(
  { truckId = "stock", spawn = [0, 3, 0], spawnYaw = 0, color = "#c8512e", onFrame },
  ref
) {
  const spec: TruckSpec = useMemo(() => truckSpec(truckId), [truckId]);
  const wheels = useMemo(
    () => [
      { x: spec.trackWidth, y: -0.25, z: spec.wheelbaseFront, steer: true },
      { x: -spec.trackWidth, y: -0.25, z: spec.wheelbaseFront, steer: true },
      { x: spec.trackWidth, y: -0.25, z: -spec.wheelbaseRear, steer: false },
      { x: -spec.trackWidth, y: -0.25, z: -spec.wheelbaseRear, steer: false },
    ],
    [spec]
  );

  const { world } = useRapier();
  const bodyRef = useRef<RapierRigidBody | null>(null);
  const controllerRef = useRef<any>(null);
  const wheelGroups = useRef<THREE.Group[]>([]);
  const wheelSpin = useRef<THREE.Mesh[]>([]);
  const steerSmooth = useRef(0);
  const rollAngle = useRef(0);
  const wasAir = useRef(false);
  const airStart = useRef(0);

  const setTelemetry = useGame((s) => s.setTelemetry);
  const addJump = useGame((s) => s.addJump);
  const addDistance = useGame((s) => s.addDistance);
  const lastPos = useRef(new THREE.Vector3());

  // (Re)build the raycast vehicle controller whenever the truck spec changes.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;

    // Low centre of mass + strong pitch/roll inertia so throttle can't flip it.
    const mr = spec.mass / 1400;
    body.setAdditionalMassProperties(
      spec.mass,
      { x: 0, y: -0.6, z: 0 },
      { x: 3200 * mr, y: 2400 * mr, z: 2800 * mr },
      { x: 0, y: 0, z: 0, w: 1 },
      true
    );

    const rawWorld: any = (world as any).raw ? (world as any).raw() : world;
    const controller = rawWorld.createVehicleController(body);
    const dir = { x: 0, y: -1, z: 0 };
    const axle = { x: -1, y: 0, z: 0 };
    wheels.forEach((w) => {
      controller.addWheel({ x: w.x, y: w.y, z: w.z }, dir, axle, spec.suspensionRest, spec.wheelRadius);
    });
    for (let i = 0; i < wheels.length; i++) {
      controller.setWheelSuspensionStiffness(i, 28);
      controller.setWheelMaxSuspensionTravel(i, 0.8);
      controller.setWheelSuspensionCompression(i, 0.9);
      controller.setWheelSuspensionRelaxation(i, 0.95);
      controller.setWheelFrictionSlip(i, spec.frictionSlip);
      controller.setWheelMaxSuspensionForce(i, 90000);
      if (controller.setWheelSideFrictionStiffness) controller.setWheelSideFrictionStiffness(i, 1.0);
    }
    controllerRef.current = controller;
    return () => {
      try {
        rawWorld.removeVehicleController(controller);
      } catch {
        /* world may already be torn down */
      }
      controllerRef.current = null;
    };
  }, [world, spec, wheels]);

  useFrame((_, dtRaw) => {
    const controller = controllerRef.current;
    const body = bodyRef.current;
    if (!controller || !body) return;
    const dt = Math.min(dtRaw, 1 / 30);
    const input = readInput();

    const linvel = body.linvel();
    const speed = Math.hypot(linvel.x, linvel.y, linvel.z);

    const speedFactor = 1 - Math.min(0.6, speed / 40);
    const targetSteer = -input.steer * MAX_STEER * speedFactor;
    steerSmooth.current += (targetSteer - steerSmooth.current) * Math.min(1, dt * 8);

    let engine = 0;
    // low-gear torque: up to +80% force at crawl speeds (fades out by ~18 m/s)
    // so steep grades are climbed with authority without raising top speed
    const lowGear = 1 + 0.8 * Math.max(0, 1 - speed / 18);
    if (input.throttle !== 0 && speed < spec.maxSpeed) engine = input.throttle * spec.engine * lowGear;
    let brake = 0;
    if (input.brake) brake = 80;
    else if (input.throttle === 0) brake = 6;

    for (let i = 0; i < wheels.length; i++) {
      controller.setWheelEngineForce(i, engine);
      controller.setWheelBrake(i, brake);
      if (wheels[i].steer) controller.setWheelSteering(i, steerSmooth.current);
    }

    controller.updateVehicle(dt);

    let inContact = 0;
    rollAngle.current += (speed * (engine < 0 ? -1 : 1) * dt) / spec.wheelRadius;
    for (let i = 0; i < wheels.length; i++) {
      const g = wheelGroups.current[i];
      if (g) {
        const susp = controller.wheelSuspensionLength?.(i) ?? spec.suspensionRest;
        g.position.set(wheels[i].x, wheels[i].y - susp, wheels[i].z);
        g.rotation.y = wheels[i].steer ? controller.wheelSteering?.(i) ?? 0 : 0;
      }
      const spin = wheelSpin.current[i];
      if (spin) spin.rotation.x = rollAngle.current;
      if (controller.wheelIsInContact?.(i)) inContact++;
    }

    const airborne = inContact === 0;
    const now = performance.now() / 1000;
    if (airborne && !wasAir.current) airStart.current = now;
    if (!airborne && wasAir.current) {
      const airtime = now - airStart.current;
      if (airtime > 0.45) addJump(airtime);
    }
    wasAir.current = airborne;

    if (input.reset) {
      const t = body.translation();
      const yaw = new THREE.Euler().setFromQuaternion(
        new THREE.Quaternion(body.rotation().x, body.rotation().y, body.rotation().z, body.rotation().w),
        "YXZ"
      ).y;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
      body.setTranslation({ x: t.x, y: t.y + 1.5, z: t.z }, true);
      body.setRotation(q, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }

    const t = body.translation();
    const pos = new THREE.Vector3(t.x, t.y, t.z);

    // LAVA IS IMPASSABLE: touch the pool (or a flank stream) and you're
    // scorched — instant respawn at the volcano's base, facing away.
    {
      const dPool = Math.hypot(t.x - LAVA.x, t.z - LAVA.z);
      let burned = dPool < LAVA.r + 1.2 && t.y < LAVA.y + 2.5;
      if (!burned && dPool > 110 && dPool < 272) {
        // flank streams: within ~5u of a stream's radial line while on the cone
        const ang = Math.atan2(t.z - LAVA.z, t.x - LAVA.x);
        for (const sa of LAVA.streams) {
          let dA = Math.abs(ang - sa);
          if (dA > Math.PI) dA = Math.PI * 2 - dA;
          if (dA * dPool < 4.5) {
            burned = true;
            break;
          }
        }
      }
      if (burned) {
        const sy = terrainHeight(LAVA.safe.x, LAVA.safe.z);
        body.setTranslation({ x: LAVA.safe.x, y: sy + 2.5, z: LAVA.safe.z }, true);
        body.setRotation(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0)), true);
        body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        useGame.getState().setScorched();
        lastPos.current.set(0, 0, 0); // don't count the teleport as distance
        return;
      }
    }

    if (lastPos.current.lengthSq() > 0) {
      const d = pos.distanceTo(lastPos.current);
      if (d < 5) addDistance(d);
    }
    lastPos.current.copy(pos);

    const speedKmh = speed * 3.6;
    setTelemetry({ speedKmh, airborne, altitude: t.y });

    if (onFrame) {
      const r = body.rotation();
      onFrame(pos, new THREE.Quaternion(r.x, r.y, r.z, r.w), speedKmh);
    }
  });

  const R = spec.wheelRadius;

  return (
    <RigidBody
      key={spec.id}
      ref={(r) => {
        bodyRef.current = r;
        if (typeof ref === "function") ref(r);
        else if (ref) (ref as any).current = r;
      }}
      colliders={false}
      position={spawn}
      rotation={[0, spawnYaw, 0]}
      canSleep={false}
      linearDamping={0.05}
      angularDamping={0.5}
      friction={0.9}
    >
      <CuboidCollider args={spec.colliderHalf} position={[0, 0.1, 0]} />

      {/* ---- Truck body (scaled per spec) ---- */}
      <group scale={spec.bodyScale}>
        <mesh castShadow position={[0, 0, 0]}>
          <boxGeometry args={[2.0, 0.7, 4.7]} />
          <meshStandardMaterial color={color} metalness={0.4} roughness={0.5} />
        </mesh>
        <mesh castShadow position={[0, 0.45, 1.45]}>
          <boxGeometry args={[1.95, 0.45, 1.7]} />
          <meshStandardMaterial color={color} metalness={0.4} roughness={0.5} />
        </mesh>
        <mesh castShadow position={[0, 0.75, 0.0]}>
          <boxGeometry args={[1.85, 0.9, 1.6]} />
          <meshStandardMaterial color={color} metalness={0.4} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.78, 0.05]}>
          <boxGeometry args={[1.7, 0.6, 1.4]} />
          <meshStandardMaterial color="#16252e" metalness={0.6} roughness={0.2} />
        </mesh>
        <mesh castShadow position={[0, 0.35, -1.7]}>
          <boxGeometry args={[2.0, 0.5, 1.5]} />
          <meshStandardMaterial color={color} metalness={0.4} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.05, -1.7]}>
          <boxGeometry args={[1.7, 0.2, 1.3]} />
          <meshStandardMaterial color="#2a2a2a" roughness={0.9} />
        </mesh>
        <mesh castShadow position={[0, -0.1, 2.45]}>
          <boxGeometry args={[2.05, 0.35, 0.3]} />
          <meshStandardMaterial color={spec.accent} metalness={0.7} roughness={0.4} />
        </mesh>
        {[-0.7, 0.7].map((x) => (
          <mesh key={x} position={[x, 0.2, 2.35]}>
            <boxGeometry args={[0.4, 0.25, 0.1]} />
            <meshStandardMaterial color="#fffbe0" emissive="#fff4c0" emissiveIntensity={0.6} />
          </mesh>
        ))}
        <mesh castShadow position={[0, 0.95, -1.05]}>
          <boxGeometry args={[1.9, 0.12, 0.12]} />
          <meshStandardMaterial color={spec.accent} metalness={0.6} roughness={0.4} />
        </mesh>
      </group>

      {/* ---- Wheels ---- */}
      {wheels.map((w, i) => (
        <group
          key={i}
          ref={(g) => {
            if (g) wheelGroups.current[i] = g;
          }}
          position={[w.x, w.y - spec.suspensionRest, w.z]}
        >
          <mesh
            ref={(m) => {
              if (m) wheelSpin.current[i] = m;
            }}
            castShadow
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[R, R, 0.4, 18]} />
            <meshStandardMaterial color="#1b1b1b" roughness={0.85} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[R * 0.36, R * 0.36, 0.42, 8]} />
            <meshStandardMaterial color="#9a9a9a" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      ))}
    </RigidBody>
  );
});

export default Truck;
