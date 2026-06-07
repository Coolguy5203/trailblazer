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
];

export function truckSpec(id: string): TruckSpec {
  return TRUCKS.find((t) => t.id === id) ?? TRUCKS[0];
}
