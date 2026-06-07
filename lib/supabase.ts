"use client";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anon, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export const SUPABASE_URL = url;
// Synthetic email domain — accounts are username + password, no real email needed.
export const EMAIL_DOMAIN = "trailblazer.app";
