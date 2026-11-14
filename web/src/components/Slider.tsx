import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "../lib/format";
import { useThemeStore, type PlayheadStyle } from "../stores/themeStore";

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

interface WaveParams {
  wavelength: number;
  speedPx: number;
}

function waveParams(variant: PlayheadStyle): WaveParams {
  switch (variant) {
    case "shinobi":
      return { wavelength: 34, speedPx: 36 };
    case "akatsuki":
      return { wavelength: 40, speedPx: 24 };
    case "grandline":
      return { wavelength: 30, speedPx: 42 };
    case "pixel":
    default:
      return { wavelength: 28, speedPx: 28 };
  }
}

/** Exact wave height at pixel X & phase so the SVG scrubber curve and playhead rider stay 100% locked together. */
function sampleWaveY(variant: PlayheadStyle, x: number, phase: number, amp: number, cy = 12): number {
  if (amp <= 0) return cy;
  const { wavelength } = waveParams(variant);
  const pos = (((x + phase) % wavelength) + wavelength) % wavelength;
  const t = pos / wavelength; // [0, 1)

  switch (variant) {
    case "shinobi": {
      // Crisp Kunai/Chakra triangle wave
      const tri = t < 0.25 ? t * 4 : t < 0.75 ? 2 - t * 4 : (t - 1) * 4;
      return cy - amp * tri;
    }
    case "akatsuki": {
      // Tsukuyomi hypnotic double-harmonic wave
      const w = Math.sin(t * Math.PI * 2) * 0.8 + Math.sin(t * Math.PI * 4) * 0.35;
      return cy - amp * w;
    }
    case "grandline": {
      // Gear 5 Nika bouncy crest wave
      const arc = Math.abs(Math.sin(t * Math.PI)) * 1.45 - 0.55;
      return cy - amp * arc;
    }
    case "pixel":
    default:
      return cy - Math.sin(t * Math.PI * 2) * amp;
  }
}

function buildWavePath(variant: PlayheadStyle, totalWidth: number, phase: number, amp: number, cy = 12): string {
  if (totalWidth <= 0) return "";
  if (amp <= 0.05) return `M 0 ${cy} L ${totalWidth} ${cy}`;
  const step = 3;
  let d = `M 0 ${sampleWaveY(variant, 0, phase, amp, cy).toFixed(2)}`;
  for (let x = step; x <= totalWidth; x += step) {
    d += ` L ${x} ${sampleWaveY(variant, x, phase, amp, cy).toFixed(2)}`;
  }
  if (totalWidth % step !== 0) {
    d += ` L ${totalWidth} ${sampleWaveY(variant, totalWidth, phase, amp, cy).toFixed(2)}`;
  }
  return d;
}

function PlayheadThumb({
  variant,
  isPlaying,
  dragging,
  slopeAngle,
}: {
  variant: PlayheadStyle;
  isPlaying: boolean;
  dragging: boolean;
  slopeAngle: number;
}) {
  const animeAssets = useThemeStore((s) => s.animeAssets);
  const spin = isPlaying && !dragging ? "animate-[spin_2.8s_linear_infinite]" : "";

  switch (variant) {
    case "shinobi":
      return (
        <img
          src={animeAssets.shinobi.playheadIcon}
          alt=""
          aria-hidden="true"
          className={cn(
            "size-6 object-contain drop-shadow-[0_0_8px_rgba(250,204,21,0.85)] transition-transform",
            spin,
          )}
        />
      );

    case "akatsuki":
      return (
        <img
          src={animeAssets.akatsuki.playheadIcon}
          alt=""
          aria-hidden="true"
          className={cn(
            "size-[22px] rounded-full object-contain drop-shadow-[0_0_10px_rgba(239,68,68,0.9)]",
            isPlaying && !dragging && "animate-[spin_4.5s_linear_infinite]",
          )}
        />
      );

    case "grandline":
      return (
        <img
          src={animeAssets.grandline.playheadIcon}
          alt=""
          aria-hidden="true"
          style={{ transform: `rotate(${slopeAngle.toFixed(1)}deg)` }}
          className="h-5 w-9 object-contain drop-shadow-[0_0_10px_rgba(192,132,252,0.85)]"
        />
      );

    case "pixel":
      return (
        <div
          className={cn(
            "rounded-full bg-accent shadow-[0_2px_8px_rgba(0,0,0,0.5)] transition-[transform,opacity] duration-150",
            dragging ? "scale-125 opacity-100" : "opacity-95 group-hover:scale-110 group-hover:opacity-100",
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
  const [phase, setPhase] = useState(0);
  const clipId = useId();

  const shown = drag ?? value;
  const pct = max > 0 ? Math.min(100, Math.max(0, (shown / max) * 100)) : 0;
  const bufPct = max > 0 && buffered ? Math.min(100, (buffered / max) * 100) : 0;
  const isCustomSvgTrack = variant !== "default";

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

  useEffect(() => {
    if (!isCustomSvgTrack || !isPlaying || drag !== null) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let last = performance.now();
    const { wavelength, speedPx } = waveParams(variant);
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      setPhase((p) => (p + dt * speedPx) % wavelength);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isCustomSvgTrack, isPlaying, drag, variant]);

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
  const amp = drag !== null ? 0 : isPlaying ? 4.1 : 1.9;
  const wavePath = isCustomSvgTrack ? buildWavePath(variant, trackWidth, phase, amp, 12) : "";

  // Compute exact vertical wave deflection & slope at playhead X so icon/thumb rides the scrubber wave seamlessly.
  const yNow = isCustomSvgTrack ? sampleWaveY(variant, currentX, phase, amp, 12) : 12;
  const yAhead = isCustomSvgTrack ? sampleWaveY(variant, currentX + 4, phase, amp, 12) : 12;
  const thumbOffsetY = yNow - 12;
  const slopeAngle = Math.atan2(yAhead - yNow, 4) * (180 / Math.PI) * 0.45;

  const trackColor = (() => {
    switch (variant) {
      case "shinobi":
        return "#facc15";
      case "akatsuki":
        return "#ef4444";
      case "grandline":
        return "#c084fc";
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
                <path
                  d={wavePath}
                  fill="none"
                  stroke={trackColor}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            </svg>

            <div
              className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `clamp(10px, ${pct}%, calc(100% - 10px))`,
                transform: `translate(-50%, calc(-50% + ${thumbOffsetY.toFixed(2)}px))`,
              }}
            >
              <PlayheadThumb
                variant={variant}
                isPlaying={isPlaying}
                dragging={drag !== null}
                slopeAngle={slopeAngle}
              />
            </div>
          </>
        ) : (
          /* Default Flat Studio Track */
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
