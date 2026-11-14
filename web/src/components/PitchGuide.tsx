import { useEffect, useRef } from "react";
import { cn } from "../lib/format";
import { noteName, pitchTrail, useVideoke } from "../stores/videoke";
import { MicrophoneStageIcon, WaveformIcon } from "./icons";

const WINDOW_MS = 6000;
/** Where "now" sits, as a fraction of the width: the trail scrolls in from the right edge of this. */
const NOW_X = 0.82;
const SPAN = 18; // semitones visible

/**
 * Live pitch guide: a scrolling piano roll of your voice. Each sung note becomes a glowing bar on its note
 * lane (green when you're within 20 cents of the note, amber when you're between notes).
 */
export function PitchGuide({ className, compact = false }: { className?: string; compact?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const micOn = useVideoke((v) => v.micOn);
  const live = useVideoke((v) => v.live);
  const level = useVideoke((v) => v.micLevel);
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

      // Follow the singer's range smoothly.
      const recent = pitchTrail.filter((p) => p.midi !== null && now - p.t < 3000).map((p) => p.midi as number);
      if (recent.length) {
        const sorted = [...recent].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        center.current += (median - center.current) * 0.05;
      }
      const low = Math.round(center.current) - SPAN / 2;
      const laneH = h / SPAN;
      const yOf = (midi: number) => h - (midi - low + 0.5) * laneH;

      // Note lanes, piano-roll style.
      for (let i = 0; i < SPAN; i++) {
        const midi = low + i;
        const sharp = [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);
        g.fillStyle = sharp ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.035)";
        g.fillRect(0, h - (i + 1) * laneH, w, laneH);
        if (((midi % 12) + 12) % 12 === 0) {
          g.fillStyle = "rgba(255,255,255,0.18)";
          g.fillRect(0, h - (i + 1) * laneH, w, 1);
          if (!compact || laneH > 7) {
            g.fillStyle = "rgba(255,255,255,0.45)";
            g.font = "600 9px ui-monospace, monospace";
            g.fillText(noteName(midi), 4, h - i * laneH - 2);
          }
        }
      }

      // "Now" line.
      const nowX = w * NOW_X;
      g.fillStyle = "rgba(255,255,255,0.35)";
      g.fillRect(nowX, 0, 1.5, h);

      // Group readings into note bars: consecutive frames on the same note make one bar.
      const xOf = (t: number) => nowX - ((now - t) / WINDOW_MS) * nowX;
      let bar: { note: number; start: number; end: number; err: number; n: number } | null = null;
      const flush = () => {
        if (!bar) return;
        const x0 = xOf(bar.start);
        const x1 = Math.max(xOf(bar.end), x0 + 3);
        const inTune = bar.err / bar.n <= 20;
        const y = yOf(bar.note);
        const bh = Math.max(3, laneH * 0.62);
        g.shadowColor = inTune ? accent : "#f5b942";
        g.shadowBlur = 10;
        g.fillStyle = inTune ? accent : "#f5b942";
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
        if (bar && bar.note === note && p.t - bar.end < 120) {
          bar.end = p.t;
          bar.err += err;
          bar.n++;
        } else {
          flush();
          bar = { note, start: p.t, end: p.t, err, n: 1 };
        }
      }
      flush();

      // Exact live pitch: a dot on the now line, with a thin line through the raw readings.
      g.strokeStyle = "rgba(255,255,255,0.55)";
      g.lineWidth = 1.2;
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
      const last = pitchTrail[pitchTrail.length - 1];
      if (last && last.midi !== null && now - last.t < 250) {
        g.fillStyle = "#fff";
        g.shadowColor = accent;
        g.shadowBlur = 14;
        g.beginPath();
        g.arc(nowX, yOf(last.midi), Math.max(3.5, laneH * 0.45), 0, Math.PI * 2);
        g.fill();
        g.shadowBlur = 0;
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [compact]);

  const inTune = live && Math.abs(live.cents) <= 20;

  return (
    <div className={cn("relative overflow-hidden rounded-[14px] border border-white/10 bg-black/55 backdrop-blur-md", className)}>
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-1.5 text-[11px] text-white/80">
        <WaveformIcon size={13} className="shrink-0" />
        <span className="font-semibold tracking-wide uppercase">Pitch guide</span>
        <span className="flex-1" />
        {micOn && (
          <>
            <span className="flex h-1.5 w-14 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
              <span className="h-full bg-emerald-400 transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
            </span>
            <span className={cn("w-[84px] text-right font-mono font-bold tabular-nums", live ? (inTune ? "text-emerald-300" : "text-amber-300") : "text-white/50")}>
              {live ? `${noteName(live.midi)} ${live.cents >= 0 ? "+" : ""}${live.cents}¢` : "Sing…"}
            </span>
          </>
        )}
        <button
          type="button"
          onClick={() => (micOn ? stopMic() : void startMic())}
          className={cn(
            "flex h-6 items-center gap-1 rounded-full px-2.5 font-semibold transition-colors",
            micOn ? "bg-emerald-500/25 text-emerald-200 hover:bg-emerald-500/35" : "bg-white/12 text-white hover:bg-white/20",
          )}
        >
          <MicrophoneStageIcon size={12} weight={micOn ? "fill" : "regular"} />
          {micOn ? "Mic on" : "Mic off"}
        </button>
      </div>
      <div className={cn("relative", compact ? "h-20" : "h-28 md:h-32")}>
        <canvas ref={canvas} className="absolute inset-0 size-full" />
        {!micOn && (
          <button
            type="button"
            onClick={() => void startMic()}
            className="absolute inset-0 grid place-items-center text-center text-xs text-white/75 transition-colors hover:text-white"
          >
            <span className="flex items-center gap-2 rounded-full bg-black/60 px-3.5 py-1.5 font-semibold ring-1 ring-white/15">
              <MicrophoneStageIcon size={14} />
              Turn on the mic to see your pitch and get a real score
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

