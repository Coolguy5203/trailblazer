"use client";
import { useGame } from "@/lib/store";
import { creditsEarned, formatCredits, CREDIT_SYMBOL } from "@/lib/economy";

export default function HUD({ roomCode }: { roomCode?: string }) {
  const speed = useGame((s) => s.speedKmh);
  const airborne = useGame((s) => s.airborne);
  const distance = useGame((s) => s.distanceM);
  const jumps = useGame((s) => s.jumps);
  const bestAir = useGame((s) => s.bestAir);
  const earned = creditsEarned(distance, jumps);

  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      {/* Speedometer (bottom-centre on mobile to clear the minimap + pedals) */}
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-col items-center md:bottom-6 md:left-auto md:right-6 md:translate-x-0 md:items-end">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-4xl font-bold tabular-nums text-white drop-shadow-lg md:text-6xl">
            {Math.round(speed)}
          </span>
          <span className="text-lg font-semibold text-white/80">km/h</span>
        </div>
        {airborne && (
          <span className="mt-1 animate-pulse rounded bg-amber-400/90 px-2 py-0.5 text-xs font-bold text-black">
            AIRBORNE
          </span>
        )}
      </div>

      {/* Session stats */}
      <div className="absolute left-6 top-6 space-y-1 rounded-lg bg-black/35 px-4 py-3 text-sm text-white backdrop-blur">
        <div className="flex justify-between gap-6">
          <span className="text-white/70">Distance</span>
          <span className="font-mono font-semibold">{(distance / 1000).toFixed(2)} km</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-white/70">Jumps</span>
          <span className="font-mono font-semibold">{jumps}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-white/70">Best air</span>
          <span className="font-mono font-semibold">{bestAir.toFixed(1)}s</span>
        </div>
        <div className="mt-1 flex justify-between gap-6 border-t border-white/15 pt-1">
          <span className="text-white/70">Earned</span>
          <span className="font-mono font-semibold text-amber-300">
            {CREDIT_SYMBOL} {formatCredits(earned)}
          </span>
        </div>
        {roomCode && (
          <div className="mt-1 flex justify-between gap-6 border-t border-white/15 pt-1">
            <span className="text-white/70">Lobby</span>
            <span className="font-mono font-bold tracking-widest text-amber-300">{roomCode}</span>
          </div>
        )}
      </div>

      {/* Controls hint (keyboard only) */}
      <div className="absolute bottom-6 left-6 hidden rounded-lg bg-black/35 px-4 py-2 text-xs text-white/80 backdrop-blur md:block">
        <span className="font-semibold text-white">WASD / Arrows</span> drive &nbsp;·&nbsp;
        <span className="font-semibold text-white">Space</span> handbrake &nbsp;·&nbsp;
        <span className="font-semibold text-white">R</span> recover
      </div>
    </div>
  );
}
