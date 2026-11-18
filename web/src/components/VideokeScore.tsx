import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/format";
import { AUTO_ADVANCE_MS, playScoreSounds, songbookCode, useVideoke, type ScoreTone } from "../stores/videoke";
import { ArrowsOutIcon, MicrophoneStageIcon, PlayIcon, SkipForwardIcon, XIcon } from "./icons";

const ROLL_SECONDS = 1.5;

const TONE_TEXT: Record<ScoreTone, string> = {
  bad: "text-danger",
  meh: "text-amber-300",
  good: "text-sky-300",
  great: "text-accent-text",
};

const TONE_RING: Record<ScoreTone, string> = {
  bad: "border-danger/45 bg-danger/12 text-danger",
  meh: "border-amber-400/45 bg-amber-400/12 text-amber-300",
  good: "border-sky-400/45 bg-sky-400/12 text-sky-300",
  great: "border-accent/55 bg-accent-soft text-accent-text",
};

function axisBarColor(val: number): string {
  if (val >= 88) return "bg-emerald-400";
  if (val >= 76) return "bg-sky-400";
  if (val >= 62) return "bg-amber-400";
  return "bg-danger";
}

/** Karaoke-machine & Utavie vocal judge score screen: drumroll, giant score + rank, funny roast, 5-axis breakdown. */
export function VideokeScore() {
  const score = useVideoke((v) => v.score);
  const minimize = useVideoke((v) => v.minimize);
  const expand = useVideoke((v) => v.expand);
  const dismiss = useVideoke((v) => v.dismiss);
  const playNext = useVideoke((v) => v.playNext);
  const singAgain = useVideoke((v) => v.singAgain);
  const startMic = useVideoke((v) => v.startMic);
  const holdScoreOpen = useVideoke((v) => v.holdScoreOpen);

  const [shown, setShown] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [left, setLeft] = useState(AUTO_ADVANCE_MS);
  const played = useRef(0);

  // Drumroll + spinning counter, once per score event.
  useEffect(() => {
    if (!score || played.current === score.id) return;
    played.current = score.id;
    setRevealed(false);
    const stopSound = playScoreSounds(score.tone, ROLL_SECONDS);
    const started = performance.now();
    const spin = setInterval(() => {
      if (performance.now() - started >= ROLL_SECONDS * 1000) {
        clearInterval(spin);
        setShown(score.score);
        setRevealed(true);
      } else {
        setShown(Math.floor(35 + Math.random() * 65));
      }
    }, 50);
    return () => {
      clearInterval(spin);
      if (useVideoke.getState().score?.id !== score.id) stopSound();
    };
  }, [score]);

  // Countdown to auto-minimize / next reserved song.
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
          aria-label="Videoke score"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/82 p-3 md:p-6"
          onClick={minimize}
        >
          <motion.div
            initial={{ scale: 0.94, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 80, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="scroll-area relative max-h-[92dvh] w-full max-w-[95vw] overflow-y-auto rounded-[20px] border border-line-strong bg-surface-1 p-5 text-center shadow-[0_32px_90px_rgba(0,0,0,0.85)] sm:max-w-lg sm:p-6 md:max-w-2xl md:rounded-[24px] md:p-8"
          >
            <button
              type="button"
              onClick={minimize}
              aria-label="Minimize score"
              className="absolute top-3.5 right-3.5 grid size-9 place-items-center rounded-full bg-surface-3/80 text-fg-2 transition-colors hover:bg-surface-4 hover:text-fg md:top-5 md:right-5 md:size-10"
            >
              <XIcon size={18} />
            </button>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3.5 py-1 text-[11px] font-extrabold tracking-widest text-accent-text uppercase md:text-xs">
                <MicrophoneStageIcon size={14} weight="fill" />
                <span>{revealed ? score.badge : "Judging Vocals…"}</span>
              </span>
              <span className="rounded-full bg-surface-3/80 px-2.5 py-1 font-mono text-[11px] font-bold text-fg-3">
                SONG #{code}
              </span>
            </div>

            <p className="mt-2.5 truncate px-6 text-sm font-bold text-fg-2 md:text-base">{score.track.title}</p>

            {/* Giant Score Readout + Rank Stamp */}
            <div className="my-4 flex items-center justify-center gap-4 rounded-[22px] border border-line-strong bg-bg/85 px-5 py-5 shadow-inner md:my-5 md:gap-7 md:rounded-[26px] md:py-7">
              <div className="flex flex-col items-center">
                <span className="text-[11px] font-extrabold tracking-[0.24em] text-fg-3 uppercase md:text-xs">
                  {score.heard ? "Vocal Score" : "Party Roll"}
                </span>
                <motion.span
                  key={revealed ? "final" : "rolling"}
                  initial={revealed ? { scale: 1.45 } : false}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 14 }}
                  className={cn(
                    "mt-0.5 font-mono text-[82px] leading-none font-black tracking-tighter tabular-nums sm:text-[98px] md:text-[124px]",
                    revealed ? toneText : "text-fg",
                  )}
                >
                  {String(shown).padStart(2, "0")}
                </motion.span>
              </div>

              {revealed && (
                <motion.div
                  initial={{ scale: 0.4, rotate: -14, opacity: 0 }}
                  animate={{ scale: 1, rotate: -4, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 420, damping: 16 }}
                  className={cn(
                    "flex size-16 shrink-0 flex-col items-center justify-center rounded-2xl border-2 shadow-lg sm:size-20 md:size-24",
                    TONE_RING[score.tone],
                  )}
                >
                  <span className="text-[9px] font-extrabold tracking-widest uppercase opacity-80 md:text-[10px]">
                    Rank
                  </span>
                  <span className="font-mono text-2xl leading-none font-black sm:text-3xl md:text-4xl">
                    {score.rank}
                  </span>
                </motion.div>
              )}
            </div>

            {/* Judge's Verdict & Roast */}
            <div className="min-h-[68px] md:min-h-[78px]">
              {revealed ? (
                <>
                  <h2 className={cn("text-2xl font-black tracking-tight sm:text-3xl md:text-4xl", toneText)}>
                    {score.headline}
                  </h2>
                  <p className="mx-auto mt-1.5 max-w-lg text-sm leading-relaxed font-medium text-fg-2 md:text-base">
                    “{score.roast}”
                  </p>
                </>
              ) : (
                <p className="pt-4 text-sm font-medium text-fg-3 md:text-base">
                  Analyzing intonation, note stability, vibrato, dynamic swell &amp; phrasing…
                </p>
              )}
            </div>

            {/* 5-Axis Utavie Vocal Breakdown + Judge's Technical Note */}
            {revealed && (
              <div className="mt-4 rounded-[18px] border border-line bg-bg/60 p-3.5 text-left md:mt-5 md:p-4">
                <div className="grid gap-2 md:grid-cols-2 md:gap-x-6 md:gap-y-2.5">
                  {score.axes.map((ax) => (
                    <div key={ax.label} className="flex items-center gap-2.5 text-xs md:text-[13px]">
                      <span className="w-20 shrink-0 font-bold text-fg-2">{ax.label}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                        <span
                          className={cn("block h-full rounded-full transition-[width] duration-300", axisBarColor(ax.value))}
                          style={{ width: `${ax.value}%` }}
                        />
                      </span>
                      <span className="w-8 text-right font-mono font-extrabold text-fg tabular-nums">{ax.value}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 border-t border-line/70 pt-2 text-[11.5px] leading-snug text-fg-3 md:text-xs">
                  <strong className="font-semibold text-fg-2">Judge’s report:</strong> {score.judgeNote}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-5 flex flex-wrap gap-2.5">
              {!score.heard && (
                <button
                  type="button"
                  onClick={async () => {
                    await startMic();
                    singAgain();
                  }}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-emerald-500/20 px-4 text-xs font-bold text-emerald-300 ring-1 ring-emerald-400/40 transition-colors hover:bg-emerald-500/30 active:scale-95 md:text-sm"
                >
                  <MicrophoneStageIcon size={16} weight="fill" />
                  <span>Turn On Mic &amp; Sing for Real Score</span>
                </button>
              )}
              <button
                type="button"
                onClick={singAgain}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-surface-3 px-4 text-xs font-bold text-fg transition-colors hover:bg-surface-4 active:scale-95 md:h-12 md:text-sm"
              >
                <PlayIcon size={15} weight="fill" />
                <span>Sing Again</span>
              </button>
              {score.hasNext ? (
                <button
                  type="button"
                  onClick={playNext}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-accent px-4 text-xs font-bold text-accent-ink transition-transform hover:brightness-110 active:scale-95 md:h-12 md:text-sm"
                >
                  <SkipForwardIcon size={15} weight="fill" />
                  <span>Next Reserved</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={dismiss}
                  className="flex h-11 flex-1 items-center justify-center rounded-full bg-accent px-4 text-xs font-bold text-accent-ink transition-transform hover:brightness-110 active:scale-95 md:h-12 md:text-sm"
                >
                  Done
                </button>
              )}
            </div>

            {score.advanceAt && (
              <div className="mt-4">
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full bg-accent transition-[width] duration-100 ease-linear"
                    style={{ width: `${(left / AUTO_ADVANCE_MS) * 100}%` }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-fg-3 md:text-xs">
                  <span>
                    {score.hasNext ? `Next reserved song in ${secondsLeft}s` : `Auto-minimizing in ${secondsLeft}s`}
                  </span>
                  <button
                    type="button"
                    onClick={holdScoreOpen}
                    className="font-semibold text-fg-2 underline-offset-2 hover:text-fg hover:underline"
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
          initial={{ opacity: 0, y: 30, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30 }}
          className="fixed right-3 bottom-[calc(142px+env(safe-area-inset-bottom))] z-[45] md:right-5 md:bottom-[108px]"
        >
          <div className="flex items-center gap-2.5 rounded-full border border-line-strong bg-surface-1 py-1.5 pr-2 pl-2 shadow-[0_16px_40px_rgba(0,0,0,0.6)]">
            <button type="button" onClick={expand} className="flex min-w-0 items-center gap-2.5 text-left" title="Show full score">
              <span
                className={cn(
                  "grid size-11 shrink-0 place-items-center rounded-full bg-bg font-mono text-lg font-black tabular-nums md:size-13 md:text-xl",
                  toneText,
                )}
              >
                {score.score}
              </span>
              <span className="min-w-0 max-w-[190px] md:max-w-[230px]">
                <span className={cn("block truncate text-xs font-extrabold md:text-sm", toneText)}>
                  {score.rank} · {score.headline}
                </span>
                <span className="block truncate text-[11px] text-fg-3">{score.track.title}</span>
              </span>
              <ArrowsOutIcon size={15} className="shrink-0 text-fg-3" />
            </button>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Close score"
              className="grid size-8 shrink-0 place-items-center rounded-full text-fg-3 hover:bg-surface-3 hover:text-fg"
            >
              <XIcon size={15} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
