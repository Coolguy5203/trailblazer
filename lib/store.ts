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
  owned_paints: string[];
  owned_trucks: string[];
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

  // current named region the player is in (null = backcountry/wilds)
  regionId: string | null;
  setRegionId: (id: string | null) => void;

  // --- time-trial run state ---
  courseId: string | null; // active course (null = free roam)
  cpIndex: number; // next checkpoint to hit (0 = start line)
  cpCount: number;
  runState: "ready" | "running" | "finished";
  startMs: number;
  elapsedMs: number;
  bestMs: number | null;
  cpBearing: number; // radians, signed angle from truck heading to next checkpoint
  startCourse: (id: string, cpCount: number, bestMs: number | null) => void;
  passCheckpoint: (now: number) => void;
  tickElapsed: (now: number) => void;
  setBearing: (b: number) => void;
  exitCourse: () => void;

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

  regionId: null,
  setRegionId: (regionId) => set({ regionId }),

  courseId: null,
  cpIndex: 0,
  cpCount: 0,
  runState: "ready",
  startMs: 0,
  elapsedMs: 0,
  bestMs: null,
  cpBearing: 0,
  startCourse: (courseId, cpCount, bestMs) =>
    set({ courseId, cpCount, bestMs, cpIndex: 0, runState: "ready", startMs: 0, elapsedMs: 0, cpBearing: 0 }),
  passCheckpoint: (now) =>
    set((s) => {
      if (!s.courseId || s.runState === "finished") return {};
      if (s.cpIndex === 0) return { runState: "running", startMs: now, cpIndex: 1 };
      if (s.cpIndex < s.cpCount - 1) return { cpIndex: s.cpIndex + 1 };
      return { cpIndex: s.cpCount, runState: "finished", elapsedMs: now - s.startMs };
    }),
  tickElapsed: (now) => set((s) => (s.runState === "running" ? { elapsedMs: now - s.startMs } : {})),
  setBearing: (cpBearing) => set({ cpBearing }),
  exitCourse: () => set({ courseId: null, cpIndex: 0, cpCount: 0, runState: "ready", elapsedMs: 0, bestMs: null }),

  phase: "menu",
  setPhase: (phase) => set({ phase }),
}));
