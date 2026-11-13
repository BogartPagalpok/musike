import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "../lib/format";

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
  variant?: "default" | "pixel";
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
        {variant === "pixel" ? (
          <>
            {/* Google Pixel Squiggly Progress Wave */}
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

              {/* Unplayed Track (Subtle Straight Line) */}
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

              {/* Buffered Indicator (If Ahead of Played) */}
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

              {/* Played Squiggly Wave Path Clipped to Current Position */}
              <g clipPath={`url(#${clipId})`}>
                <path
                  d={
                    drag !== null
                      ? `M 0 12 L ${trackWidth} 12`
                      : makeWavePath(trackWidth, 32, isPlaying ? 4.5 : 2, 12)
                  }
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={cn(isPlaying && drag === null && "animate-pixel-wave")}
                />
              </g>
            </svg>

            {/* Google Pixel Sleek Vertical Pill Thumb */}
            <div
              className={cn(
                "pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow-[0_2px_8px_rgba(0,0,0,0.5)] transition-[transform,opacity] duration-150",
                drag !== null ? "scale-125 opacity-100" : "opacity-90 group-hover:scale-110 group-hover:opacity-100",
              )}
              style={{
                left: `${pct}%`,
                width: "4px",
                height: "16px",
              }}
            />
          </>
        ) : (
          /* Default Slider Track (for volume, etc.) */
          <div className="relative top-1/2 -translate-y-1/2 h-1 w-full overflow-hidden rounded-full bg-surface-4 transition-[height] duration-200 group-hover:h-1.5">
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

        {variant !== "pixel" && (
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
