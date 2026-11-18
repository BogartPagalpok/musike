import { create } from "zustand";
import type { Track } from "../lib/types";
import { ensurePlaybackAnalyser, samplePlaybackHarmonics } from "../player/equalizer";
import { getExactPlaybackTime, playerHooks, usePlayer } from "../player/player";
import { toast } from "./ui";

/* ------------------------------------------------------------------------------------------------
 * Which tracks are Videoke songs. Started or reserved from the Videoke tab; their video *is* the lyrics,
 * so the app hides synced lyrics for them, never fills the queue with radio, and scores them when they end.
 * ---------------------------------------------------------------------------------------------- */

const IDS_KEY = "musike:videoke-ids";
const BEST_KEY = "musike:videoke-best";

function readIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(IDS_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function readBestScores(): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(BEST_KEY) ?? "{}") as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === "number" && Number.isFinite(v) && v > 0) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function saveBestScore(trackId: string, scoreDecimal: number) {
  if (!trackId || scoreDecimal <= 0) return;
  try {
    const all = readBestScores();
    if ((all[trackId] ?? 0) < scoreDecimal) {
      all[trackId] = scoreDecimal;
      localStorage.setItem(BEST_KEY, JSON.stringify(all));
    }
  } catch {
    /* ignore storage quota */
  }
}

/** Deterministic 5-digit videoke songbook code for any track ID. */
export function songbookCode(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 90000;
  }
  return String(10000 + Math.abs(hash)).slice(0, 5);
}

/* ------------------------------------------------------------------------------------------------
 * Real-Time YIN Vocal Pitch Detection + Krumhansl-Schmuckler Key/Chord Consonance & Beat Analyzer
 * ---------------------------------------------------------------------------------------------- */

export interface LiveVocalStats {
  sungSeconds: number;
  notesHit: number;
  inTunePct: number;
  streak: number;
  bestStreak: number;
  vibratos: number;
  lastVibratoAt: number;
  runningScore: number | null;
  currentNoteLabel: string | null;
}

const INITIAL_LIVE_STATS: LiveVocalStats = {
  sungSeconds: 0,
  notesHit: 0,
  inTunePct: 0,
  streak: 0,
  bestStreak: 0,
  vibratos: 0,
  lastVibratoAt: 0,
  runningScore: null,
  currentNoteLabel: null,
};

interface NoteSegment {
  anchorMidi: number;
  startMs: number;
  endMs: number;
  songStartSec: number;
  songEndSec: number;
  midis: number[];
  rmsList: number[];
  instantChromaSum: Float32Array;
  instantChromaCount: number;
}

export interface EvaluatedNote {
  songStartSec: number;
  durSec: number;
  meanMidi: number;
  sungNote: number;
  rawOffsetCents: number;
  meanAbsErrCents: number;
  stdCents: number;
  hadVibrato: boolean;
  instantChordMatch: number | null;
}

export interface TakeTracker {
  startedPlayMs: number | null;
  firstVoicedPlayMs: number | null;
  maxSongSec: number;
  activeFrames: number;
  voicedFrames: number;
  sustainedFrames: number;
  cracks: number;
  vibratos: number;
  vibratoTotalSec: number;
  vibratoHzSum: number;
  vibratoDepthSum: number;
  vibratoWave: number[];
  longToneMaxSec: number;
  longToneSteadySum: number;
  longToneCount: number;
  maxNoteDurSec: number;
  cleanAttacks: number;
  kobushi: number;
  falls: number;
  notesHit: number;
  streak: number;
  bestStreak: number;
  uniqueNotes: Set<number>;
  minMidi: number;
  maxMidi: number;
  voicedRmsList: number[];
  phraseOnsetsMs: number[];
  playbackBeatMs: number[];
  timingOffsetsMs: number[];
  backingChroma: Float32Array;
  backingChromaFrames: number;
  singerPcDur: Float32Array;
  segments: EvaluatedNote[];
  wasVoiced: boolean;
  currentNote: NoteSegment | null;
  recentRawMidis: number[];
  noiseFloor: number;
  peakRms: number;
}

export function createTake(): TakeTracker {
  return {
    startedPlayMs: null,
    firstVoicedPlayMs: null,
    maxSongSec: 0,
    activeFrames: 0,
    voicedFrames: 0,
    sustainedFrames: 0,
    cracks: 0,
    vibratos: 0,
    vibratoTotalSec: 0,
    vibratoHzSum: 0,
    vibratoDepthSum: 0,
    vibratoWave: [],
    longToneMaxSec: 0,
    longToneSteadySum: 0,
    longToneCount: 0,
    maxNoteDurSec: 0,
    cleanAttacks: 0,
    kobushi: 0,
    falls: 0,
    notesHit: 0,
    streak: 0,
    bestStreak: 0,
    uniqueNotes: new Set<number>(),
    minMidi: Infinity,
    maxMidi: -Infinity,
    voicedRmsList: [],
    phraseOnsetsMs: [],
    playbackBeatMs: [],
    timingOffsetsMs: [],
    backingChroma: new Float32Array(12),
    backingChromaFrames: 0,
    singerPcDur: new Float32Array(12),
    segments: [],
    wasVoiced: false,
    currentNote: null,
    recentRawMidis: [],
    noiseFloor: 0.0012,
    peakRms: 0.028,
  };
}

