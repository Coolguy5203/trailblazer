"use client";
import { useEffect, useRef } from "react";
import { setTouchInput } from "@/lib/input";

function HoldButton({
  onDown,
  onUp,
  className,
  children,
  label,
}: {
  onDown: () => void;
  onUp: () => void;
  className: string;
  children: React.ReactNode;
  label: string;
}) {
  const active = useRef(false);
  const down = (e: React.PointerEvent) => {
    e.preventDefault();
    active.current = true;
    onDown();
  };
  const up = (e: React.PointerEvent) => {
    e.preventDefault();
    if (active.current) {
      active.current = false;
      onUp();
    }
  };
  return (
    <button
      aria-label={label}
      onPointerDown={down}
      onPointerUp={up}
      onPointerLeave={up}
      onPointerCancel={up}
      className={`pointer-events-auto touch-none select-none active:brightness-150 ${className}`}
    >
      {children}
    </button>
  );
}

export default function TouchControls() {
  // reset all virtual input when the controls unmount (leaving driving)
  useEffect(() => () => setTouchInput({ throttle: 0, steer: 0, brake: false, reset: false }), []);

  const base = "grid place-items-center rounded-full bg-black/40 text-white backdrop-blur ring-1 ring-white/20 shadow-lg";

  return (
    <div className="pointer-events-none absolute inset-0 z-20 md:hidden">
      {/* Steering — bottom-left */}
      <div className="absolute bottom-8 left-5 flex items-end gap-3">
        <HoldButton
          label="steer left"
          onDown={() => setTouchInput({ steer: -1 })}
          onUp={() => setTouchInput({ steer: 0 })}
          className={`${base} h-20 w-20 text-3xl`}
        >
          ◀
        </HoldButton>
        <HoldButton
          label="steer right"
          onDown={() => setTouchInput({ steer: 1 })}
          onUp={() => setTouchInput({ steer: 0 })}
          className={`${base} h-20 w-20 text-3xl`}
        >
          ▶
        </HoldButton>
      </div>

      {/* Pedals + actions — bottom-right */}
      <div className="absolute bottom-8 right-5 flex items-end gap-3">
        <div className="flex flex-col gap-2">
          <HoldButton
            label="handbrake"
            onDown={() => setTouchInput({ brake: true })}
            onUp={() => setTouchInput({ brake: false })}
            className={`${base} h-12 w-12 text-xs font-bold`}
          >
            HAND
          </HoldButton>
          <HoldButton
            label="recover"
            onDown={() => setTouchInput({ reset: true })}
            onUp={() => setTouchInput({ reset: false })}
            className={`${base} h-12 w-12 text-lg`}
          >
            ↺
          </HoldButton>
        </div>
        <div className="flex flex-col gap-3">
          <HoldButton
            label="accelerate"
            onDown={() => setTouchInput({ throttle: 1 })}
            onUp={() => setTouchInput({ throttle: 0 })}
            className="pointer-events-auto grid h-24 w-24 touch-none select-none place-items-center rounded-full bg-amber-500/80 text-2xl font-black text-black ring-1 ring-white/30 shadow-lg active:brightness-125"
          >
            GAS
          </HoldButton>
          <HoldButton
            label="reverse / brake"
            onDown={() => setTouchInput({ throttle: -1 })}
            onUp={() => setTouchInput({ throttle: 0 })}
            className={`${base} h-16 w-24 text-sm font-bold`}
          >
            REV
          </HoldButton>
        </div>
      </div>
    </div>
  );
}
