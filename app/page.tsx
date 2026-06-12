"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type * as THREE from "three";
import { useGame, type Profile, type ControlScheme } from "@/lib/store";
import { signIn, signUp, signOut, loadCurrentProfile, saveStats, purchaseItem } from "@/lib/profile";
import { finishCourse, myCourseTimes, courseLeaderboard, type CourseResult } from "@/lib/profile";
import { useRoom, browsePublicRooms } from "@/lib/useRoom";
import { creditsEarned, formatCredits, CREDIT_SYMBOL } from "@/lib/economy";
import { BASIC_PAINTS, PREMIUM_PAINTS, TRUCKS, paintHex, type PaintOption } from "@/lib/shop";
import { regionAt, regionInfo } from "@/lib/regions";
import { COURSES, course as getCourse, checkpointY, formatTime, type Course } from "@/lib/courses";
import { CHAPTERS, chapter as getChapter, objectiveGoal, type Chapter } from "@/lib/story";
import { completeChapter } from "@/lib/profile";
import HUD from "@/components/HUD";
import TouchControls from "@/components/TouchControls";
import Minimap from "@/components/Minimap";

const STORY_COLOR = "#5ad1ff";

const Scene = dynamic(() => import("@/components/Scene"), { ssr: false });

type Screen = "landing" | "auth" | "menu" | "driving";

