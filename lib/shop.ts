// Shop catalog. Prices MUST match the tb_purchase() SQL function.

export interface PaintOption {
  id: string;
  hex: string;
  name: string;
  price: number; // 0 = free/basic, always owned
}

// Basic paints are free and always available.
export const BASIC_PAINTS: PaintOption[] = [
  { id: "rust", hex: "#c8512e", name: "Rust", price: 0 },
  { id: "ocean", hex: "#2e6fc8", name: "Ocean", price: 0 },
  { id: "forest", hex: "#3ca35a", name: "Forest", price: 0 },
  { id: "sand", hex: "#d2a429", name: "Sand", price: 0 },
  { id: "grape", hex: "#7a5cd6", name: "Grape", price: 0 },
  { id: "steel", hex: "#b9bcc2", name: "Steel", price: 0 },
  { id: "shadow", hex: "#222831", name: "Shadow", price: 0 },
];

// Premium paints cost credits and persist in owned_paints.
export const PREMIUM_PAINTS: PaintOption[] = [
  { id: "midnight", hex: "#10203a", name: "Midnight", price: 250 },
  { id: "crimson", hex: "#6e1018", name: "Crimson", price: 300 },
  { id: "teal", hex: "#0f6f6a", name: "Teal", price: 300 },
  { id: "violet", hex: "#5b2a86", name: "Violet", price: 350 },
  { id: "arctic", hex: "#cfe8ff", name: "Arctic", price: 450 },
  { id: "gold", hex: "#c9a227", name: "Gold", price: 700 },
];

export const ALL_PAINTS = [...BASIC_PAINTS, ...PREMIUM_PAINTS];

export function paintHex(id: string): string {
  return ALL_PAINTS.find((p) => p.id === id)?.hex ?? BASIC_PAINTS[0].hex;
}

export interface TruckSpec {
  id: string;
  name: string;
  price: number; // 0 = stock, always owned
  blurb: string;
  // physics
  engine: number; // per-wheel engine force
  maxSpeed: number; // m/s soft cap
  mass: number;
  wheelRadius: number;
  suspensionRest: number;
  frictionSlip: number;
  // geometry
  trackWidth: number; // wheel |x|
  wheelbaseFront: number; // front wheel z
  wheelbaseRear: number; // rear wheel z magnitude
  bodyScale: [number, number, number]; // visual body group scale
  colliderHalf: [number, number, number];
  accent: string; // trim colour
  // display stats (0..1 bars)
  stats: { speed: number; grip: number; climb: number };
}

export const TRUCKS: TruckSpec[] = [
  {
    id: "stock",
    name: "Pathfinder",
    price: 0,
    blurb: "The balanced all-rounder. Great place to learn the trails.",
    engine: 1650,
    maxSpeed: 34,
    mass: 1400,
    wheelRadius: 0.62,
    suspensionRest: 0.55,
    frictionSlip: 3.4,
    trackWidth: 1.05,
    wheelbaseFront: 1.5,
    wheelbaseRear: 1.55,
    bodyScale: [1, 1, 1],
    colliderHalf: [1.0, 0.5, 2.35],
    accent: "#111111",
    stats: { speed: 0.6, grip: 0.6, climb: 0.6 },
  },
  {
    id: "mule",
    name: "Trail Mule",
    price: 600,
    blurb: "A dependable workhorse — a touch more grunt and grip than the starter.",
    engine: 1780,
    maxSpeed: 35,
    mass: 1500,
    wheelRadius: 0.64,
    suspensionRest: 0.56,
    frictionSlip: 3.5,
    trackWidth: 1.08,
    wheelbaseFront: 1.55,
    wheelbaseRear: 1.6,
    bodyScale: [1.06, 1.02, 1.06],
    colliderHalf: [1.06, 0.51, 2.42],
    accent: "#2b2b2b",
    stats: { speed: 0.62, grip: 0.68, climb: 0.66 },
  },
  {
    id: "scout",
    name: "Scout Buggy",
    price: 900,
    blurb: "A featherweight buggy — darty and quick, but light on climbing grip.",
    engine: 1700,
    maxSpeed: 44,
    mass: 1000,
    wheelRadius: 0.56,
    suspensionRest: 0.48,
    frictionSlip: 3.6,
    trackWidth: 1.16,
    wheelbaseFront: 1.45,
    wheelbaseRear: 1.5,
    bodyScale: [1.0, 0.72, 0.9],
    colliderHalf: [1.0, 0.38, 2.1],
    accent: "#ffcf33",
    stats: { speed: 0.9, grip: 0.78, climb: 0.45 },
  },
  {
    id: "sport",
    name: "Dust Runner",
    price: 1200,
    blurb: "Low, wide desert racer. Fast and grippy, light on its feet.",
    engine: 1850,
    maxSpeed: 42,
    mass: 1200,
    wheelRadius: 0.6,
    suspensionRest: 0.5,
    frictionSlip: 3.8,
    trackWidth: 1.2,
    wheelbaseFront: 1.55,
    wheelbaseRear: 1.62,
    bodyScale: [1.12, 0.82, 1.03],
    colliderHalf: [1.14, 0.42, 2.42],
    accent: "#e6e6e6",
    stats: { speed: 0.9, grip: 0.85, climb: 0.5 },
  },
  {
    id: "hauler",
    name: "Boulder",
    price: 2200,
    blurb: "Big, heavy crawler. Massive torque and clearance for the gnarly stuff.",
    engine: 2300,
    maxSpeed: 30,
    mass: 2000,
    wheelRadius: 0.74,
    suspensionRest: 0.62,
    frictionSlip: 3.6,
    trackWidth: 1.16,
    wheelbaseFront: 1.6,
    wheelbaseRear: 1.7,
    bodyScale: [1.15, 1.18, 1.12],
    colliderHalf: [1.12, 0.6, 2.6],
    accent: "#1a1a1a",
    stats: { speed: 0.45, grip: 0.7, climb: 0.95 },
  },
  {
    id: "juggernaut",
    name: "Juggernaut",
    price: 3200,
    blurb: "An absurd monster truck on huge tyres. Unstoppable uphill, slow to wind up.",
    engine: 2650,
    maxSpeed: 32,
    mass: 2400,
    wheelRadius: 0.86,
    suspensionRest: 0.7,
    frictionSlip: 3.7,
    trackWidth: 1.3,
    wheelbaseFront: 1.7,
    wheelbaseRear: 1.8,
    bodyScale: [1.25, 1.3, 1.18],
    colliderHalf: [1.22, 0.68, 2.7],
    accent: "#0d0d0d",
    stats: { speed: 0.42, grip: 0.74, climb: 1.0 },
  },
  {
    id: "vortex",
    name: "Vortex GT",
    price: 4500,
    blurb: "The flagship. Blistering speed, race-grade grip and no real weakness.",
    engine: 2150,
    maxSpeed: 47,
    mass: 1300,
    wheelRadius: 0.62,
    suspensionRest: 0.54,
    frictionSlip: 4.0,
    trackWidth: 1.2,
    wheelbaseFront: 1.55,
    wheelbaseRear: 1.6,
    bodyScale: [1.1, 0.84, 1.05],
    colliderHalf: [1.12, 0.45, 2.42],
    accent: "#bcd4ff",
    stats: { speed: 0.96, grip: 0.95, climb: 0.7 },
  },
];

export function truckSpec(id: string): TruckSpec {
  return TRUCKS.find((t) => t.id === id) ?? TRUCKS[0];
}
