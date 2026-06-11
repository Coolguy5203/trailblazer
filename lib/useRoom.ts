"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { RemotePlayer } from "@/components/Scene";

const PALETTE = ["#c8512e", "#2e7dc8", "#3ca35a", "#b03ca3", "#d2a429", "#2eb5b5", "#d94f6e", "#7a5cd6"];

export function colorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

interface Pose {
  pos: [number, number, number];
  quat: [number, number, number, number];
  t: number;
}

export interface RoomApi {
  code: string | null;
  isHost: boolean;
  remotes: RemotePlayer[];
  memberCount: number;
  create: (name: string) => Promise<string>;
  join: (code: string, name: string) => Promise<void>;
  leave: () => void;
  sendPose: (pos: [number, number, number], quat: [number, number, number, number]) => void;
  // what our truck looks like (broadcast with each pose so friends see the real rig)
  setIdentity: (paintHex: string, truckId: string) => void;
  sendEmote: (emoji: string) => void;
}

export function useRoom(): RoomApi {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const clientId = useRef<string>(Math.random().toString(36).slice(2));
  const posesRef = useRef<Map<string, RemotePlayer>>(new Map());
  const namesRef = useRef<Map<string, string>>(new Map());
  const identityRef = useRef<{ color: string; truckId: string }>({ color: "#c8512e", truckId: "stock" });
  const lastSend = useRef(0);
  const hostRef = useRef(false);
  const heartbeat = useRef<ReturnType<typeof setInterval> | null>(null);

  const [code, setCode] = useState<string | null>(null);
  const [remotes, setRemotes] = useState<RemotePlayer[]>([]);
  const [memberCount, setMemberCount] = useState(1);

  // flush poses → React state at ~16fps (decoupled from broadcast rate)
  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      const list: RemotePlayer[] = [];
      posesRef.current.forEach((rp, id) => {
        if (id === clientId.current) return;
        list.push(rp);
      });
      setRemotes(list);
      setMemberCount(1 + list.length);
      void now;
    }, 60);
    return () => clearInterval(iv);
  }, []);

  const teardown = useCallback(() => {
    if (heartbeat.current) clearInterval(heartbeat.current);
    heartbeat.current = null;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (hostRef.current && code) {
      void supabase.from("tb_public_rooms").delete().eq("code", code);
    }
    posesRef.current.clear();
    namesRef.current.clear();
  }, [code]);

  const connect = useCallback(
    async (roomCode: string, name: string, host: boolean) => {
      teardown();
      hostRef.current = host;
      namesRef.current.set(clientId.current, name);

      const channel = supabase.channel(`room-${roomCode}`, {
        config: { broadcast: { self: false }, presence: { key: clientId.current } },
      });

      channel.on("broadcast", { event: "pose" }, ({ payload }) => {
        const p = payload as { id: string; name: string; color?: string; truckId?: string; pose: Pose };
        const prev = posesRef.current.get(p.id);
        posesRef.current.set(p.id, {
          id: p.id,
          name: p.name,
          color: p.color ?? colorFor(p.id),
          truckId: p.truckId ?? "stock",
          pos: p.pose.pos,
          quat: p.pose.quat,
          emote: prev?.emote,
          emoteAt: prev?.emoteAt,
        });
      });

      channel.on("broadcast", { event: "emote" }, ({ payload }) => {
        const p = payload as { id: string; emoji: string };
        const prev = posesRef.current.get(p.id);
        if (prev) posesRef.current.set(p.id, { ...prev, emote: p.emoji, emoteAt: Date.now() });
      });

      channel.on("presence", { event: "leave" }, ({ leftPresences }) => {
        for (const pr of leftPresences as any[]) {
          const id = pr.id ?? pr.key;
          if (id) posesRef.current.delete(id);
        }
      });

      await new Promise<void>((resolve) => {
        channel.subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel.track({ id: clientId.current, name });
            resolve();
          }
        });
      });

      channelRef.current = channel;
      setCode(roomCode);

      if (host) {
        const upsert = async () => {
          await supabase.from("tb_public_rooms").upsert({
            code: roomCode,
            host_name: name,
            players: posesRef.current.size + 1,
            updated_at: new Date().toISOString(),
          });
        };
        await upsert();
        heartbeat.current = setInterval(upsert, 8000);
      }
    },
    [teardown]
  );

  const create = useCallback(
    async (name: string) => {
      const c = makeCode();
      await connect(c, name, true);
      return c;
    },
    [connect]
  );

  const join = useCallback(
    async (c: string, name: string) => {
      await connect(c.toUpperCase().trim(), name, false);
    },
    [connect]
  );

  const leave = useCallback(() => {
    teardown();
    setCode(null);
    setRemotes([]);
    setMemberCount(1);
  }, [teardown]);

  const sendPose = useCallback(
    (pos: [number, number, number], quat: [number, number, number, number]) => {
      const ch = channelRef.current;
      if (!ch) return;
      const now = performance.now();
      if (now - lastSend.current < 80) return; // ~12 Hz
      lastSend.current = now;
      ch.send({
        type: "broadcast",
        event: "pose",
        payload: {
          id: clientId.current,
          name: namesRef.current.get(clientId.current),
          color: identityRef.current.color,
          truckId: identityRef.current.truckId,
          pose: { pos, quat, t: now },
        },
      });
    },
    []
  );

  const setIdentity = useCallback((color: string, truckId: string) => {
    identityRef.current = { color, truckId };
  }, []);

  const sendEmote = useCallback((emoji: string) => {
    const ch = channelRef.current;
    if (!ch) return;
    ch.send({ type: "broadcast", event: "emote", payload: { id: clientId.current, emoji } });
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  return { code, isHost: hostRef.current, remotes, memberCount, create, join, leave, sendPose, setIdentity, sendEmote };
}

export async function browsePublicRooms() {
  const cutoff = new Date(Date.now() - 30000).toISOString();
  const { data } = await supabase
    .from("tb_public_rooms")
    .select("code, host_name, players, updated_at")
    .gt("updated_at", cutoff)
    .order("updated_at", { ascending: false })
    .limit(20);
  return data ?? [];
}