export default function Page() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [screen, setScreen] = useState<Screen>("landing");
  const [booted, setBooted] = useState(false);
  const [paintId, setPaintId] = useState("rust");
  const [truckId, setTruckId] = useState("stock");
  const [lastEarned, setLastEarned] = useState<number | null>(null);
  const [spawn, setSpawn] = useState<[number, number, number]>([0, 3, 0]);
  const [spawnYaw, setSpawnYaw] = useState(0);
  const [courseResult, setCourseResult] = useState<CourseResult | null>(null);
  const [courseTimes, setCourseTimes] = useState<Record<string, number>>({});

  const room = useRoom();
  const scheme = useGame((s) => s.scheme);
  const setScheme = useGame((s) => s.setScheme);
  const resetSession = useGame((s) => s.resetSession);
  const setRegionId = useGame((s) => s.setRegionId);
  const startCourseStore = useGame((s) => s.startCourse);
  const exitCourseStore = useGame((s) => s.exitCourse);
  const runState = useGame((s) => s.runState);
  const activeCourseId = useGame((s) => s.courseId);
  const cpIndexLive = useGame((s) => s.cpIndex);
  const activeCourse = getCourse(activeCourseId);
  const startStoryStore = useGame((s) => s.startStory);
  const exitStoryStore = useGame((s) => s.exitStory);
  const storyChapterN = useGame((s) => s.storyChapter);
  const storyDone = useGame((s) => s.storyDone);
  const storyStep = useGame((s) => s.storyStep);
  const storyHits = useGame((s) => s.storyHits);
  const activeChapter = getChapter(storyChapterN);
  const [storyResult, setStoryResult] = useState<{ awarded: number } | null>(null);
  const [briefing, setBriefing] = useState<Chapter | null>(null);
  const storyPhase = useGame((s) => s.storyPhase);
  const phaseDone = useGame((s) => s.phaseDone);
  const advancePhase = useGame((s) => s.advancePhase);
  const finishStory = useGame((s) => s.finishStory);

  // a phase finished → advance to the next objective, or complete the chapter
  useEffect(() => {
    if (!phaseDone || !activeChapter) return;
    const next = activeChapter.objectives[storyPhase + 1];
    if (next) advancePhase(objectiveGoal(next));
    else finishStory();
  }, [phaseDone, activeChapter, storyPhase, advancePhase, finishStory]);

  // restore session on load
  useEffect(() => {
    loadCurrentProfile().then((p) => {
      if (p) {
        setProfile(p);
        setScreen("menu");
      } else {
        setScreen("landing");
      }
      setBooted(true);
    });
  }, []);

  // reload best times whenever we return to the menu with a profile
  useEffect(() => {
    if (screen === "menu" && profile) myCourseTimes().then(setCourseTimes);
  }, [screen, profile]);

  // keep the lobby informed of what our truck looks like
  useEffect(() => {
    room.setIdentity(paintHex(paintId), truckId);
  }, [room, paintId, truckId]);

  const sessionStart = useRef(0);
  const lastMap = useRef(0);
  const startSession = useCallback(() => {
    resetSession();
    exitCourseStore();
    exitStoryStore();
    setCourseResult(null);
    setStoryResult(null);
    setSpawn([-300, checkpointY(-300, -300) + 3, -300]); // Home Flats centre
    setSpawnYaw(0);
    setLastEarned(null);
    setRegionId(null); // so the first frame announces the region we spawn in
    sessionStart.current = performance.now();
    setScreen("driving");
  }, [resetSession, setRegionId, exitCourseStore, exitStoryStore]);

  const startChapter = useCallback(
    (c: Chapter) => {
      resetSession();
      exitCourseStore();
      setCourseResult(null);
      setStoryResult(null);
      setLastEarned(null);
      setRegionId(null);
      const [sx, sz] = c.spawn;
      setSpawn([sx, checkpointY(sx, sz) + 2.5, sz]);
      // face the first objective's first point
      const o = c.objectives[0];
      const tgt =
        o.kind === "reach" ? o.target : o.kind === "gates" || o.kind === "collect" ? o.points[0] : [sx, sz + 1];
      setSpawnYaw(Math.atan2(tgt[0] - sx, tgt[1] - sz));
      startStoryStore(c.n, objectiveGoal(o));
      setBriefing(c); // mission briefing overlay shown over the start
      sessionStart.current = performance.now();
      setScreen("driving");
    },
    [resetSession, setRegionId, exitCourseStore, startStoryStore]
  );

  const startChallenge = useCallback(
    (c: Course) => {
      resetSession();
      setCourseResult(null);
      setLastEarned(null);
      setRegionId(null);
      // spawn just behind the start gate, facing the second gate
      const [c0x, c0z] = c.checkpoints[0];
      const [c1x, c1z] = c.checkpoints[1];
      let fx = c1x - c0x,
        fz = c1z - c0z;
      const len = Math.hypot(fx, fz) || 1;
      fx /= len;
      fz /= len;
      const sx = c0x - fx * 11;
      const sz = c0z - fz * 11;
      setSpawn([sx, checkpointY(sx, sz) + 2.5, sz]);
      setSpawnYaw(Math.atan2(fx, fz));
      startCourseStore(c.id, c.checkpoints.length, courseTimes[c.id] ?? null);
      sessionStart.current = performance.now();
      setScreen("driving");
    },
    [resetSession, setRegionId, startCourseStore, courseTimes]
  );

  const onLeaveDriving = useCallback(async () => {
    room.leave();
    const st = useGame.getState();
    exitCourseStore();
    exitStoryStore();
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

  // broadcast our pose, detect region changes, and run the time-trial each frame
  const onFrame = useCallback(
    (pos: THREE.Vector3, quat: THREE.Quaternion) => {
      if (room.code) {
        room.sendPose([pos.x, pos.y, pos.z], [quat.x, quat.y, quat.z, quat.w]);
      }
      const st = useGame.getState();
      const rid = regionAt(pos.x, pos.z)?.id ?? "wilds";
      if (rid !== st.regionId) st.setRegionId(rid);

      // throttled minimap update (~10 Hz): yaw is the screen rotation of the
      // forward vector for a top-down map (x right, z down).
      const nowMs = performance.now();
      if (nowMs - lastMap.current > 90) {
        lastMap.current = nowMs;
        const fwx = 2 * (quat.x * quat.z + quat.w * quat.y);
        const fwz = 1 - 2 * (quat.x * quat.x + quat.y * quat.y);
        st.setMapPos({ x: pos.x, z: pos.z, yaw: Math.atan2(fwx, -fwz) });
        // arrived at the picked destination → clear it
        if (st.destination && Math.hypot(pos.x - st.destination.x, pos.z - st.destination.z) < 30) {
          st.setDestination(null);
        }
      }

      if (st.courseId && st.runState !== "finished") {
        const c = getCourse(st.courseId);
        if (c) {
          const now = performance.now();
          st.tickElapsed(now);
          const idx = Math.min(st.cpIndex, c.checkpoints.length - 1);
          const [cx, cz] = c.checkpoints[idx];
          const gy = checkpointY(cx, cz);
          const dxz = Math.hypot(pos.x - cx, pos.z - cz);
          // y check stops gates on a different spiral loop (directly above/below) triggering
          if (dxz < 8 && Math.abs(pos.y - gy) < 7) st.passCheckpoint(now);

          // bearing from truck heading to the next gate (for the HUD arrow)
          const fx = 2 * (quat.x * quat.z + quat.w * quat.y);
          const fz = 1 - 2 * (quat.x * quat.x + quat.y * quat.y);
          const dx = cx - pos.x,
            dz = cz - pos.z;
          st.setBearing(Math.atan2(fx * dz - fz * dx, fx * dx + fz * dz));
        }
      }

      // story-mode objective tracking (current phase of the chapter)
      if (st.storyChapter != null && !st.storyDone && !st.phaseDone) {
        const ch = getChapter(st.storyChapter);
        const o = ch?.objectives[st.storyPhase];
        if (o) {
          if (o.kind === "reach") {
            const d = Math.hypot(pos.x - o.target[0], pos.z - o.target[1]);
            if (d < o.radius && (o.minY === undefined || pos.y >= o.minY)) st.storyReach();
          } else if (o.kind === "bigair") {
            if (st.bestAir >= o.seconds) st.storyReach();
          } else if (o.kind === "collect") {
            o.points.forEach((p, i) => {
              if (!st.storyHits.includes(i) && Math.hypot(pos.x - p[0], pos.z - p[1]) < 7) st.storyHit(i);
            });
          } else if (o.kind === "gates") {
            const idx = st.storyStep;
            if (idx < o.points.length) {
              const p = o.points[idx];
              if (Math.hypot(pos.x - p[0], pos.z - p[1]) < 8 && Math.abs(pos.y - checkpointY(p[0], p[1])) < 8)
                st.storyHit(idx);
            }
          }
        }
      }
    },
    [room]
  );

  // when a chapter objective completes, save progress + award credits
  useEffect(() => {
    if (!storyDone || storyChapterN == null) return;
    let cancelled = false;
    completeChapter(storyChapterN)
      .then(async (res) => {
        if (cancelled) return;
        setStoryResult({ awarded: res.awarded });
        const p = await loadCurrentProfile();
        if (p) setProfile(p);
      })
      .catch(() => {
        if (!cancelled) setStoryResult({ awarded: 0 });
      });
    return () => {
      cancelled = true;
    };
  }, [storyDone, storyChapterN]);

  // when a run finishes, save the time + award credits
  useEffect(() => {
    if (runState !== "finished" || !activeCourseId) return;
    const ms = useGame.getState().elapsedMs;
    let cancelled = false;
    finishCourse(activeCourseId, ms)
      .then(async (res) => {
        if (cancelled) return;
        setCourseResult(res);
        const p = await loadCurrentProfile();
        if (p) setProfile(p);
      })
      .catch(() => {
        if (!cancelled) setCourseResult({ awarded: 0, is_pb: false, best_ms: ms });
      });
    return () => {
      cancelled = true;
    };
  }, [runState, activeCourseId]);

  if (!booted) {
    return <div className="grid h-screen place-items-center bg-stone-900 text-stone-400">Loading…</div>;
  }

  if (screen === "landing") {
    return <Landing onPlay={() => setScreen("auth")} />;
  }

  if (screen === "driving") {
    return (
      <main className="relative h-screen w-screen overflow-hidden bg-[#bcd4e6]">
        <Scene
          color={paintHex(paintId)}
          truckId={truckId}
          spawn={spawn}
          spawnYaw={spawnYaw}
          remotes={room.remotes}
          checkpoints={activeCourse?.checkpoints}
          cpIndex={cpIndexLive}
          cpColor={activeCourse?.color}
          story={
            activeChapter
              ? { objective: activeChapter.objectives[storyPhase], hits: storyHits, step: storyStep, color: STORY_COLOR }
              : undefined
          }
          onFrame={onFrame}
        />
        <HUD roomCode={room.code ?? undefined} />
        {!activeCourse && !activeChapter && <RegionBanner />}
        {activeCourse && <CourseHUD course={activeCourse} />}
        {activeChapter && <StoryHUD chapter={activeChapter} phase={storyPhase} step={storyStep} />}
        {briefing && <Briefing chapter={briefing} onClose={() => setBriefing(null)} />}
        {storyResult && activeChapter && (
          <StoryFinish
            chapter={activeChapter}
            awarded={storyResult.awarded}
            hasNext={!!getChapter(activeChapter.n + 1)}
            onNext={() => {
              const nxt = getChapter(activeChapter.n + 1);
              if (nxt) startChapter(nxt);
            }}
            onExit={onLeaveDriving}
          />
        )}
        {courseResult && activeCourse && (
          <CourseFinish
            course={activeCourse}
            result={courseResult}
            onRetry={() => {
              setCourseResult(null);
              startChallenge(activeCourse);
            }}
            onExit={onLeaveDriving}
          />
        )}
        <Minimap remotes={room.remotes} />
        {room.code && (
          <div className="pointer-events-none absolute left-1/2 top-16 -translate-x-1/2 rounded-lg bg-black/35 px-3 py-1.5 text-center text-xs text-white backdrop-blur md:bottom-6 md:top-auto">
            <div className="font-semibold">
              {room.memberCount} driver{room.memberCount === 1 ? "" : "s"} · {room.code}
            </div>
            {room.members.length > 1 && (
              <div className="mt-0.5 flex flex-wrap justify-center gap-x-2 text-white/80">
                {room.members.map((m) => {
                  const col = room.remotes.find((r) => r.id === m.id)?.color;
                  return (
                    <span key={m.id} style={col ? { color: col } : undefined}>
                      {m.name}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {room.code && (
          <div className="absolute left-4 top-1/2 flex -translate-y-1/2 flex-col gap-2">
            {["👋", "❤️", "💨", "🎉"].map((e) => (
              <button
                key={e}
                onClick={() => room.sendEmote(e)}
                className="grid h-11 w-11 place-items-center rounded-full bg-black/40 text-xl ring-1 ring-white/20 backdrop-blur transition hover:bg-black/60 active:scale-90"
              >
                {e}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={onLeaveDriving}
          className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-black/45 px-5 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-black/65"
        >
          ‹ Garage
        </button>
        <TouchControls />
      </main>
    );
  }

  return (
    <main className="h-screen overflow-y-auto bg-gradient-to-b from-stone-800 via-stone-900 to-black text-stone-100">
      <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-10">
        <Header />
        {screen === "auth" ? (
          <AuthForm
            onBack={() => setScreen("landing")}
            onAuthed={(p) => {
              setProfile(p);
              setScreen("menu");
            }}
          />
        ) : (
          <Menu
            profile={profile!}
            lastEarned={lastEarned}
            paintId={paintId}
            setPaintId={setPaintId}
            truckId={truckId}
            setTruckId={setTruckId}
            refreshProfile={async () => {
              const p = await loadCurrentProfile();
              if (p) setProfile(p);
            }}
            courseTimes={courseTimes}
            onChallenge={startChallenge}
            storyProgress={profile?.story_progress ?? 0}
            onChapter={startChapter}
            scheme={scheme}
            setScheme={setScheme}
            room={room}
            onPlay={startSession}
            onSignOut={async () => {
              await signOut();
              setProfile(null);
              setScreen("landing");
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

function Landing({ onPlay }: { onPlay: () => void }) {
  const features = [
    { icon: "🏔️", title: "A Huge Open World", desc: "1,700m of dunes, canyons, forests and a spiral-road mountain to summit." },
    { icon: "🚙", title: "Real Off-Road Physics", desc: "Raycast suspension, grip and momentum. Three trucks, each with its own feel." },
    { icon: "📖", title: "Story Campaign", desc: "Seven chapters charting the frontier — climb, collect, jump and race." },
    { icon: "⏱️", title: "Time Trials", desc: "Checkpoint courses with credit rewards and global leaderboards." },
    { icon: "🤝", title: "Play With Friends", desc: "Spin up a public lobby and share a code to drive together in real time." },
    { icon: "🎨", title: "Earn & Customize", desc: "Bank credits, buy premium paints and unlock new vehicles." },
  ];
  return (
    <main className="h-screen overflow-y-auto bg-gradient-to-b from-sky-950 via-stone-900 to-black text-stone-100">
      <div className="mx-auto max-w-3xl px-6 py-12 sm:py-20">
        <div className="text-center">
          <div className="mb-4 inline-block rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber-300 ring-1 ring-amber-400/30">
            Free · plays in your browser
          </div>
          <h1 className="bg-gradient-to-r from-amber-300 to-orange-500 bg-clip-text text-6xl font-black tracking-tight text-transparent sm:text-8xl">
            TRAILBLAZER
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-stone-300 sm:text-lg">
            Off-road. Off-grid. All terrain. Master the physics, summit the mountain, and blaze trails across a massive
            open world — solo or with friends.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={onPlay}
              className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-8 py-4 text-lg font-black text-black shadow-lg transition hover:brightness-110 sm:w-auto"
            >
              ▶ Play Free
            </button>
            <button
              onClick={onPlay}
              className="w-full rounded-xl bg-stone-800 px-8 py-4 font-semibold text-stone-200 ring-1 ring-white/10 transition hover:bg-stone-700 sm:w-auto"
            >
              Sign in
            </button>
          </div>
          <p className="mt-3 text-xs text-stone-500">Create a free account (just a username) to save your progress.</p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl bg-stone-800/50 p-5 ring-1 ring-white/10">
              <div className="text-3xl">{f.icon}</div>
              <div className="mt-2 font-bold">{f.title}</div>
              <div className="mt-1 text-sm text-stone-400">{f.desc}</div>
            </div>
          ))}
        </div>

        <div className="mt-14 rounded-2xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 p-6 text-center ring-1 ring-amber-400/20">
          <div className="text-xl font-bold">Ready to blaze a trail?</div>
          <button
            onClick={onPlay}
            className="mt-4 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-8 py-3 font-black text-black transition hover:brightness-110"
          >
            ▶ Play Free
          </button>
        </div>

        <p className="mt-10 text-center text-xs text-stone-600">
          Built with React Three Fiber + Rapier · Works on desktop &amp; mobile
        </p>
      </div>
    </main>
  );
}

function AuthForm({ onAuthed, onBack }: { onAuthed: (p: Profile) => void; onBack: () => void }) {
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
      <button type="button" onClick={onBack} className="text-xs text-stone-400 transition hover:text-stone-200">
        ‹ Back
      </button>
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
  paintId,
  setPaintId,
  truckId,
  setTruckId,
  refreshProfile,
  courseTimes,
  onChallenge,
  storyProgress,
  onChapter,
  scheme,
  setScheme,
  room,
  onPlay,
  onSignOut,
}: {
  profile: Profile;
  lastEarned: number | null;
  paintId: string;
  setPaintId: (c: string) => void;
  truckId: string;
  setTruckId: (id: string) => void;
  refreshProfile: () => Promise<void>;
  courseTimes: Record<string, number>;
  onChallenge: (c: Course) => void;
  storyProgress: number;
  onChapter: (c: Chapter) => void;
  scheme: ControlScheme;
  setScheme: (s: ControlScheme) => void;
  room: ReturnType<typeof useRoom>;
  onPlay: () => void;
  onSignOut: () => void;
}) {
  const [shopErr, setShopErr] = useState<string | null>(null);
  const [buying, setBuying] = useState<string | null>(null);

  const buy = async (kind: "paint" | "truck", id: string) => {
    setShopErr(null);
    setBuying(id);
    try {
      await purchaseItem(kind, id);
      await refreshProfile();
      if (kind === "paint") setPaintId(id);
      else setTruckId(id);
    } catch (e: any) {
      setShopErr(e.message);
    } finally {
      setBuying(null);
    }
  };
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

      {/* story */}
      <div className="rounded-xl bg-gradient-to-b from-sky-900/40 to-stone-800/60 p-4 ring-1 ring-sky-400/20">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-sky-200">Story — The Trailblazer Expedition</span>
          <span className="text-xs text-sky-300/70">
            {Math.min(storyProgress, CHAPTERS.length)}/{CHAPTERS.length}
          </span>
        </div>
        <div className="space-y-2">
          {CHAPTERS.map((c, idx) => {
            const done = c.n <= storyProgress;
            const current = c.n === storyProgress + 1;
            const locked = c.n > storyProgress + 1;
            const newAct = idx === 0 || CHAPTERS[idx - 1].act !== c.act;
            return (
              <div key={c.id}>
              {newAct && (
                <div className="mb-1 mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-sky-400/80 first:mt-0">
                  {c.act}
                </div>
              )}
              <div
                className={`rounded-lg p-3 ring-1 transition ${
                  current ? "bg-sky-500/10 ring-sky-400/40" : "bg-stone-900 ring-white/5"
                } ${locked ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-stone-500">Ch.{c.n}</span>
                      <span className="font-semibold">{c.title}</span>
                      {done && <span className="text-xs text-emerald-400">✓</span>}
                    </div>
                    <div className="text-xs leading-snug text-stone-400">{locked ? "Locked — finish the previous chapter" : c.blurb}</div>
                    {!locked && (
                      <div className="mt-1 text-xs text-amber-300">
                        Reward {CREDIT_SYMBOL}
                        {formatCredits(c.reward)}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => onChapter(c)}
                    disabled={locked}
                    className={`shrink-0 self-center rounded-md px-3 py-1.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:bg-stone-700 disabled:text-stone-500 ${
                      current ? "bg-sky-500 text-black hover:brightness-110" : "bg-stone-700 text-stone-200 hover:bg-stone-600"
                    }`}
                  >
                    {locked ? "🔒" : done ? "Replay" : "Start"}
                  </button>
                </div>
              </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* vehicles */}
      <div className="rounded-xl bg-stone-800/60 p-4 ring-1 ring-white/10">
        <div className="mb-3 text-sm font-semibold text-stone-300">Garage</div>
        <div className="space-y-2">
          {TRUCKS.map((t) => {
            const owned = profile.owned_trucks?.includes(t.id) ?? t.id === "stock";
            const equipped = truckId === t.id;
            const afford = profile.credits >= t.price;
            return (
              <div
                key={t.id}
                className={`rounded-lg p-3 ring-1 transition ${
                  equipped ? "bg-amber-500/10 ring-amber-400/40" : "bg-stone-900 ring-white/5"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{t.name}</div>
                    <div className="text-xs text-stone-400">{t.blurb}</div>
                  </div>
                  {owned ? (
                    <button
                      onClick={() => setTruckId(t.id)}
                      disabled={equipped}
                      className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-bold transition ${
                        equipped ? "bg-amber-500 text-black" : "bg-stone-700 hover:bg-stone-600"
                      }`}
                    >
                      {equipped ? "Driving" : "Drive"}
                    </button>
                  ) : (
                    <button
                      onClick={() => buy("truck", t.id)}
                      disabled={!afford || buying === t.id}
                      className="shrink-0 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-bold text-black transition hover:brightness-110 disabled:opacity-40"
                    >
                      {buying === t.id ? "…" : `${CREDIT_SYMBOL} ${formatCredits(t.price)}`}
                    </button>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(["speed", "grip", "climb"] as const).map((k) => (
                    <div key={k}>
                      <div className="mb-0.5 text-[10px] uppercase tracking-wide text-stone-500">{k}</div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-stone-700">
                        <div className="h-full rounded-full bg-amber-400" style={{ width: `${t.stats[k] * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* paint */}
      <div className="rounded-xl bg-stone-800/60 p-4 ring-1 ring-white/10">
        <div className="mb-2 text-sm font-semibold text-stone-300">Paint</div>
        <div className="mb-1 text-[10px] uppercase tracking-wide text-stone-500">Standard</div>
        <div className="mb-3 flex flex-wrap gap-2">
          {BASIC_PAINTS.map((p) => (
            <PaintSwatch key={p.id} p={p} owned equipped={paintId === p.id} onEquip={() => setPaintId(p.id)} onBuy={() => {}} buying={false} />
          ))}
        </div>
        <div className="mb-1 text-[10px] uppercase tracking-wide text-stone-500">Premium</div>
        <div className="flex flex-wrap gap-2">
          {PREMIUM_PAINTS.map((p) => {
            const owned = profile.owned_paints?.includes(p.id) ?? false;
            return (
              <PaintSwatch
                key={p.id}
                p={p}
                owned={owned}
                equipped={paintId === p.id}
                canAfford={profile.credits >= p.price}
                buying={buying === p.id}
                onEquip={() => setPaintId(p.id)}
                onBuy={() => buy("paint", p.id)}
              />
            );
          })}
        </div>
        {shopErr && <p className="mt-2 text-xs text-red-400">{shopErr}</p>}
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

      {/* challenges */}
      <div className="rounded-xl bg-stone-800/60 p-4 ring-1 ring-white/10">
        <div className="mb-3 text-sm font-semibold text-stone-300">Time trials</div>
        <div className="space-y-2">
          {COURSES.map((c) => {
            const best = courseTimes[c.id];
            return (
              <div key={c.id} className="rounded-lg bg-stone-900 p-3 ring-1 ring-white/5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{c.name}</span>
                      <span className="text-[10px] uppercase tracking-wide text-stone-500">{c.region}</span>
                    </div>
                    <div className="truncate text-xs text-stone-400">{c.tagline}</div>
                    <div className="mt-1 text-xs">
                      <span className="text-stone-500">Best </span>
                      <span className="font-mono text-cyan-300">{best ? formatTime(best) : "—"}</span>
                      <span className="text-stone-500"> · reward </span>
                      <span className="text-amber-300">
                        {CREDIT_SYMBOL}
                        {formatCredits(c.reward)}
                      </span>
                    </div>
                  </div>
                  <div className="relative flex shrink-0 flex-col items-stretch gap-1">
                    <button
                      onClick={() => onChallenge(c)}
                      className="rounded-md bg-cyan-500 px-4 py-1.5 text-xs font-bold text-black transition hover:brightness-110"
                    >
                      Race
                    </button>
                    <Leaderboard courseId={c.id} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

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

function StoryHUD({ chapter, phase, step }: { chapter: Chapter; phase: number; step: number }) {
  const o = chapter.objectives[Math.min(phase, chapter.objectives.length - 1)];
  const goal = objectiveGoal(o);
  const showProgress = o.kind === "collect" || o.kind === "gates";
  return (
    <div className="pointer-events-none absolute left-1/2 top-16 -translate-x-1/2 text-center">
      <div className="rounded-xl bg-black/45 px-6 py-2 backdrop-blur">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-300">
          Ch.{chapter.n} · {chapter.title}
          {chapter.objectives.length > 1 && (
            <span className="text-sky-200/70"> — objective {Math.min(phase + 1, chapter.objectives.length)}/{chapter.objectives.length}</span>
          )}
        </div>
        <div className="text-lg font-semibold text-white">{o.hint}</div>
        {showProgress && (
          <div className="font-mono text-sm text-sky-200">
            {step} / {goal}
          </div>
        )}
      </div>
    </div>
  );
}

function Briefing({ chapter, onClose }: { chapter: Chapter; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/65 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl bg-stone-900 p-6 ring-1 ring-sky-400/25">
        <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-sky-400">{chapter.act}</div>
        <div className="mt-1 text-2xl font-black text-white">
          Chapter {chapter.n}: {chapter.title}
        </div>
        <div className="mt-4 rounded-xl bg-stone-800/80 p-4 ring-1 ring-white/10">
          <div className="text-xs font-bold text-sky-300">{chapter.intro.speaker}</div>
          <p className="mt-1 text-sm leading-relaxed text-stone-200">“{chapter.intro.text}”</p>
        </div>
        <div className="mt-3 text-xs text-stone-400">
          {chapter.objectives.length} objective{chapter.objectives.length > 1 ? "s" : ""} · first:{" "}
          <span className="text-stone-200">{chapter.objectives[0].hint}</span>
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full rounded-lg bg-sky-500 py-3 font-bold text-black transition hover:brightness-110"
        >
          Let&apos;s ride
        </button>
      </div>
    </div>
  );
}

function StoryFinish({
  chapter,
  awarded,
  hasNext,
  onNext,
  onExit,
}: {
  chapter: Chapter;
  awarded: number;
  hasNext: boolean;
  onNext: () => void;
  onExit: () => void;
}) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-black/55 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl bg-stone-900 p-6 text-center ring-1 ring-white/10">
        <div className="text-xs font-semibold uppercase tracking-widest text-sky-300">Chapter {chapter.n} complete</div>
        <div className="my-2 text-2xl font-black text-white">{chapter.title}</div>
        <div className="mb-3 rounded-xl bg-stone-800/80 p-3 text-left ring-1 ring-white/10">
          <div className="text-xs font-bold text-sky-300">{chapter.outro.speaker}</div>
          <p className="mt-1 text-sm leading-relaxed text-stone-200">“{chapter.outro.text}”</p>
        </div>
        {!hasNext && <div className="mb-2 text-sm text-amber-200">🏁 The Vanguard&apos;s warning is finally lit. Campaign complete!</div>}
        {awarded > 0 ? (
          <div className="mb-4 text-sm text-amber-300">
            +{formatCredits(awarded)} {CREDIT_SYMBOL} credits
          </div>
        ) : (
          <div className="mb-4 text-sm text-stone-400">Replay — already completed</div>
        )}
        <div className="flex gap-2">
          {hasNext && (
            <button onClick={onNext} className="flex-1 rounded-lg bg-sky-500 py-2.5 font-bold text-black transition hover:brightness-110">
              Next chapter
            </button>
          )}
          <button onClick={onExit} className="flex-1 rounded-lg bg-stone-700 py-2.5 font-semibold text-white transition hover:bg-stone-600">
            Garage
          </button>
        </div>
      </div>
    </div>
  );
}

function CourseHUD({ course }: { course: Course }) {
  const elapsed = useGame((s) => s.elapsedMs);
  const cpIndex = useGame((s) => s.cpIndex);
  const runState = useGame((s) => s.runState);
  const best = useGame((s) => s.bestMs);
  const bearing = useGame((s) => s.cpBearing);
  const total = course.checkpoints.length;

  return (
    <div className="pointer-events-none absolute left-1/2 top-16 flex -translate-x-1/2 flex-col items-center">
      <div className="rounded-xl bg-black/45 px-6 py-2 text-center backdrop-blur">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300">{course.name}</div>
        <div className="font-mono text-4xl font-bold tabular-nums text-white">{formatTime(elapsed)}</div>
        <div className="text-xs text-white/70">
          {runState === "ready" ? "Cross the start gate to begin" : `Gate ${Math.min(cpIndex, total)} / ${total}`}
          {best != null && <> · Best {formatTime(best)}</>}
        </div>
      </div>
      {runState !== "finished" && (
        <div className="mt-3" style={{ transform: `rotate(${bearing}rad)` }}>
          <svg viewBox="0 0 24 24" className="h-10 w-10 fill-cyan-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
            <path d="M12 2l7 19-7-4.2L5 21z" />
          </svg>
        </div>
      )}
    </div>
  );
}

function CourseFinish({
  course,
  result,
  onRetry,
  onExit,
}: {
  course: Course;
  result: CourseResult;
  onRetry: () => void;
  onExit: () => void;
}) {
  const elapsed = useGame((s) => s.elapsedMs);
  return (
    <div className="absolute inset-0 grid place-items-center bg-black/55 backdrop-blur-sm">
      <div className="w-80 rounded-2xl bg-stone-900 p-6 text-center ring-1 ring-white/10">
        <div className="text-xs font-semibold uppercase tracking-widest text-cyan-300">{course.name} — finished</div>
        <div className="my-2 font-mono text-5xl font-bold text-white">{formatTime(elapsed)}</div>
        {result.is_pb && (
          <div className="mb-2 inline-block rounded bg-cyan-400 px-2 py-0.5 text-xs font-bold text-black">
            NEW PERSONAL BEST
          </div>
        )}
        <div className="mb-4 text-sm text-amber-300">
          {result.awarded > 0
            ? `+${formatCredits(result.awarded)} ${CREDIT_SYMBOL} credits`
            : "Beat your best time to earn more credits"}
        </div>
        <div className="flex gap-2">
          <button onClick={onRetry} className="flex-1 rounded-lg bg-cyan-500 py-2.5 font-bold text-black transition hover:brightness-110">
            Retry
          </button>
          <button onClick={onExit} className="flex-1 rounded-lg bg-stone-700 py-2.5 font-semibold text-white transition hover:bg-stone-600">
            Garage
          </button>
        </div>
      </div>
    </div>
  );
}

function Leaderboard({ courseId }: { courseId: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<{ username: string; best_ms: number }[] | null>(null);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && rows === null) courseLeaderboard(courseId).then(setRows);
  };
  return (
    <>
      <button
        onClick={toggle}
        className="rounded-md bg-stone-700 px-4 py-1 text-xs font-semibold text-stone-200 transition hover:bg-stone-600"
      >
        🏆
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-52 rounded-lg bg-stone-950 p-3 text-left text-xs ring-1 ring-white/10 shadow-xl">
          <div className="mb-1 font-semibold text-stone-300">Top times</div>
          {rows === null ? (
            <div className="text-stone-500">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="text-stone-500">No times yet — be the first!</div>
          ) : (
            rows.map((r, i) => (
              <div key={i} className="flex justify-between py-0.5">
                <span className="text-stone-400">
                  {i + 1}. {r.username}
                </span>
                <span className="font-mono text-cyan-300">{formatTime(r.best_ms)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </>
  );
}

function RegionBanner() {
  const regionId = useGame((s) => s.regionId);
  const [show, setShow] = useState(false);
  const [info, setInfo] = useState({ name: "", tagline: "" });

  useEffect(() => {
    if (!regionId) return;
    setInfo(regionInfo(regionId));
    setShow(true);
    const t = setTimeout(() => setShow(false), 3400);
    return () => clearTimeout(t);
  }, [regionId]);

  return (
    <div
      className={`pointer-events-none absolute left-1/2 top-24 -translate-x-1/2 text-center transition-all duration-700 ${
        show ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"
      }`}
    >
      <div className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300/90">Now entering</div>
      <div className="mt-1 text-4xl font-black text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]">{info.name}</div>
      <div className="mt-1 text-sm text-white/85 drop-shadow">{info.tagline}</div>
    </div>
  );
}

function PaintSwatch({
  p,
  owned,
  equipped,
  canAfford = true,
  buying,
  onEquip,
  onBuy,
}: {
  p: PaintOption;
  owned: boolean;
  equipped: boolean;
  canAfford?: boolean;
  buying: boolean;
  onEquip: () => void;
  onBuy: () => void;
}) {
  return (
    <div className="flex w-12 flex-col items-center gap-1">
      <button
        onClick={owned ? onEquip : onBuy}
        disabled={buying || (!owned && !canAfford)}
        title={owned ? p.name : `${p.name} — ${p.price} credits`}
        style={{ background: p.hex }}
        className={`relative h-9 w-9 rounded-full ring-2 transition disabled:opacity-40 ${
          equipped ? "ring-amber-400" : "ring-white/10 hover:ring-white/40"
        }`}
      >
        {!owned && (
          <span className="absolute inset-0 grid place-items-center text-xs text-white/90 drop-shadow">🔒</span>
        )}
      </button>
      <span className="text-[9px] leading-none text-stone-400">
        {owned ? p.name : `${CREDIT_SYMBOL}${formatCredits(p.price)}`}
      </span>
    </div>
  );
}
