import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/format";
import { getCachedVocalGuide, loadVocalGuide, subscribeVocalGuide, type VocalGuideTrack } from "../lib/vocalGuide";
import { getExactPlaybackTime, selectCurrent, usePlayer } from "../player/player";
import { noteName, pitchTrail, useVideoke } from "../stores/videoke";
import { MicrophoneStageIcon, WaveformIcon } from "./icons";

/** Playhead sits at 27% from the left so 73% of the display shows UPCOMING target notes scrolling in! */
const NOW_X = 0.27;
const PAST_SEC = 1.8;
const AHEAD_SEC = 4.8;
const SPAN = 16; // semitones visible vertically

/**
 * DAM / Joysound / Utavie-style Visual Vocal Pitch Guide:
 * - Scrolls upcoming Target Vocal Guide Bars (with note names like G4, A4, C5) right-to-left synced to the video.
 * - Auto-adapts octave register to the singer's voice and lights up bars Gold/Emerald when hit in tune!
 * - Works both as an On-Video Top Display HUD (`overlay`) and as a standalone docked panel.
 */
export function PitchGuide({
  className,
  compact = false,
  overlay = false,
}: {
  className?: string;
  compact?: boolean;
  /** Renders directly across the top of the Karaoke Video Display like a real karaoke machine HUD */
  overlay?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const track = usePlayer(selectCurrent);
  const micOn = useVideoke((v) => v.micOn);
  const live = useVideoke((v) => v.live);
  const level = useVideoke((v) => v.micLevel);
  const stats = useVideoke((v) => v.liveStats);
  const startMic = useVideoke((v) => v.startMic);
  const stopMic = useVideoke((v) => v.stopMic);

  const [guide, setGuide] = useState<VocalGuideTrack | null>(() =>
    track ? getCachedVocalGuide(track.id) : null,
  );
  const [hudTarget, setHudTarget] = useState<{ note: string; countdownSec: number | null } | null>(null);

  const guideRef = useRef<VocalGuideTrack | null>(guide);
  guideRef.current = guide;

  const centerRef = useRef(64);

  // Load real studio-extracted vocal melody guide (subscribes to progressive hi-fi vocal contour upgrade)
  useEffect(() => {
    if (!track) {
      setGuide(null);
      return;
    }
    setGuide(getCachedVocalGuide(track.id));
    const unsub = subscribeVocalGuide(track.id, (updated) => {
      setGuide(updated);
    });
    void loadVocalGuide(track);
    return () => {
      unsub();
    };
  }, [track?.id]);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let raf = 0;
    let frameCount = 0;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const dpr = window.devicePixelRatio || 1;
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) {
        el.width = Math.round(w * dpr);
        el.height = Math.round(h * dpr);
      }
      const g = el.getContext("2d");
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);

      const css = getComputedStyle(el);
      const accent = css.getPropertyValue("--accent").trim() || "#c3ec52";
      const now = performance.now();
      const songSec = getExactPlaybackTime();
      const activeGuide = guideRef.current;

      const recentVoice = pitchTrail
        .filter((p) => p.midi !== null && now - p.t < 4000)
        .map((p) => p.midi as number);

      let guideMedian = 64;
      if (activeGuide && activeGuide.bars.length > 0) {
        const windowBars = activeGuide.bars.filter(
          (b) => b.end >= songSec - 4 && b.start <= songSec + 8,
        );
        const sample = windowBars.length ? windowBars : activeGuide.bars.slice(0, 16);
        const mids = sample.map((b) => b.midi).sort((a, b) => a - b);
        guideMedian = Math.max(58, Math.min(72, mids[Math.floor(mids.length / 2)] ?? 64));
      }

      centerRef.current += (guideMedian - centerRef.current) * 0.08;

      const low = Math.round(centerRef.current) - Math.floor(SPAN / 2);
      const laneH = h / SPAN;
      const yOf = (midi: number) => h - (midi - low + 0.5) * laneH;
      const foldVoiceToStaff = (midi: number) => {
        let v = midi;
        while (v - centerRef.current > 7.5) v -= 12;
        while (centerRef.current - v > 7.5) v += 12;
        return v;
      };
      const nowX = w * NOW_X;

      const xOfSongSec = (sec: number) => {
        const dt = sec - songSec;
        return dt >= 0
          ? nowX + (dt / AHEAD_SEC) * (w - nowX)
          : nowX + (dt / PAST_SEC) * nowX;
      };

      // 1. Piano-roll semitone lanes & octave/fifth reference lines
      for (let i = 0; i < SPAN; i++) {
        const midi = low + i;
        const pc = ((midi % 12) + 12) % 12;
        const sharp = [1, 3, 6, 8, 10].includes(pc);
        const topY = h - (i + 1) * laneH;

        g.fillStyle = sharp
          ? overlay
            ? "rgba(0,0,0,0.28)"
            : "rgba(0,0,0,0.3)"
          : "rgba(255,255,255,0.035)";
        g.fillRect(0, topY, w, laneH);

        g.fillStyle = "rgba(255,255,255,0.055)";
        g.fillRect(0, topY, w, 0.5);

        if (pc === 0 || pc === 4 || pc === 7) {
          g.fillStyle = pc === 0 ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.09)";
          g.fillRect(0, topY + laneH - 1, w, 1);
          if (laneH >= 5.2 && (pc === 0 || pc === 7)) {
            g.fillStyle = pc === 0 ? "rgba(255,255,255,0.68)" : "rgba(255,255,255,0.4)";
            g.font = "700 9px ui-monospace, SFMono-Regular, monospace";
            g.fillText(noteName(midi), 5, topY + laneH - 1.5);
          }
        }
      }

      // 2. Render UPCOMING & ACTIVE TARGET VOCAL GUIDE BARS (scrolling right -> left!)
      let currentTargetNote: string | null = null;
      let nextUpcomingBar: { note: string; inSec: number } | null = null;

      if (activeGuide) {
        const barH = Math.max(6, Math.min(13, laneH * 0.82));

        // Check whether live voice is currently hitting the target pitch class
        const latestVoice =
          recentVoice.length && pitchTrail[pitchTrail.length - 1]?.midi !== null &&
          now - (pitchTrail[pitchTrail.length - 1]?.t ?? 0) < 220
            ? (pitchTrail[pitchTrail.length - 1].midi as number)
            : null;

        for (const b of activeGuide.bars) {
          if (b.end < songSec - PAST_SEC) continue;
          if (b.start > songSec + AHEAD_SEC) {
            if (!nextUpcomingBar) {
              nextUpcomingBar = {
                note: noteName(b.midi),
                inSec: b.start - songSec,
              };
            }
            break;
          }

          if (!nextUpcomingBar && b.start > songSec) {
            nextUpcomingBar = {
              note: noteName(b.midi),
              inSec: b.start - songSec,
            };
          }

          const midi = b.midi;
          const x0 = xOfSongSec(b.start);
          const x1 = Math.max(x0 + 8, xOfSongSec(b.end));
          const y = yOf(midi);
          const r = Math.min(barH / 2, 5);
          const isActiveAtPlayhead = songSec >= b.start && songSec <= b.end;

          if (isActiveAtPlayhead) {
            currentTargetNote = noteName(midi);
          }

          // Did the singer hit this guide bar's note (modulo octave within ±1.1 semitones)?
          const hittingNow =
            isActiveAtPlayhead &&
            latestVoice !== null &&
            Math.min(
              Math.abs(((latestVoice - midi) % 12 + 18) % 12 - 6),
              Math.abs(latestVoice - midi),
            ) <= 1.15;

          // Base guide bar capsule (bright translucent silver-blue ahead of playhead)
          g.save();
          if (isActiveAtPlayhead) {
            g.shadowColor = hittingNow ? "#fbbf24" : "#38bdf8";
            g.shadowBlur = hittingNow ? 16 : 11;
          }
          g.fillStyle = hittingNow
            ? "rgba(251, 191, 36, 0.42)"
            : isActiveAtPlayhead
              ? "rgba(56, 189, 248, 0.36)"
              : b.end < songSec
                ? "rgba(255, 255, 255, 0.14)"
                : "rgba(226, 232, 240, 0.28)";
          g.strokeStyle = hittingNow
            ? "#fde047"
            : isActiveAtPlayhead
              ? "#7dd3fc"
              : b.end < songSec
                ? "rgba(255, 255, 255, 0.24)"
                : "rgba(255, 255, 255, 0.62)";
          g.lineWidth = isActiveAtPlayhead ? 1.8 : 1.15;

          g.beginPath();
          g.roundRect(x0, y - barH / 2, x1 - x0, barH, r);
          g.fill();
          g.stroke();

          // Progress fill inside active guide bar up to playhead
          if (x0 < nowX && x1 > x0) {
            const fillRight = Math.min(nowX, x1);
            g.fillStyle = hittingNow ? "rgba(52, 211, 153, 0.72)" : "rgba(195, 236, 82, 0.35)";
            g.beginPath();
            g.roundRect(x0, y - barH / 2, Math.max(2, fillRight - x0), barH, r);
            g.fill();
          }
          g.restore();

          // Note name (+ syllable hint) printed clearly for the singer!
          const label = noteName(midi);
          const barW = x1 - x0;
          if (barW >= 22) {
            g.fillStyle = isActiveAtPlayhead ? "#ffffff" : "rgba(255,255,255,0.92)";
            g.font = "800 9.5px ui-monospace, SFMono-Regular, monospace";
            const text =
              !compact && b.syllable && barW >= 54 ? `${label} ${b.syllable}` : label;
            g.save();
            g.beginPath();
            g.rect(x0 + 2, y - barH - 2, barW - 4, barH * 2 + 4);
            g.clip();
            g.fillText(text, x0 + 4.5, y + 3.2);
            g.restore();
          }
        }
      }

      // 3. Playhead laser line ("SING HERE" at NOW_X = 27%)
      const grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "rgba(56, 189, 248, 0.2)");
      grad.addColorStop(0.5, "rgba(255, 255, 255, 0.9)");
      grad.addColorStop(1, "rgba(56, 189, 248, 0.2)");
      g.fillStyle = grad;
      g.fillRect(nowX - 0.75, 0, 2, h);

      // 4. Singer's live microphone pitch trail (to the left of NOW_X, past 1.8 seconds)
      const xOfPerfMs = (tMs: number) => nowX - ((now - tMs) / (PAST_SEC * 1000)) * nowX;

      g.lineCap = "round";
      g.lineJoin = "round";
      let prevPt: { x: number; y: number } | null = null;
      for (const p of pitchTrail) {
        if (now - p.t > PAST_SEC * 1000) continue;
        if (p.midi === null) {
          prevPt = null;
          continue;
        }
        const x = xOfPerfMs(p.t);
        const y = yOf(foldVoiceToStaff(p.midi));
        const err = Math.abs(p.midi - Math.round(p.midi)) * 100;
        const col = err <= 15 ? "#34d399" : err <= 26 ? accent : "#fbbf24";
        if (prevPt && Math.abs(prevPt.y - y) < laneH * 5.5) {
          g.strokeStyle = col;
          g.shadowColor = col;
          g.shadowBlur = 8;
          g.lineWidth = 3;
          g.beginPath();
          g.moveTo(prevPt.x, prevPt.y);
          g.lineTo(x, y);
          g.stroke();
          g.shadowBlur = 0;
        }
        prevPt = { x, y };
      }

      // 5. Live glowing singer pitch orb on the playhead
      const last = pitchTrail[pitchTrail.length - 1];
      if (last && last.midi !== null && now - last.t < 240) {
        const y = yOf(foldVoiceToStaff(last.midi));
        const err = Math.abs(last.midi - Math.round(last.midi)) * 100;
        const orbColor = err <= 15 ? "#34d399" : err <= 26 ? accent : "#fbbf24";
        g.fillStyle = "#ffffff";
        g.shadowColor = orbColor;
        g.shadowBlur = 16;
        g.beginPath();
        g.arc(nowX, y, Math.max(4.5, laneH * 0.55), 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = orbColor;
        g.lineWidth = 2;
        g.stroke();
        g.shadowBlur = 0;
      }

      // Publish target note & intro countdown to React header ~6x/sec
      if (frameCount++ % 10 === 0) {
        if (currentTargetNote) {
          setHudTarget({ note: currentTargetNote, countdownSec: null });
        } else if (nextUpcomingBar && nextUpcomingBar.inSec >= 1.5) {
          setHudTarget({
            note: nextUpcomingBar.note,
            countdownSec: Math.ceil(nextUpcomingBar.inSec),
          });
        } else if (nextUpcomingBar) {
          setHudTarget({ note: nextUpcomingBar.note, countdownSec: null });
        } else {
          setHudTarget(null);
        }
      }
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, [compact, overlay]);

  const inTune = live && Math.abs(live.cents) <= 22;
  const perfect = live && Math.abs(live.cents) <= 12;
  const vibratoRecent = stats.lastVibratoAt > 0 && performance.now() - stats.lastVibratoAt < 2200;

  return (
    <div
      className={cn(
        "relative overflow-hidden select-none",
        overlay
          ? "border-b border-white/15 bg-gradient-to-b from-black/90 via-black/78 to-black/45"
          : "rounded-[14px] border border-white/14 bg-black/85 shadow-inner",
        className,
      )}
    >
      {/* Top Telemetry & Target Note Strip */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-white/10 px-3 py-1.5 text-[11px] text-white/90">
        <span className="flex items-center gap-1.5 font-extrabold tracking-wider text-white uppercase">
          <WaveformIcon size={13} className="shrink-0 text-sky-300" />
          <span>Vocal Guide</span>
        </span>

        {/* Syncing / Target Note / Intro Countdown Pill */}
        {guide?.syncing ? (
          <span className="animate-pulse rounded-full bg-sky-500/20 px-2.5 py-0.5 font-mono text-[10.5px] font-bold text-sky-200 ring-1 ring-sky-400/30">
            Syncing vocal melody…
          </span>
        ) : hudTarget ? (
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 font-mono text-[10.5px] font-extrabold tabular-nums",
              hudTarget.countdownSec !== null
                ? "bg-sky-500/25 text-sky-200 ring-1 ring-sky-400/35"
                : "bg-zinc-800 text-white ring-1 ring-white/25",
            )}
          >
            {hudTarget.countdownSec !== null
              ? `♪ Instrumental · ${hudTarget.note} in ${hudTarget.countdownSec}s`
              : `Hit Note: ${hudTarget.note}`}
          </span>
        ) : null}

        {micOn && stats.notesHit > 0 && (
          <div className="hidden items-center gap-1.5 sm:flex">
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300 tabular-nums">
              {stats.inTunePct}% in tune
            </span>
            {stats.streak >= 3 && (
              <span className="rounded-full bg-amber-400/20 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-300 tabular-nums">
                {stats.streak}x
              </span>
            )}
            {vibratoRecent && (
              <span className="animate-pulse rounded-full bg-sky-400/25 px-2 py-0.5 text-[10px] font-bold text-sky-200">
                〰 Vibrato!
              </span>
            )}
            {stats.runningScore !== null && (
              <span className="rounded-full bg-accent/20 px-2 py-0.5 font-mono text-[10px] font-extrabold text-accent-text tabular-nums">
                Score {stats.runningScore}
              </span>
            )}
          </div>
        )}

        <span className="flex-1" />

        {micOn ? (
          <>
            <span className="hidden h-1.5 w-10 overflow-hidden rounded-full bg-zinc-800 md:flex" aria-hidden="true">
              <span
                className="h-full bg-emerald-400 transition-[width] duration-75"
                style={{ width: `${Math.round(level * 100)}%` }}
              />
            </span>
            <span
              className={cn(
                "min-w-[82px] text-right font-mono font-bold tabular-nums",
                live ? (perfect ? "text-emerald-300" : inTune ? "text-lime-300" : "text-amber-300") : "text-white/50",
              )}
            >
              {live ? `You: ${noteName(live.midi)} ${live.cents >= 0 ? "+" : ""}${live.cents}¢` : "Sing now…"}
            </span>
          </>
        ) : (
          <span className="hidden text-[10.5px] text-white/60 sm:inline">
            Follow the notes · Turn mic on to score
          </span>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (micOn) stopMic();
            else void startMic();
          }}
          className={cn(
            "flex h-6 items-center gap-1 rounded-full px-2.5 text-[11px] font-bold transition-colors active:scale-95",
            micOn
              ? "bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/40 hover:bg-emerald-500/35"
              : "bg-accent text-accent-ink hover:brightness-110",
          )}
        >
          <MicrophoneStageIcon size={12} weight={micOn ? "fill" : "regular"} />
          <span>{micOn ? "Mic On" : "Turn Mic On"}</span>
        </button>
      </div>

      {/* Scrolling Vocal Guide + Live Voice Canvas (NEVER covered or dimmed so notes are always clear!) */}
      <div className={cn("relative", overlay ? "h-[78px] md:h-[92px]" : compact ? "h-[88px]" : "h-28 md:h-32")}>
        <canvas ref={canvas} className="absolute inset-0 size-full" />
      </div>
    </div>
  );
}
