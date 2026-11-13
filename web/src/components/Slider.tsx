import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "../lib/format";
import type { PlayheadStyle } from "../stores/themeStore";

interface Props {
  value: number;
  max: number;
  label: string;
  /** Called continuously while dragging when `live`, otherwise once on release. */
  onChange: (v: number) => void;
  live?: boolean;
  buffered?: number;
  step?: number;
  valueText?: (v: number) => string;
  /** Show the thumb at rest (touch layouts), not only on hover. */
  showThumb?: boolean;
  onScrub?: (v: number | null) => void;
  className?: string;
  variant?: PlayheadStyle;
  isPlaying?: boolean;
}

function makeWavePath(totalWidth: number, wavelength = 32, amp = 4.5, cy = 12) {
  if (totalWidth <= 0) return "";
  let d = `M -${wavelength} ${cy}`;
  for (let x = -wavelength; x <= totalWidth + wavelength * 2; x += wavelength) {
    d += ` Q ${x + wavelength / 4} ${cy - amp}, ${x + wavelength / 2} ${cy}`;
    d += ` Q ${x + (3 * wavelength) / 4} ${cy + amp}, ${x + wavelength} ${cy}`;
  }
  return d;
}

function makeStepWavePath(totalWidth: number, step = 18, amp = 3.5, cy = 12) {
  if (totalWidth <= 0) return "";
  let d = `M 0 ${cy}`;
  let up = true;
  for (let x = 0; x <= totalWidth + step; x += step) {
    const y = up ? cy - amp : cy + amp;
    d += ` L ${x} ${y} L ${x + step} ${y}`;
    up = !up;
  }
  return d;
}

function makeZigzagPath(totalWidth: number, step = 16, amp = 4.5, cy = 12) {
  if (totalWidth <= 0) return "";
  let d = `M -${step} ${cy}`;
  let up = true;
  for (let x = -step; x <= totalWidth + step * 2; x += step) {
    d += ` L ${x + step * 0.5} ${up ? cy - amp : cy + amp} L ${x + step} ${cy}`;
    up = !up;
  }
  return d;
}

