"use client";
import type { ControlScheme } from "./store";

// Shared mutable input snapshot, read every physics frame.
export interface InputState {
  throttle: number; // -1 (reverse) .. 1 (forward)
  steer: number; // -1 (left) .. 1 (right)
  brake: boolean; // handbrake
  reset: boolean; // recover/flip request
}

const pressed = new Set<string>();
let scheme: ControlScheme = "both";

// Virtual input from on-screen touch controls, merged with the keyboard.
const touch = { throttle: 0, steer: 0, brake: false, reset: false };
export function setTouchInput(t: Partial<typeof touch>) {
  Object.assign(touch, t);
}

export function setScheme(s: ControlScheme) {
  scheme = s;
}

function clamp(v: number) {
  return Math.max(-1, Math.min(1, v));
}

const wasd = { up: "keyw", down: "keys", left: "keya", right: "keyd" };
const arrows = { up: "arrowup", down: "arrowdown", left: "arrowleft", right: "arrowright" };

function on(set: { up: string; down: string; left: string; right: string }) {
  return {
    up: pressed.has(set.up),
    down: pressed.has(set.down),
    left: pressed.has(set.left),
    right: pressed.has(set.right),
  };
}

export function readInput(): InputState {
  const w = scheme === "arrows" ? { up: false, down: false, left: false, right: false } : on(wasd);
  const a = scheme === "wasd" ? { up: false, down: false, left: false, right: false } : on(arrows);
  const up = w.up || a.up;
  const down = w.down || a.down;
  const left = w.left || a.left;
  const right = w.right || a.right;
  return {
    throttle: clamp((up ? 1 : 0) - (down ? 1 : 0) + touch.throttle),
    steer: clamp((right ? 1 : 0) - (left ? 1 : 0) + touch.steer),
    brake: pressed.has("space") || touch.brake,
    reset: pressed.has("keyr") || touch.reset,
  };
}

let attached = false;
export function attachInput() {
  if (attached || typeof window === "undefined") return () => {};
  attached = true;
  const norm = (e: KeyboardEvent) => e.code.toLowerCase();
  const down = (e: KeyboardEvent) => {
    const k = norm(e);
    // prevent page scroll on arrows / space while driving
    if (k.startsWith("arrow") || k === "space") e.preventDefault();
    pressed.add(k);
  };
  const up = (e: KeyboardEvent) => pressed.delete(norm(e));
  const blur = () => pressed.clear();
  window.addEventListener("keydown", down, { passive: false });
  window.addEventListener("keyup", up);
  window.addEventListener("blur", blur);
  return () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("blur", blur);
    attached = false;
  };
}
