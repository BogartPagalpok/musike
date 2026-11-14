import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/format";
import { AUTO_ADVANCE_MS, playScoreSounds, useVideoke, type ScoreTone } from "../stores/videoke";
import { ArrowsOutIcon, MicrophoneStageIcon, PlayIcon, SkipForwardIcon, XIcon } from "./icons";

const ROLL_SECONDS = 1.6;

const TONE_TEXT: Record<ScoreTone, string> = {
  bad: "text-danger",
  meh: "text-amber-300",
  good: "text-sky-300",
  great: "text-accent-text",
};

const TONE_BAR: Record<ScoreTone, string> = {
  bad: "bg-danger",
  meh: "bg-amber-400",
  good: "bg-sky-400",
  great: "bg-accent",
};

/** Karaoke-machine score screen: drumroll, big number, a roast, then it tucks itself away after 10 s. */
export function VideokeScore() {
  const score = useVideoke((v) => v.score);
  const minimize = useVideoke((v) => v.minimize);
  const expand = useVideoke((v) => v.expand);
  const dismiss = useVideoke((v) => v.dismiss);
  const playNext = useVideoke((v) => v.playNext);
  const singAgain = useVideoke((v) => v.singAgain);
  const [shown, setShown] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [left, setLeft] = useState(AUTO_ADVANCE_MS);
  const played = useRef(0);

  // Drumroll + counter, once per score.
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
      } else setShown(Math.floor(40 + Math.random() * 60));
    }, 55);
    return () => {
      clearInterval(spin);
      // Only cut the sound if a different score replaced this one.
      if (useVideoke.getState().score?.id !== score.id) stopSound();
    };
  }, [score]);

  // Countdown to the next song.
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
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-3 backdrop-blur-md md:p-6"
          onClick={minimize}
        >
          <motion.div
            initial={{ scale: 0.88, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.85, y: 120, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[95vw] overflow-hidden rounded-[28px] border border-white/20 bg-surface-1/95 p-6 text-center shadow-[0_36px_100px_rgba(0,0,0,0.85)] backdrop-blur-2xl sm:max-w-lg md:max-w-2xl md:rounded-[34px] md:p-9"
          >
            <button
              type="button"
              onClick={minimize}
              aria-label="Minimize score"
              className="absolute top-4 right-4 grid size-10 place-items-center rounded-full bg-surface-3/70 text-fg-2 transition-colors hover:bg-surface-4 hover:text-fg md:top-5 md:right-5 md:size-11"
            >
              <XIcon size={20} />
            </button>

            <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-4 py-1.5 text-xs font-extrabold tracking-widest text-accent-text uppercase md:text-sm">
              <MicrophoneStageIcon size={16} weight="fill" />
              <span>{revealed ? score.badge : "Scoring…"}</span>
            </span>
            <p className="mt-3 truncate text-base font-bold text-fg-2 md:text-lg">{score.track.title}</p>

            <div className="my-5 flex flex-col items-center justify-center rounded-[24px] border border-line-strong bg-bg/80 py-6 shadow-inner md:my-6 md:rounded-[28px] md:py-8">
              <span className="text-xs font-extrabold tracking-[0.26em] text-fg-3 uppercase md:text-sm">Your Score</span>
              <motion.span
                key={revealed ? "final" : "rolling"}
                initial={revealed ? { scale: 1.55 } : false}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 380, damping: 14 }}
                className={cn(
                  "mt-1 font-mono text-[88px] leading-none font-black tracking-tighter tabular-nums sm:text-[104px] md:text-[136px]",
                  revealed ? toneText : "text-fg",
                )}
              >
                {String(shown).padStart(2, "0")}
              </motion.span>
            </div>

            <div className="min-h-[78px] md:min-h-[92px]">
              {revealed ? (
                <>
                  <h2 className={cn("text-3xl font-black tracking-tight sm:text-4xl md:text-[42px] md:leading-tight", toneText)}>
                    {score.headline}
                  </h2>
                  <p className="mx-auto mt-2 max-w-lg text-base leading-relaxed font-medium text-fg-2 md:text-lg">
                    {score.roast}
                  </p>
                </>
              ) : (
                <p className="pt-5 text-base font-medium text-fg-3 md:text-lg">
                  Checking pitch, stability, expression, technique and rhythm…
                </p>
              )}
            </div>

            {revealed && (
              <div className="mt-5 grid gap-2 rounded-[18px] border border-line bg-bg/55 p-4 text-left md:mt-6 md:grid-cols-2 md:gap-x-6 md:gap-y-2.5 md:p-5">
                {score.axes.map((ax) => (
                  <div key={ax.label} className="flex items-center gap-3 text-xs md:text-[13px]">
                    <span className="w-22 shrink-0 font-bold text-fg-2">{ax.label}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                      <span className={cn("block h-full rounded-full transition-all duration-500", TONE_BAR[score.tone])} style={{ width: `${ax.value}%` }} />
                    </span>
                    <span className="w-8 text-right font-mono font-extrabold text-fg tabular-nums">{ax.value}</span>
                  </div>
                ))}
                {!score.heard && (
                  <p className="pt-1 text-xs text-fg-3 md:col-span-2">
                    Mic was off, so the machine guessed. Turn on the mic for a real score.
                  </p>
                )}
              </div>
            )}

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={singAgain}
                className="flex h-12 items-center justify-center gap-2 rounded-full bg-surface-3 px-4 text-sm font-bold text-fg transition-colors hover:bg-surface-4 active:scale-95 md:h-13 md:text-base"
              >
                <PlayIcon size={16} weight="fill" />
                Sing again
              </button>
              {score.hasNext ? (
                <button
                  type="button"
                  onClick={playNext}
                  className="flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-4 text-sm font-bold text-accent-ink transition-transform hover:brightness-110 active:scale-95 md:h-13 md:text-base"
                >
                  <SkipForwardIcon size={16} weight="fill" />
                  Next song
                </button>
              ) : (
                <button
                  type="button"
                  onClick={dismiss}
                  className="flex h-12 items-center justify-center rounded-full bg-accent px-4 text-sm font-bold text-accent-ink transition-transform hover:brightness-110 active:scale-95 md:h-13 md:text-base"
                >
                  Done
                </button>
              )}
            </div>

            {score.advanceAt && (
              <div className="mt-5">
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full bg-accent transition-[width] duration-100 ease-linear" style={{ width: `${(left / AUTO_ADVANCE_MS) * 100}%` }} />
                </div>
                <p className="mt-2 text-xs font-medium text-fg-3 md:text-sm">
                  {score.hasNext ? `Next reserved song in ${secondsLeft}s` : `Minimizing in ${secondsLeft}s`}
                </p>
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
          <div className="flex items-center gap-3 rounded-full border border-white/20 bg-surface-1/95 py-2 pr-2 pl-2 shadow-[0_16px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            <button type="button" onClick={expand} className="flex min-w-0 items-center gap-3 text-left" title="Show score">
              <span className={cn("grid size-12 shrink-0 place-items-center rounded-full bg-bg font-mono text-xl font-black tabular-nums md:size-14 md:text-2xl", toneText)}>
                {score.score}
              </span>
              <span className="min-w-0 max-w-[200px] md:max-w-[240px]">
                <span className={cn("block truncate text-sm font-extrabold md:text-base", toneText)}>{score.headline}</span>
                <span className="block truncate text-xs text-fg-3">{score.track.title}</span>
              </span>
              <ArrowsOutIcon size={16} className="shrink-0 text-fg-3" />
            </button>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Close score"
              className="grid size-9 shrink-0 place-items-center rounded-full text-fg-3 hover:bg-surface-3 hover:text-fg"
            >
              <XIcon size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

