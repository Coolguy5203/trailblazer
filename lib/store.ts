"use client";
import { create } from "zustand";

export type ControlScheme = "both" | "wasd" | "arrows";

export interface Profile {
  id: string;
  username: string;
  distance_m: number;
  jumps: number;
  airtime_s: number;
  playtime_s: number;
  credits: number;
}

interface GameState {
  // settings
  scheme: ControlScheme;
  setScheme: (s: ControlScheme) => void;

  // live telemetry (updated from physics each frame, read by HUD)
  speedKmh: number;
  airborne: boolean;
  altitude: number;
  setTelemetry: (t: { speedKmh: number; airborne: boolean; altitude: number }) => void;

  // session stats
  distanceM: number;
  jumps: number;
  bestAir: number;
  addDistance: (m: number) => void;
  addJump: (airtime: number) => void;
  resetSession: () => void;

  // app phase
  phase: "menu" | "driving";
  setPhase: (p: GameState["phase"]) => void;
}

export const useGame = create<GameState>((set) => ({
  scheme: "both",
  setScheme: (scheme) => set({ scheme }),

  speedKmh: 0,
  airborne: false,
  altitude: 0,
  setTelemetry: (t) => set({ speedKmh: t.speedKmh, airborne: t.airborne, altitude: t.altitude }),

  distanceM: 0,
  jumps: 0,
  bestAir: 0,
  addDistance: (m) => set((s) => ({ distanceM: s.distanceM + m })),
  addJump: (airtime) => set((s) => ({ jumps: s.jumps + 1, bestAir: Math.max(s.bestAir, airtime) })),
  resetSession: () => set({ distanceM: 0, jumps: 0, bestAir: 0 }),

  phase: "menu",
  setPhase: (phase) => set({ phase }),
}));
