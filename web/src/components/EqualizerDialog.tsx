import { ArrowCounterClockwiseIcon } from "./icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "../i18n";
import { cn } from "../lib/format";
import {
  computeEqCurveDb,
  EQ_FREQUENCIES,
  EQ_PRESET_IDS,
  readEqSpectrum,
  useEqualizer,
} from "../player/equalizer";
import { useUi } from "../stores/ui";
import { Modal } from "./Modal";

const formatFreq = (hz: number) => (hz >= 1000 ? `${hz / 1000}k` : `${hz}`);
const formatDb = (db: number) => `${db > 0 ? "+" : ""}${db.toFixed(db % 1 === 0 ? 0 : 1)} dB`;

const CURVE_POINTS = 64;
const CURVE_FREQS = Array.from({ length: CURVE_POINTS }, (_, i) => {
  const minLog = Math.log10(24);
  const maxLog = Math.log10(18000);
  return Math.pow(10, minLog + (i / (CURVE_POINTS - 1)) * (maxLog - minLog));
});

function FrequencyCurve() {
  const enabled = useEqualizer((s) => s.enabled);
  const bands = useEqualizer((s) => s.bands);
  const preamp = useEqualizer((s) => s.preamp);
  const bassBoost = useEqualizer((s) => s.bassBoost);
  const clarity = useEqualizer((s) => s.clarity);
  const [spectrum, setSpectrum] = useState<number[]>(() => new Array(28).fill(0));
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const buf = new Uint8Array(64);
    let active = true;
    const tick = () => {
      if (!active) return;
      if (readEqSpectrum(buf)) {
        const bars: number[] = [];
        for (let i = 0; i < 28; i++) {
          const v = (buf[i * 2] ?? 0) / 255;
          bars.push(v);
        }
        setSpectrum(bars);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      active = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const { linePath, areaPath, dots } = useMemo(() => {
    const dbs = computeEqCurveDb(CURVE_FREQS, { enabled, bands, preamp, bassBoost, clarity });
    const width = 560;
    const height = 110;
    const padY = 14;
    const midY = height / 2;
    const scaleY = (height / 2 - padY) / 14; // +/- 14 dB range

    const pts = dbs.map((db, i) => {
      const x = (i / (CURVE_POINTS - 1)) * width;
      const y = Math.max(6, Math.min(height - 6, midY - db * scaleY));
      return [x, y] as const;
    });

    const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const area = `${line} L${width},${midY} L0,${midY} Z`;

    const bandDots = EQ_FREQUENCIES.map((freq, idx) => {
      const minLog = Math.log10(24);
      const maxLog = Math.log10(18000);
      const x = ((Math.log10(freq) - minLog) / (maxLog - minLog)) * width;
      const gain = enabled ? (bands[idx] ?? 0) + preamp * 0.5 : 0;
      const y = Math.max(8, Math.min(height - 8, midY - gain * scaleY));
      return { x, y, freq, gain: bands[idx] ?? 0 };
    });

    return { linePath: line, areaPath: area, dots: bandDots };
  }, [enabled, bands, preamp, bassBoost, clarity]);

  return (
    <div className="relative h-[116px] w-full overflow-hidden rounded-[14px] bg-bg/80 ring-1 ring-line">
      <svg viewBox="0 0 560 110" preserveAspectRatio="none" className="size-full">
        <defs>
          <linearGradient id="eqAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={enabled ? "0.32" : "0.08"} />
            <stop offset="50%" stopColor="var(--accent)" stopOpacity="0.03" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={enabled ? "0.22" : "0.05"} />
          </linearGradient>
        </defs>

        {/* Grid lines: +12dB, 0dB, -12dB */}
        <line x1="0" y1="18" x2="560" y2="18" stroke="currentColor" className="text-line" strokeDasharray="3 3" strokeWidth="1" />
        <line x1="0" y1="55" x2="560" y2="55" stroke="currentColor" className="text-line-strong" strokeWidth="1" />
        <line x1="0" y1="92" x2="560" y2="92" stroke="currentColor" className="text-line" strokeDasharray="3 3" strokeWidth="1" />

        {/* Live spectrum bars */}
        {spectrum.map((v, i) => {
          const barW = 560 / spectrum.length - 3;
          const x = i * (560 / spectrum.length) + 1.5;
          const h = Math.max(2, v * 88);
          return (
            <rect
              key={i}
              x={x}
              y={104 - h}
              width={barW}
              height={h}
              rx={2}
              fill="var(--accent)"
              opacity={enabled ? 0.14 : 0.06}
            />
          );
        })}

        {/* Composite response curve */}
        <path d={areaPath} fill="url(#eqAreaGrad)" />
        <path
          d={linePath}
          fill="none"
          stroke={enabled ? "var(--accent)" : "var(--fg-3)"}
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Band control nodes */}
        {dots.map((d, i) => (
          <circle
            key={i}
            cx={d.x}
            cy={d.y}
            r={3.5}
            fill={enabled ? "var(--accent)" : "var(--fg-3)"}
            stroke="var(--bg)"
            strokeWidth="1.5"
          />
        ))}
      </svg>

      <div className="pointer-events-none absolute inset-y-2 left-2.5 flex flex-col justify-between text-[10px] text-fg-3 tabular-nums">
        <span>+12 dB</span>
        <span>0 dB</span>
        <span>-12 dB</span>
      </div>
    </div>
  );
}

function VerticalBandSlider({
  freq,
  gain,
  disabled,
  onChange,
}: {
  freq: number;
  gain: number;
  disabled: boolean;
  onChange: (db: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  const setFromClientY = (clientY: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    const db = Math.round((ratio * 24 - 12) * 2) / 2;
    onChange(db);
  };

  const pct = ((gain + 12) / 24) * 100;
  const zeroPct = 50;
  const fillTop = gain >= 0 ? 100 - pct : 50;
  const fillHeight = Math.abs(pct - zeroPct);

  return (
    <div className="flex flex-col items-center gap-1.5 select-none">
      <span
        className={cn(
          "text-[10px] tabular-nums transition-colors",
          gain !== 0 && !disabled ? "font-semibold text-accent-text" : "text-fg-3",
        )}
      >
        {gain > 0 ? `+${gain}` : gain}
      </span>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={`${formatFreq(freq)} Hz`}
        aria-valuemin={-12}
        aria-valuemax={12}
        aria-valuenow={gain}
        onDoubleClick={() => onChange(0)}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            onChange(Math.min(12, gain + 0.5));
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            onChange(Math.max(-12, gain - 0.5));
          } else if (e.key === "0") {
            onChange(0);
          }
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setFromClientY(e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) setFromClientY(e.clientY);
        }}
        className="group relative flex h-36 w-7 cursor-pointer items-center justify-center touch-none"
      >
        {/* Center 0 dB tick */}
        <span className="pointer-events-none absolute inset-x-1 top-1/2 h-px bg-line-strong" />

        {/* Vertical rail */}
        <div className="relative h-full w-1.5 overflow-hidden rounded-full bg-surface-3 ring-1 ring-line">
          <div
            className={cn("absolute inset-x-0 rounded-full transition-colors", disabled ? "bg-fg-3/50" : "bg-accent")}
            style={{ top: `${fillTop}%`, height: `${fillHeight}%` }}
          />
        </div>

        {/* Thumb */}
        <div
          className={cn(
            "pointer-events-none absolute left-1/2 size-4 -translate-x-1/2 translate-y-1/2 rounded-full shadow-md ring-2 transition-transform group-hover:scale-110",
            disabled ? "bg-surface-4 ring-fg-3/40" : "bg-fg ring-accent",
          )}
          style={{ bottom: `${pct}%` }}
        />
      </div>

      <span className="text-[10px] font-medium text-fg-2 tabular-nums">{formatFreq(freq)}</span>
    </div>
  );
}

