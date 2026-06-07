"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type * as THREE from "three";
import { useGame, type Profile, type ControlScheme } from "@/lib/store";
import { signIn, signUp, signOut, loadCurrentProfile, saveStats } from "@/lib/profile";
import { useRoom, browsePublicRooms } from "@/lib/useRoom";
import { creditsEarned, formatCredits, CREDIT_SYMBOL } from "@/lib/economy";
import HUD from "@/components/HUD";

const Scene = dynamic(() => import("@/components/Scene"), { ssr: false });

const TRUCK_COLORS = ["#c8512e", "#2e6fc8", "#3ca35a", "#d2a429", "#7a5cd6", "#b9bcc2", "#222831"];

type Screen = "auth" | "menu" | "driving";

export default function Page() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [screen, setScreen] = useState<Screen>("auth");
  const [booted, setBooted] = useState(false);
  const [color, setColor] = useState(TRUCK_COLORS[0]);
  const [lastEarned, setLastEarned] = useState<number | null>(null);

  const room = useRoom();
  const scheme = useGame((s) => s.scheme);
  const setScheme = useGame((s) => s.setScheme);
  const resetSession = useGame((s) => s.resetSession);

  // restore session on load
  useEffect(() => {
    loadCurrentProfile().then((p) => {
      if (p) {
        setProfile(p);
        setScreen("menu");
      }
      setBooted(true);
    });
  }, []);

  const sessionStart = useRef(0);
  const startSession = useCallback(() => {
    resetSession();
    setLastEarned(null);
    sessionStart.current = performance.now();
    setScreen("driving");
  }, [resetSession]);

  const onLeaveDriving = useCallback(async () => {
    room.leave();
    const st = useGame.getState();
    setLastEarned(creditsEarned(st.distanceM, st.jumps));
    const playtime = (performance.now() - sessionStart.current) / 1000;
    try {
      await saveStats({ distance_m: st.distanceM, jumps: st.jumps, airtime_s: st.bestAir, playtime_s: playtime });
      const p = await loadCurrentProfile();
      if (p) setProfile(p);
    } catch {
      /* stats save is best-effort */
    }
    setScreen("menu");
  }, [room]);

  // broadcast our pose to the lobby when in a room
  const onFrame = useCallback(
    (pos: THREE.Vector3, quat: THREE.Quaternion) => {
      if (room.code) {
        room.sendPose([pos.x, pos.y, pos.z], [quat.x, quat.y, quat.z, quat.w]);
      }
    },
    [room]
  );

  if (!booted) {
    return <div className="grid h-screen place-items-center bg-stone-900 text-stone-400">Loading…</div>;
  }

  if (screen === "driving") {
    return (
      <main className="relative h-screen w-screen overflow-hidden bg-[#bcd4e6]">
        <Scene color={color} remotes={room.remotes} onFrame={onFrame} />
        <HUD roomCode={room.code ?? undefined} />
        {room.code && (
          <div className="pointer-events-none absolute right-6 top-6 rounded-lg bg-black/35 px-3 py-2 text-sm text-white backdrop-blur">
            {room.memberCount} driver{room.memberCount === 1 ? "" : "s"} online
          </div>
        )}
        <button
          onClick={onLeaveDriving}
          className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-black/45 px-5 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-black/65"
        >
          ‹ Garage
        </button>
      </main>
    );
  }

  return (
    <main className="h-screen overflow-y-auto bg-gradient-to-b from-stone-800 via-stone-900 to-black text-stone-100">
      <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-10">
        <Header />
        {screen === "auth" ? (
          <AuthForm
            onAuthed={(p) => {
              setProfile(p);
              setScreen("menu");
            }}
          />
        ) : (
          <Menu
            profile={profile!}
            lastEarned={lastEarned}
            color={color}
            setColor={setColor}
            scheme={scheme}
            setScheme={setScheme}
            room={room}
            onPlay={startSession}
            onSignOut={async () => {
              await signOut();
              setProfile(null);
              setScreen("auth");
            }}
          />
        )}
      </div>
    </main>
  );
}

function Header() {
  return (
    <div className="mb-8 text-center">
      <h1 className="bg-gradient-to-r from-amber-300 to-orange-500 bg-clip-text text-5xl font-black tracking-tight text-transparent">
        TRAILBLAZER
      </h1>
      <p className="mt-1 text-sm text-stone-400">Off-road. Off-grid. All terrain.</p>
    </div>
  );
}

