"use client";
import { forwardRef, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CuboidCollider, useRapier, type RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { readInput } from "@/lib/input";
import { useGame } from "@/lib/store";

// Chassis-local wheel connection points (full-size pickup proportions).
const WHEELS = [
  { x: 1.05, y: -0.25, z: 1.5, steer: true }, // front-left
  { x: -1.05, y: -0.25, z: 1.5, steer: true }, // front-right
  { x: 1.05, y: -0.25, z: -1.55, steer: false }, // rear-left
  { x: -1.05, y: -0.25, z: -1.55, steer: false }, // rear-right
];
const WHEEL_RADIUS = 0.62; // taller tyres roll over obstacles more easily
const SUSPENSION_REST = 0.55; // more ride height = ground clearance for crawling
const MAX_STEER = 0.55;
const ENGINE_FORCE = 1350; // per driven wheel (4WD) — torque to climb
const MAX_SPEED = 30; // m/s (~108 km/h) soft cap

export interface TruckProps {
  spawn?: [number, number, number];
  color?: string;
  onFrame?: (pos: THREE.Vector3, quat: THREE.Quaternion, speedKmh: number) => void;
}

const Truck = forwardRef<RapierRigidBody, TruckProps>(function Truck(
  { spawn = [0, 3, 0], color = "#c8512e", onFrame },
  ref
) {
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

  // Build the raycast vehicle controller once the chassis body exists.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;

    // Drop the centre of mass well below the chassis and give it strong pitch/roll
    // inertia so engine torque at the contact patches can't flip the truck on
    // acceleration, while still leaving yaw responsive enough to steer.
    body.setAdditionalMassProperties(
      1400,
      { x: 0, y: -0.6, z: 0 }, // COM below the wheels
      { x: 3200, y: 2400, z: 2800 }, // inertia: x=pitch, y=yaw, z=roll
      { x: 0, y: 0, z: 0, w: 1 },
      true
    );

    const rawWorld: any = (world as any).raw ? (world as any).raw() : world;
    const controller = rawWorld.createVehicleController(body);
    const dir = { x: 0, y: -1, z: 0 };
    const axle = { x: -1, y: 0, z: 0 };
    WHEELS.forEach((w) => {
      controller.addWheel({ x: w.x, y: w.y, z: w.z }, dir, axle, SUSPENSION_REST, WHEEL_RADIUS);
    });
    for (let i = 0; i < WHEELS.length; i++) {
      controller.setWheelSuspensionStiffness(i, 28);
      controller.setWheelMaxSuspensionTravel(i, 0.8); // long travel keeps wheels on the ground over bumps
      controller.setWheelSuspensionCompression(i, 0.9);
      controller.setWheelSuspensionRelaxation(i, 0.95);
      controller.setWheelFrictionSlip(i, 3.4); // grip to crawl up rocks & steep faces
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
  }, [world]);

  useFrame((_, dtRaw) => {
    const controller = controllerRef.current;
    const body = bodyRef.current;
    if (!controller || !body) return;
    const dt = Math.min(dtRaw, 1 / 30);
    const input = readInput();

    // forward speed (signed) along chassis -Z is "forward" for our model
    const linvel = body.linvel();
    const speed = Math.hypot(linvel.x, linvel.y, linvel.z);

    // smoothed steering, tightened at speed
    const speedFactor = 1 - Math.min(0.6, speed / 40);
    const targetSteer = -input.steer * MAX_STEER * speedFactor;
    steerSmooth.current += (targetSteer - steerSmooth.current) * Math.min(1, dt * 8);

    // engine + brake
    let engine = 0;
    if (input.throttle !== 0 && speed < MAX_SPEED) engine = input.throttle * ENGINE_FORCE;
    let brake = 0;
    if (input.brake) brake = 80; // handbrake
    else if (input.throttle === 0) brake = 6; // gentle rolling resistance

    for (let i = 0; i < WHEELS.length; i++) {
      controller.setWheelEngineForce(i, engine);
      controller.setWheelBrake(i, brake);
      if (WHEELS[i].steer) controller.setWheelSteering(i, steerSmooth.current);
    }

    controller.updateVehicle(dt);

    // ---- visuals: place/roll wheels from the controller state ----
    let inContact = 0;
    rollAngle.current += (speed * (engine < 0 ? -1 : 1) * dt) / WHEEL_RADIUS;
    for (let i = 0; i < WHEELS.length; i++) {
      const g = wheelGroups.current[i];
      if (g) {
        const susp = controller.wheelSuspensionLength?.(i) ?? SUSPENSION_REST;
        g.position.set(WHEELS[i].x, WHEELS[i].y - susp, WHEELS[i].z);
        g.rotation.y = WHEELS[i].steer ? controller.wheelSteering?.(i) ?? 0 : 0;
      }
      const spin = wheelSpin.current[i];
      if (spin) spin.rotation.x = rollAngle.current;
      if (controller.wheelIsInContact?.(i)) inContact++;
    }

    // airborne + jump tracking
    const airborne = inContact === 0;
    const now = performance.now() / 1000;
    if (airborne && !wasAir.current) airStart.current = now;
    if (!airborne && wasAir.current) {
      const airtime = now - airStart.current;
      if (airtime > 0.45) addJump(airtime);
    }
    wasAir.current = airborne;

    // recover / flip-back
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

    // telemetry + distance
    const t = body.translation();
    const pos = new THREE.Vector3(t.x, t.y, t.z);
    if (lastPos.current.lengthSq() > 0) {
      const d = pos.distanceTo(lastPos.current);
      if (d < 5) addDistance(d); // ignore teleport jumps
    }
    lastPos.current.copy(pos);

    const speedKmh = speed * 3.6;
    setTelemetry({ speedKmh, airborne, altitude: t.y });

    if (onFrame) {
      const r = body.rotation();
      onFrame(pos, new THREE.Quaternion(r.x, r.y, r.z, r.w), speedKmh);
    }
  });

  return (
    <RigidBody
      ref={(r) => {
        bodyRef.current = r;
        if (typeof ref === "function") ref(r);
        else if (ref) (ref as any).current = r;
      }}
      colliders={false}
      position={spawn}
      canSleep={false}
      linearDamping={0.05}
      angularDamping={0.5}
      friction={0.9}
    >
      {/* chassis collider (mass concentrated low for stability) */}
      <CuboidColliderLow />

      {/* ---- Truck body (full-size pickup, built from primitives) ---- */}
      <group>
        {/* lower body / frame */}
        <mesh castShadow position={[0, 0, 0]}>
          <boxGeometry args={[2.0, 0.7, 4.7]} />
          <meshStandardMaterial color={color} metalness={0.4} roughness={0.5} />
        </mesh>
        {/* hood */}
        <mesh castShadow position={[0, 0.45, 1.45]}>
          <boxGeometry args={[1.95, 0.45, 1.7]} />
          <meshStandardMaterial color={color} metalness={0.4} roughness={0.5} />
        </mesh>
        {/* cab */}
        <mesh castShadow position={[0, 0.75, 0.0]}>
          <boxGeometry args={[1.85, 0.9, 1.6]} />
          <meshStandardMaterial color={color} metalness={0.4} roughness={0.5} />
        </mesh>
        {/* greenhouse / windows */}
        <mesh position={[0, 0.78, 0.05]}>
          <boxGeometry args={[1.7, 0.6, 1.4]} />
          <meshStandardMaterial color="#16252e" metalness={0.6} roughness={0.2} />
        </mesh>
        {/* bed walls */}
        <mesh castShadow position={[0, 0.35, -1.7]}>
          <boxGeometry args={[2.0, 0.5, 1.5]} />
          <meshStandardMaterial color={color} metalness={0.4} roughness={0.5} />
        </mesh>
        {/* bed floor (lower so it reads as an open bed) */}
        <mesh position={[0, 0.05, -1.7]}>
          <boxGeometry args={[1.7, 0.2, 1.3]} />
          <meshStandardMaterial color="#2a2a2a" roughness={0.9} />
        </mesh>
        {/* front bumper */}
        <mesh castShadow position={[0, -0.1, 2.45]}>
          <boxGeometry args={[2.05, 0.35, 0.3]} />
          <meshStandardMaterial color="#222" metalness={0.7} roughness={0.4} />
        </mesh>
        {/* headlights */}
        {[-0.7, 0.7].map((x) => (
          <mesh key={x} position={[x, 0.2, 2.35]}>
            <boxGeometry args={[0.4, 0.25, 0.1]} />
            <meshStandardMaterial color="#fffbe0" emissive="#fff4c0" emissiveIntensity={0.6} />
          </mesh>
        ))}
        {/* roll-bar over bed */}
        <mesh castShadow position={[0, 0.95, -1.05]}>
          <boxGeometry args={[1.9, 0.12, 0.12]} />
          <meshStandardMaterial color="#111" metalness={0.6} roughness={0.4} />
        </mesh>
      </group>

      {/* ---- Wheels ---- */}
      {WHEELS.map((w, i) => (
        <group
          key={i}
          ref={(g) => {
            if (g) wheelGroups.current[i] = g;
          }}
          position={[w.x, w.y - SUSPENSION_REST, w.z]}
        >
          <mesh
            ref={(m) => {
              if (m) wheelSpin.current[i] = m;
            }}
            castShadow
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[WHEEL_RADIUS, WHEEL_RADIUS, 0.4, 18]} />
            <meshStandardMaterial color="#1b1b1b" roughness={0.85} />
          </mesh>
          {/* hub */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.22, 0.22, 0.42, 8]} />
            <meshStandardMaterial color="#9a9a9a" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      ))}
    </RigidBody>
  );
});

function CuboidColliderLow() {
  return <CuboidCollider args={[1.0, 0.5, 2.35]} position={[0, 0.1, 0]} />;
}

export default Truck;