function HorizontalControl({
  label,
  value,
  min,
  max,
  step = 0.5,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex flex-col gap-1.5 rounded-[12px] bg-surface-2 p-3 ring-1 ring-line">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-fg-2">{label}</span>
        <span className="text-[11px] font-semibold text-accent-text tabular-nums">{formatDb(value)}</span>
      </div>
      <div className="relative flex h-5 items-center">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-4">
          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onDoubleClick={() => onChange(0)}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </div>
    </div>
  );
}

export function EqualizerDialog() {
  const open = useUi((s) => s.equalizerOpen);
  const setOpen = useUi((s) => s.setEqualizerOpen);
  const t = useT();

  const enabled = useEqualizer((s) => s.enabled);
  const preset = useEqualizer((s) => s.preset);
  const bands = useEqualizer((s) => s.bands);
  const preamp = useEqualizer((s) => s.preamp);
  const bassBoost = useEqualizer((s) => s.bassBoost);
  const clarity = useEqualizer((s) => s.clarity);
  const compressor = useEqualizer((s) => s.compressor);

  const toggleEnabled = useEqualizer((s) => s.toggleEnabled);
  const setPreset = useEqualizer((s) => s.setPreset);
  const setBand = useEqualizer((s) => s.setBand);
  const setPreamp = useEqualizer((s) => s.setPreamp);
  const setBassBoost = useEqualizer((s) => s.setBassBoost);
  const setClarity = useEqualizer((s) => s.setClarity);
  const setCompressor = useEqualizer((s) => s.setCompressor);
  const reset = useEqualizer((s) => s.reset);

  return (
    <Modal open={open} onClose={() => setOpen(false)} title={t.equalizer.title}>
      <div className="scroll-area -mx-2 flex max-h-[75dvh] flex-col gap-4 overflow-y-auto px-2 pb-1">
        {/* Top bar: Status + Reset + On/Off */}
        <div className="flex items-center justify-between gap-3 rounded-[14px] bg-surface-1 px-4 py-3 ring-1 ring-line">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{t.equalizer.title}</p>
            <p className="truncate text-xs text-fg-2">{t.equalizer.subtitle}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={reset}
              title={t.equalizer.reset}
              className="flex h-8 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-xs font-medium text-fg-2 ring-1 ring-line transition-colors hover:bg-surface-3 hover:text-fg"
            >
              <ArrowCounterClockwiseIcon size={13} />
              <span className="hidden sm:inline">{t.equalizer.reset}</span>
            </button>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={toggleEnabled}
              className={cn(
                "flex h-8 items-center rounded-full px-3.5 text-xs font-semibold transition-all",
                enabled
                  ? "bg-accent text-accent-ink shadow-sm"
                  : "bg-surface-3 text-fg-2 ring-1 ring-line hover:text-fg",
              )}
            >
              {enabled ? t.equalizer.enabled : t.equalizer.bypassed}
            </button>
          </div>
        </div>

        {/* Real-time Frequency Curve + Spectrum */}
        <FrequencyCurve />

        {/* Presets */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-fg-3">
              {t.equalizer.presets}
            </span>
            {preset === "custom" && (
              <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-medium text-accent-text">
                {t.equalizer.presetNames.custom}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {EQ_PRESET_IDS.map((id) => {
              const active = preset === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPreset(id)}
                  className={cn(
                    "flex h-8 items-center rounded-full px-3 text-xs font-medium transition-all",
                    active
                      ? "bg-accent text-accent-ink font-semibold shadow-xs"
                      : "bg-surface-1 text-fg-2 ring-1 ring-line hover:bg-surface-3 hover:text-fg",
                  )}
                >
                  {t.equalizer.presetNames[id]}
                </button>
              );
            })}
          </div>
        </div>

        {/* 10-Band Parametric Faders */}
        <div className="rounded-[16px] bg-surface-1 px-2 py-3.5 ring-1 ring-line">
          <div className="grid grid-cols-10 gap-0.5 sm:gap-1">
            {EQ_FREQUENCIES.map((freq, idx) => (
              <VerticalBandSlider
                key={freq}
                freq={freq}
                gain={bands[idx] ?? 0}
                disabled={!enabled}
                onChange={(db) => setBand(idx, db)}
              />
            ))}
          </div>
        </div>

        {/* Studio Tone & Dynamics Controls */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <HorizontalControl label={t.equalizer.preamp} value={preamp} min={-12} max={12} onChange={setPreamp} />
          <HorizontalControl label={t.equalizer.bassBoost} value={bassBoost} min={0} max={12} onChange={setBassBoost} />
          <HorizontalControl label={t.equalizer.clarity} value={clarity} min={0} max={12} onChange={setClarity} />
        </div>

        {/* Loudness Normalizer / Dynamics Compressor */}
        <button
          type="button"
          role="switch"
          aria-checked={compressor}
          onClick={() => setCompressor(!compressor)}
          className="flex items-center justify-between gap-3 rounded-[14px] bg-surface-1 p-3.5 text-left ring-1 ring-line transition-colors hover:bg-surface-2"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{t.equalizer.compressor}</p>
            <p className="truncate text-xs text-fg-2">{t.equalizer.compressorSub}</p>
          </div>
          <span
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors",
              compressor && enabled ? "bg-accent" : "bg-surface-4",
            )}
          >
            <span
              className={cn(
                "block size-5 rounded-full transition-transform",
                compressor && enabled ? "translate-x-5 bg-accent-ink" : "translate-x-0 bg-fg-2",
              )}
            />
          </span>
        </button>
      </div>
    </Modal>
  );
}

