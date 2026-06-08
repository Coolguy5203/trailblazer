"use client";
import { supabase, SUPABASE_URL, EMAIL_DOMAIN } from "./supabase";
import type { Profile } from "./store";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,16}$/;

function emailFor(username: string) {
  return `${username.toLowerCase()}@${EMAIL_DOMAIN}`;
}

export function validateUsername(u: string): string | null {
  if (!USERNAME_RE.test(u)) return "3–16 letters, numbers or underscores.";
  return null;
}

export async function signUp(username: string, password: string): Promise<Profile> {
  const err = validateUsername(username);
  if (err) throw new Error(err);
  if (password.length < 6) throw new Error("Password must be at least 6 characters.");

  // The edge function creates an auto-confirmed user + profile row (no real email).
  const res = await fetch(`${SUPABASE_URL}/functions/v1/tb-auth-signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "Sign-up failed.");

  return signIn(username, password);
}

export async function signIn(username: string, password: string): Promise<Profile> {
  const { error } = await supabase.auth.signInWithPassword({
    email: emailFor(username),
    password,
  });
  if (error) throw new Error("Wrong username or password.");
  const p = await loadCurrentProfile();
  if (!p) throw new Error("Profile not found.");
  return p;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function loadCurrentProfile(): Promise<Profile | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase
    .from("tb_profiles")
    .select("id, username, distance_m, jumps, airtime_s, playtime_s, credits, owned_paints, owned_trucks")
    .eq("id", auth.user.id)
    .single();
  if (error || !data) return null;
  return data as Profile;
}

// Server-authoritative purchase. Returns the new credit balance.
// Throws a friendly message on failure (too poor / already owned / unknown).
export async function purchaseItem(kind: "paint" | "truck", id: string): Promise<number> {
  const { data, error } = await supabase.rpc("tb_purchase", { p_kind: kind, p_id: id });
  if (error) {
    const m = error.message || "";
    if (m.includes("insufficient")) throw new Error("Not enough credits.");
    if (m.includes("already")) throw new Error("You already own this.");
    throw new Error("Purchase failed.");
  }
  return data as number;
}

// Record a time-trial finish (server validates + awards credits).
export interface CourseResult {
  awarded: number;
  is_pb: boolean;
  best_ms: number;
}
export async function finishCourse(courseId: string, ms: number): Promise<CourseResult> {
  const { data, error } = await supabase.rpc("tb_finish_course", { p_course: courseId, p_ms: Math.round(ms) });
  if (error) throw new Error("Could not save your time.");
  return data as CourseResult;
}

// This player's best time per course → { courseId: best_ms }.
export async function myCourseTimes(): Promise<Record<string, number>> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return {};
  const { data } = await supabase
    .from("tb_course_times")
    .select("course_id, best_ms")
    .eq("profile_id", auth.user.id);
  const out: Record<string, number> = {};
  (data ?? []).forEach((r: any) => (out[r.course_id] = r.best_ms));
  return out;
}

export async function courseLeaderboard(courseId: string): Promise<{ username: string; best_ms: number }[]> {
  const { data } = await supabase
    .from("tb_course_times")
    .select("username, best_ms")
    .eq("course_id", courseId)
    .order("best_ms", { ascending: true })
    .limit(10);
  return (data ?? []) as { username: string; best_ms: number }[];
}

// Persist accumulated session stats to the player's profile.
export async function saveStats(delta: {
  distance_m: number;
  jumps: number;
  airtime_s: number;
  playtime_s: number;
}) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  // server-side increment via RPC keeps it race-safe and avoids read-modify-write
  await supabase.rpc("tb_bump_stats", {
    d_distance: Math.round(delta.distance_m),
    d_jumps: delta.jumps,
    d_airtime: Math.round(delta.airtime_s),
    d_playtime: Math.round(delta.playtime_s),
  });
}
