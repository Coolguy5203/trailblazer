"use client";
import { useState } from "react";
import { useGame } from "@/lib/store";
import { REGIONS, regionInfo } from "@/lib/regions";
import { MAP_SIZE, HALF } from "@/lib/terrain";
import { course as getCourse } from "@/lib/courses";
import { chapter as getChapter } from "@/lib/story";

const SIZE = 150; // px (small map)
const BIG = 320; // px (expanded map)

// short labels that fit inside cells on the expanded map
const SHORT: Record<string, string> = {
  pines: "Pines",
  mesa: "Mesa",
  timber: "Timber",
  mirage: "Mirage",
  ascent: "Ascent",
  home: "Home",
  basecamp: "Basecamp",
  canyon: "Canyon",
  ridge: "Ridge",
  proving: "Proving",
  speedway: "Speedway",
  rift: "Rift",
  basin: "Basin",
  dunes: "Dunes",
  cinder: "Volcano",
  badlands: "Badlands",
};

function MapSvg({
  size,
  showNames,
  onPick,
}: {
  size: number;
  showNames: boolean;
  onPick?: (x: number, z: number, name: string) => void;
}) {
  const { x, z, yaw } = useGame((s) => s.mapPos);
  const regionId = useGame((s) => s.regionId);
  const courseId = useGame((s) => s.courseId);
  const cpIndex = useGame((s) => s.cpIndex);
  const storyChapterN = useGame((s) => s.storyChapter);
  const storyStep = useGame((s) => s.storyStep);
  const storyHits = useGame((s) => s.storyHits);
  const destination = useGame((s) => s.destination);

  const px = (wx: number) => ((wx + HALF) / MAP_SIZE) * size;
  const py = (wz: number) => ((wz + HALF) / MAP_SIZE) * size;
  const pr = (wr: number) => (wr / MAP_SIZE) * size;

  // active objective target (course/story take priority over the picked destination)
  let target: [number, number] | null = null;
  const remaining: [number, number][] = [];
  if (courseId) {
    const c = getCourse(courseId);
    if (c) {
      if (cpIndex < c.checkpoints.length) target = c.checkpoints[cpIndex];
      for (let i = cpIndex; i < c.checkpoints.length; i++) remaining.push(c.checkpoints[i]);
    }
  } else if (storyChapterN != null) {
    const o = getChapter(storyChapterN)?.objective;
    if (o) {
      if (o.kind === "reach") target = o.target;
      else if (o.kind === "gates" && storyStep < o.points.length) {
        target = o.points[storyStep];
        for (let i = storyStep; i < o.points.length; i++) remaining.push(o.points[i]);
      } else if (o.kind === "collect") {
        o.points.forEach((p, i) => {
          if (!storyHits.includes(i)) remaining.push(p);
        });
        target = remaining[0] ?? null;
      }
    }
  }
  const objColor = courseId ? getCourse(courseId)?.color ?? "#7fdbff" : "#5ad1ff";

  return (
    <svg width={size} height={size} className="rounded-xl bg-black/55 ring-1 ring-white/20 backdrop-blur">
      {REGIONS.map((r) => (
        <g key={r.id}>
          <rect
            x={px(r.x - r.radius)}
            y={py(r.z - r.radius)}
            width={pr(r.radius * 2)}
            height={pr(r.radius * 2)}
            rx={2}
            fill={r.id === regionId ? "rgba(245,200,80,0.18)" : "rgba(255,255,255,0.05)"}
            stroke={r.id === regionId ? "rgba(245,200,80,0.7)" : "rgba(255,255,255,0.18)"}
            strokeWidth={r.id === regionId ? 1.4 : 0.8}
            className={onPick ? "cursor-pointer" : undefined}
            onClick={onPick ? () => onPick(r.x, r.z, r.name) : undefined}
          />
          {showNames && (
            <text
              x={px(r.x)}
              y={py(r.z) + 3}
              textAnchor="middle"
              fill={r.id === regionId ? "#f5c850" : "rgba(255,255,255,0.75)"}
              fontSize={size / 30}
              fontWeight={600}
              pointerEvents="none"
            >
              {SHORT[r.id] ?? r.name}
            </text>
          )}
        </g>
      ))}

      {/* picked destination */}
      {destination && (
        <g>
          <line
            x1={px(x)}
            y1={py(z)}
            x2={px(destination.x)}
            y2={py(destination.z)}
            stroke="#ffd24a"
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.8}
          />
          <path
            d={`M ${px(destination.x)} ${py(destination.z) - 6} l 4 6 l -4 6 l -4 -6 Z`}
            fill="#ffd24a"
            stroke="#000"
            strokeWidth={0.5}
          />
        </g>
      )}

      {/* objective markers */}
      {remaining.map((p, i) => (
        <circle key={i} cx={px(p[0])} cy={py(p[1])} r={size / 80} fill={objColor} opacity={0.55} />
      ))}
      {target && (
        <circle cx={px(target[0])} cy={py(target[1])} r={4} fill="none" stroke={objColor} strokeWidth={1.6}>
          <animate attributeName="r" values="3;6;3" dur="1.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="1;0.3;1" dur="1.4s" repeatCount="indefinite" />
        </circle>
      )}

      {/* player */}
      <g transform={`translate(${px(x)} ${py(z)}) rotate(${(yaw * 180) / Math.PI})`}>
        <path d="M0 -6 L4 5 L0 2.5 L-4 5 Z" fill="#fff" stroke="#000" strokeWidth={0.6} />
      </g>

      <text x={6} y={13} fill="rgba(255,255,255,0.6)" fontSize="9" fontFamily="monospace" pointerEvents="none">
        N
      </text>
    </svg>
  );
}

export default function Minimap() {
  const [open, setOpen] = useState(false);
  const regionId = useGame((s) => s.regionId);
  const destination = useGame((s) => s.destination);
  const setDestination = useGame((s) => s.setDestination);
  const { x, z } = useGame((s) => s.mapPos);

  const distM = destination ? Math.round(Math.hypot(x - destination.x, z - destination.z)) : 0;

  return (
    <>
      {/* small map — tap to expand */}
      <div className="absolute right-4 top-4 select-none">
        <button onClick={() => setOpen(true)} className="block" aria-label="open map">
          <MapSvg size={SIZE} showNames={false} />
        </button>
        <div className="pointer-events-none mt-1 text-center text-[10px] font-semibold text-white/80 drop-shadow">
          {regionInfo(regionId).name}
        </div>
        {destination && (
          <div className="pointer-events-none text-center text-[10px] text-amber-300 drop-shadow">
            ➤ {destination.name} · {distM}m
          </div>
        )}
      </div>

      {/* expanded map — names + tap a region to set destination */}
      {open && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="rounded-2xl bg-stone-900 p-4 ring-1 ring-white/15" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between gap-6">
              <span className="text-sm font-bold text-white">World map — tap a region to set destination</span>
              <button onClick={() => setOpen(false)} className="rounded bg-stone-700 px-2 py-0.5 text-xs text-white hover:bg-stone-600">
                ✕
              </button>
            </div>
            <MapSvg
              size={BIG}
              showNames
              onPick={(dx, dz, name) => {
                setDestination({ x: dx, z: dz, name });
                setOpen(false);
              }}
            />
            {destination && (
              <button
                onClick={() => {
                  setDestination(null);
                  setOpen(false);
                }}
                className="mt-2 w-full rounded-lg bg-stone-700 py-1.5 text-xs font-semibold text-white hover:bg-stone-600"
              >
                Clear destination ({destination.name})
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
