import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/format";
import {
  AUTO_ADVANCE_MS,
  noteName,
  playScoreSounds,
  songbookCode,
  useVideoke,
  type ScoreAxis,
  type ScoreTone,
} from "../stores/videoke";
import { ArrowsOutIcon, MicrophoneStageIcon, PlayIcon, SkipForwardIcon, XIcon } from "./icons";

const ROLL_SECONDS = 1.35;

const TONE_TEXT: Record<ScoreTone, string> = {
  bad: "text-danger",
  meh: "text-amber-400",
  good: "text-sky-400",
  great: "text-accent-text",
};

const TONE_BADGE: Record<ScoreTone, string> = {
  bad: "border-danger/50 bg-danger/12 text-danger",
  meh: "border-amber-400/50 bg-amber-400/12 text-amber-300",
  good: "border-sky-400/50 bg-sky-400/12 text-sky-300",
  great: "border-accent/60 bg-accent-soft text-accent-text",
};

/** 5-Axis Pentagon Radar Chart (Pitch · Stability · Expression · Rhythm · Vibrato & Long). */
function PentagonRadar({ axes }: { axes: ScoreAxis[] }) {
  const cx = 130;
  const cy = 116;
  const maxR = 72;
  const count = 5;

  const ptAt = (idx: number, val0to100: number) => {
    const angle = -Math.PI / 2 + (idx * 2 * Math.PI) / count;
    const r = (Math.max(0, Math.min(100, val0to100)) / 100) * maxR;
    return {
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
    };
  };

  const polyPoints = (vals: number[]) =>
    vals
      .map((v, i) => {
        const p = ptAt(i, v);
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })
      .join(" ");

  const safeAxes =
    axes.length === 5
      ? axes
      : [
          { label: "Pitch", value: 75 },
          { label: "Stability", value: 75 },
          { label: "Expression", value: 75 },
          { label: "Rhythm", value: 75 },
          { label: "Vibrato & Long", value: 75 },
        ];

  const avgPolygon = polyPoints([82, 80, 78, 81, 76]);
  const userPolygon = polyPoints(safeAxes.map((a) => a.value));

  const shortLabels = ["Pitch", "Stability", "Expression", "Rhythm", "Vib & Long"];

  return (
    <div className="flex flex-col items-center rounded-lg border border-line bg-surface-2 p-3">
      <div className="mb-1 flex w-full items-center justify-between text-[11px]">
        <span className="font-semibold text-fg">5-Axis Vocal Balance</span>
        <span className="flex items-center gap-2.5 text-[10px] text-fg-3">
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-emerald-400" /> You
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-0.5 w-2.5 bg-fg-3" /> Avg
          </span>
        </span>
      </div>

      <svg viewBox="0 0 260 226" className="h-[196px] w-full max-w-[260px]" aria-label="5-axis vocal radar chart">
        {[25, 50, 75, 100].map((ring) => (
          <polygon
            key={ring}
            points={polyPoints([ring, ring, ring, ring, ring])}
            fill="none"
            stroke="currentColor"
            strokeOpacity={ring === 100 ? 0.24 : 0.1}
            strokeWidth={ring === 100 ? 1.1 : 0.8}
            className="text-fg"
          />
        ))}

        {Array.from({ length: count }).map((_, i) => {
          const outer = ptAt(i, 100);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={outer.x}
              y2={outer.y}
              stroke="currentColor"
              strokeOpacity={0.12}
              strokeWidth="0.9"
              className="text-fg"
            />
          );
        })}

        {/* Average Reference Pentagon */}
        <polygon
          points={avgPolygon}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.4}
          strokeWidth="1.2"
          strokeDasharray="3 3"
          className="text-fg-2"
        />

        {/* Singer's 5-Axis Polygon */}
        <polygon
          points={userPolygon}
          fill="rgba(30, 215, 96, 0.22)"
          stroke="#1ed760"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {safeAxes.map((ax, i) => {
          const dot = ptAt(i, ax.value);
          const lbl = ptAt(i, 124);
          const anchor = i === 0 ? "middle" : i <= 2 ? "start" : "end";
          const dx = i === 0 ? 0 : i <= 2 ? 4 : -4;
          return (
            <g key={ax.label}>
              <circle cx={dot.x} cy={dot.y} r="3.4" fill="#1ed760" />
              <text
                x={lbl.x + dx}
                y={lbl.y - 3}
                textAnchor={anchor}
                className="fill-fg-2 text-[9.5px] font-medium"
              >
                {shortLabels[i]}
              </text>
              <text
                x={lbl.x + dx}
                y={lbl.y + 9}
                textAnchor={anchor}
                className="fill-fg font-mono text-[10.5px] font-bold"
              >
                {ax.value}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Section-by-Section Pitch Graph (5 song parts) + Rhythm Ahead/Behind Tendency Gauge. */
function SectionPitchAndRhythm({
  sections,
  pitchHitPct,
  rhythmOffsetMs,
}: {
  sections: [number, number, number, number, number];
  pitchHitPct: number;
  rhythmOffsetMs: number;
}) {
  // Map -160ms..+160ms to 8%..92% along gauge (50% = Dead On Beat)
  const gaugePct = Math.max(8, Math.min(92, 50 + (rhythmOffsetMs / 160) * 42));
  const rhythmLabel =
    Math.abs(rhythmOffsetMs) <= 28
      ? "Just On Beat"
      : rhythmOffsetMs < 0
        ? `Ahead ${Math.abs(rhythmOffsetMs)}ms`
        : `Laid-back +${rhythmOffsetMs}ms`;

  const w = 220;
  const h = 76;
  const padX = 18;
  const padY = 12;
  const pts = sections.map((val, idx) => {
    const x = padX + (idx / 4) * (w - padX * 2);
    const y = h - padY - (Math.max(0, Math.min(100, val)) / 100) * (h - padY * 2);
    return { x, y, val };
  });
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

  return (
    <div className="flex flex-col justify-between gap-3 rounded-lg border border-line bg-surface-2 p-3">
      <div>
        <div className="mb-1.5 flex items-center justify-between text-[11px]">
          <span className="font-semibold text-fg">Pitch Accuracy Graph</span>
          <span className="font-mono font-bold text-accent-text tabular-nums">{pitchHitPct}% Hit</span>
        </div>

        <svg viewBox={`0 0 ${w} ${h}`} className="h-[82px] w-full rounded-md bg-bg px-1" aria-label="Section pitch accuracy graph">
          {[25, 50, 75].map((lvl) => {
            const y = h - padY - (lvl / 100) * (h - padY * 2);
            return (
              <line
                key={lvl}
                x1={padX - 6}
                y1={y}
                x2={w - padX + 6}
                y2={y}
                stroke="currentColor"
                strokeOpacity={0.12}
                strokeDasharray="2 3"
                className="text-fg"
              />
            );
          })}
          <path d={linePath} fill="none" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          {pts.map((p, idx) => (
            <g key={idx}>
              <circle cx={p.x} cy={p.y} r="3.5" fill="#38bdf8" />
              <text x={p.x} y={h - 2} textAnchor="middle" className="fill-fg-3 font-mono text-[8.5px]">
                P{idx + 1}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Rhythm Timing Gauge (Rushing / Ahead <-> Just <-> Behind / Late) */}
      <div className="border-t border-line pt-2.5">
        <div className="mb-1.5 flex items-center justify-between text-[11px]">
          <span className="font-semibold text-fg">Rhythm Timing</span>
          <span className="font-mono text-[10.5px] font-semibold text-fg-2 tabular-nums">{rhythmLabel}</span>
        </div>
        <div className="relative flex h-5 items-center">
          <div className="h-1.5 w-full rounded-full bg-bg" />
          <span className="absolute top-1/2 left-1/2 h-3.5 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-fg-3/60" />
          <span
            className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg bg-accent shadow-xs"
            style={{ left: `${gaugePct}%` }}
          />
        </div>
        <div className="flex justify-between text-[9.5px] font-medium text-fg-3">
          <span>Rush (Fast)</span>
          <span>On Beat</span>
          <span>Drag (Slow)</span>
        </div>
      </div>
    </div>
  );
}

/** Vibrato Waveform + Long Tone + Technique Counters (Scoop / Kobushi / Fall). */
function VibratoAndTechniqueCard({
  vibratoCount,
  vibratoTotalSec,
  vibratoHz,
  vibratoSkill,
  vibratoWave,
  longToneSec,
  longToneScore,
  scoops,
  kobushi,
  falls,
}: {
  vibratoCount: number;
  vibratoTotalSec: number;
  vibratoHz: number;
  vibratoSkill: string;
  vibratoWave: number[];
  longToneSec: number;
  longToneScore: number;
  scoops: number;
  kobushi: number;
  falls: number;
}) {
  const waveSamples =
    vibratoWave.length >= 8
      ? vibratoWave
      : vibratoCount > 0
        ? Array.from({ length: 28 }, (_, i) => Math.sin((i / 27) * Math.PI * 5) * 0.72)
        : Array.from({ length: 28 }, () => 0);

  const wavePath = waveSamples
    .map((v, idx) => {
      const x = 6 + (idx / (waveSamples.length - 1)) * 148;
      const y = 18 - v * 12;
      return `${idx === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border border-line bg-surface-2 p-3 sm:grid-cols-2">
      {/* Left: Vibrato Waveform + Long Tone */}
      <div className="flex flex-col justify-between gap-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-fg">Vibrato &amp; Long Tone</span>
          <span className="rounded-sm bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] font-bold text-fg">
            {vibratoSkill}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <svg viewBox="0 0 160 36" className="h-9 w-28 shrink-0 rounded-md bg-bg" aria-label="Captured vibrato waveform">
            <line x1="0" y1="18" x2="160" y2="18" stroke="currentColor" strokeOpacity={0.14} className="text-fg" />
            <path
              d={wavePath}
              fill="none"
              stroke={vibratoCount > 0 ? "#1ed760" : "#71717a"}
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          <div className="min-w-0 text-[11px] leading-snug text-fg-2 tabular-nums">
            <p>
              Vibrato: <strong className="font-mono text-fg">{vibratoTotalSec.toFixed(1)}s</strong>{" "}
              <span className="text-fg-3">
                ({vibratoCount}x{vibratoHz > 0 ? ` · ${vibratoHz}Hz` : ""})
              </span>
            </p>
            <p className="mt-0.5">
              Long Tone: <strong className="font-mono text-fg">{longToneSec.toFixed(1)}s</strong>{" "}
              <span className="text-fg-3">({longToneScore}/100)</span>
            </p>
          </div>
        </div>
      </div>

      {/* Right: 3 Expressive Technique Counters (Scoop · Kobushi · Fall) */}
      <div className="flex flex-col justify-between gap-2 border-t border-line pt-2.5 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-3">
        <span className="text-[11px] font-semibold text-fg">Vocal Inflections</span>
        <div className="grid grid-cols-3 gap-1.5 text-center">
          {[
            { label: "Scoop", count: scoops, hint: "↗" },
            { label: "Kobushi", count: kobushi, hint: "∿" },
            { label: "Fall", count: falls, hint: "↘" },
          ].map((item) => (
            <div key={item.label} className="rounded-md bg-bg px-2 py-1.5">
              <p className="font-mono text-sm font-bold text-fg tabular-nums">
                {item.count}
                <span className="ml-0.5 text-[10px] text-accent-text">{item.hint}</span>
              </p>
              <p className="text-[10px] font-medium text-fg-3">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** In-App Visual Piano Keyboard Vocal Range Map (Lowest to Highest Note vs Song Range). */
function VocalRangeKeyboard({
  singerMin,
  singerMax,
  songMin,
  songMax,
}: {
  singerMin: number | null;
  singerMax: number | null;
  songMin: number | null;
  songMax: number | null;
}) {
  // Render 3 octaves: C3 (48) to B5 (83) -> 21 white keys + black sharps
  const startMidi = 48; // C3
  const endMidi = 83; // B5
  const whiteNotes: number[] = [];
  const isBlack = (m: number) => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);

  for (let m = startMidi; m <= endMidi; m++) {
    if (!isBlack(m)) whiteNotes.push(m);
  }

  const inSinger = (m: number) => singerMin !== null && singerMax !== null && m >= singerMin && m <= singerMax;
  const inSong = (m: number) => songMin !== null && songMax !== null && m >= songMin && m <= songMax;

  return (
    <div className="rounded-lg border border-line bg-surface-2 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <span className="font-semibold text-fg">Vocal Range Keyboard</span>
        <div className="flex items-center gap-3 font-mono text-[10.5px] tabular-nums">
          <span className="text-fg-2">
            You:{" "}
            <strong className="text-accent-text">
              {singerMin !== null && singerMax !== null ? `${noteName(singerMin)} – ${noteName(singerMax)}` : "—"}
            </strong>
          </span>
          <span className="text-fg-3">
            Song: {songMin !== null && songMax !== null ? `${noteName(songMin)} – ${noteName(songMax)}` : "C4 – D5"}
          </span>
        </div>
      </div>

      <div className="relative h-12 w-full overflow-hidden rounded-md border border-line bg-bg select-none">
        <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${whiteNotes.length}, minmax(0, 1fr))` }}>
          {whiteNotes.map((m) => {
            const sung = inSinger(m);
            const ref = inSong(m);
            const isC = m % 12 === 0;
            return (
              <div
                key={m}
                className={cn(
                  "relative flex items-end justify-center border-r border-black/20 pb-0.5 last:border-r-0",
                  sung ? "bg-emerald-400 text-[#050a06]" : ref ? "bg-sky-200 text-zinc-900" : "bg-zinc-100 text-zinc-500",
                )}
              >
                {isC && <span className="font-mono text-[8px] font-bold">{noteName(m)}</span>}
              </div>
            );
          })}
        </div>

        {/* Black keys positioned accurately above white key boundaries */}
        {whiteNotes.map((m, idx) => {
          const sharpMidi = m + 1;
          if (sharpMidi > endMidi || !isBlack(sharpMidi)) return null;
          const leftPct = ((idx + 1) / whiteNotes.length) * 100;
          const widthPct = (0.62 / whiteNotes.length) * 100;
          const sung = inSinger(sharpMidi);
          const ref = inSong(sharpMidi);
          return (
            <span
              key={sharpMidi}
              style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
              className={cn(
                "pointer-events-none absolute top-0 h-[60%] -translate-x-1/2 rounded-b-[2px] border border-black/50",
                sung ? "bg-emerald-600" : ref ? "bg-sky-600" : "bg-zinc-900",
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

/** My Music Karaoke Score (com.ezcompany.karaokemike) Precision Vocal Scoring Screen. */
export function VideokeScore() {
  const score = useVideoke((v) => v.score);
  const minimize = useVideoke((v) => v.minimize);
  const expand = useVideoke((v) => v.expand);
  const dismiss = useVideoke((v) => v.dismiss);
  const playNext = useVideoke((v) => v.playNext);
  const singAgain = useVideoke((v) => v.singAgain);
  const startMic = useVideoke((v) => v.startMic);
  const holdScoreOpen = useVideoke((v) => v.holdScoreOpen);

  const [shownDecimal, setShownDecimal] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [left, setLeft] = useState(AUTO_ADVANCE_MS);
  const played = useRef(0);

  useEffect(() => {
    if (!score || played.current === score.id) return;
    played.current = score.id;
    setRevealed(false);
    const stopSound = playScoreSounds(score.tone, ROLL_SECONDS);
    const started = performance.now();
    const spin = setInterval(() => {
      if (performance.now() - started >= ROLL_SECONDS * 1000) {
        clearInterval(spin);
        setShownDecimal(score.telemetry.scoreDecimal);
        setRevealed(true);
      } else {
        setShownDecimal(Number((55 + Math.random() * 44.999).toFixed(3)));
      }
    }, 45);
    return () => {
      clearInterval(spin);
      if (useVideoke.getState().score?.id !== score.id) stopSound();
    };
  }, [score]);

  useEffect(() => {
    if (!score?.advanceAt) return;
    const tick = () => setLeft(Math.max(0, (score.advanceAt ?? 0) - Date.now()));
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [score?.advanceAt]);

  useEffect(() => {
    if (score?.phase !== "open") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && minimize();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [score?.phase, minimize]);

  if (!score) return null;
  const toneText = TONE_TEXT[score.tone];
  const secondsLeft = Math.ceil(left / 1000);
  const code = songbookCode(score.track.id);
  const tel = score.telemetry;

  const formattedScore = shownDecimal.toFixed(3);
  const [intPart, decPart] = formattedScore.split(".");
  const diffFromAvg = Number((tel.scoreDecimal - tel.avgScoreDecimal).toFixed(3));

  return createPortal(
    <AnimatePresence>
      {score.phase === "open" ? (
        <motion.div
          key="open"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="Karaoke vocal score report"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/82 p-3 md:p-5"
          onClick={minimize}
        >
          <motion.div
            initial={{ scale: 0.95, y: 14 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 60, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="scroll-area relative max-h-[93dvh] w-full max-w-[96vw] overflow-y-auto rounded-xl border border-line-strong bg-surface-1 p-4 shadow-[0_32px_90px_rgba(0,0,0,0.85)] sm:p-5 md:max-w-3xl md:p-6"
          >
            {/* Header Row */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-sm bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent-text">
                    <MicrophoneStageIcon size={13} weight="fill" />
                    <span>{revealed ? "Karaoke Vocal Report" : "Analyzing Vocal Take…"}</span>
                  </span>
                  <span className="font-mono text-[11px] font-medium text-fg-3">#{code}</span>
                </div>
                <h2 className="mt-1 truncate text-base font-bold tracking-tight text-fg md:text-lg">
                  {score.track.title}
                </h2>
                {score.track.artist && (
                  <p className="truncate text-xs text-fg-2">{score.track.artist}</p>
                )}
              </div>

              <button
                type="button"
                onClick={minimize}
                aria-label="Minimize score"
                className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md bg-surface-2 text-fg-2 transition-colors duration-150 hover:bg-surface-3 hover:text-fg"
              >
                <XIcon size={16} />
              </button>
            </div>

            {/* Precision 00.000 pts Score Banner + Rank + Song Average Delta */}
            <div className="mt-3.5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-bg px-4 py-3.5 md:px-6 md:py-4">
              <div className="flex items-baseline gap-1 font-mono tabular-nums">
                <span className={cn("text-5xl leading-none font-black tracking-tight sm:text-6xl md:text-7xl", revealed ? toneText : "text-fg")}>
                  {intPart}
                </span>
                <span className={cn("text-2xl font-extrabold sm:text-3xl", revealed ? toneText : "text-fg-2")}>
                  .{decPart}
                </span>
                <span className="ml-1 text-xs font-bold text-fg-3 uppercase">pts</span>
              </div>

              <div className="flex items-center gap-3">
                {revealed && (
                  <div className="text-right text-xs tabular-nums">
                    <p className="text-fg-3">
                      Average <span className="font-mono font-semibold text-fg-2">{tel.avgScoreDecimal.toFixed(3)}</span>
                    </p>
                    <p className={cn("mt-0.5 font-mono font-bold", diffFromAvg >= 0 ? "text-emerald-400" : "text-amber-400")}>
                      {diffFromAvg >= 0 ? `+${diffFromAvg.toFixed(3)}` : diffFromAvg.toFixed(3)} pts
                    </p>
                  </div>
                )}

                {revealed && (
                  <div
                    className={cn(
                      "flex size-14 shrink-0 flex-col items-center justify-center rounded-lg border-2",
                      TONE_BADGE[score.tone],
                    )}
                  >
                    <span className="text-[9px] font-bold uppercase opacity-80">Rank</span>
                    <span className="font-mono text-2xl leading-none font-black">{score.rank}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Coach Summary Line */}
            <p className="mt-2.5 text-xs leading-relaxed text-fg-2">
              {revealed ? (
                <>
                  <strong className={cn("font-semibold", toneText)}>{score.headline}</strong> — {score.judgeNote}
                </>
              ) : (
                "Calculating reference pitch accuracy, sustained stability, rhythm timing, vibrato waveform & vocal range…"
              )}
            </p>

            {/* Detailed Item-by-Item Analytics (Shown once 1.35s tally finishes) */}
            {revealed && (
              <div className="mt-3.5 flex flex-col gap-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <PentagonRadar axes={score.axes} />
                  <SectionPitchAndRhythm
                    sections={tel.sectionPitch}
                    pitchHitPct={tel.pitchHitPct}
                    rhythmOffsetMs={tel.rhythmOffsetMs}
                  />
                </div>

                <VibratoAndTechniqueCard
                  vibratoCount={tel.vibratoCount}
                  vibratoTotalSec={tel.vibratoTotalSec}
                  vibratoHz={tel.vibratoHz}
                  vibratoSkill={tel.vibratoSkill}
                  vibratoWave={tel.vibratoWave}
                  longToneSec={tel.longToneSec}
                  longToneScore={tel.longToneScore}
                  scoops={tel.scoops}
                  kobushi={tel.kobushi}
                  falls={tel.falls}
                />

                <VocalRangeKeyboard
                  singerMin={tel.singerMinMidi}
                  singerMax={tel.singerMaxMidi}
                  songMin={tel.songMinMidi}
                  songMax={tel.songMaxMidi}
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-4 flex flex-wrap gap-2">
              {!score.heard && (
                <button
                  type="button"
                  onClick={async () => {
                    await startMic();
                    singAgain();
                  }}
                  className="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-accent-soft px-4 text-xs font-semibold text-accent-text transition-colors duration-150 hover:bg-surface-3 active:scale-[0.98]"
                >
                  <MicrophoneStageIcon size={15} weight="fill" />
                  <span>Turn On Live Mic &amp; Sing for Real Precision Score</span>
                </button>
              )}
              <button
                type="button"
                onClick={singAgain}
                className="flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md bg-surface-2 px-4 text-xs font-semibold text-fg transition-colors duration-150 hover:bg-surface-3 active:scale-[0.98]"
              >
                <PlayIcon size={14} weight="fill" />
                <span>Sing Again</span>
              </button>
              {score.hasNext ? (
                <button
                  type="button"
                  onClick={playNext}
                  className="flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md bg-fg px-4 text-xs font-semibold text-bg transition-opacity duration-150 hover:opacity-90 active:scale-[0.98]"
                >
                  <SkipForwardIcon size={14} weight="fill" />
                  <span>Next Reserved</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={dismiss}
                  className="flex h-10 flex-1 cursor-pointer items-center justify-center rounded-md bg-fg px-4 text-xs font-semibold text-bg transition-opacity duration-150 hover:opacity-90 active:scale-[0.98]"
                >
                  Done
                </button>
              )}
            </div>

            {score.advanceAt && (
              <div className="mt-3.5">
                <div className="h-1 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full bg-accent transition-[width] duration-100 ease-linear"
                    style={{ width: `${(left / AUTO_ADVANCE_MS) * 100}%` }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-fg-3">
                  <span>
                    {score.hasNext ? `Next reserved song in ${secondsLeft}s` : `Auto-minimizing in ${secondsLeft}s`}
                  </span>
                  <button
                    type="button"
                    onClick={holdScoreOpen}
                    className="cursor-pointer font-semibold text-fg-2 underline-offset-2 hover:text-fg hover:underline"
                  >
                    Keep open
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      ) : (
        <motion.div
          key="mini"
          initial={{ opacity: 0, y: 24, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24 }}
          className="fixed right-3 bottom-[calc(142px+env(safe-area-inset-bottom))] z-[45] md:right-5 md:bottom-[104px]"
        >
          <div className="flex items-center gap-2.5 rounded-lg border border-line-strong bg-surface-1 py-1.5 pr-2 pl-2.5 shadow-[0_16px_40px_rgba(0,0,0,0.6)]">
            <button
              type="button"
              onClick={expand}
              className="flex min-w-0 cursor-pointer items-center gap-2.5 text-left"
              title="Show full vocal score report"
            >
              <span className={cn("font-mono text-base font-black tabular-nums", toneText)}>
                {tel.scoreDecimal.toFixed(3)}
              </span>
              <span className="min-w-0 max-w-[180px] md:max-w-[220px]">
                <span className={cn("block truncate text-xs font-bold", toneText)}>
                  Rank {score.rank} · {score.track.title}
                </span>
              </span>
              <ArrowsOutIcon size={14} className="shrink-0 text-fg-3" />
            </button>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Close score"
              className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-md text-fg-3 hover:bg-surface-3 hover:text-fg"
            >
              <XIcon size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
