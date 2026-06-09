"use client";
import { useGame } from "@/lib/store";
import { REGIONS, regionInfo } from "@/lib/regions";
import { MAP_SIZE, HALF } from "@/lib/terrain";
import { course as getCourse } from "@/lib/courses";
import { chapter as getChapter } from "@/lib/story";

const SIZE = 150; // px

export default function Minimap() {
  const { x, z, yaw } = useGame((s) => s.mapPos);
  const regionId = useGame((s) => s.regionId);
  const courseId = useGame((s) => s.courseId);
  const cpIndex = useGame((s) => s.cpIndex);
  const storyChapterN = useGame((s) => s.storyChapter);
  const storyStep = useGame((s) => s.storyStep);
  const storyHits = useGame((s) => s.storyHits);

  // world (x,z) → minimap px (x right, z down)
  const px = (wx: number) => ((wx + HALF) / MAP_SIZE) * SIZE;
  const py = (wz: number) => ((wz + HALF) / MAP_SIZE) * SIZE;
  const pr = (wr: number) => (wr / MAP_SIZE) * SIZE;

  // figure out the immediate objective target to point the player toward
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
    <div className="pointer-events-none absolute right-4 top-4 select-none">
      <svg width={SIZE} height={SIZE} className="rounded-xl bg-black/45 ring-1 ring-white/20 backdrop-blur">
        {/* regions: equal square cells on the grid */}
        {REGIONS.map((r) => (
          <rect
            key={r.id}
            x={px(r.x - r.radius)}
            y={py(r.z - r.radius)}
            width={pr(r.radius * 2)}
            height={pr(r.radius * 2)}
            rx={2}
            fill={r.id === regionId ? "rgba(245,200,80,0.18)" : "rgba(255,255,255,0.05)"}
            stroke={r.id === regionId ? "rgba(245,200,80,0.7)" : "rgba(255,255,255,0.18)"}
            strokeWidth={r.id === regionId ? 1.4 : 0.8}
          />
        ))}

        {/* objective markers */}
        {remaining.map((p, i) => (
          <circle key={i} cx={px(p[0])} cy={py(p[1])} r={1.8} fill={objColor} opacity={0.55} />
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

        {/* N compass */}
        <text x={6} y={13} fill="rgba(255,255,255,0.6)" fontSize="9" fontFamily="monospace">
          N
        </text>
      </svg>
      <div className="mt-1 text-center text-[10px] font-semibold text-white/80 drop-shadow">
        {regionInfo(regionId).name}
      </div>
    </div>
  );
}
