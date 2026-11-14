import { create } from "zustand";
import type { Track } from "../lib/types";
import { playerHooks, usePlayer } from "../player/player";
import { toast } from "./ui";

/* ------------------------------------------------------------------------------------------------
 * Which tracks are Videoke songs. Started or reserved from the Videoke tab; their video *is* the lyrics,
 * so the app hides synced lyrics for them, never fills the queue with radio, and scores them when they end.
 * ---------------------------------------------------------------------------------------------- */

const IDS_KEY = "musike:videoke-ids";

function readIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(IDS_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

/* ------------------------------------------------------------------------------------------------
 * Live microphone pitch tracking (shared by every pitch guide on screen and by the scorer).
 * ---------------------------------------------------------------------------------------------- */

export interface PitchPoint {
  /** performance.now() in ms */
  t: number;
  /** Fractional MIDI note, or null when nothing is being sung. */
  midi: number | null;
}

/** Rolling 10 s of pitch readings for the scrolling guide. */
export const pitchTrail: PitchPoint[] = [];

/** Running numbers for the song being sung right now; reset when a score is shown. */
const take = { frames: 0, voiced: 0, centsErr: 0, jumps: 0, lastMidi: null as number | null, loud: 0 };

function resetTake() {
  take.frames = 0;
  take.voiced = 0;
  take.centsErr = 0;
  take.jumps = 0;
  take.lastMidi = null;
  take.loud = 0;
}

let micStream: MediaStream | null = null;
let micCtx: AudioContext | null = null;
let micRaf: number | null = null;

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function noteName(midi: number): string {
  const m = Math.round(midi);
  return `${NOTE_NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
}

/** Time-domain autocorrelation pitch detector for the human singing range (~75-1100 Hz). */
function detectPitchHz(buf: Float32Array, sampleRate: number): number | null {
  let rms = 0;
  for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / buf.length);
  if (rms < 0.012) return null;
  const minLag = Math.floor(sampleRate / 1100);
  const maxLag = Math.min(Math.floor(sampleRate / 75), Math.floor(buf.length / 2));
  let bestLag = -1;
  let bestCorr = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < buf.length - lag; i++) {
      sum += buf[i] * buf[i + lag];
      norm += buf[i] * buf[i];
    }
    const corr = norm > 0 ? sum / norm : 0;
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }
  if (bestCorr < 0.75 || bestLag <= 0) return null;
  return sampleRate / bestLag;
}

function newAudioContext(): AudioContext | null {
  try {
    const Ctor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    return Ctor ? new Ctor() : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------------------------------------
 * Funny judge: every tier has many lines, and the same line never shows twice in a row.
 * ---------------------------------------------------------------------------------------------- */

interface Line {
  headline: string;
  roast: string;
}

const LINES: { max: number; badge: string; tone: "bad" | "meh" | "good" | "great"; lines: Line[] }[] = [
  {
    max: 69,
    badge: "Emergency Exit",
    tone: "bad",
    lines: [
      { headline: "Drop the Mic (Literally)", roast: "Even the instrumental is trying to escape." },
      { headline: "Who Hurt You?", roast: "Because now you're hurting all of us." },
      { headline: "Mic Confiscated", roast: "The videoke machine has filed a complaint." },
      { headline: "Was That a Song?", roast: "Sounded more like a group chat argument." },
      { headline: "Please Stop", roast: "The dog left the room. The dog loves everyone." },
      { headline: "Certified Noise", roast: "The neighbors are recording this as evidence." },
    ],
  },
  {
    max: 75,
    badge: "Roasted",
    tone: "bad",
    lines: [
      { headline: "You Suck at this", roast: "The neighbors closed their windows and called the barangay. Pass the mic." },
      { headline: "Sintunado Supreme", roast: "Every note was a suggestion, and you ignored all of them." },
      { headline: "Bold of You", roast: "Confidence: 100. Pitch: still loading." },
      { headline: "Back to the Shower", roast: "That's where this voice belongs for now." },
      { headline: "Tita Is Concerned", roast: "She's already texting the family group chat about this." },
      { headline: "Not Your Song", roast: "Pick something with fewer notes. Maybe one note." },
    ],
  },
  {
    max: 79,
    badge: "Nice Try",
    tone: "meh",
    lines: [
      { headline: "Keep Your Day Job", roast: "A for effort, D- for pitch. Drink some water and try again." },
      { headline: "Almost Almost", roast: "You were close. Like, same-barangay close." },
      { headline: "Mid But Brave", roast: "Nobody clapped, but nobody left either." },
      { headline: "Warm-Up Round?", roast: "We'll pretend that one didn't count." },
      { headline: "Respectfully, No", roast: "The chorus deserved better, but the verses were okay-ish." },
    ],
  },
  {
    max: 84,
    badge: "Not Bad",
    tone: "good",
    lines: [
      { headline: "Shower Singer Certified", roast: "Not bad, but the backing track did a lot of the heavy lifting." },
      { headline: "Decent Ka Dyan", roast: "The uncles stopped talking for at least ten seconds." },
      { headline: "Getting Somewhere", roast: "Two more beers and you'll think you're the original artist." },
      { headline: "Solid B", roast: "Your crush looked up from their phone. Briefly." },
      { headline: "Respectable", roast: "Nobody's calling the barangay. Yet." },
    ],
  },
  {
    max: 89,
    badge: "Fiesta Ready",
    tone: "good",
    lines: [
      { headline: "Fiesta Contender", roast: "Solid pipes! The titos at the table are nodding in approval." },
      { headline: "Okay, We See You", roast: "Someone just asked who's singing from the other room." },
      { headline: "Lowkey Talented", roast: "Highkey. That was actually good." },
      { headline: "Encore Material", roast: "Reserve another one, the crowd wants more." },
      { headline: "Lola Approved", roast: "She put down her pancit to listen. That's huge." },
    ],
  },
  {
    max: 95,
    badge: "Crowd Favorite",
    tone: "great",
    lines: [
      { headline: "Videoke Superstar", roast: "Main character vocals. Everybody stopped talking." },
      { headline: "Are You Signed?", roast: "Because that sounded like a record label demo." },
      { headline: "Chills. Actual Chills.", roast: "Someone in the back is crying and won't admit it." },
      { headline: "Stage Presence", roast: "Phones up, flashlights on. That's a concert now." },
      { headline: "Barangay Idol", roast: "The captain wants you at the next town fiesta." },
    ],
  },
  {
    max: 100,
    badge: "Perfect Pipes",
    tone: "great",
    lines: [
      { headline: "Golden Mic Legend!", roast: "Did you swallow the original artist? Record deal incoming!" },
      { headline: "Wala Kang Kupas", roast: "Flawless. The machine wants your autograph." },
      { headline: "Call the Grammys", roast: "That wasn't karaoke, that was a live album." },
      { headline: "Untouchable", roast: "Nobody wants to sing after you. Nobody." },
      { headline: "Hall of Fame", roast: "This score is going on the family group chat banner." },
    ],
  },
];

let lastLine = "";

function judge(score: number) {
  const tier = LINES.find((x) => score <= x.max) ?? LINES[LINES.length - 1];
  const options = tier.lines.filter((l) => l.headline !== lastLine);
  const line = options[Math.floor(Math.random() * options.length)] ?? tier.lines[0];
  lastLine = line.headline;
  return { badge: tier.badge, tone: tier.tone, ...line };
}

export type ScoreTone = "bad" | "meh" | "good" | "great";

export interface ScoreAxis {
  label: string;
  value: number;
}

export interface VideokeScore {
  id: number;
  track: Track;
  score: number;
  headline: string;
  roast: string;
  badge: string;
  tone: ScoreTone;
  axes: ScoreAxis[];
  /** true when the score came from the microphone, false when the judge had nothing to listen to */
  heard: boolean;
  phase: "open" | "mini";
  /** When the 10 s countdown ends (ms epoch), or null once it ran. */
  advanceAt: number | null;
  hasNext: boolean;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function computeScore(): { score: number; axes: ScoreAxis[]; heard: boolean } {
  const jitter = () => Math.round((Math.random() - 0.5) * 8);
  if (take.frames > 40 && take.voiced > 15) {
    const coverage = take.voiced / take.frames; // how much of the song you sang
    const accuracy = 1 - clamp(take.centsErr / take.voiced / 50, 0, 1); // closeness to a real note
    const stability = 1 - clamp(take.jumps / take.voiced / 0.35, 0, 1); // fewer wild jumps
    const energy = clamp(take.loud / take.frames / 0.5, 0, 1);
    const pitch = clamp(Math.round(55 + accuracy * 45 + jitter()), 40, 100);
    const stab = clamp(Math.round(55 + stability * 45 + jitter()), 40, 100);
    const expr = clamp(Math.round(55 + energy * 45 + jitter()), 40, 100);
    const tech = clamp(Math.round((pitch + stab) / 2 + jitter()), 40, 100);
    const rhythm = clamp(Math.round(55 + clamp(coverage * 2, 0, 1) * 45 + jitter()), 40, 100);
    const score = clamp(Math.round(pitch * 0.35 + stab * 0.2 + expr * 0.15 + tech * 0.15 + rhythm * 0.15), 55, 99);
    return {
      score,
      heard: true,
      axes: [
        { label: "Pitch", value: pitch },
        { label: "Stability", value: stab },
        { label: "Expression", value: expr },
        { label: "Technique", value: tech },
        { label: "Rhythm", value: rhythm },
      ],
    };
  }
  // No microphone: the machine guesses, like the real ones do.
  const score = clamp(Math.round(60 + Math.random() * 39), 60, 99);
  const axis = (label: string) => ({ label, value: clamp(score + jitter(), 40, 100) });
  return { score, heard: false, axes: ["Pitch", "Stability", "Expression", "Technique", "Rhythm"].map(axis) };
}

/* ------------------------------------------------------------------------------------------------
 * Karaoke-machine sound effects, synthesized: snare drumroll -> cymbal crash -> brass fanfare + crowd,
 * or a buzzer and a sad trombone for the bad ones.
 * ---------------------------------------------------------------------------------------------- */

function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function noiseHit(ctx: AudioContext, noise: AudioBuffer, at: number, opts: { type: BiquadFilterType; freq: number; q?: number; gain: number; decay: number }) {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = opts.type;
  filter.frequency.value = opts.freq;
  if (opts.q) filter.Q.value = opts.q;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, at);
  amp.gain.exponentialRampToValueAtTime(opts.gain, at + 0.004);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + opts.decay);
  src.connect(filter).connect(amp).connect(ctx.destination);
  src.start(at, Math.random() * 0.5);
  src.stop(at + opts.decay + 0.05);
}

function brass(ctx: AudioContext, freq: number, at: number, dur: number, gain = 0.05, vibrato = 0) {
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, at);
  out.gain.exponentialRampToValueAtTime(gain, at + 0.03);
  out.gain.setValueAtTime(gain, at + dur * 0.7);
  out.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(900, at);
  lp.frequency.linearRampToValueAtTime(2600, at + 0.06);
  lp.connect(out).connect(ctx.destination);
  for (const detune of [-7, 7]) {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, at);
    osc.detune.value = detune;
    if (vibrato) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 6;
      depth.gain.value = vibrato;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(at);
      lfo.stop(at + dur);
    }
    osc.connect(lp);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }
}

function applause(ctx: AudioContext, noise: AudioBuffer, at: number, seconds: number, density: number, gain: number) {
  const claps = Math.floor(seconds * density);
  for (let i = 0; i < claps; i++) {
    const t = at + Math.random() * seconds;
    // Swell in, fade out.
    const shape = Math.sin(Math.PI * ((t - at) / seconds));
    noiseHit(ctx, noise, t, { type: "bandpass", freq: 900 + Math.random() * 1800, q: 1.2, gain: gain * (0.4 + 0.6 * shape), decay: 0.05 + Math.random() * 0.04 });
  }
}

/** Snare drumroll that lasts as long as the score counter spins. */
function playDrumroll(ctx: AudioContext, noise: AudioBuffer, seconds: number) {
  const now = ctx.currentTime;
  for (let t = 0; t < seconds; t += 0.042) {
    const level = 0.025 + (t / seconds) * 0.09;
    noiseHit(ctx, noise, now + t, { type: "highpass", freq: 1600, gain: level, decay: 0.07 });
  }
  // Floor tom bumps under the roll
  for (let t = 0; t < seconds; t += 0.33) brass(ctx, 80, now + t, 0.12, 0.02);
}

function playReveal(ctx: AudioContext, noise: AudioBuffer, tone: ScoreTone) {
  const now = ctx.currentTime + 0.02;
  if (tone === "bad") {
    // Game-show buzzer, then the sad trombone.
    brass(ctx, 110, now, 0.45, 0.06);
    brass(ctx, 116, now, 0.45, 0.04);
    const notes = [293.66, 277.18, 261.63, 246.94];
    notes.forEach((f, i) => brass(ctx, f, now + 0.55 + i * 0.32, i === 3 ? 1.1 : 0.3, 0.05, i === 3 ? 6 : 0));
    applause(ctx, noise, now + 2.2, 1.2, 6, 0.05); // a couple of pity claps
    return;
  }
  // Cymbal crash on the reveal.
  noiseHit(ctx, noise, now, { type: "highpass", freq: 5500, gain: 0.16, decay: 1.6 });
  if (tone === "meh") {
    [523.25, 659.25, 587.33].forEach((f, i) => brass(ctx, f, now + i * 0.16, i === 2 ? 0.6 : 0.15, 0.045));
    applause(ctx, noise, now + 0.3, 2, 25, 0.06);
    return;
  }
  // The classic "ta-ta-ta-taaa" karaoke machine fanfare.
  const melody: [number, number, number][] = [
    [523.25, 0, 0.12],
    [523.25, 0.14, 0.12],
    [523.25, 0.28, 0.12],
    [659.25, 0.42, 0.22],
    [587.33, 0.66, 0.12],
    [659.25, 0.8, 0.12],
    [783.99, 0.94, 0.9],
  ];
  for (const [f, t, d] of melody) brass(ctx, f, now + t, d, 0.05);
  // Chord under the last note.
  for (const f of [392, 523.25, 659.25]) brass(ctx, f, now + 0.94, 0.9, 0.025);
  if (tone === "great") noiseHit(ctx, noise, now + 0.94, { type: "highpass", freq: 6000, gain: 0.12, decay: 1.4 });
  applause(ctx, noise, now + 0.4, tone === "great" ? 3.6 : 2.6, tone === "great" ? 90 : 50, tone === "great" ? 0.08 : 0.065);
}

/** Starts the drumroll now and the reveal after `rollSeconds`. Returns a stop function. */
export function playScoreSounds(tone: ScoreTone, rollSeconds: number): () => void {
  const ctx = newAudioContext();
  if (!ctx) return () => {};
  const noise = noiseBuffer(ctx, 2);
  playDrumroll(ctx, noise, rollSeconds);
  const reveal = setTimeout(() => playReveal(ctx, noise, tone), rollSeconds * 1000);
  const close = setTimeout(() => void ctx.close().catch(() => {}), (rollSeconds + 6) * 1000);
  return () => {
    clearTimeout(reveal);
    clearTimeout(close);
    void ctx.close().catch(() => {});
  };
}

/* ------------------------------------------------------------------------------------------------
 * Store
 * ---------------------------------------------------------------------------------------------- */

export const AUTO_ADVANCE_MS = 10_000;
let advanceTimer: ReturnType<typeof setTimeout> | null = null;
let miniTimer: ReturnType<typeof setTimeout> | null = null;
let scoreSeq = 0;

interface VideokeState {
  ids: Set<string>;
  micOn: boolean;
  micLevel: number;
  /** Latest reading: note being sung right now. */
  live: { midi: number; cents: number } | null;
  score: VideokeScore | null;

  isVideoke: (id: string | undefined) => boolean;
  mark: (track: Track) => void;
  singNow: (track: Track) => void;
  reserve: (track: Track) => void;
  startMic: () => Promise<void>;
  stopMic: () => void;
  showScore: (track: Track) => void;
  minimize: () => void;
  expand: () => void;
  dismiss: () => void;
  playNext: () => void;
  singAgain: () => void;
}

function hasReservedNext(): boolean {
  const p = usePlayer.getState();
  const next = p.queue[p.index + 1];
  return !!next && useVideoke.getState().ids.has(next.id);
}

export const useVideoke = create<VideokeState>((set, get) => ({
  ids: readIds(),
  micOn: false,
  micLevel: 0,
  live: null,
  score: null,

  isVideoke: (id) => !!id && get().ids.has(id),

  mark: (track) => {
    const ids = new Set(get().ids);
    ids.add(track.id);
    // Keep the list from growing forever.
    const list = [...ids].slice(-400);
    try {
      localStorage.setItem(IDS_KEY, JSON.stringify(list));
    } catch {
      /* private mode */
    }
    set({ ids: new Set(list) });
  },

  singNow: (track) => {
    get().mark(track);
    resetTake();
    const p = usePlayer.getState();
    p.setPreferVideo(true);
    const at = p.queue.findIndex((x) => x.id === track.id);
    if (at >= 0) return p.jumpTo(at);
    // Keep only songs that were reserved in Videoke; never carry the music queue (or radio) along.
    const reserved = p.queue.slice(p.index + 1).filter((x) => get().ids.has(x.id));
    p.playList([track, ...reserved], 0);
  },

  reserve: (track) => {
    const p = usePlayer.getState();
    const current = p.queue[p.index];
    // Nothing to wait for: sing it right away.
    if (!current || !get().ids.has(current.id)) return get().singNow(track);
    if (p.queue.slice(p.index + 1).some((x) => x.id === track.id)) return;
    get().mark(track);
    // Line it up after the songs already reserved, before anything else in the queue.
    let insert = p.index + 1;
    while (insert < p.queue.length && get().ids.has(p.queue[insert].id)) insert++;
    const queue = [...p.queue.slice(0, insert), track, ...p.queue.slice(insert)];
    usePlayer.setState({ queue, original: p.original ? [...p.original, track] : null });
    toast(`Reserved #${insert - p.index}: ${track.title}`);
  },

  startMic: async () => {
    if (get().micOn) return;
    try {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
        });
      } catch {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
    } catch {
      toast("Microphone permission denied or unavailable", "error");
      return;
    }
    micCtx = newAudioContext();
    if (!micCtx) {
      micStream.getTracks().forEach((tr) => tr.stop());
      micStream = null;
      return;
    }
    if (micCtx.state === "suspended") {
      await micCtx.resume().catch(() => {});
    }
    const ctx = micCtx;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    ctx.createMediaStreamSource(micStream).connect(analyser);
    const timeData = new Float32Array(analyser.fftSize);
    set({ micOn: true });
    let frame = 0;
    const loop = () => {
      micRaf = requestAnimationFrame(loop);
      if (frame++ % 2) return; // ~30 readings a second is plenty
      analyser.getFloatTimeDomainData(timeData);
      let rms = 0;
      for (let i = 0; i < timeData.length; i++) rms += timeData[i] * timeData[i];
      rms = Math.sqrt(rms / timeData.length);
      const level = Math.min(1, rms * 8);
      const hz = detectPitchHz(timeData, ctx.sampleRate);
      const midi = hz ? 69 + 12 * Math.log2(hz / 440) : null;
      const now = performance.now();
      pitchTrail.push({ t: now, midi });
      while (pitchTrail.length && now - pitchTrail[0].t > 10_000) pitchTrail.shift();

      const playing = usePlayer.getState().status === "playing";
      if (playing) {
        take.frames++;
        if (level > 0.15) take.loud++;
        if (midi !== null) {
          take.voiced++;
          take.centsErr += Math.abs(midi - Math.round(midi)) * 100;
          if (take.lastMidi !== null && Math.abs(midi - take.lastMidi) > 4) take.jumps++;
          take.lastMidi = midi;
        }
      }
      set({ micLevel: level, live: midi === null ? null : { midi, cents: Math.round((midi - Math.round(midi)) * 100) } });
    };
    loop();
  },

  stopMic: () => {
    if (micRaf !== null) cancelAnimationFrame(micRaf);
    micRaf = null;
    micStream?.getTracks().forEach((tr) => tr.stop());
    micStream = null;
    void micCtx?.close().catch(() => {});
    micCtx = null;
    pitchTrail.length = 0;
    set({ micOn: false, micLevel: 0, live: null });
  },

  showScore: (track) => {
    const { score, axes, heard } = computeScore();
    resetTake();
    const verdict = judge(score);
    // The song is over: stop it while the score is on screen.
    const p = usePlayer.getState();
    if (p.status === "playing" && p.queue[p.index]?.id === track.id) p.toggle();
    if (advanceTimer) clearTimeout(advanceTimer);
    if (miniTimer) clearTimeout(miniTimer);
    const hasNext = hasReservedNext();
    set({
      score: {
        id: ++scoreSeq,
        track,
        score,
        axes,
        heard,
        headline: verdict.headline,
        roast: verdict.roast,
        badge: verdict.badge,
        tone: verdict.tone,
        phase: "open",
        advanceAt: Date.now() + AUTO_ADVANCE_MS,
        hasNext,
      },
    });
    // After 10 s: tuck the score away and start the next reserved song.
    advanceTimer = setTimeout(() => {
      advanceTimer = null;
      const s = get().score;
      if (!s) return;
      set({ score: { ...s, phase: "mini", advanceAt: null } });
      if (hasReservedNext()) get().playNext();
      miniTimer = setTimeout(() => get().dismiss(), 12_000);
    }, AUTO_ADVANCE_MS);
  },

  minimize: () => {
    const s = get().score;
    if (s) set({ score: { ...s, phase: "mini" } });
  },

  expand: () => {
    const s = get().score;
    if (miniTimer) clearTimeout(miniTimer);
    if (s) set({ score: { ...s, phase: "open" } });
  },

  dismiss: () => {
    if (advanceTimer) clearTimeout(advanceTimer);
    if (miniTimer) clearTimeout(miniTimer);
    advanceTimer = miniTimer = null;
    set({ score: null });
  },

  playNext: () => {
    if (advanceTimer) clearTimeout(advanceTimer);
    advanceTimer = null;
    const s = get().score;
    if (s) set({ score: { ...s, phase: "mini", advanceAt: null } });
    resetTake();
    const p = usePlayer.getState();
    if (hasReservedNext()) p.jumpTo(p.index + 1);
  },

  singAgain: () => {
    const s = get().score;
    get().dismiss();
    if (!s) return;
    resetTake();
    const p = usePlayer.getState();
    if (p.queue[p.index]?.id === s.track.id) {
      p.seek(0);
      if (p.status !== "playing") p.toggle();
    } else get().singNow(s.track);
  },
}));

// Videoke songs: score them when they end (the score screen moves on to the next reserved song by itself),
// and never let autoplay radio stuff the reservation list.
playerHooks.onEnded = (track) => {
  if (!useVideoke.getState().ids.has(track.id)) return false;
  useVideoke.getState().showScore(track);
  return true;
};
playerHooks.blockRadio = (track) => useVideoke.getState().ids.has(track.id);

/** Whether the track playing now is a Videoke song (its video already shows the lyrics). */
export function useIsVideokeTrack(): boolean {
  const id = usePlayer((p) => p.queue[p.index]?.id ?? "");
  return useVideoke((v) => v.ids.has(id));
}