function PlayheadThumb({ variant, isPlaying, dragging }: { variant: PlayheadStyle; isPlaying: boolean; dragging: boolean }) {
  const spin = isPlaying && !dragging ? "animate-[spin_3s_linear_infinite]" : "";

  switch (variant) {
    case "shinobi":
      return (
        <div className="relative flex items-center justify-center">
          {/* Flying Kunai + Spinning Rasengan Chakra Core */}
          <svg width="26" height="20" viewBox="0 0 26 20" className="drop-shadow-[0_0_8px_rgba(56,189,248,0.85)]">
            <path d="M1 10 L7 7 L7 13 Z" fill="#cbd5e1" />
            <rect x="7" y="9" width="4" height="2" fill="#f97316" />
            <circle cx="17" cy="10" r="7.5" fill="#0ea5e9" stroke="#e0f2fe" strokeWidth="1.5" />
            <g className={spin} style={{ transformOrigin: "17px 10px" }}>
              <path d="M17 4.5 A5.5 5.5 0 0 1 22.5 10" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M17 15.5 A5.5 5.5 0 0 1 11.5 10" fill="none" stroke="#bae6fd" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="17" cy="10" r="2.2" fill="#f8fafc" />
            </g>
          </svg>
        </div>
      );

    case "akatsuki":
      return (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          className={cn("drop-shadow-[0_0_8px_rgba(239,68,68,0.9)]", spin)}
        >
          <circle cx="12" cy="12" r="10.5" fill="#dc2626" stroke="#09090b" strokeWidth="2" />
          <circle cx="12" cy="12" r="6" fill="none" stroke="#09090b" strokeWidth="1.1" strokeOpacity="0.85" />
          <circle cx="12" cy="12" r="2.6" fill="#09090b" />
          <circle cx="12" cy="5.8" r="1.5" fill="#09090b" />
          <circle cx="17.4" cy="15.2" r="1.5" fill="#09090b" />
          <circle cx="6.6" cy="15.2" r="1.5" fill="#09090b" />
        </svg>
      );

    case "grandline":
      return (
        <svg width="24" height="18" viewBox="0 0 24 18" className="drop-shadow-[0_2px_8px_rgba(251,191,36,0.7)]">
          <ellipse cx="12" cy="12.5" rx="11" ry="3.2" fill="#facc15" stroke="#78350f" strokeWidth="1.1" />
          <path d="M6 11.5 C6 5.5, 18 5.5, 18 11.5 Z" fill="#fde047" stroke="#78350f" strokeWidth="1.1" />
          <path d="M6.2 10.6 Q12 12 17.8 10.6" fill="none" stroke="#ef4444" strokeWidth="2.4" />
        </svg>
      );

    case "kpop":
      return (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          className={cn("drop-shadow-[0_0_8px_rgba(244,114,182,0.85)]", isPlaying && !dragging && "animate-pulse")}
        >
          <defs>
            <linearGradient id="kpopThumbGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f9a8d4" />
              <stop offset="50%" stopColor="#f472b6" />
              <stop offset="100%" stopColor="#67e8f9" />
            </linearGradient>
          </defs>
          <path
            d="M12 20.5s-7.2-4.6-9-8.8C1.7 8.4 4.1 5 7.4 5c1.9 0 3.6 1 4.6 2.5C13 6 14.7 5 16.6 5 19.9 5 22.3 8.4 21 11.7c-1.8 4.2-9 8.8-9 8.8z"
            fill="url(#kpopThumbGrad)"
            stroke="#ffffff"
            strokeWidth="1.4"
          />
          <path d="M18.5 2l.7 1.8L21 4.5l-1.8.7L18.5 7l-.7-1.8L16 4.5l1.8-.7z" fill="#ffffff" />
        </svg>
      );

    case "arcade8bit":
      return (
        <svg
          width="20"
          height="20"
          viewBox="0 0 16 16"
          shapeRendering="crispEdges"
          className={cn("drop-shadow-[0_2px_4px_rgba(0,0,0,0.65)]", isPlaying && !dragging && "animate-bounce")}
        >
          {/* 8-bit Pixel Cat with Headphones */}
          <rect x="3" y="2" width="2" height="2" fill="#22d3ee" />
          <rect x="11" y="2" width="2" height="2" fill="#22d3ee" />
          <rect x="4" y="4" width="8" height="2" fill="#facc15" />
          <rect x="3" y="6" width="10" height="6" fill="#fde047" />
          <rect x="2" y="7" width="1" height="4" fill="#22d3ee" />
          <rect x="13" y="7" width="1" height="4" fill="#22d3ee" />
          <rect x="5" y="8" width="2" height="2" fill="#0f172a" />
          <rect x="9" y="8" width="2" height="2" fill="#0f172a" />
          <rect x="7" y="10" width="2" height="1" fill="#ef4444" />
          <rect x="4" y="12" width="3" height="2" fill="#facc15" />
          <rect x="9" y="12" width="3" height="2" fill="#facc15" />
        </svg>
      );

    case "vinyl":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" className={cn("drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)]", spin)}>
          <circle cx="12" cy="12" r="10.5" fill="#18181b" stroke="#f59e0b" strokeWidth="1.3" />
          <circle cx="12" cy="12" r="7.5" fill="none" stroke="#3f3f46" strokeWidth="0.9" />
          <circle cx="12" cy="12" r="4" fill="#f59e0b" />
          <circle cx="12" cy="12" r="1.4" fill="#09090b" />
        </svg>
      );

    case "cyberpunk":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" className="drop-shadow-[0_0_8px_rgba(34,211,238,0.9)]">
          <polygon points="12,2 21,7 21,17 12,22 3,17 3,7" fill="#0f172a" stroke="#22d3ee" strokeWidth="2" />
          <polygon points="12,6.5 17,9.5 17,14.5 12,17.5 7,14.5 7,9.5" fill="#f43f5e" />
          <circle cx="12" cy="12" r="2" fill="#ecfeff" />
        </svg>
      );

    case "pixel":
      return (
        <div
          className={cn(
            "rounded-full bg-accent shadow-[0_2px_8px_rgba(0,0,0,0.5)] transition-[transform,opacity] duration-150",
            dragging ? "scale-125 opacity-100" : "opacity-90 group-hover:scale-110 group-hover:opacity-100",
          )}
          style={{ width: "4px", height: "16px" }}
        />
      );

    default:
      return null;
  }
}