function AuthForm({ onAuthed }: { onAuthed: (p: Profile) => void }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const p = mode === "in" ? await signIn(username, password) : await signUp(username, password);
      onAuthed(p);
    } catch (e: any) {
      setErr(e.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl bg-stone-800/60 p-6 ring-1 ring-white/10">
      <div className="flex rounded-lg bg-stone-900 p-1 text-sm font-semibold">
        {(["in", "up"] as const).map((m) => (
          <button
            type="button"
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 rounded-md py-2 transition ${mode === m ? "bg-amber-500 text-black" : "text-stone-400"}`}
          >
            {m === "in" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>
      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Username"
        autoCapitalize="none"
        className="w-full rounded-lg bg-stone-900 px-4 py-3 outline-none ring-1 ring-white/10 focus:ring-amber-500"
      />
      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        type="password"
        placeholder="Password"
        className="w-full rounded-lg bg-stone-900 px-4 py-3 outline-none ring-1 ring-white/10 focus:ring-amber-500"
      />
      {err && <p className="text-sm text-red-400">{err}</p>}
      <button
        disabled={busy}
        className="w-full rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 py-3 font-bold text-black transition hover:brightness-110 disabled:opacity-50"
      >
        {busy ? "…" : mode === "in" ? "Sign in" : "Create account & play"}
      </button>
      <p className="text-center text-xs text-stone-500">An account is required to play. No email needed.</p>
    </form>
  );
}

function Menu({
  profile,
  lastEarned,
  color,
  setColor,
  scheme,
  setScheme,
  room,
  onPlay,
  onSignOut,
}: {
  profile: Profile;
  lastEarned: number | null;
  color: string;
  setColor: (c: string) => void;
  scheme: ControlScheme;
  setScheme: (s: ControlScheme) => void;
  room: ReturnType<typeof useRoom>;
  onPlay: () => void;
  onSignOut: () => void;
}) {
  const [joinCode, setJoinCode] = useState("");
  const [rooms, setRooms] = useState<{ code: string; host_name: string; players: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(() => {
    browsePublicRooms().then((r) => setRooms(r as any));
  }, []);
  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 6000);
    return () => clearInterval(iv);
  }, [refresh]);

  const hostLobby = async () => {
    setBusy(true);
    setErr(null);
    try {
      await room.create(profile.username);
      onPlay();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const joinLobby = async (code: string) => {
    if (!code) return;
    setBusy(true);
    setErr(null);
    try {
      await room.join(code, profile.username);
      onPlay();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-stone-800/60 px-4 py-3 ring-1 ring-white/10">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold">{profile.username}</div>
            <div className="text-xs text-stone-400">
              {(profile.distance_m / 1000).toFixed(1)} km driven · {profile.jumps} jumps
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-500/15 px-3 py-1.5 text-right ring-1 ring-amber-400/30">
              <div className="font-mono text-lg font-bold leading-none text-amber-300">
                {CREDIT_SYMBOL} {formatCredits(profile.credits)}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-amber-200/60">credits</div>
            </div>
            <button onClick={onSignOut} className="text-xs text-stone-400 underline hover:text-stone-200">
              Sign out
            </button>
          </div>
        </div>
        {lastEarned !== null && lastEarned > 0 && (
          <div className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-center text-sm text-amber-200 ring-1 ring-amber-400/20">
            Last run earned <span className="font-bold">{CREDIT_SYMBOL} {formatCredits(lastEarned)}</span> credits
          </div>
        )}
      </div>

      {/* truck color */}
      <div className="rounded-xl bg-stone-800/60 p-4 ring-1 ring-white/10">
        <div className="mb-2 text-sm font-semibold text-stone-300">Truck paint</div>
        <div className="flex gap-2">
          {TRUCK_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{ background: c }}
              className={`h-8 w-8 rounded-full ring-2 transition ${color === c ? "ring-amber-400" : "ring-transparent"}`}
            />
          ))}
        </div>
      </div>

      {/* controls */}
      <div className="rounded-xl bg-stone-800/60 p-4 ring-1 ring-white/10">
        <div className="mb-2 text-sm font-semibold text-stone-300">Controls</div>
        <div className="flex rounded-lg bg-stone-900 p-1 text-sm">
          {(["both", "wasd", "arrows"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScheme(s)}
              className={`flex-1 rounded-md py-2 capitalize transition ${scheme === s ? "bg-amber-500 text-black" : "text-stone-400"}`}
            >
              {s === "both" ? "WASD + Arrows" : s}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onPlay}
        className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 py-4 text-lg font-black text-black shadow-lg transition hover:brightness-110"
      >
        ▶ FREE ROAM
      </button>

      {/* multiplayer */}
      <div className="rounded-xl bg-stone-800/60 p-4 ring-1 ring-white/10">
        <div className="mb-3 text-sm font-semibold text-stone-300">Play with friends</div>
        <button
          onClick={hostLobby}
          disabled={busy}
          className="mb-3 w-full rounded-lg bg-stone-700 py-3 font-semibold transition hover:bg-stone-600 disabled:opacity-50"
        >
          Create public lobby
        </button>
        <div className="flex gap-2">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="ENTER CODE"
            maxLength={5}
            className="flex-1 rounded-lg bg-stone-900 px-4 py-3 text-center font-mono tracking-widest outline-none ring-1 ring-white/10 focus:ring-amber-500"
          />
          <button
            onClick={() => joinLobby(joinCode)}
            disabled={busy || joinCode.length < 4}
            className="rounded-lg bg-amber-500 px-5 font-bold text-black transition hover:brightness-110 disabled:opacity-40"
          >
            Join
          </button>
        </div>

        {rooms.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="text-xs uppercase tracking-wide text-stone-500">Public lobbies</div>
            {rooms.map((r) => (
              <button
                key={r.code}
                onClick={() => joinLobby(r.code)}
                disabled={busy}
                className="flex w-full items-center justify-between rounded-lg bg-stone-900 px-4 py-2 text-sm transition hover:bg-stone-700"
              >
                <span>
                  <span className="font-mono font-bold tracking-widest text-amber-300">{r.code}</span>
                  <span className="ml-2 text-stone-400">{r.host_name}</span>
                </span>
                <span className="text-stone-400">{r.players} 🚙</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {err && <p className="text-center text-sm text-red-400">{err}</p>}
    </div>
  );
}
