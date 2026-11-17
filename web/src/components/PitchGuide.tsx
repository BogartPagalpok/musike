import { useEffect, useRef } from "react";
import { cn } from "../lib/format";
import { noteName, pitchTrail, useVideoke } from "../stores/videoke";
import { MicrophoneStageIcon, WaveformIcon } from "./icons";

const WINDOW_MS = 6000;
/** Where "now" sits, as a fraction of the width: the trail scrolls in from this playhead. */
const NOW_X = 0.84;
const SPAN = 18; // semitones visible

/**
 * Utavie-style live vocal pitch guide: scrolling piano roll with Perfect/Good/Off-pitch glowing note bars,
 * smooth pitch contour line, live note + cent deviation readout, streak, vibrato detector, and running score.
 */
export function PitchGuide({ className, compact = false }: { className?: string; compact?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const micOn = useVideoke((v) => v.micOn);
  const live = useVideoke((v) => v.live);
  const level = useVideoke((v) => v.micLevel);
  const stats = useVideoke((v) => v.liveStats);
  const startMic = useVideoke((v) => v.startMic);
  const stopMic = useVideoke((v) => v.stopMic);
  const center = useRef(60);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let raf = 0;
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

      // Smoothly track the singer's active vocal register
      const recent = pitchTrail.filter((p) => p.midi !== null && now - p.t < 3200).map((p) => p.midi as number);
      if (recent.length) {
        const sorted = [...recent].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        center.current += (median - center.current) * 0.055;
      }
      const low = Math.round(center.current) - SPAN / 2;
      const laneH = h / SPAN;
      const yOf = (midi: number) => h - (midi - low + 0.5) * laneH;

      // Piano-roll semitone lanes
      for (let i = 0; i < SPAN; i++) {
        const midi = low + i;
        const pc = ((midi % 12) + 12) % 12;
        const sharp = [1, 3, 6, 8, 10].includes(pc);
        const topY = h - (i + 1) * laneH;
        g.fillStyle = sharp ? "rgba(0,0,0,0.28)" : "rgba(255,255,255,0.038)";
        g.fillRect(0, topY, w, laneH);

        // Subtle semitone divider
        g.fillStyle = "rgba(255,255,255,0.045)";
        g.fillRect(0, topY, w, 0.5);

        // Octave C & Fifth G reference lines + piano labels
        if (pc === 0 || pc === 7) {
          g.fillStyle = pc === 0 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.09)";
          g.fillRect(0, topY + laneH - 1, w, 1);
          if (!compact || laneH > 6.5) {
            g.fillStyle = pc === 0 ? "rgba(255,255,255,0.58)" : "rgba(255,255,255,0.34)";
            g.font = "600 9px ui-monospace, SFMono-Regular, monospace";
            g.fillText(noteName(midi), 6, topY + laneH - 2);
          }
        }
      }

      // Vertical playhead ("Now")
      const nowX = w * NOW_X;
      const grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "rgba(255,255,255,0.08)");
      grad.addColorStop(0.5, "rgba(255,255,255,0.48)");
      grad.addColorStop(1, "rgba(255,255,255,0.08)");
      g.fillStyle = grad;
      g.fillRect(nowX, 0, 1.5, h);

      // Group consecutive voiced frames into glowing note bars
      const xOf = (t: number) => nowX - ((now - t) / WINDOW_MS) * nowX;
      let bar: { note: number; start: number; end: number; err: number; n: number } | null = null;
      const flush = () => {
        if (!bar) return;
        const x0 = xOf(bar.start);
        const x1 = Math.max(xOf(bar.end), x0 + 3.5);
        const avgErr = bar.err / bar.n;
        const color = avgErr <= 14 ? "#34d399" : avgErr <= 25 ? accent : "#fbbf24";
        const y = yOf(bar.note);
        const bh = Math.max(3.5, laneH * 0.66);
        g.shadowColor = color;
        g.shadowBlur = avgErr <= 14 ? 12 : 8;
        g.fillStyle = color;
        const r = Math.min(bh / 2, 4);
        g.beginPath();
        g.roundRect(x0, y - bh / 2, x1 - x0, bh, r);
        g.fill();
        g.shadowBlur = 0;
        bar = null;
      };
      for (const p of pitchTrail) {
        if (now - p.t > WINDOW_MS) continue;
        if (p.midi === null) {
          flush();
          continue;
        }
        const note = Math.round(p.midi);
        const err = Math.abs(p.midi - note) * 100;
        if (bar && bar.note === note && p.t - bar.end < 135) {
          bar.end = p.t;
          bar.err += err;
          bar.n++;
        } else {
          flush();
          bar = { note, start: p.t, end: p.t, err, n: 1 };
        }
      }
      flush();

      // Continuous vocal pitch trace (shows vibrato & scoops cleanly)
      g.strokeStyle = "rgba(255,255,255,0.72)";
      g.lineWidth = 1.4;
      g.beginPath();
      let pen = false;
      for (const p of pitchTrail) {
        if (now - p.t > WINDOW_MS || p.midi === null) {
          pen = false;
          continue;
        }
        const x = xOf(p.t);
        const y = yOf(p.midi);
        if (pen) g.lineTo(x, y);
        else g.moveTo(x, y);
        pen = true;
      }
      g.stroke();

      // Live glowing pitch cursor on the playhead
      const last = pitchTrail[pitchTrail.length - 1];
      if (last && last.midi !== null && now - last.t < 240) {
        const y = yOf(last.midi);
        const err = Math.abs(last.midi - Math.round(last.midi)) * 100;
        const orbColor = err <= 14 ? "#34d399" : err <= 25 ? accent : "#fbbf24";
        g.fillStyle = "#ffffff";
        g.shadowColor = orbColor;
        g.shadowBlur = 16;
        g.beginPath();
        g.arc(nowX, y, Math.max(4, laneH * 0.48), 0, Math.PI * 2);
        g.fill();
        g.shadowBlur = 0;

        // Live note tag to the right of the playhead
        g.fillStyle = orbColor;
        g.font = "700 10px ui-monospace, SFMono-Regular, monospace";
        g.fillText(noteName(last.midi), nowX + 7, Math.max(11, Math.min(h - 4, y + 3.5)));
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [compact]);

  const inTune = live && Math.abs(live.cents) <= 22;
  const perfect = live && Math.abs(live.cents) <= 12;
  const vibratoRecent = stats.lastVibratoAt > 0 && performance.now() - stats.lastVibratoAt < 2200;

  return (
    <div className={cn("relative overflow-hidden rounded-[14px] border border-white/12 bg-black/65 shadow-inner backdrop-blur-md", className)}>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-white/10 px-3 py-1.5 text-[11px] text-white/85">
        <span className="flex items-center gap-1.5 font-bold tracking-wider text-white/90 uppercase">
          <WaveformIcon size={13} className="shrink-0 text-accent-text" />
          <span>Vocal Pitch</span>
        </span>

        {micOn && stats.notesHit > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300 tabular-nums">
              {stats.inTunePct}% in tune
            </span>
            {stats.streak >= 3 && (
              <span className="rounded-full bg-amber-400/20 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-300 tabular-nums">
                {stats.streak}x streak
              </span>
            )}
            {vibratoRecent && (
              <span className="animate-pulse rounded-full bg-sky-400/25 px-2 py-0.5 text-[10px] font-bold text-sky-200">
                〰 Vibrato!
              </span>
            )}
            {stats.runningScore !== null && (
              <span className="hidden rounded-full bg-accent/20 px-2 py-0.5 font-mono text-[10px] font-extrabold text-accent-text tabular-nums sm:inline-block">
                Live {stats.runningScore}
              </span>
            )}
          </div>
        )}

        <span className="flex-1" />

        {micOn && (
          <>
            <span className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-white/15 sm:flex" aria-hidden="true">
              <span
                className="h-full bg-emerald-400 transition-[width] duration-75"
                style={{ width: `${Math.round(level * 100)}%` }}
              />
            </span>
            <span
              className={cn(
                "w-[82px] text-right font-mono font-bold tabular-nums",
                live ? (perfect ? "text-emerald-300" : inTune ? "text-lime-300" : "text-amber-300") : "text-white/45",
              )}
            >
              {live ? `${noteName(live.midi)} ${live.cents >= 0 ? "+" : ""}${live.cents}¢` : "Listening…"}
            </span>
          </>
        )}

        <button
          type="button"
          onClick={() => (micOn ? stopMic() : void startMic())}
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

      <div className={cn("relative", compact ? "h-[76px]" : "h-28 md:h-32")}>
        <canvas ref={canvas} className="absolute inset-0 size-full" />
        {!micOn && (
          <button
            type="button"
            onClick={() => void startMic()}
            className="absolute inset-0 grid place-items-center bg-black/25 px-3 text-center text-xs text-white/85 transition-colors hover:bg-black/15 hover:text-white"
          >
            <span className="flex items-center gap-2 rounded-full bg-black/75 px-4 py-1.5 font-semibold shadow-lg ring-1 ring-white/20">
              <MicrophoneStageIcon size={14} className="text-accent-text" weight="fill" />
              <span>Tap to enable Live Mic for real vocal pitch &amp; accurate scoring</span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