let take: TakeTracker = createTake();

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function noteName(midi: number): string {
  const m = Math.round(midi);
  return `${NOTE_NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
}

/* ------------------------------------------------------------------------------------------------
 * Krumhansl-Schmuckler Key Finding & Diatonic / Chord Consonance
 * ---------------------------------------------------------------------------------------------- */

const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

// Scale degree consonance relative to tonic (0..11 semitones above root)
const MAJOR_DEGREE_WEIGHT = [1.0, 0.1, 0.96, 0.62, 1.0, 0.96, 0.14, 1.0, 0.18, 0.96, 0.66, 0.94];
const MINOR_DEGREE_WEIGHT = [1.0, 0.1, 0.96, 1.0, 0.22, 0.96, 0.14, 1.0, 0.94, 0.78, 0.96, 0.84];

export interface DetectedKey {
  root: number;
  mode: "major" | "minor";
  correlation: number;
  label: string;
}

function pearson12(a: ArrayLike<number>, b: readonly number[], shift: number): number {
  let meanA = 0;
  let meanB = 0;
  for (let i = 0; i < 12; i++) {
    meanA += a[(i + shift) % 12]!;
    meanB += b[i]!;
  }
  meanA /= 12;
  meanB /= 12;
  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < 12; i++) {
    const da = a[(i + shift) % 12]! - meanA;
    const db = b[i]! - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  return den > 1e-9 ? num / den : 0;
}

export function detectBestKey(chroma: ArrayLike<number>): DetectedKey | null {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += chroma[i]!;
  if (sum <= 1e-6) return null;

  let bestRoot = 0;
  let bestMode: "major" | "minor" = "major";
  let bestR = -2;

  for (let root = 0; root < 12; root++) {
    const rMaj = pearson12(chroma, MAJOR_PROFILE, root);
    if (rMaj > bestR) {
      bestR = rMaj;
      bestRoot = root;
      bestMode = "major";
    }
    const rMin = pearson12(chroma, MINOR_PROFILE, root);
    if (rMin > bestR) {
      bestR = rMin;
      bestRoot = root;
      bestMode = "minor";
    }
  }

  return {
    root: bestRoot,
    mode: bestMode,
    correlation: bestR,
    label: `${NOTE_NAMES[bestRoot]} ${bestMode === "major" ? "Major" : "Minor"}`,
  };
}

function scaleDegreeConsonance(pc: number, key: DetectedKey): number {
  const deg = (((pc - key.root) % 12) + 12) % 12;
  return key.mode === "major" ? MAJOR_DEGREE_WEIGHT[deg]! : MINOR_DEGREE_WEIGHT[deg]!;
}

/**
 * YIN Cumulative Mean Normalized Difference Function (CMNDF) pitch detector with parabolic interpolation.
 * Uses adaptive SNR gating (`noiseFloor * 2.5` down to `0.0011` RMS) so quiet built-in laptop mics with
 * `autoGainControl: false` detect natural singing at 50-70 cm while rejecting ambient room hum.
 */
export function detectVocalPitch(
  buf: Float32Array,
  sampleRate: number,
  noiseFloor: number,
): { hz: number; clarity: number; rms: number } | null {
  let sumSq = 0;
  for (let i = 0; i < buf.length; i++) sumSq += buf[i]! * buf[i]!;
  const rms = Math.sqrt(sumSq / buf.length);

  const gate = clamp(noiseFloor * 2.5, 0.0011, 0.032);
  if (rms < gate) return null;

  const minTau = Math.max(2, Math.floor(sampleRate / 1050)); // ~C6 soprano top
  const maxTau = Math.min(Math.floor(sampleRate / 78), Math.floor(buf.length / 2)); // ~D#2 bass low
  const windowSize = buf.length - maxTau;
  if (windowSize <= maxTau) return null;

  const cmndf = new Float32Array(maxTau + 1);
  cmndf[0] = 1;
  let runningSum = 0;

  for (let tau = 1; tau <= maxTau; tau++) {
    let diff = 0;
    for (let i = 0; i < windowSize; i++) {
      const delta = buf[i]! - buf[i + tau]!;
      diff += delta * delta;
    }
    runningSum += diff;
    cmndf[tau] = runningSum > 0 ? (diff * tau) / runningSum : 1;
  }

  // First-minimum search below YIN threshold (prevents sub-harmonic octave errors)
  const YIN_THRESHOLD = 0.17;
  let bestTau = -1;
  for (let tau = minTau; tau <= maxTau - 1; tau++) {
    if (cmndf[tau]! < YIN_THRESHOLD) {
      while (tau + 1 <= maxTau - 1 && cmndf[tau + 1]! < cmndf[tau]!) {
        tau++;
      }
      bestTau = tau;
      break;
    }
  }

  // Fallback to global minimum only if strongly periodic (< 0.22)
  if (bestTau < 0) {
    let minVal = 1;
    let minIdx = -1;
    for (let tau = minTau; tau <= maxTau - 1; tau++) {
      if (cmndf[tau]! < minVal) {
        minVal = cmndf[tau]!;
        minIdx = tau;
      }
    }
    if (minIdx > 0 && minVal < 0.22) {
      bestTau = minIdx;
    } else {
      return null;
    }
  }

  const clarity = clamp(1 - cmndf[bestTau]!, 0, 1);
  if (clarity < 0.8) return null;

  // Parabolic interpolation around bestTau for sub-sample (< 0.5 cent) precision
  const s0 = cmndf[bestTau - 1]!;
  const s1 = cmndf[bestTau]!;
  const s2 = cmndf[bestTau + 1]!;
  const denom = 2 * (2 * s1 - s0 - s2);
  const shift = denom !== 0 ? clamp((s0 - s2) / denom, -0.5, 0.5) : 0;
  const refinedTau = bestTau + shift;

  return {
    hz: sampleRate / refinedTau,
    clarity,
    rms,
  };
}

/** Finalizes a held note segment to measure fine intonation, stability, vibrato, long tones, inflections & live chord match. */
export function finalizeNoteSegment(
  seg: NoteSegment,
  tracker: TakeTracker = take,
): { hadVibrato: boolean; inTune: boolean } {
  const durMs = seg.endMs - seg.startMs;
  const durSec = durMs / 1000;
  const n = seg.midis.length;
  if (n < 4 || durMs < 130) return { hadVibrato: false, inTune: false };

  const core = n >= 6 ? seg.midis.slice(2) : seg.midis.slice(1);
  const meanMidi = core.reduce((a, b) => a + b, 0) / core.length;
  const sungNote = Math.round(meanMidi);
  const rawOffsetCents = (meanMidi - sungNote) * 100;
  const pc = ((sungNote % 12) + 12) % 12;

  tracker.notesHit++;
  tracker.uniqueNotes.add(sungNote);
  tracker.singerPcDur[pc] += durSec;
  if (durSec > tracker.maxNoteDurSec) tracker.maxNoteDurSec = durSec;
  if (sungNote < tracker.minMidi) tracker.minMidi = sungNote;
  if (sungNote > tracker.maxMidi) tracker.maxMidi = sungNote;

  // 1. Shakuri / Scoop detection (smooth upward glide into held pitch)
  if (n >= 6) {
    const startDelta = (meanMidi - seg.midis[0]!) * 100;
    const endErr = Math.abs((seg.midis[Math.min(n - 1, core.length)]! - meanMidi) * 100);
    if (startDelta >= 35 && startDelta <= 185 && endErr <= 24) {
      tracker.cleanAttacks++;
    }
  }

  // 2. Vocal Fall detection (expressive downward release over final 2-4 frames of a sustained note)
  if (n >= 8 && durMs >= 280) {
    const preEnd = seg.midis[n - 3]!;
    const lastVal = seg.midis[n - 1]!;
    const dropCents = (preEnd - lastVal) * 100;
    if (dropCents >= 45 && dropCents <= 240) {
      tracker.falls++;
    }
  }

  // 3. Kobushi / Vocal Turn detection (single quick 60-180¢ ornament crest within 120-260ms inside a note)
  if (n >= 8) {
    for (let i = 2; i < core.length - 2; i++) {
      const base = (core[i - 2]! + core[i + 2]!) * 0.5;
      const excursion = Math.abs(core[i]! - base) * 100;
      const returnErr = Math.abs(core[i - 2]! - core[i + 2]!) * 100;
      if (excursion >= 58 && excursion <= 190 && returnErr <= 32) {
        tracker.kobushi++;
        break;
      }
    }
  }

  // 4. Vibrato detection & waveform capture (4.2 - 8.2 Hz oscillation, 14 - 85¢ swing)
  let hadVibrato = false;
  const residualsCents: number[] = [];
  for (let i = 0; i < core.length; i++) {
    let sum = 0;
    let cnt = 0;
    for (let k = Math.max(0, i - 2); k <= Math.min(core.length - 1, i + 2); k++) {
      sum += core[k]!;
      cnt++;
    }
    residualsCents.push((core[i]! - sum / cnt) * 100);
  }

  if (durMs >= 360 && core.length >= 10) {
    let zeroCrossings = 0;
    let peakSum = 0;
    for (let i = 1; i < residualsCents.length; i++) {
      if (
        (residualsCents[i - 1]! < 0 && residualsCents[i]! >= 0) ||
        (residualsCents[i - 1]! > 0 && residualsCents[i]! <= 0)
      ) {
        zeroCrossings++;
      }
      peakSum += Math.abs(residualsCents[i]!);
    }
    const avgSwing = (peakSum / residualsCents.length) * 1.57;
    const freqHz = zeroCrossings / 2 / Math.max(0.1, durSec);
    if (freqHz >= 4.2 && freqHz <= 8.2 && avgSwing >= 14 && avgSwing <= 85) {
      hadVibrato = true;
      tracker.vibratos++;
      tracker.vibratoTotalSec += durSec;
      tracker.vibratoHzSum += freqHz;
      tracker.vibratoDepthSum += avgSwing;
      if (residualsCents.length >= tracker.vibratoWave.length) {
        const maxAbs = Math.max(20, ...residualsCents.map((v) => Math.abs(v)));
        tracker.vibratoWave = Array.from({ length: 28 }, (_, idx) => {
          const srcIdx = Math.min(residualsCents.length - 1, Math.floor((idx / 27) * (residualsCents.length - 1)));
          return clamp(residualsCents[srcIdx]! / maxAbs, -1, 1);
        });
      }
    }
  }

  // 5. Intra-note Stability & Sustained Singing Classification
  let varianceSum = 0;
  let absErrSum = 0;
  for (let i = 0; i < core.length; i++) {
    const c = hadVibrato ? residualsCents[i]! * 0.45 : (core[i]! - meanMidi) * 100;
    varianceSum += c * c;
    // Measure fine intonation on the vibrato-compensated tonal center so rich vibrato isn't penalized as pitch error
    const tonalMidi = hadVibrato ? core[i]! - (residualsCents[i]! / 100) * 0.78 : core[i]!;
    absErrSum += Math.abs(tonalMidi - Math.round(tonalMidi)) * 100;
  }
  const stdCents = Math.sqrt(varianceSum / core.length);
  const meanAbsErrCents = absErrSum / core.length;

  // Count genuinely held melodic frames (distinguishes sustained singing from gliding speech syllables)
  if (durMs >= 220 && stdCents <= 36) {
    tracker.sustainedFrames += seg.midis.length;
  }

  if (durSec >= 0.85 && stdCents <= 34) {
    if (durSec > tracker.longToneMaxSec) tracker.longToneMaxSec = durSec;
    tracker.longToneSteadySum += clamp(102 - stdCents * 1.6, 20, 100);
    tracker.longToneCount++;
  }

  // 6. Instantaneous Backing-Track Chord Consonance during this note (when available)
  let instantChordMatch: number | null = null;
  if (seg.instantChromaCount >= 2) {
    const c = seg.instantChromaSum;
    let total = 0;
    for (let i = 0; i < 12; i++) total += c[i]!;
    if (total > 0.01) {
      const pSelf = c[pc]! / total;
      const pFifth = (c[(pc + 7) % 12]! + c[(pc + 5) % 12]!) / (2 * total);
      const pSemitoneClash = Math.max(c[(pc + 1) % 12]!, c[(pc + 11) % 12]!) / total;
      if (pSelf >= 0.11) {
        instantChordMatch = 1.0;
      } else if (pSemitoneClash >= 0.24 && pSelf < 0.05) {
        instantChordMatch = 0.16; // sharp minor-2nd dissonance against live chord tone
      } else if (pFifth >= 0.12) {
        instantChordMatch = 0.88;
      } else {
        instantChordMatch = 0.68;
      }
    }
  }

  tracker.segments.push({
    songStartSec: seg.songStartSec,
    durSec,
    meanMidi,
    sungNote,
    rawOffsetCents,
    meanAbsErrCents,
    stdCents,
    hadVibrato,
    instantChordMatch,
  });

  const inTune = meanAbsErrCents <= 22 && stdCents <= 30 && (instantChordMatch === null || instantChordMatch >= 0.5);
  if (inTune) {
    tracker.streak++;
    if (tracker.streak > tracker.bestStreak) tracker.bestStreak = tracker.streak;
  } else {
    tracker.streak = 0;
  }

  return { hadVibrato, inTune };
}

let micStream: MediaStream | null = null;
let micCtx: AudioContext | null = null;
let micRaf: number | null = null;

function newAudioContext(): AudioContext | null {
  try {
    const Ctor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    return Ctor ? new Ctor() : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------------------------------------
 * Context-Aware Judge + Zero-Randomness Precision Vocal Scoring
 * ---------------------------------------------------------------------------------------------- */

export type ScoreTone = "bad" | "meh" | "good" | "great";
export type ScoreRank = "S+" | "S" | "A" | "B" | "C" | "D" | "F";

export interface ScoreAxis {
  label: string;
  value: number;
}

export type JudgeReason =
  | "silent"
  | "early"
  | "monotone"
  | "talking"
  | "screamer"
  | "no-mic"
  | "normal";

interface Line {
  headline: string;
  roast: string;
}

const SPECIAL_LINES: Record<Exclude<JudgeReason, "normal">, { badge: string; tone: ScoreTone; lines: Line[] }> = {
  silent: {
    badge: "No Vocals Detected",
    tone: "bad",
    lines: [
      { headline: "0.0s Sung — Where Were You?", roast: "The backing track played its heart out while your microphone heard zero singing." },
      { headline: "Mic Check… Hello?", roast: "No singing voice was detected on the microphone. Sing clearly into your mic to earn points!" },
    ],
  },
  early: {
    badge: "Incomplete Take",
    tone: "bad",
    lines: [
      { headline: "Too Short for a Full Score", roast: "You only sang a few seconds! Sing through at least a full verse and chorus to earn a complete score." },
      { headline: "Stopped Right After Warm-Up", roast: "Score scaled to how much you sang — keep singing longer to unlock higher ranks!" },
    ],
  },
  monotone: {
    badge: "Flat Monotone",
    tone: "bad",
    lines: [
      { headline: "Stuck on One Note", roast: "Your voice stayed locked within 1–2 notes instead of following the song's vocal melody." },
      { headline: "One-Note Delivery", roast: "Move your pitch up and down with the melody to raise Pitch and Range scores." },
    ],
  },
  talking: {
    badge: "Spoken / Unsteady",
    tone: "bad",
    lines: [
      { headline: "Talking Instead of Singing", roast: "Detected short gliding speech syllables rather than sustained musical notes." },
      { headline: "Hold Your Notes!", roast: "Spoken words slide across pitches — sustain steady vowel tones to score higher." },
    ],
  },
  screamer: {
    badge: "Loud & Off-Key",
    tone: "bad",
    lines: [
      { headline: "High Volume, Off Pitch", roast: "Strong mic projection, but your notes clashed with the backing track's key." },
      { headline: "Power Without Pitch", roast: "Dial back the volume slightly and lock into the song's scale!" },
    ],
  },
  "no-mic": {
    badge: "Mic Off · 0 Pts",
    tone: "bad",
    lines: [
      { headline: "Microphone Was Off", roast: "Real scoring requires live microphone input — turn Mic On and sing to get scored." },
    ],
  },
};

const TIER_LINES: { max: number; badge: string; tone: ScoreTone; lines: Line[] }[] = [
  {
    max: 49,
    badge: "Off Key",
    tone: "bad",
    lines: [
      { headline: "Rough Intonation", roast: "Most notes landed outside the song's key or drifted mid-phrase." },
      { headline: "Out of Sync & Pitch", roast: "Listen closely to the backing chords and hold your vowel pitches steady." },
    ],
  },
  {
    max: 65,
    badge: "Needs Practice",
    tone: "bad",
    lines: [
      { headline: "Pitch Was Drifting", roast: "You caught parts of the melody, but intonation and note sustain need tightening." },
      { headline: "Getting the Hang of It", roast: "Focus on matching the root notes of the chorus and sustaining phrase endings." },
    ],
  },
  {
    max: 75,
    badge: "Fair Take",
    tone: "meh",
    lines: [
      { headline: "Decent Effort!", roast: "Several phrases landed in key, with room to sharpen pitch accuracy and stability." },
      { headline: "Warm-Up Complete", roast: "Tighten up sharp/flat notes on transitions to break into Rank B and A." },
    ],
  },
  {
    max: 82,
    badge: "Solid Singer",
    tone: "good",
    lines: [
      { headline: "Good Vocal Control!", roast: "Consistent in-key singing with steady rhythm and clear vocal projection." },
      { headline: "Clean & Respectable", roast: "Solid melody tracking — add controlled vibrato and sustained long tones for Rank A!" },
    ],
  },
  {
    max: 89,
    badge: "Stage Ready",
    tone: "good",
    lines: [
      { headline: "Strong Performance!", roast: "Accurate intonation locked into the song's key with confident phrasing." },
      { headline: "Crowd Pleaser", roast: "Steady held notes, balanced dynamics, and tight rhythmic pocket." },
    ],
  },
  {
    max: 95,
    badge: "Star Vocalist",
    tone: "great",
    lines: [
      { headline: " Precision Vocals!", roast: "Crisp cent-level pitch accuracy, steady sustain, and expressive musicality." },
      { headline: "Studio-Grade Take", roast: "Locked right into the harmony and beat from start to finish." },
    ],
  },
  {
    max: 100,
    badge: "Golden Mic Legend",
    tone: "great",
    lines: [
      { headline: "Masterclass Performance!", roast: "Exceptional intonation, rock-solid stability, rich vibrato, and full vocal range." },
    ],
  },
];

let lastHeadline = "";

function pickLine(pool: Line[]): Line {
  const fresh = pool.filter((l) => l.headline !== lastHeadline);
  const chosen = fresh[0] ?? pool[0]!;
  lastHeadline = chosen.headline;
  return chosen;
}

export function rankForScore(score: number): ScoreRank {
  if (score >= 95) return "S+";
  if (score >= 89) return "S";
  if (score >= 82) return "A";
  if (score >= 74) return "B";
  if (score >= 64) return "C";
  if (score >= 48) return "D";
  return "F";
}

function judge(score: number, reason: JudgeReason, axes: ScoreAxis[], statsSummary: string) {
  if (reason !== "normal") {
    const bucket = SPECIAL_LINES[reason];
    const line = pickLine(bucket.lines);
    return {
      badge: bucket.badge,
      tone: bucket.tone,
      headline: line.headline.trim(),
      roast: line.roast,
      judgeNote: `${line.roast} (${statsSummary})`,
    };
  }
  const tier = TIER_LINES.find((t) => score <= t.max) ?? TIER_LINES[TIER_LINES.length - 1]!;
  const line = pickLine(tier.lines);

  const sorted = [...axes].sort((a, b) => b.value - a.value);
  const best = sorted[0];
  const weakest = sorted[sorted.length - 1];
  const tip =
    best && weakest && best.value - weakest.value >= 10
      ? ` Strongest: ${best.label} (${best.value}). Work on: ${weakest.label} (${weakest.value}).`
      : "";

  return {
    badge: tier.badge,
    tone: tier.tone,
    headline: line.headline.trim(),
    roast: line.roast,
    judgeNote: `${statsSummary}${tip}`,
  };
}

export interface KaraokeTelemetry {
  scoreDecimal: number;
  prevBestDecimal: number | null;
  sungSeconds: number;
  notesHit: number;
  detectedKeyLabel: string | null;
  sungMidis: number[];
  pitchHitPct: number;
  sectionPitch: [number | null, number | null, number | null, number | null, number | null];
  rhythmOffsetMs: number;
  hasBeatTiming: boolean;
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
  singerMinMidi: number | null;
  singerMaxMidi: number | null;
}

export interface VideokeScore {
  id: number;
  track: Track;
  score: number;
  rank: ScoreRank;
  headline: string;
  roast: string;
  judgeNote: string;
  badge: string;
  tone: ScoreTone;
  axes: ScoreAxis[];
  telemetry: KaraokeTelemetry;
  /** true when the score came from real microphone vocal analysis */
  heard: boolean;
  phase: "open" | "mini";
  /** When the countdown ends (ms epoch), or null once paused/completed. */
  advanceAt: number | null;
  hasNext: boolean;
}

function vibratoGradeLabel(count: number, totalSec: number, avgHz: number, avgDepth: number): string {
  if (count <= 0 || totalSec < 0.25) return "None";
  const box = avgDepth >= 34 ? "A" : avgDepth >= 20 ? "B" : "C";
  const speed = avgHz >= 6.4 ? "3" : avgHz >= 5.1 ? "2" : "1";
  const desc = box === "A" ? "Rich" : box === "B" ? "Standard" : "Subtle";
  return `${box}-${speed} ${desc}`;
}

function zeroResult(
  reason: "no-mic" | "silent",
  summary: string,
  prevBestDecimal: number | null,
  sungSeconds = 0,
): {
  score: number;
  axes: ScoreAxis[];
  telemetry: KaraokeTelemetry;
  heard: boolean;
  reason: JudgeReason;
  summary: string;
} {
  return {
    score: 0,
    heard: reason !== "no-mic",
    reason,
    summary,
    axes: [
      { label: "Pitch", value: 0 },
      { label: "Stability", value: 0 },
      { label: "Expression", value: 0 },
      { label: "Rhythm", value: 0 },
      { label: "Vibrato & Long", value: 0 },
    ],
    telemetry: {
      scoreDecimal: 0,
      prevBestDecimal,
      sungSeconds: Number(sungSeconds.toFixed(1)),
      notesHit: 0,
      detectedKeyLabel: null,
      sungMidis: [],
      pitchHitPct: 0,
      sectionPitch: [null, null, null, null, null],
      rhythmOffsetMs: 0,
      hasBeatTiming: false,
      vibratoCount: 0,
      vibratoTotalSec: 0,
      vibratoHz: 0,
      vibratoSkill: "None",
      vibratoWave: [],
      longToneSec: 0,
      longToneScore: 0,
      scoops: 0,
      kobushi: 0,
      falls: 0,
      singerMinMidi: null,
      singerMaxMidi: null,
    },
  };
}

/**
 * Deterministic, zero-randomness vocal performance evaluator (0.000 - 100.000 pts).
 * Evaluates fine cent intonation, Krumhansl-Schmuckler backing-track key & live chord consonance,
 * sustained melodic singing vs speech, intra-note stability, dynamic phrasing, beat onset timing,
 * vibrato/long tones, and real sung duration & participation ratio.
 */
export function evaluateTake(
  track: Track | null,
  micOn: boolean,
  tracker: TakeTracker = take,
): {
  score: number;
  axes: ScoreAxis[];
  telemetry: KaraokeTelemetry;
  heard: boolean;
  reason: JudgeReason;
  summary: string;
} {
  const bestMap = readBestScores();
  const prevBestDecimal = track?.id && bestMap[track.id] !== undefined ? bestMap[track.id]! : null;

  if (!micOn) {
    return zeroResult(
      "no-mic",
      "Microphone was off — 0.000 pts. Keep Mic On while singing for real vocal scoring.",
      prevBestDecimal,
    );
  }

  const sungSeconds = tracker.voicedFrames / 30;
  const playedSeconds = Math.max(tracker.activeFrames / 30, sungSeconds);

  if (tracker.voicedFrames < 36 || sungSeconds < 1.2 || tracker.segments.length < 2) {
    return zeroResult(
      "silent",
      sungSeconds < 0.3
        ? "0.0s of singing detected while microphone was active."
        : `Only ${sungSeconds.toFixed(1)}s detected — sing at least a phrase to be scored.`,
      prevBestDecimal,
      sungSeconds,
    );
  }

  // 1. Determine Reference Musical Key (from live backing-track chroma when available, else singer's tonal center)
  const hasBackingKey = tracker.backingChromaFrames >= 20;
  const backingKey = hasBackingKey ? detectBestKey(tracker.backingChroma) : null;
  const singerKey = detectBestKey(tracker.singerPcDur);
  const referenceKey = backingKey ?? singerKey;

  // Calibrate up to ±6¢ constant mic/tuning reference offset
  let calOffset = 0;
  if (tracker.segments.length >= 5) {
    const offsets = tracker.segments.map((s) => s.rawOffsetCents).sort((a, b) => a - b);
    calOffset = clamp(offsets[Math.floor(offsets.length / 2)]!, -6, 6);
  }

  // Sustained melodic ratio: separates real held singing notes (0.60..0.95) from spoken words/noise (0.05..0.32)
  const sustainedRatio = clamp(tracker.sustainedFrames / Math.max(1, tracker.voicedFrames), 0, 1);
  const speechFactor = clamp(0.35 + sustainedRatio * 0.85, 0.35, 1.0);

  // 2. AXIS 1: PITCH ACCURACY (Fine Cent Intonation + Key/Chord Harmonic Consonance)
  let totalSegDur = 0;
  let weightedCentErr = 0;
  let weightedHarmony = 0;
  let weightedJitter = 0;
  let inTuneDur = 0;

  const spanSec = Math.max(5, tracker.maxSongSec, playedSeconds);
  const secBuckets: { inTuneDur: number; totalDur: number }[] = [
    { inTuneDur: 0, totalDur: 0 },
    { inTuneDur: 0, totalDur: 0 },
    { inTuneDur: 0, totalDur: 0 },
    { inTuneDur: 0, totalDur: 0 },
    { inTuneDur: 0, totalDur: 0 },
  ];

  for (const seg of tracker.segments) {
    const w = seg.durSec;
    totalSegDur += w;

    const adjCentErr = Math.max(0, seg.meanAbsErrCents - Math.abs(calOffset) * 0.3);
    weightedCentErr += adjCentErr * w;
    weightedJitter += seg.stdCents * w;

    const pc = ((seg.sungNote % 12) + 12) % 12;
    const scaleCons = referenceKey ? scaleDegreeConsonance(pc, referenceKey) : 0.7;
    // When backing key wasn't available, discount scaleCons by tonal coherence correlation so random chromatic notes don't pass
    const effectiveScaleCons = hasBackingKey
      ? scaleCons
      : scaleCons * clamp(((singerKey?.correlation ?? 0.3) + 0.15) / 0.85, 0.35, 1.0);

    const noteHarmony =
      seg.instantChordMatch !== null
        ? effectiveScaleCons * 0.58 + seg.instantChordMatch * 0.42
        : effectiveScaleCons;
    weightedHarmony += noteHarmony * w;

    const segInTune = adjCentErr <= 21 && noteHarmony >= 0.62 && seg.stdCents <= 30;
    if (segInTune) inTuneDur += w;

    const bIdx = clamp(Math.floor((seg.songStartSec / spanSec) * 5), 0, 4);
    secBuckets[bIdx]!.totalDur += w;
    if (segInTune) secBuckets[bIdx]!.inTuneDur += w;
  }

  const meanCentErr = weightedCentErr / Math.max(0.1, totalSegDur);
  const meanHarmony = weightedHarmony / Math.max(0.1, totalSegDur);
  const meanJitter = weightedJitter / Math.max(0.1, totalSegDur);
  const inTuneRatio = clamp(inTuneDur / Math.max(0.1, totalSegDur), 0, 1);

  // Random uniform error is 25.0¢ -> maps to ~42/100; 8¢ -> ~86/100; 4¢ -> ~96/100
  const fineCentScore = clamp(106 - meanCentErr * 2.55, 6, 100);
  // Random 12-tone harmony mean is ~0.58 -> maps to ~42/100; diatonic in-key 0.94 -> ~97/100; clashing key 0.40 -> ~15/100
  const harmonyScore = clamp(((meanHarmony - 0.3) / 0.66) * 100, 8, 100);

  let pitchFloat = clamp(
    (fineCentScore * 0.54 + harmonyScore * 0.34 + inTuneRatio * 100 * 0.12) * speechFactor,
    5,
    100,
  );

  // 3. AXIS 2: PITCH STABILITY (Intra-note jitter, voice cracks & sustained hold)
  const jitterScore = clamp(103 - meanJitter * 1.9, 8, 100);
  const crackPenalty = Math.min(30, (tracker.cracks / Math.max(1, tracker.notesHit)) * 50);
  const stabilityFloat = clamp(
    (jitterScore - crackPenalty) * clamp(0.42 + sustainedRatio * 0.78, 0.42, 1.0),
    5,
    100,
  );

  // 4. AXIS 3: EXPRESSION (SNR projection, dynamic phrase swell & vocal inflections)
  let snrDb = 10;
  let dynamicRangeDb = 2;
  if (tracker.voicedRmsList.length >= 8) {
    const dbList = tracker.voicedRmsList
      .map((r) => 20 * Math.log10(Math.max(1e-5, r)))
      .sort((a, b) => a - b);
    const p15 = dbList[Math.floor(dbList.length * 0.15)]!;
    const p90 = dbList[Math.floor(dbList.length * 0.9)]!;
    dynamicRangeDb = Math.max(0, p90 - p15);
    const meanRms =
      tracker.voicedRmsList.reduce((a, b) => a + b, 0) / tracker.voicedRmsList.length;
    snrDb = 20 * Math.log10(Math.max(1e-5, meanRms) / Math.max(1e-4, tracker.noiseFloor));
  }
  const projectionScore = clamp((snrDb - 6) * 2.0, 5, 38);
  const swellScore = clamp(dynamicRangeDb * 3.8, 5, 42);
  const inflectionBonus = Math.min(
    22,
    tracker.cleanAttacks * 1.9 + tracker.kobushi * 2.8 + tracker.falls * 2.0,
  );
  let expressionFloat = clamp(
    (projectionScore + swellScore + inflectionBonus) * clamp(0.48 + sustainedRatio * 0.68, 0.48, 1.0),
    6,
    100,
  );

  // 5. AXIS 4: RHYTHM & PARTICIPATION (Beat onset alignment + active vocal coverage)
  let rhythmOffsetMs = 0;
  const hasBeatTiming = tracker.timingOffsetsMs.length >= 3;
  let timingPrecision = clamp(52 + sustainedRatio * 30, 35, 82);
  if (hasBeatTiming) {
    const sortedT = [...tracker.timingOffsetsMs].sort((a, b) => a - b);
    rhythmOffsetMs = Math.round(sortedT[Math.floor(sortedT.length / 2)]!);
    const madMs =
      sortedT.reduce((acc, v) => acc + Math.abs(v - rhythmOffsetMs), 0) / sortedT.length;
    const biasPenalty = Math.max(0, Math.abs(rhythmOffsetMs) - 32) * 0.28;
    timingPrecision = clamp(98 - madMs * 0.42 - biasPenalty, 22, 100);
  }

  // Discount up to 10s of initial instrumental intro before first sung note
  const introGapSec =
    tracker.startedPlayMs !== null && tracker.firstVoicedPlayMs !== null
      ? clamp((tracker.firstVoicedPlayMs - tracker.startedPlayMs) / 1000, 0, 10)
      : 0;
  const effectivePlayedSec = Math.max(sungSeconds, playedSeconds - introGapSec);
  // Real vocals occupy ~45% of post-intro karaoke duration (allowing breaths & turnarounds)
  const participationRatio = clamp(sungSeconds / Math.max(4, effectivePlayedSec * 0.45), 0, 1.06);
  let rhythmFloat = clamp(participationRatio * 52 + (timingPrecision / 100) * 48, 8, 100);

  // 6. AXIS 5: VIBRATO, LONG TONE & MELODIC RANGE
  const rangeSemitones =
    tracker.maxMidi >= tracker.minMidi ? tracker.maxMidi - tracker.minMidi : 0;
  const rangeScore = clamp(rangeSemitones * 2.6, 4, 36);
  const longToneAvg =
    tracker.longToneCount > 0
      ? tracker.longToneSteadySum / tracker.longToneCount
      : clamp((tracker.maxNoteDurSec / 0.85) * 65, 0, 62);
  const longComponent = longToneAvg * 0.44;
  const vibComponent = Math.min(24, tracker.vibratos * 4.5 + tracker.vibratoTotalSec * 2.8);
  let vibLongFloat = clamp(rangeScore + longComponent + vibComponent, 5, 100);

  // 7. Diagnostic Verdict Classification & Anti-Cheese Coverage Scaling
  let reason: JudgeReason = "normal";
  const trackDur = track?.duration && track.duration > 30 ? track.duration : 210;
  const completionRatio = playedSeconds / trackDur;

  let qualityScale = 1.0;
  if (sungSeconds >= 3.5 && sustainedRatio < 0.28) {
    reason = "talking";
    pitchFloat *= 0.72;
    qualityScale = 0.75;
  } else if (sungSeconds >= 4 && (rangeSemitones < 3 || tracker.uniqueNotes.size <= 2)) {
    reason = "monotone";
    pitchFloat *= 0.55;
    vibLongFloat = Math.min(vibLongFloat, 28);
    expressionFloat = Math.min(expressionFloat, 40);
    qualityScale = 0.62;
  } else if (pitchFloat < 48 && snrDb > 22 && tracker.voicedFrames > 60) {
    reason = "screamer";
    qualityScale = 0.8;
  } else if (pitchFloat < 38) {
    qualityScale = 0.82;
  }

  const qualityFloat =
    (pitchFloat * 0.44 +
      stabilityFloat * 0.18 +
      expressionFloat * 0.14 +
      rhythmFloat * 0.13 +
      vibLongFloat * 0.11) *
    qualityScale;

  // Duration & active-participation scaling: prevents high scores from singing 1 line or staying silent 90% of the song
  let durScale = 1.0;
  if (sungSeconds < 22) {
    durScale = clamp(0.14 + (sungSeconds / 22) * 0.78, 0.14, 0.92);
    if (sungSeconds < 12 && completionRatio < 0.25) {
      reason = "early";
    }
  } else {
    durScale = clamp(0.92 + ((sungSeconds - 22) / 33) * 0.08, 0.92, 1.0);
  }

  const partScale =
    effectivePlayedSec >= 18 ? clamp(0.26 + participationRatio * 0.78, 0.26, 1.0) : 1.0;
  const coverageMultiplier = Math.min(durScale, partScale);

  const totalFloat = qualityFloat * coverageMultiplier;
  const scoreDecimal = Number(clamp(totalFloat, 1, 100).toFixed(3));
  const totalScore = Math.round(scoreDecimal);

  const pitchScore = Math.round(pitchFloat * coverageMultiplier);
  const stabilityScore = Math.round(stabilityFloat * coverageMultiplier);
  const expressionScore = Math.round(expressionFloat * coverageMultiplier);
  const rhythmScore = Math.round(rhythmFloat * coverageMultiplier);
  const vibLongScore = Math.round(vibLongFloat * coverageMultiplier);
  const pitchHitPct = Math.round(inTuneRatio * 100);

  const sectionPitch = secBuckets.map((b) =>
    b.totalDur >= 0.35 ? clamp(Math.round((b.inTuneDur / b.totalDur) * 100), 0, 100) : null,
  ) as [number | null, number | null, number | null, number | null, number | null];

  const avgVibHz =
    tracker.vibratos > 0 ? Number((tracker.vibratoHzSum / tracker.vibratos).toFixed(1)) : 0;
  const avgVibDepth = tracker.vibratos > 0 ? tracker.vibratoDepthSum / tracker.vibratos : 0;
  const vibratoSkill = vibratoGradeLabel(
    tracker.vibratos,
    tracker.vibratoTotalSec,
    avgVibHz,
    avgVibDepth,
  );

  const keyText = referenceKey ? `Key ${referenceKey.label} · ` : "";
  const summary = `${keyText}Sung ${sungSeconds.toFixed(1)}s (${tracker.notesHit} notes) · In-key ${pitchHitPct}% · Long tone ${tracker.longToneMaxSec.toFixed(1)}s · Vibrato ${tracker.vibratoTotalSec.toFixed(1)}s (${tracker.vibratos}x)`;

  return {
    score: totalScore,
    heard: true,
    reason,
    summary,
    axes: [
      { label: "Pitch", value: pitchScore },
      { label: "Stability", value: stabilityScore },
      { label: "Expression", value: expressionScore },
      { label: "Rhythm", value: rhythmScore },
      { label: "Vibrato & Long", value: vibLongScore },
    ],
    telemetry: {
      scoreDecimal,
      prevBestDecimal,
      sungSeconds: Number(sungSeconds.toFixed(1)),
      notesHit: tracker.notesHit,
      detectedKeyLabel: referenceKey?.label ?? null,
      sungMidis: [...tracker.uniqueNotes].sort((a, b) => a - b),
      pitchHitPct,
      sectionPitch,
      rhythmOffsetMs: hasBeatTiming ? clamp(rhythmOffsetMs, -180, 180) : 0,
      hasBeatTiming,
      vibratoCount: tracker.vibratos,
      vibratoTotalSec: Number(tracker.vibratoTotalSec.toFixed(1)),
      vibratoHz: avgVibHz,
      vibratoSkill,
      vibratoWave: tracker.vibratoWave,
      longToneSec: Number(tracker.longToneMaxSec.toFixed(1)),
      longToneScore: Math.round(longToneAvg),
      scoops: tracker.cleanAttacks,
      kobushi: tracker.kobushi,
      falls: tracker.falls,
      singerMinMidi: Number.isFinite(tracker.minMidi) ? tracker.minMidi : null,
      singerMaxMidi: Number.isFinite(tracker.maxMidi) ? tracker.maxMidi : null,
    },
  };
}

function resetTake() {
  take = createTake();
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

function noiseHit(
  ctx: AudioContext,
  noise: AudioBuffer,
  at: number,
  opts: { type: BiquadFilterType; freq: number; q?: number; gain: number; decay: number },
) {
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
  ampRamp(out.gain, at, dur, gain);
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

function ampRamp(param: AudioParam, at: number, dur: number, gain: number) {
  param.exponentialRampToValueAtTime(gain, at + 0.03);
  param.setValueAtTime(gain, at + dur * 0.7);
  param.exponentialRampToValueAtTime(0.0001, at + dur);
}

function applause(ctx: AudioContext, noise: AudioBuffer, at: number, seconds: number, density: number, gain: number) {
  const claps = Math.floor(seconds * density);
  for (let i = 0; i < claps; i++) {
    const t = at + Math.random() * seconds;
    const shape = Math.sin(Math.PI * ((t - at) / seconds));
    noiseHit(ctx, noise, t, {
      type: "bandpass",
      freq: 900 + Math.random() * 1800,
      q: 1.2,
      gain: gain * (0.4 + 0.6 * shape),
      decay: 0.05 + Math.random() * 0.04,
    });
  }
}

function playDrumroll(ctx: AudioContext, noise: AudioBuffer, seconds: number) {
  const now = ctx.currentTime;
  for (let t = 0; t < seconds; t += 0.042) {
    const level = 0.025 + (t / seconds) * 0.09;
    noiseHit(ctx, noise, now + t, { type: "highpass", freq: 1600, gain: level, decay: 0.07 });
  }
  for (let t = 0; t < seconds; t += 0.33) brass(ctx, 80, now + t, 0.12, 0.02);
}

function playReveal(ctx: AudioContext, noise: AudioBuffer, tone: ScoreTone) {
  const now = ctx.currentTime + 0.02;
  if (tone === "bad") {
    brass(ctx, 110, now, 0.45, 0.06);
    brass(ctx, 116, now, 0.45, 0.04);
    const notes = [293.66, 277.18, 261.63, 246.94];
    notes.forEach((f, i) => brass(ctx, f, now + 0.55 + i * 0.32, i === 3 ? 1.1 : 0.3, 0.05, i === 3 ? 6 : 0));
    return;
  }
  noiseHit(ctx, noise, now, { type: "highpass", freq: 5500, gain: 0.16, decay: 1.6 });
  if (tone === "meh") {
    [523.25, 659.25, 587.33].forEach((f, i) => brass(ctx, f, now + i * 0.16, i === 2 ? 0.6 : 0.15, 0.045));
    applause(ctx, noise, now + 0.3, 2, 25, 0.06);
    return;
  }
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
  for (const f of [392, 523.25, 659.25]) brass(ctx, f, now + 0.94, 0.9, 0.025);
  if (tone === "great") noiseHit(ctx, noise, now + 0.94, { type: "highpass", freq: 6000, gain: 0.12, decay: 1.4 });
  applause(ctx, noise, now + 0.4, tone === "great" ? 3.6 : 2.6, tone === "great" ? 90 : 50, tone === "great" ? 0.08 : 0.065);
}

/** Starts the drumroll now and the reveal after `rollSeconds`. Returns a stop function. */
export function playScoreSounds(tone: ScoreTone, rollSeconds: number): () => void {
  const ctx = newAudioContext();
  if (!ctx) return () => {};
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  const noise = noiseBuffer(ctx, 2);
  if (rollSeconds > 0.05) playDrumroll(ctx, noise, rollSeconds);
  const reveal = setTimeout(() => playReveal(ctx, noise, tone), Math.max(0, rollSeconds * 1000));
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
  /** True only when the user manually clicked Mic Off so auto-start respects their choice. */
  userMutedMic: boolean;
  micLevel: number;
  live: { midi: number; cents: number; clarity: number } | null;
  liveStats: LiveVocalStats;
  score: VideokeScore | null;

  isVideoke: (id: string | undefined) => boolean;
  mark: (track: Track) => void;
  singNow: (track: Track) => void;
  reserve: (track: Track) => void;
  startMic: () => Promise<void>;
  stopMic: (manual?: boolean) => void;
  showScore: (track: Track) => void;
  holdScoreOpen: () => void;
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
  userMutedMic: false,
  micLevel: 0,
  live: null,
  liveStats: INITIAL_LIVE_STATS,
  score: null,

  isVideoke: (id) => !!id && get().ids.has(id),

  mark: (track) => {
    const ids = new Set(get().ids);
    ids.add(track.id);
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
    set({ liveStats: INITIAL_LIVE_STATS });
    // Auto-enable live microphone when starting a Videoke song unless user explicitly muted it
    if (!get().micOn && !get().userMutedMic) {
      void get().startMic();
    } else {
      ensurePlaybackAnalyser();
    }
    const p = usePlayer.getState();
    const reserved = p.queue.slice(p.index + 1).filter((x) => get().ids.has(x.id) && x.id !== track.id);
    usePlayer.setState({ repeat: "off" });
    p.playList([track, ...reserved], 0);
  },

  reserve: (track) => {
    const p = usePlayer.getState();
    const current = p.queue[p.index];
    if (!current || !get().ids.has(current.id)) return get().singNow(track);
    const reserved = p.queue.slice(p.index + 1).filter((x) => get().ids.has(x.id));
    if (reserved.some((x) => x.id === track.id)) return;
    get().mark(track);
    const nextReserved = [...reserved, track];
    const queue = [current, ...nextReserved];
    usePlayer.setState({ queue, index: 0, original: null, repeat: "off" });
    toast(`Reserved #${nextReserved.length}: ${track.title}`);
  },

  startMic: async () => {
    set({ userMutedMic: false });
    if (get().micOn) {
      ensurePlaybackAnalyser();
      return;
    }
    try {
      let preferredDeviceId: string | undefined;
      try {
        if (navigator.mediaDevices?.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const inputs = devices.filter((d) => d.kind === "audioinput" && d.deviceId && d.deviceId !== "default");
          const nonBluetooth = inputs.find(
            (d) => d.label && !/\b(airpods|bluetooth|hands-?free|headset|buds|wireless)\b/i.test(d.label),
          );
          if (nonBluetooth && inputs.some((d) => /\b(airpods|bluetooth|hands-?free|headset|buds)\b/i.test(d.label))) {
            preferredDeviceId = nonBluetooth.deviceId;
          }
        }
      } catch {
        /* ignore device enumeration failure */
      }

      // Disable OS echoCancellation / noiseSuppression / autoGainControl so CoreAudio / WASAPI / AudioManager
      // stay in hi-fi stereo music mode instead of muffled mono telephony ducking mode.
      const hiFiConstraints: MediaTrackConstraints = {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
        ...(preferredDeviceId ? { deviceId: { ideal: preferredDeviceId } } : {}),
      };

      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: hiFiConstraints });
      } catch {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      const activeTrack = micStream.getAudioTracks()[0];
      if (activeTrack && /\b(airpods|bluetooth|hands-?free|buds)\b/i.test(activeTrack.label)) {
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        const builtIn = devices.find(
          (d) =>
            d.kind === "audioinput" &&
            d.deviceId &&
            d.deviceId !== "default" &&
            d.label &&
            !/\b(airpods|bluetooth|hands-?free|buds)\b/i.test(d.label),
        );
        if (builtIn) {
          try {
            const cleaner = await navigator.mediaDevices.getUserMedia({
              audio: {
                deviceId: { exact: builtIn.deviceId },
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
              },
            });
            micStream.getTracks().forEach((tr) => tr.stop());
            micStream = cleaner;
          } catch {
            /* keep original stream */
          }
        }
      }
    } catch {
      toast("Microphone permission denied — enable Mic access in System Settings to score vocals", "error");
      return;
    }

    try {
      const Ctor =
        window.AudioContext ??
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      micCtx = Ctor ? new Ctor({ latencyHint: "interactive", sampleRate: 48000 }) : null;
    } catch {
      micCtx = newAudioContext();
    }
    if (!micCtx) {
      micStream.getTracks().forEach((tr) => tr.stop());
      micStream = null;
      return;
    }
    if (micCtx.state === "suspended") {
      await micCtx.resume().catch(() => {});
    }
    ensurePlaybackAnalyser();
    const ctx = micCtx;

    // 4th-order Butterworth Vocal Bandpass Chain (82 Hz - 1100 Hz)
    const hp1 = ctx.createBiquadFilter();
    hp1.type = "highpass";
    hp1.frequency.value = 82;
    hp1.Q.value = 0.707;

    const hp2 = ctx.createBiquadFilter();
    hp2.type = "highpass";
    hp2.frequency.value = 82;
    hp2.Q.value = 0.707;

    const presence = ctx.createBiquadFilter();
    presence.type = "peaking";
    presence.frequency.value = 340;
    presence.Q.value = 0.85;
    presence.gain.value = 4.5;

    const lp1 = ctx.createBiquadFilter();
    lp1.type = "lowpass";
    lp1.frequency.value = 1100;
    lp1.Q.value = 0.707;

    const lp2 = ctx.createBiquadFilter();
    lp2.type = "lowpass";
    lp2.frequency.value = 1100;
    lp2.Q.value = 0.707;

    const source = ctx.createMediaStreamSource(micStream);
    source.connect(hp1);
    hp1.connect(hp2);
    hp2.connect(presence);
    presence.connect(lp1);
    lp1.connect(lp2);

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    lp2.connect(analyser);
    const timeData = new Float32Array(analyser.fftSize);

    // Parallel Singer's Formant Bandpass (1250 - 3400 Hz) to distinguish human vowels from distant speaker bleed
    const formantBp = ctx.createBiquadFilter();
    formantBp.type = "bandpass";
    formantBp.frequency.value = 2150;
    formantBp.Q.value = 0.85;
    const formantAnalyser = ctx.createAnalyser();
    formantAnalyser.fftSize = 1024;
    source.connect(formantBp);
    formantBp.connect(formantAnalyser);
    const formantData = new Float32Array(formantAnalyser.fftSize);

    set({ micOn: true });

    let frame = 0;
    let lastVibratoFlash = 0;

    const loop = () => {
      micRaf = requestAnimationFrame(loop);
      if (frame++ % 2) return; // ~30 Hz vocal analysis rate
      if (ctx.state === "suspended") void ctx.resume().catch(() => {});

      analyser.getFloatTimeDomainData(timeData);
      formantAnalyser.getFloatTimeDomainData(formantData);

      let sumSq = 0;
      for (let i = 0; i < timeData.length; i++) sumSq += timeData[i]! * timeData[i]!;
      const rawRms = Math.sqrt(sumSq / timeData.length);

      let fSq = 0;
      for (let i = 0; i < formantData.length; i++) fSq += formantData[i]! * formantData[i]!;
      const formantRms = Math.sqrt(fSq / formantData.length);

      const now = performance.now();
      let detected = detectVocalPitch(timeData, ctx.sampleRate, take.noiseFloor);
      const pb = samplePlaybackHarmonics(detected ? detected.hz : null, now);

      if (detected) {
        const formantRatio = formantRms / Math.max(1e-5, rawRms);
        const snrRatio = rawRms / Math.max(1e-5, take.noiseFloor);
        // Reject distant speaker accompaniment bleed while keeping near-field human vocals responsive
        const likelySpeakerBleed =
          pb.available &&
          ((pb.binLevel > 0.48 && snrRatio < 3.5 && formantRatio < 0.13) ||
            (pb.overallLevel > 0.25 && snrRatio < 2.9 && formantRatio < 0.08));

        if (likelySpeakerBleed) {
          take.noiseFloor = clamp(take.noiseFloor * 0.93 + rawRms * 0.07, 0.00025, 0.028);
          detected = null;
        } else {
          take.peakRms = clamp(Math.max(take.peakRms * 0.995, rawRms), 0.008, 0.35);
        }
      } else {
        // Track ambient + speaker floor during unvoiced frames
        take.noiseFloor = clamp(take.noiseFloor * 0.94 + rawRms * 0.06, 0.00025, 0.028);
      }

      // Software-normalized meter level so quiet built-in laptop mics & loud USB mics both show crisp movement
      const normSignal = Math.max(0, rawRms - take.noiseFloor * 1.15);
      const level = clamp(normSignal / Math.max(0.008, take.peakRms * 0.72), 0, 1);

      let midi: number | null = detected ? 69 + 12 * Math.log2(detected.hz / 440) : null;

      // 3-point glitch filter: reject single-frame octave/consonant spikes > 5 semitones
      if (midi !== null) {
        take.recentRawMidis.push(midi);
        if (take.recentRawMidis.length > 3) take.recentRawMidis.shift();
        if (take.recentRawMidis.length === 3) {
          const [a, b, c] = take.recentRawMidis;
          if (Math.abs(b! - a!) > 5 && Math.abs(b! - c!) > 5) {
            midi = (a! + c!) / 2;
          }
        }
      } else {
        take.recentRawMidis.length = 0;
      }

      const pState = usePlayer.getState();
      const playing = pState.status === "playing";

      if (playing) {
        if (take.startedPlayMs === null) take.startedPlayMs = now;
        take.activeFrames++;
        const songSec = getExactPlaybackTime();
        if (songSec > take.maxSongSec) take.maxSongSec = songSec;
        const activeTrack = pState.queue[pState.index] ?? null;

        // Accumulate live backing-track chroma & beat timestamps
        if (pb.available) {
          for (let i = 0; i < 12; i++) take.backingChroma[i] += pb.chroma[i]!;
          take.backingChromaFrames++;
          if (pb.beatOnset) {
            take.playbackBeatMs.push(now);
            while (take.playbackBeatMs.length > 48) take.playbackBeatMs.shift();
          }
        }

        if (midi !== null && detected) {
          if (take.firstVoicedPlayMs === null) take.firstVoicedPlayMs = now;
          take.voicedFrames++;
          take.voicedRmsList.push(detected.rms);

          const recordBeatTiming = () => {
            if (take.playbackBeatMs.length === 0) return;
            let bestDt: number | null = null;
            for (let i = take.playbackBeatMs.length - 1; i >= 0; i--) {
              const dt = now - take.playbackBeatMs[i]!;
              if (dt > 320) break;
              if (Math.abs(dt) <= 260 && (bestDt === null || Math.abs(dt) < Math.abs(bestDt))) {
                bestDt = dt;
              }
            }
            if (bestDt !== null) take.timingOffsetsMs.push(bestDt);
          };

          if (!take.wasVoiced) {
            take.phraseOnsetsMs.push(now);
            take.wasVoiced = true;
            recordBeatTiming();
          }

          const cur = take.currentNote;
          if (cur && Math.abs(midi - cur.anchorMidi) <= 0.68 && now - cur.endMs < 130) {
            cur.midis.push(midi);
            cur.rmsList.push(detected.rms);
            cur.endMs = now;
            cur.songEndSec = songSec;
            cur.anchorMidi = cur.anchorMidi * 0.85 + midi * 0.15;
            if (pb.available) {
              for (let i = 0; i < 12; i++) cur.instantChromaSum[i] += pb.chroma[i]!;
              cur.instantChromaCount++;
            }
          } else {
            if (cur) {
              const prevMidi = cur.anchorMidi;
              const res = finalizeNoteSegment(cur);
              if (res.hadVibrato) lastVibratoFlash = now;
              if (cur.midis.length < 4 && Math.abs(midi - prevMidi) > 6.5) {
                take.cracks++;
              }
              recordBeatTiming();
            }
            const chromaAcc = new Float32Array(12);
            let chromaCnt = 0;
            if (pb.available) {
              chromaAcc.set(pb.chroma);
              chromaCnt = 1;
            }
            take.currentNote = {
              anchorMidi: midi,
              startMs: now,
              endMs: now,
              songStartSec: songSec,
              songEndSec: songSec,
              midis: [midi],
              rmsList: [detected.rms],
              instantChromaSum: chromaAcc,
              instantChromaCount: chromaCnt,
            };
          }
        } else {
          take.wasVoiced = false;
          if (take.currentNote && now - take.currentNote.endMs >= 110) {
            const res = finalizeNoteSegment(take.currentNote);
            if (res.hadVibrato) lastVibratoFlash = now;
            take.currentNote = null;
          }
        }

        // Publish live HUD stats (~5 times/sec)
        if (frame % 12 === 0) {
          const evalSnap = take.segments.length >= 2 ? evaluateTake(activeTrack, true) : null;
          set({
            liveStats: {
              sungSeconds: Number((take.voicedFrames / 30).toFixed(1)),
              notesHit: take.notesHit,
              inTunePct: evalSnap?.telemetry.pitchHitPct ?? 0,
              streak: take.streak,
              bestStreak: take.bestStreak,
              vibratos: take.vibratos,
              lastVibratoAt: lastVibratoFlash,
              runningScore: evalSnap ? Number(evalSnap.telemetry.scoreDecimal.toFixed(1)) : null,
              currentNoteLabel: midi !== null ? noteName(midi) : null,
            },
          });
        }
      } else if (frame % 10 === 0) {
        set({
          liveStats: {
            ...get().liveStats,
            currentNoteLabel: midi !== null ? noteName(midi) : null,
          },
        });
      }

      set({
        micLevel: level,
        live:
          midi === null
            ? null
            : {
                midi,
                cents: Math.round((midi - Math.round(midi)) * 100),
                clarity: detected?.clarity ?? 0,
              },
      });
    };
    loop();
  },

  stopMic: (manual = true) => {
    if (micRaf !== null) cancelAnimationFrame(micRaf);
    micRaf = null;
    micStream?.getTracks().forEach((tr) => tr.stop());
    micStream = null;
    void micCtx?.close().catch(() => {});
    micCtx = null;
    set({
      micOn: false,
      userMutedMic: manual ? true : get().userMutedMic,
      micLevel: 0,
      live: null,
      liveStats: INITIAL_LIVE_STATS,
    });
  },

  showScore: (track) => {
    if (take.currentNote) {
      finalizeNoteSegment(take.currentNote);
      take.currentNote = null;
    }
    const { score, axes, telemetry, heard, reason, summary } = evaluateTake(track, get().micOn);
    if (heard && telemetry.scoreDecimal > 0) {
      saveBestScore(track.id, telemetry.scoreDecimal);
    }
    resetTake();
    set({ liveStats: INITIAL_LIVE_STATS });

    const verdict = judge(score, reason, axes, summary);
    const rank = rankForScore(score);

    const p = usePlayer.getState();
    p.pause();
    const current = p.queue[p.index];
    const reserved = p.queue.slice(p.index + 1).filter((x) => get().ids.has(x.id));
    if (current) {
      usePlayer.setState({
        queue: [current, ...reserved],
        index: 0,
        original: null,
        repeat: "off",
        status: "paused",
        position: 0,
      });
    }
    if (advanceTimer) clearTimeout(advanceTimer);
    if (miniTimer) clearTimeout(miniTimer);
    const hasNext = reserved.length > 0;
    set({
      score: {
        id: ++scoreSeq,
        track,
        score,
        rank,
        axes,
        telemetry,
        heard,
        headline: verdict.headline,
        roast: verdict.roast,
        judgeNote: verdict.judgeNote,
        badge: verdict.badge,
        tone: verdict.tone,
        phase: "open",
        advanceAt: Date.now() + AUTO_ADVANCE_MS,
        hasNext,
      },
    });
    advanceTimer = setTimeout(() => {
      advanceTimer = null;
      const s = get().score;
      if (!s) return;
      set({ score: { ...s, phase: "mini", advanceAt: null } });
      if (hasReservedNext()) {
        get().playNext();
      } else {
        usePlayer.getState().pause();
      }
      miniTimer = setTimeout(() => get().dismiss(), 12_000);
    }, AUTO_ADVANCE_MS);
  },

  holdScoreOpen: () => {
    if (advanceTimer) {
      clearTimeout(advanceTimer);
      advanceTimer = null;
    }
    const s = get().score;
    if (s && s.advanceAt !== null) {
      set({ score: { ...s, advanceAt: null } });
    }
  },

  minimize: () => {
    const s = get().score;
    if (s) set({ score: { ...s, phase: "mini" } });
  },

  expand: () => {
    const s = get().score;
    if (miniTimer) clearTimeout(miniTimer);
    if (advanceTimer) {
      clearTimeout(advanceTimer);
      advanceTimer = null;
    }
    if (s) set({ score: { ...s, phase: "open", advanceAt: null } });
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
    set({ liveStats: INITIAL_LIVE_STATS });
    const p = usePlayer.getState();
    if (hasReservedNext()) p.jumpTo(p.index + 1);
  },

  singAgain: () => {
    const s = get().score;
    get().dismiss();
    if (!s) return;
    resetTake();
    set({ liveStats: INITIAL_LIVE_STATS });
    if (!get().micOn && !get().userMutedMic) {
      void get().startMic();
    }
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
playerHooks.forceVideo = (track) => useVideoke.getState().ids.has(track.id);
playerHooks.onTrackStarted = (track) => {
  const st = useVideoke.getState();
  if (st.ids.has(track.id)) {
    ensurePlaybackAnalyser();
    if (!st.micOn && !st.userMutedMic) {
      void st.startMic();
    }
  } else if (st.micOn) {
    st.stopMic(false);
  }
};

/** Whether the track playing now is a Videoke song (its video already shows the lyrics). */
export function useIsVideokeTrack(): boolean {
  const id = usePlayer((p) => p.queue[p.index]?.id ?? "");
  return useVideoke((v) => v.ids.has(id));
}