export function Slider({
  value,
  max,
  label,
  onChange,
  live,
  buffered,
  step,
  valueText,
  showThumb,
  onScrub,
  className,
  variant = "default",
  isPlaying = false,
}: Props) {
  const track = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const [trackWidth, setTrackWidth] = useState(600);
  const clipId = useId();

  const shown = drag ?? value;
  const pct = max > 0 ? Math.min(100, Math.max(0, (shown / max) * 100)) : 0;
  const bufPct = max > 0 && buffered ? Math.min(100, (buffered / max) * 100) : 0;

  useLayoutEffect(() => {
    if (!track.current) return;
    const updateWidth = () => {
      if (track.current) {
        const w = Math.round(track.current.getBoundingClientRect().width);
        if (w > 0) setTrackWidth(w);
      }
    };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(track.current);
    return () => ro.disconnect();
  }, []);

  const valueAt = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * max;
  };

  const update = (v: number | null) => {
    setDrag(v);
    onScrub?.(v);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (max <= 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const v = valueAt(e.clientX);
    update(v);
    if (live) onChange(v);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag === null) return;
    const v = valueAt(e.clientX);
    update(v);
    if (live) onChange(v);
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (drag === null) return;
    onChange(valueAt(e.clientX));
    update(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const s = step ?? max / 20;
    const map: Record<string, number> = {
      ArrowRight: value + s,
      ArrowUp: value + s,
      ArrowLeft: value - s,
      ArrowDown: value - s,
      Home: 0,
      End: max,
    };
    if (e.key in map) {
      e.preventDefault();
      e.stopPropagation();
      onChange(Math.min(max, Math.max(0, map[e.key])));
    }
  };

  const currentX = (pct / 100) * trackWidth;
  const bufX = (bufPct / 100) * trackWidth;
  const isCustomSvgTrack = variant !== "default";
  const amp = isPlaying && drag === null ? 4.2 : 1.8;

  const wavePath = (() => {
    if (drag !== null) return `M 0 12 L ${trackWidth} 12`;
    switch (variant) {
      case "arcade8bit":
        return makeStepWavePath(trackWidth, 16, amp, 12);
      case "cyberpunk":
        return makeZigzagPath(trackWidth, 18, amp, 12);
      case "vinyl":
        return makeWavePath(trackWidth, 24, isPlaying ? 2.5 : 1, 12);
      default:
        return makeWavePath(trackWidth, 32, amp, 12);
    }
  })();

  const trackColor = (() => {
    switch (variant) {
      case "shinobi":
        return "#38bdf8";
      case "akatsuki":
        return "#ef4444";
      case "grandline":
        return "#fbbf24";
      case "kpop":
        return "#f472b6";
      case "arcade8bit":
        return "#facc15";
      case "vinyl":
        return "#f59e0b";
      case "cyberpunk":
        return "#22d3ee";
      default:
        return "var(--accent)";
    }
  })();

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      aria-valuenow={Math.round(shown)}
      aria-valuetext={valueText?.(shown)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => update(null)}
      onKeyDown={onKeyDown}
      className={cn("group relative flex h-6 cursor-pointer touch-none items-center select-none", className)}
    >
      <div ref={track} className="relative h-6 w-full">
        {isCustomSvgTrack ? (
          <>
            <svg
              className="pointer-events-none absolute inset-0 size-full overflow-hidden"
              viewBox={`0 0 ${trackWidth} 24`}
              preserveAspectRatio="none"
            >
              <defs>
                <clipPath id={clipId}>
                  <rect x="0" y="0" width={Math.max(0, currentX)} height="24" rx="2" />
                </clipPath>
              </defs>

              <line
                x1={Math.max(0, currentX)}
                y1="12"
                x2={trackWidth}
                y2="12"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
                className="text-surface-4"
              />

              {bufX > currentX && (
                <line
                  x1={Math.max(0, currentX)}
                  y1="12"
                  x2={Math.min(trackWidth, bufX)}
                  y2="12"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  className="text-fg-3/30"
                />
              )}

              <g clipPath={`url(#${clipId})`}>
                {variant === "shinobi" && drag === null && (
                  <path
                    d={makeWavePath(trackWidth, 32, -amp * 0.75, 12)}
                    fill="none"
                    stroke="#f97316"
                    strokeOpacity="0.65"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    className={cn(isPlaying && "animate-pixel-wave")}
                  />
                )}
                {variant === "cyberpunk" && drag === null && (
                  <path
                    d={makeZigzagPath(trackWidth, 18, -amp * 0.7, 12)}
                    fill="none"
                    stroke="#f43f5e"
                    strokeOpacity="0.55"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                )}
                <path
                  d={wavePath}
                  fill="none"
                  stroke={trackColor}
                  strokeWidth={variant === "vinyl" ? "4" : "3.5"}
                  strokeLinecap={variant === "arcade8bit" ? "square" : "round"}
                  strokeLinejoin={variant === "arcade8bit" ? "miter" : "round"}
                  className={cn(isPlaying && drag === null && variant !== "cyberpunk" && "animate-pixel-wave")}
                />
              </g>
            </svg>

            <div
              className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-transform duration-150 group-hover:scale-110"
              style={{
                left: `clamp(6px, ${pct}%, calc(100% - 6px))`,
              }}
            >
              <PlayheadThumb variant={variant} isPlaying={isPlaying} dragging={drag !== null} />
            </div>
          </>
        ) : (
          /* Default Slider Track */
          <div className="relative top-1/2 h-1 w-full -translate-y-1/2 overflow-hidden rounded-full bg-surface-4 transition-[height] duration-200 group-hover:h-1.5">
            <div className="absolute inset-y-0 left-0 bg-fg-3/40" style={{ width: `${bufPct}%` }} />
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full transition-colors",
                drag !== null ? "bg-accent" : "bg-fg group-hover:bg-accent",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}

        {variant === "default" && (
          <div
            className={cn(
              "pointer-events-none absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg shadow-[0_1px_4px_rgb(0_0_0/0.4)] transition-opacity",
              showThumb || drag !== null ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
            )}
            style={{ left: `${pct}%` }}
          />
        )}
      </div>
    </div>
  );
}
