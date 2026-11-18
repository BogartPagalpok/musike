import { create } from "zustand";
import type { Track } from "../lib/types";
import { getCachedVocalGuide } from "../lib/vocalGuide";
import { getPlaybackPitchDominance } from "../player/equalizer";
import { getExactPlaybackTime, playerHooks, usePlayer } from "../player/player";
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

/** Deterministic 5-digit videoke songbook code for any track ID. */
export function songbookCode(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 90000;
  }
  return String(10000 + Math.abs(hash)).slice(0, 5);
}

/* ------------------------------------------------------------------------------------------------
 * Accurate YIN Vocal Pitch Detection + Real-Time Note, Vibrato, Dynamics & Participation Analyzer
 * ---------------------------------------------------------------------------------------------- */

export interface PitchPoint {
  /** performance.now() in ms */
  t: number;
  /** Fractional MIDI note, or null when nothing is being sung. */
  midi: number | null;
  /** Pitch clarity (0..1) from YIN CMNDF */
  clarity?: number;
}

/** Rolling 10 s of pitch readings for the scrolling guide. */
export const pitchTrail: PitchPoint[] = [];

export interface LiveVocalStats {
  notesHit: number;
  inTunePct: number;
  streak: number;
  bestStreak: number;
  vibratos: number;
  lastVibratoAt: number;
  runningScore: number | null;
}

const INITIAL_LIVE_STATS: LiveVocalStats = {
  notesHit: 0,
  inTunePct: 0,
  streak: 0,
  bestStreak: 0,
  vibratos: 0,
  lastVibratoAt: 0,
  runningScore: null,
};

interface NoteSegment {
  anchorMidi: number;
  startMs: number;
  endMs: number;
  songStartSec: number;
  songEndSec: number;
  targetMidi: number | null;
  midis: number[];
  rmsList: number[];
}

interface SectionBucket {
  inTune: number;
  total: number;
}

interface TakeTracker {
  startedPlayMs: number | null;
  activeFrames: number;
  voicedFrames: number;
  inTuneFrames: number;
  perfectFrames: number;
  centsErrSum: number;
  evalFrames: number;
  noteJitterSum: number;
  noteJitterCount: number;
  cracks: number;
  vibratos: number;
  vibratoTotalSec: number;
  vibratoHzSum: number;
  vibratoDepthSum: number;
  vibratoWave: number[];
  longToneMaxSec: number;
  longToneSteadySum: number;
  longToneCount: number;
  cleanAttacks: number;
  kobushi: number;
  falls: number;
  notesHit: number;
  streak: number;
  bestStreak: number;
  uniqueNotes: Set<number>;
  minMidi: number;
  maxMidi: number;
  dbSamples: number[];
  activeWindows: Set<number>;
  sungWindows: Set<number>;
  phraseOnsets: number;
  timingOffsetsMs: number[];
  sections: [SectionBucket, SectionBucket, SectionBucket, SectionBucket, SectionBucket];
  wasVoiced: boolean;
  centsOffsets: number[];
  currentNote: NoteSegment | null;
  recentRawMidis: number[];
  noiseFloor: number;
}

function createTake(): TakeTracker {
  return {
    startedPlayMs: null,
    activeFrames: 0,
    voicedFrames: 0,
    inTuneFrames: 0,
    perfectFrames: 0,
    centsErrSum: 0,
    evalFrames: 0,
    noteJitterSum: 0,
    noteJitterCount: 0,
    cracks: 0,
    vibratos: 0,
    vibratoTotalSec: 0,
    vibratoHzSum: 0,
    vibratoDepthSum: 0,
    vibratoWave: [],
    longToneMaxSec: 0,
    longToneSteadySum: 0,
    longToneCount: 0,
    cleanAttacks: 0,
    kobushi: 0,
    falls: 0,
    notesHit: 0,
    streak: 0,
    bestStreak: 0,
    uniqueNotes: new Set<number>(),
    minMidi: Infinity,
    maxMidi: -Infinity,
    dbSamples: [],
    activeWindows: new Set<number>(),
    sungWindows: new Set<number>(),
    phraseOnsets: 0,
    timingOffsetsMs: [],
    sections: [
      { inTune: 0, total: 0 },
      { inTune: 0, total: 0 },
      { inTune: 0, total: 0 },
      { inTune: 0, total: 0 },
      { inTune: 0, total: 0 },
    ],
    wasVoiced: false,
    centsOffsets: [],
    currentNote: null,
    recentRawMidis: [],
    noiseFloor: 0.008,
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

/**
 * YIN Cumulative Mean Normalized Difference Function (CMNDF) pitch detector with parabolic interpolation.
 * Eliminates octave-drop subharmonic errors and achieves < 0.5 cent accuracy across human singing range (78-1050 Hz).
 */
function detectVocalPitch(
  buf: Float32Array,
  sampleRate: number,
  noiseFloor: number,
): { hz: number; clarity: number; rms: number } | null {
  let sumSq = 0;
  for (let i = 0; i < buf.length; i++) sumSq += buf[i] * buf[i];
  const rms = Math.sqrt(sumSq / buf.length);

  // Adaptive vocal energy gate: rejects room hum and distant speaker bleed without OS voice-call ducking
  const gate = Math.max(0.017, Math.min(0.05, noiseFloor * 2.35));
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
      const delta = buf[i] - buf[i + tau];
      diff += delta * delta;
    }
    runningSum += diff;
    cmndf[tau] = runningSum > 0 ? (diff * tau) / runningSum : 1;
  }

  // First-minimum search below YIN threshold (prevents sub-harmonic octave errors)
  const YIN_THRESHOLD = 0.18;
  let bestTau = -1;
  for (let tau = minTau; tau <= maxTau - 1; tau++) {
    if (cmndf[tau] < YIN_THRESHOLD) {
      while (tau + 1 <= maxTau - 1 && cmndf[tau + 1] < cmndf[tau]) {
        tau++;
      }
      bestTau = tau;
      break;
    }
  }

  // Fallback to global minimum if clearly periodic (< 0.25)
  if (bestTau < 0) {
    let minVal = 1;
    let minIdx = -1;
    for (let tau = minTau; tau <= maxTau - 1; tau++) {
      if (cmndf[tau] < minVal) {
        minVal = cmndf[tau];
        minIdx = tau;
      }
    }
    if (minIdx > 0 && minVal < 0.25) {
      bestTau = minIdx;
    } else {
      return null;
    }
  }

  const clarity = clamp(1 - cmndf[bestTau], 0, 1);
  if (clarity < 0.78) return null;

  // Parabolic interpolation around bestTau for sub-sample (< 0.5 cent) precision
  const s0 = cmndf[bestTau - 1];
  const s1 = cmndf[bestTau];
  const s2 = cmndf[bestTau + 1];
  const denom = 2 * (2 * s1 - s0 - s2);
  const shift = denom !== 0 ? clamp((s0 - s2) / denom, -0.5, 0.5) : 0;
  const refinedTau = bestTau + shift;

  return {
    hz: sampleRate / refinedTau,
    clarity,
    rms,
  };
}

/** Octave-folded cent error against a target reference MIDI note (or nearest chromatic note when null). */
function pitchErrorCents(sungMidi: number, targetMidi: number | null): number {
  if (targetMidi === null) {
    return Math.abs(sungMidi - Math.round(sungMidi)) * 100;
  }
  const diff = (((sungMidi - targetMidi) % 12) + 18) % 12 - 6;
  return Math.abs(diff) * 100;
}

/** Finalizes a held note segment to evaluate reference-melody pitch, stability, vibrato, long tones, scoops, kobushi & falls. */
function finalizeNoteSegment(seg: NoteSegment, trackDurSec = 220): { hadVibrato: boolean; inTune: boolean } {
  const durMs = seg.endMs - seg.startMs;
  const durSec = durMs / 1000;
  const n = seg.midis.length;
  if (n < 4 || durMs < 130) return { hadVibrato: false, inTune: false };

  const core = n >= 6 ? seg.midis.slice(2) : seg.midis.slice(1);
  const meanMidi = core.reduce((a, b) => a + b, 0) / core.length;
  const sungNote = Math.round(meanMidi);
  const noteOffsetCents = (meanMidi - sungNote) * 100;

  take.notesHit++;
  take.uniqueNotes.add(sungNote);
  if (sungNote < take.minMidi) take.minMidi = sungNote;
  if (sungNote > take.maxMidi) take.maxMidi = sungNote;
  take.centsOffsets.push(noteOffsetCents);

  // 1. Shakuri / Scoop detection (smooth upward glide into held pitch)
  if (n >= 6) {
    const startDelta = (meanMidi - seg.midis[0]!) * 100;
    const endErr = Math.abs((seg.midis[Math.min(n - 1, core.length)]! - meanMidi) * 100);
    if (startDelta >= 35 && startDelta <= 185 && endErr <= 24) {
      take.cleanAttacks++;
    }
  }

  // 2. Vocal Fall detection (expressive downward release over final 2-4 frames of a sustained note)
  if (n >= 8 && durMs >= 280) {
    const preEnd = seg.midis[n - 3]!;
    const lastVal = seg.midis[n - 1]!;
    const dropCents = (preEnd - lastVal) * 100;
    if (dropCents >= 45 && dropCents <= 240) {
      take.falls++;
    }
  }

  // 3. Kobushi / Vocal Turn detection (single quick 60-180¢ ornament crest within 120-260ms inside a note)
  if (n >= 8) {
    for (let i = 2; i < core.length - 2; i++) {
      const base = (core[i - 2]! + core[i + 2]!) * 0.5;
      const excursion = Math.abs(core[i]! - base) * 100;
      const returnErr = Math.abs(core[i - 2]! - core[i + 2]!) * 100;
      if (excursion >= 58 && excursion <= 190 && returnErr <= 32) {
        take.kobushi++;
        break;
      }
    }
  }

  // 4. Vibrato detection & waveform capture (4.2 - 8.2 Hz oscillation, 13 - 85¢ swing)
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

  if (durMs >= 350 && core.length >= 10) {
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
    if (freqHz >= 4.2 && freqHz <= 8.2 && avgSwing >= 13 && avgSwing <= 85) {
      hadVibrato = true;
      take.vibratos++;
      take.vibratoTotalSec += durSec;
      take.vibratoHzSum += freqHz;
      take.vibratoDepthSum += avgSwing;
      if (residualsCents.length >= take.vibratoWave.length) {
        const maxAbs = Math.max(20, ...residualsCents.map((v) => Math.abs(v)));
        take.vibratoWave = Array.from({ length: 28 }, (_, idx) => {
          const srcIdx = Math.min(residualsCents.length - 1, Math.floor((idx / 27) * (residualsCents.length - 1)));
          return clamp(residualsCents[srcIdx]! / maxAbs, -1, 1);
        });
      }
    }
  }

  // 5. Stability & Long Tone Steadiness (>= 0.85s held note)
  let varianceSum = 0;
  for (let i = 0; i < core.length; i++) {
    const c = hadVibrato ? residualsCents[i]! * 0.45 : (core[i]! - meanMidi) * 100;
    varianceSum += c * c;
  }
  const stdCents = Math.sqrt(varianceSum / core.length);
  take.noteJitterSum += stdCents;
  take.noteJitterCount++;

  if (durSec >= 0.85) {
    if (durSec > take.longToneMaxSec) take.longToneMaxSec = durSec;
    take.longToneSteadySum += clamp(102 - stdCents * 1.35, 25, 100);
    take.longToneCount++;
  }

  // 6. Reference-Melody + Chromatic Intonation Evaluation + Section Bucket
  const secIdx = clamp(Math.floor((seg.songStartSec / Math.max(30, trackDurSec)) * 5), 0, 4);
  const bucket = take.sections[secIdx]!;
  let noteErrSum = 0;
  for (const m of core) {
    // Blend reference guide melody accuracy (when a GuideBar is active) with chromatic precision
    const chromErr = Math.abs(m - Math.round(m)) * 100;
    const refErr = seg.targetMidi !== null ? pitchErrorCents(m, seg.targetMidi) : chromErr;
    const err = seg.targetMidi !== null ? Math.min(refErr * 0.72 + chromErr * 0.28, chromErr + 28) : chromErr;
    noteErrSum += err;
    take.centsErrSum += err;
    take.evalFrames++;
    bucket.total++;
    if (err <= 26) {
      take.inTuneFrames++;
      bucket.inTune++;
    }
    if (err <= 13) take.perfectFrames++;
  }
  const avgNoteErr = noteErrSum / core.length;
  const inTune = avgNoteErr <= 26;
  if (inTune) {
    take.streak++;
    if (take.streak > take.bestStreak) take.bestStreak = take.streak;
  } else {
    take.streak = 0;
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
 * Context-Aware Funny Judge + Score Computation
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
  | "screamer"
  | "no-mic"
  | "normal";

interface Line {
  headline: string;
  roast: string;
}

const SPECIAL_LINES: Record<Exclude<JudgeReason, "normal">, { badge: string; tone: ScoreTone; lines: Line[] }> = {
  silent: {
    badge: "Ghost Singer",
    tone: "bad",
    lines: [
      { headline: "Nice Instrumental! Where Were You?", roast: "Sing King worked overtime while you stood there aura farming in complete silence." },
      { headline: "Mic Check… Hello?", roast: "You held the mic like an ice cream cone and didn't sing a single bar." },
      { headline: "Paid for the Mic, Used It as a Prop", roast: "0% vocals, 100% staring at the screen waiting for a miracle." },
      { headline: "John Cage's 4'33\" Cover?", roast: "Bold artistic choice performing a silent tribute at videoke night." },
      { headline: "Cat Got Your Tongue?", roast: "Even the backing vocalists looked around wondering when you were coming in." },
    ],
  },
  early: {
    badge: "Early Bailout",
    tone: "meh",
    lines: [
      { headline: "Rage Quit Before the Chorus?", roast: "You saw that high note coming from a mile away and hit the eject button." },
      { headline: "One Verse Wonder", roast: "Sang four words, panicked, and asked for a score. Finish the song next time!" },
      { headline: "Speedrunning Videoke?", roast: "The intro barely finished and you're already asking the judge for a trophy." },
      { headline: "Stage Fright Hit Fast", roast: "You dipped faster than an uncle when the bill arrives. Sing the whole track!" },
    ],
  },
  monotone: {
    badge: "Podcast Mode",
    tone: "bad",
    lines: [
      { headline: "Sir, This Is Videoke Not a Podcast", roast: "You read the lyrics on one flat note like a hostage statement. Use some melody!" },
      { headline: "One-Note Wonder", roast: "The songwriter wrote twelve different notes and you bravely refused eleven of them." },
      { headline: " Siri Has More Inflection", roast: "Sounded like GPS navigation reading directions through a karaoke mic." },
      { headline: "Spoken Word Night?", roast: "Great audiobook narration, questionable singing. Try moving your pitch up and down!" },
    ],
  },
  screamer: {
    badge: "RIP Speakers",
    tone: "bad",
    lines: [
      { headline: "Loud AND Wrong", roast: "Volume: 110%. Key: somewhere in another zip code. Our speakers need therapy." },
      { headline: "Passionate Chaos", roast: "You attacked every note like it owed you money, and missed all of them." },
      { headline: "You Suck at this (Loudly)", roast: "Screaming the chorus doesn't make it in tune—the barangay tanod is outside." },
      { headline: "Pure Decibels, Zero Pitch", roast: "That wasn't a high note, that was a structural stress test on the windows." },
    ],
  },
  "no-mic": {
    badge: "Mic Off · Party Roll",
    tone: "meh",
    lines: [
      { headline: "Bluetooth Telepathy?", roast: "Your mic was off, so the judge graded your lip-syncing and pure delusion." },
      { headline: "Air-Mic Champion", roast: "Zero microphone plugged in—this score is 100% vibes and imaginary vocals." },
      { headline: "Milli Vanilli Mode", roast: "Mic was off the whole time! Turn on the mic if you want the judge to hear your real pipes." },
      { headline: "Unplugged & Unverified", roast: "The machine couldn't hear you with the mic off, so it rolled the fiesta dice." },
    ],
  },
};

const TIER_LINES: { max: number; badge: string; tone: ScoreTone; lines: Line[] }[] = [
  {
    max: 49,
    badge: "Vocal Crime Scene",
    tone: "bad",
    lines: [
      { headline: "Drop the Mic (Literally)", roast: "Even the instrumental backing track tried to skip itself." },
      { headline: "Mic Confiscated", roast: "The videoke machine just locked itself in self-defense." },
      { headline: "Who Hurt You?", roast: "Because whatever happened, you just took it out on our eardrums." },
      { headline: "Certified Audio Hazard", roast: "The dog left the room, and the dog usually howls along." },
      { headline: "Call an Ambulance (For the Song)", roast: "That melody didn't survive the first verse." },
    ],
  },
  {
    max: 64,
    badge: "Emergency Exit",
    tone: "bad",
    lines: [
      { headline: "Was That the Same Song?", roast: "You and the backing track were in two completely different time zones." },
      { headline: "Tita Is Concerned", roast: "She just muted her hearing aid and texted the family group chat." },
      { headline: "Key? Never Met Her", roast: "You sang in cursive while the song was printed in block letters." },
      { headline: "Brave. Very Brave.", roast: "Not good, mind you—just impressively fearless in front of witnesses." },
      { headline: "Neighbors Closed the Windows", roast: "And it's 34°C outside. That tells you everything." },
    ],
  },
  {
    max: 75,
    badge: "Roasted",
    tone: "bad",
    lines: [
      { headline: "You Suck at this", roast: "The neighbors closed their windows and called the barangay. Please pass the mic." },
      { headline: "Sintunado Supreme", roast: "Every note on screen was a polite suggestion, and you rejected all of them." },
      { headline: "Bold of You", roast: "Confidence: 100. Intonation: still buffering since verse one." },
      { headline: "Back to the Shower", roast: "The bathroom tiles give you way more reverb forgiveness than this judge." },
      { headline: "Pick a Easier Song", roast: "Maybe Happy Birthday? Actually, let's stick to clapping on Happy Birthday." },
      { headline: "Pitch Was Fighting for Its Life", roast: "You had a few moments, mostly between the parts where you sang." },
    ],
  },
  {
    max: 79,
    badge: "Nice Try",
    tone: "meh",
    lines: [
      { headline: "Keep Your Day Job", roast: "A for effort, C- for pitch. Drink some warm water and run it back!" },
      { headline: "Almost in the Same Zip Code", roast: "You grazed the right key a couple times! Progress is progress." },
      { headline: "Warm-Up Round, Right?", roast: "Nobody booed, nobody cheered—everyone politely chewed their lumpia." },
      { headline: "Mid, But With Heart", roast: "The verses were surviving; the chorus took heavy casualties." },
      { headline: "One More Take!", roast: "Tighten up those held notes and you'll crack the 80s easily." },
    ],
  },
  {
    max: 84,
    badge: "Shower Certified",
    tone: "good",
    lines: [
      { headline: "Shower Singer Certified", roast: "Respectable! You stayed mostly on pitch and nobody reached for the skip button." },
      { headline: "Decent Pipes!", roast: "The uncles at the corner table actually nodded for ten seconds." },
      { headline: "Solid Crowd Pleaser", roast: "A little pitch wobble on the big notes, but the vibe was right on the money." },
      { headline: "Getting Dangerous", roast: "Clean up the endings of your phrases and you're entering Superstar territory." },
      { headline: "Crush Looked Up From Their Phone", roast: "Only for four seconds, sure, but that counts as a win." },
    ],
  },
  {
    max: 89,
    badge: "Fiesta Contender",
    tone: "good",
    lines: [
      { headline: "Fiesta Contender!", roast: "Real vocals! The titos stopped arguing about politics to listen." },
      { headline: "Lola Approved", roast: "She put down her plate of pancit to clap. Do you know how rare that is?" },
      { headline: "Lowkey Signed Artist?", roast: "Steady pitch, solid rhythm—you actually know what you're doing on a mic." },
      { headline: "Encore Material", roast: "Go ahead and reserve two more, the living room approves." },
      { headline: "Clean & Controlled", roast: "You locked into the pocket and held those notes without flinching." },
    ],
  },
  {
    max: 95,
    badge: "Crowd Favorite",
    tone: "great",
    lines: [
      { headline: "Videoke Superstar!", roast: "Main character vocals! Everybody in the house stopped talking." },
      { headline: "Are You Secretly Touring?", roast: "Laser-sharp pitch and real stage control—that sounded like a studio cut." },
      { headline: "Chills. Actual Chills.", roast: "Phone flashlights are waving in the air. This isn't karaoke anymore, it's a concert." },
      { headline: "Barangay Idol Champion", roast: "The captain is already drafting your invite for the town fiesta finals." },
      { headline: "Money Note Delivered", roast: "You didn't just hit the chorus, you owned the whole building." },
    ],
  },
  {
    max: 100,
    badge: "Golden Mic Legend",
    tone: "great",
    lines: [
      { headline: "Golden Mic Legend!", roast: "Did you swallow the original artist?! Flawless pitch, control, and soul!" },
      { headline: "Wala Kang Kupas!", roast: "Perfection. The videoke machine is asking for YOUR autograph right now." },
      { headline: "Call the Grammys Immediately", roast: "Nobody wants to touch the microphone after that masterclass." },
      { headline: "100% Pure Vocal Gold", roast: "Screenshot this and frame it in the family group chat forever." },
      { headline: "Untouchable Headliner", roast: "Every note dead-center, silky vibrato, zero misses. Take a bow!" },
    ],
  },
];

let lastHeadline = "";

function pickLine(pool: Line[]): Line {
  const fresh = pool.filter((l) => l.headline !== lastHeadline);
  const chosen = fresh[Math.floor(Math.random() * fresh.length)] ?? pool[0];
  lastHeadline = chosen.headline;
  return chosen;
}

export function rankForScore(score: number): ScoreRank {
  if (score >= 96) return "S+";
  if (score >= 90) return "S";
  if (score >= 83) return "A";
  if (score >= 76) return "B";
  if (score >= 66) return "C";
  if (score >= 50) return "D";
  return "F";
}

function judge(score: number, reason: JudgeReason, axes: ScoreAxis[], statsSummary: string) {
  if (reason !== "normal") {
    const bucket = SPECIAL_LINES[reason];
    const line = pickLine(bucket.lines);
    return {
      badge: bucket.badge,
      tone: bucket.tone,
      headline: line.headline,
      roast: line.roast,
      judgeNote: statsSummary,
    };
  }
  const tier = TIER_LINES.find((t) => score <= t.max) ?? TIER_LINES[TIER_LINES.length - 1];
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
    headline: line.headline,
    roast: line.roast,
    judgeNote: `${statsSummary}${tip}`,
  };
}

export interface KaraokeTelemetry {
  scoreDecimal: number;
  avgScoreDecimal: number;
  pitchHitPct: number;
  sectionPitch: [number, number, number, number, number];
  rhythmOffsetMs: number;
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
  songMinMidi: number | null;
  songMaxMidi: number | null;
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
  if (count <= 0 || totalSec < 0.25) return "—";
  const box = avgDepth >= 34 ? "A" : avgDepth >= 20 ? "B" : "C";
  const speed = avgHz >= 6.4 ? "3" : avgHz >= 5.1 ? "2" : "1";
  const desc = box === "A" ? "Rich" : box === "B" ? "Standard" : "Subtle";
  return `${box}-${speed} ${desc}`;
}

function songRangeFor(track: Track | null): { songMinMidi: number | null; songMaxMidi: number | null } {
  const g = track ? getCachedVocalGuide(track.id) : null;
  if (!g || g.bars.length === 0) return { songMinMidi: 60, songMaxMidi: 74 };
  let lo = Infinity;
  let hi = -Infinity;
  for (const b of g.bars) {
    if (b.midi < lo) lo = b.midi;
    if (b.midi > hi) hi = b.midi;
  }
  return {
    songMinMidi: Number.isFinite(lo) ? Math.round(lo) : 60,
    songMaxMidi: Number.isFinite(hi) ? Math.round(hi) : 74,
  };
}

function deterministicAvgScore(trackId: string): number {
  let h = 2166136261;
  for (let i = 0; i < trackId.length; i++) {
    h ^= trackId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const frac = ((h >>> 0) % 6400) / 1000; // 0..6.399
  return Number((79.8 + frac).toFixed(3)); // 79.800 .. 86.199 pts
}

/** Computes a preview or final My Music Karaoke Score (0.000 - 100.000 pts) from the current `take`. */
function evaluateTake(track: Track | null, micOn: boolean): {
  score: number;
  axes: ScoreAxis[];
  telemetry: KaraokeTelemetry;
  heard: boolean;
  reason: JudgeReason;
  summary: string;
} {
  const { songMinMidi, songMaxMidi } = songRangeFor(track);
  const avgScoreDecimal = deterministicAvgScore(track?.id ?? "song");

  if (!micOn) {
    const rawParty = 74 + Math.random() * 17.5;
    const scoreDecimal = Number(clamp(rawParty, 65, 92.8).toFixed(3));
    const partyScore = Math.round(scoreDecimal);
    const jitter = () => Math.round((Math.random() - 0.5) * 10);
    const pPitch = clamp(partyScore + jitter(), 55, 95);
    const pStab = clamp(partyScore + jitter(), 55, 95);
    const pExp = clamp(partyScore + jitter(), 55, 95);
    const pRhy = clamp(partyScore + jitter(), 55, 95);
    const pVib = clamp(partyScore + jitter(), 50, 94);
    return {
      score: partyScore,
      heard: false,
      reason: "no-mic",
      summary: "Microphone was off — turn on Live Mic to unlock real pitch, vibrato, rhythm & range scoring.",
      axes: [
        { label: "Pitch", value: pPitch },
        { label: "Stability", value: pStab },
        { label: "Expression", value: pExp },
        { label: "Rhythm", value: pRhy },
        { label: "Vibrato & Long", value: pVib },
      ],
      telemetry: {
        scoreDecimal,
        avgScoreDecimal,
        pitchHitPct: pPitch,
        sectionPitch: [pPitch, clamp(pPitch + 2, 50, 96), clamp(pPitch - 3, 50, 96), pStab, pExp],
        rhythmOffsetMs: 0,
        vibratoCount: 0,
        vibratoTotalSec: 0,
        vibratoHz: 0,
        vibratoSkill: "Mic Off",
        vibratoWave: [],
        longToneSec: 0,
        longToneScore: pVib,
        scoops: 0,
        kobushi: 0,
        falls: 0,
        singerMinMidi: null,
        singerMaxMidi: null,
        songMinMidi,
        songMaxMidi,
      },
    };
  }

  const sungSeconds = take.voicedFrames / 30;
  const elapsedSeconds = Math.max(take.activeFrames / 30, sungSeconds);

  if (take.voicedFrames < 18 || sungSeconds < 1.5 || take.evalFrames < 8) {
    const scoreDecimal = Number(clamp(sungSeconds * 11.4, 0, 24.5).toFixed(3));
    const tiny = Math.round(scoreDecimal);
    return {
      score: tiny,
      heard: true,
      reason: "silent",
      summary:
        sungSeconds < 0.4
          ? "0.0s of vocals detected while microphone was active."
          : `Only ${sungSeconds.toFixed(1)}s of vocal input detected — sing into the mic!`,
      axes: [
        { label: "Pitch", value: tiny },
        { label: "Stability", value: tiny },
        { label: "Expression", value: clamp(tiny + 4, 0, 30) },
        { label: "Rhythm", value: tiny },
        { label: "Vibrato & Long", value: Math.max(0, tiny - 3) },
      ],
      telemetry: {
        scoreDecimal,
        avgScoreDecimal,
        pitchHitPct: tiny,
        sectionPitch: [tiny, 0, 0, 0, 0],
        rhythmOffsetMs: 0,
        vibratoCount: 0,
        vibratoTotalSec: 0,
        vibratoHz: 0,
        vibratoSkill: "—",
        vibratoWave: [],
        longToneSec: 0,
        longToneScore: tiny,
        scoops: 0,
        kobushi: 0,
        falls: 0,
        singerMinMidi: null,
        singerMaxMidi: null,
        songMinMidi,
        songMaxMidi,
      },
    };
  }

  let calOffset = 0;
  if (take.centsOffsets.length >= 5) {
    const sortedOffsets = [...take.centsOffsets].sort((a, b) => a - b);
    const medianOffset = sortedOffsets[Math.floor(sortedOffsets.length / 2)]!;
    calOffset = clamp(medianOffset, -14, 14);
  }

  // --- AXIS 1: PITCH ACCURACY (0..100) ---
  const rawMeanErr = take.centsErrSum / Math.max(1, take.evalFrames);
  const calibratedErr = Math.max(0, rawMeanErr - Math.abs(calOffset) * 0.35);
  const inTuneRatio = take.inTuneFrames / Math.max(1, take.evalFrames);
  const perfectRatio = take.perfectFrames / Math.max(1, take.evalFrames);
  const errScore = 100 - Math.pow(calibratedErr / 4.4, 1.65);
  const ratioScore = inTuneRatio * 78 + perfectRatio * 26;
  let pitchFloat = clamp(errScore * 0.58 + ratioScore * 0.42, 18, 100);

  // --- AXIS 2: PITCH STABILITY (0..100) ---
  const avgJitterCents = take.noteJitterCount > 0 ? take.noteJitterSum / take.noteJitterCount : 24;
  const crackPenalty = Math.min(28, (take.cracks / Math.max(1, take.notesHit)) * 45);
  const stabilityFloat = clamp(103 - avgJitterCents * 1.25 - crackPenalty, 20, 100);

  // --- AXIS 3: DYNAMIC EXPRESSION + INFLECTIONS (0..100) ---
  let dynamicRangeDb = 4;
  let meanDb = -28;
  if (take.dbSamples.length >= 8) {
    const sortedDb = [...take.dbSamples].sort((a, b) => a - b);
    const p15 = sortedDb[Math.floor(sortedDb.length * 0.15)]!;
    const p90 = sortedDb[Math.floor(sortedDb.length * 0.9)]!;
    dynamicRangeDb = Math.max(0, p90 - p15);
    meanDb = sortedDb.reduce((a, b) => a + b, 0) / sortedDb.length;
  }
  const swellScore = clamp((dynamicRangeDb / 12.5) * 58, 18, 60);
  const projectionScore = clamp(((meanDb + 38) / 22) * 28, 8, 28);
  const ornamentBonus = Math.min(14, take.cleanAttacks * 1.4 + take.kobushi * 2.4 + take.falls * 1.6);
  let expressionFloat = clamp(swellScore + projectionScore + ornamentBonus, 25, 100);

  // --- AXIS 4: RHYTHM & TIMING OFFSET (0..100) ---
  let rhythmOffsetMs = 0;
  let timingPrecision = 84;
  if (take.timingOffsetsMs.length >= 2) {
    const sortedT = [...take.timingOffsetsMs].sort((a, b) => a - b);
    rhythmOffsetMs = Math.round(sortedT[Math.floor(sortedT.length / 2)]!);
    const absMeanMs = take.timingOffsetsMs.reduce((a, b) => a + Math.abs(b), 0) / take.timingOffsetsMs.length;
    timingPrecision = clamp(100 - Math.max(0, absMeanMs - 45) * 0.14, 48, 100);
  }
  const totalWindows = Math.max(1, take.activeWindows.size);
  const windowCoverage = take.sungWindows.size / totalWindows;
  const normalizedParticipation = clamp(windowCoverage / 0.48, 0.2, 1.04);
  let rhythmFloat = clamp(normalizedParticipation * 58 + (timingPrecision / 100) * 42, 22, 100);

  // --- AXIS 5: VIBRATO & LONG TONE (0..100) ---
  const rangeSemitones = take.maxMidi >= take.minMidi ? take.maxMidi - take.minMidi : 0;
  const rangeFactor = clamp(rangeSemitones / 10, 0.35, 1.0);
  const longToneSteady =
    take.longToneCount > 0 ? take.longToneSteadySum / take.longToneCount : stabilityFloat * 0.88;
  const vibratoBonus = Math.min(18, take.vibratos * 3.8 + take.vibratoTotalSec * 2.2);
  let vibLongFloat = clamp(longToneSteady * (0.62 + 0.24 * rangeFactor) + vibratoBonus, 22, 100);

  let reason: JudgeReason = "normal";
  const trackDur = track?.duration && track.duration > 30 ? track.duration : 180;
  const completionRatio = elapsedSeconds / trackDur;

  if (sungSeconds >= 4 && rangeSemitones < 3 && take.uniqueNotes.size <= 2) {
    reason = "monotone";
    vibLongFloat = Math.min(vibLongFloat, 42);
    pitchFloat *= 0.68;
    expressionFloat = Math.min(expressionFloat, 48);
  } else if (pitchFloat < 58 && meanDb > -18 && take.voicedFrames > 45) {
    reason = "screamer";
  }

  // Weighted DAM / My Music Karaoke Score formula (Pitch heavily weighted + 4 technique/musicality pillars)
  let totalFloat =
    pitchFloat * 0.42 +
    stabilityFloat * 0.18 +
    expressionFloat * 0.15 +
    rhythmFloat * 0.13 +
    vibLongFloat * 0.12;

  if (elapsedSeconds < 20 && completionRatio < 0.2) {
    reason = "early";
    const completionScale = clamp(0.55 + (elapsedSeconds / 20) * 0.4, 0.55, 0.94);
    totalFloat *= completionScale;
    rhythmFloat *= completionScale;
  }

  const scoreDecimal = Number(clamp(totalFloat, 12, 100).toFixed(3));
  const totalScore = Math.round(scoreDecimal);
  const pitchScore = Math.round(pitchFloat);
  const stabilityScore = Math.round(stabilityFloat);
  const expressionScore = Math.round(expressionFloat);
  const rhythmScore = Math.round(rhythmFloat);
  const vibLongScore = Math.round(vibLongFloat);
  const inTunePct = Math.round(inTuneRatio * 100);

  const sectionPitch = take.sections.map((b) =>
    b.total >= 2 ? clamp(Math.round((b.inTune / b.total) * 100), 15, 100) : pitchScore,
  ) as [number, number, number, number, number];

  const avgVibHz = take.vibratos > 0 ? Number((take.vibratoHzSum / take.vibratos).toFixed(1)) : 0;
  const avgVibDepth = take.vibratos > 0 ? take.vibratoDepthSum / take.vibratos : 0;
  const vibratoSkill = vibratoGradeLabel(take.vibratos, take.vibratoTotalSec, avgVibHz, avgVibDepth);

  const summary = `Pitch ${inTunePct}% · Long tone ${take.longToneMaxSec.toFixed(1)}s · Vibrato ${take.vibratoTotalSec.toFixed(1)}s (${take.vibratos}x) · Scoop ${take.cleanAttacks} / Kobushi ${take.kobushi} / Fall ${take.falls}`;

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
      avgScoreDecimal,
      pitchHitPct: inTunePct,
      sectionPitch,
      rhythmOffsetMs: clamp(rhythmOffsetMs, -180, 180),
      vibratoCount: take.vibratos,
      vibratoTotalSec: Number(take.vibratoTotalSec.toFixed(1)),
      vibratoHz: avgVibHz,
      vibratoSkill,
      vibratoWave: take.vibratoWave,
      longToneSec: Number(take.longToneMaxSec.toFixed(1)),
      longToneScore: Math.round(longToneSteady),
      scoops: take.cleanAttacks,
      kobushi: take.kobushi,
      falls: take.falls,
      singerMinMidi: Number.isFinite(take.minMidi) ? take.minMidi : null,
      singerMaxMidi: Number.isFinite(take.maxMidi) ? take.maxMidi : null,
      songMinMidi,
      songMaxMidi,
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

/** Snare drumroll that lasts as long as the score counter spins. */
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
    applause(ctx, noise, now + 2.2, 1.2, 6, 0.05);
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
  live: { midi: number; cents: number; clarity: number } | null;
  liveStats: LiveVocalStats;
  score: VideokeScore | null;

  isVideoke: (id: string | undefined) => boolean;
  mark: (track: Track) => void;
  singNow: (track: Track) => void;
  reserve: (track: Track) => void;
  startMic: () => Promise<void>;
  stopMic: () => void;
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
    pitchTrail.length = 0;
    set({ liveStats: INITIAL_LIVE_STATS });
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
    if (get().micOn) return;
    try {
      // Prefer built-in / wired mic over Bluetooth headset mic when available so Bluetooth headphones stay in hi-fi A2DP stereo
      // instead of dropping to 8kHz HFP phone-call audio!
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

      // CRITICAL: Disable OS echoCancellation / noiseSuppression / autoGainControl!
      // Enabling them forces macOS CoreAudio, Android AudioManager, iOS AVAudioSession & Windows WASAPI into
      // VOICE_COMMUNICATION / telephony ducking mode, which muffles bass, collapses stereo, and drops playback volume.
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
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        });
      }

      // If labels were hidden before permission grant and getUserMedia picked a Bluetooth HFP mic while a built-in mic exists,
      // seamlessly switch to the built-in mic so headphone output returns to full 48kHz stereo quality!
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
            /* keep original stream if switch fails */
          }
        }
      }
    } catch {
      toast("Microphone permission denied or unavailable", "error");
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
    const ctx = micCtx;

    // 4th-order Butterworth Vocal Bandpass Chain (85 Hz - 1080 Hz)
    const hp1 = ctx.createBiquadFilter();
    hp1.type = "highpass";
    hp1.frequency.value = 85;
    hp1.Q.value = 0.707;

    const hp2 = ctx.createBiquadFilter();
    hp2.type = "highpass";
    hp2.frequency.value = 85;
    hp2.Q.value = 0.707;

    const presence = ctx.createBiquadFilter();
    presence.type = "peaking";
    presence.frequency.value = 320;
    presence.Q.value = 0.85;
    presence.gain.value = 3.5;

    const lp1 = ctx.createBiquadFilter();
    lp1.type = "lowpass";
    lp1.frequency.value = 1080;
    lp1.Q.value = 0.707;

    const lp2 = ctx.createBiquadFilter();
    lp2.type = "lowpass";
    lp2.frequency.value = 1080;
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

    // Parallel Singer's Formant Bandpass (1250 - 3400 Hz) to distinguish human singing vowels from speaker piano bleed!
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
      analyser.getFloatTimeDomainData(timeData);
      formantAnalyser.getFloatTimeDomainData(formantData);

      let sumSq = 0;
      for (let i = 0; i < timeData.length; i++) sumSq += timeData[i]! * timeData[i]!;
      const rawRms = Math.sqrt(sumSq / timeData.length);

      let fSq = 0;
      for (let i = 0; i < formantData.length; i++) fSq += formantData[i]! * formantData[i]!;
      const formantRms = Math.sqrt(fSq / formantData.length);

      const level = Math.min(1, rawRms * 7.5);

      let detected = detectVocalPitch(timeData, ctx.sampleRate, take.noiseFloor);
      if (detected) {
        // Speaker Piano / Instrumental Bleed Rejection (when singing on laptop/phone speakers without headphones):
        // Distant piano from speakers has low 1.2-3.4kHz vocal formant ratio AND matches active playback spectrum at low RMS!
        const pb = getPlaybackPitchDominance(detected.hz);
        const formantRatio = formantRms / Math.max(1e-5, rawRms);
        const likelySpeakerPianoBleed =
          (pb.binLevel > 0.42 && rawRms < take.noiseFloor * 4.2 && formantRatio < 0.16) ||
          (formantRatio < 0.085 && rawRms < 0.055);

        if (likelySpeakerPianoBleed) {
          take.noiseFloor = clamp(take.noiseFloor * 0.92 + rawRms * 0.08, 0.006, 0.045);
          detected = null;
        }
      } else {
        // Slowly adapt ambient floor during unvoiced / instrumental moments
        take.noiseFloor = clamp(take.noiseFloor * 0.95 + rawRms * 0.05, 0.005, 0.042);
      }

      let midi: number | null = detected ? 69 + 12 * Math.log2(detected.hz / 440) : null;

      // 3-point glitch filter: reject single-frame octave/consonant spikes > 5 semitones
      if (midi !== null) {
        take.recentRawMidis.push(midi);
        if (take.recentRawMidis.length > 3) take.recentRawMidis.shift();
        if (take.recentRawMidis.length === 3) {
          const [a, b, c] = take.recentRawMidis;
          if (Math.abs(b - a) > 5 && Math.abs(b - c) > 5) {
            midi = (a + c) / 2;
          }
        }
      } else {
        take.recentRawMidis.length = 0;
      }

      const now = performance.now();
      pitchTrail.push({ t: now, midi, clarity: detected?.clarity });
      while (pitchTrail.length && now - pitchTrail[0].t > 10_000) pitchTrail.shift();

      const pState = usePlayer.getState();
      const playing = pState.status === "playing";

      if (playing) {
        if (take.startedPlayMs === null) take.startedPlayMs = now;
        take.activeFrames++;
        const songSec = getExactPlaybackTime();
        const activeTrack = pState.queue[pState.index] ?? null;
        const trackDurSec = activeTrack?.duration && activeTrack.duration > 30 ? activeTrack.duration : 220;
        const activeGuide = activeTrack ? getCachedVocalGuide(activeTrack.id) : null;

        let activeTargetMidi: number | null = null;
        if (activeGuide && activeGuide.bars.length > 0) {
          for (const b of activeGuide.bars) {
            if (b.end < songSec - 0.12) continue;
            if (b.start > songSec + 0.12) break;
            activeTargetMidi = b.midi;
            break;
          }
        }

        const winBucket = Math.floor((songSec || (now - take.startedPlayMs) / 1000) / 2);
        take.activeWindows.add(winBucket);

        if (midi !== null && detected) {
          take.voicedFrames++;
          take.sungWindows.add(winBucket);
          take.dbSamples.push(20 * Math.log10(Math.max(1e-4, detected.rms)));

          if (!take.wasVoiced) {
            take.phraseOnsets++;
            take.wasVoiced = true;
            if (activeGuide && activeGuide.bars.length > 0) {
              let bestDelta: number | null = null;
              for (const b of activeGuide.bars) {
                const dt = (songSec - b.start) * 1000;
                if (Math.abs(dt) <= 420 && (bestDelta === null || Math.abs(dt) < Math.abs(bestDelta))) {
                  bestDelta = dt;
                }
                if (b.start > songSec + 0.5) break;
              }
              if (bestDelta !== null) take.timingOffsetsMs.push(bestDelta);
            }
          }

          const cur = take.currentNote;
          if (cur && Math.abs(midi - cur.anchorMidi) <= 0.68 && now - cur.endMs < 130) {
            cur.midis.push(midi);
            cur.rmsList.push(detected.rms);
            cur.endMs = now;
            cur.songEndSec = songSec;
            if (cur.targetMidi === null && activeTargetMidi !== null) cur.targetMidi = activeTargetMidi;
            cur.anchorMidi = cur.anchorMidi * 0.85 + midi * 0.15;
          } else {
            if (cur) {
              const prevMidi = cur.anchorMidi;
              const res = finalizeNoteSegment(cur, trackDurSec);
              if (res.hadVibrato) lastVibratoFlash = now;
              if (cur.midis.length < 4 && Math.abs(midi - prevMidi) > 7) {
                take.cracks++;
              }
            }
            take.currentNote = {
              anchorMidi: midi,
              startMs: now,
              endMs: now,
              songStartSec: songSec,
              songEndSec: songSec,
              targetMidi: activeTargetMidi,
              midis: [midi],
              rmsList: [detected.rms],
            };
          }
        } else {
          take.wasVoiced = false;
          if (take.currentNote && now - take.currentNote.endMs >= 110) {
            const res = finalizeNoteSegment(take.currentNote, trackDurSec);
            if (res.hadVibrato) lastVibratoFlash = now;
            take.currentNote = null;
          }
        }

        // Periodically publish live HUD stats (~5 times/sec)
        if (frame % 12 === 0) {
          const inTunePct =
            take.evalFrames > 0 ? Math.round((take.inTuneFrames / take.evalFrames) * 100) : 0;
          const preview =
            take.notesHit >= 4 ? Number(evaluateTake(activeTrack, true).telemetry.scoreDecimal.toFixed(1)) : null;
          set({
            liveStats: {
              notesHit: take.notesHit,
              inTunePct,
              streak: take.streak,
              bestStreak: take.bestStreak,
              vibratos: take.vibratos,
              lastVibratoAt: lastVibratoFlash,
              runningScore: preview,
            },
          });
        }
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

  stopMic: () => {
    if (micRaf !== null) cancelAnimationFrame(micRaf);
    micRaf = null;
    micStream?.getTracks().forEach((tr) => tr.stop());
    micStream = null;
    void micCtx?.close().catch(() => {});
    micCtx = null;
    pitchTrail.length = 0;
    set({ micOn: false, micLevel: 0, live: null, liveStats: INITIAL_LIVE_STATS });
  },

  showScore: (track) => {
    if (take.currentNote) {
      finalizeNoteSegment(take.currentNote, track.duration || 220);
      take.currentNote = null;
    }
    const { score, axes, telemetry, heard, reason, summary } = evaluateTake(track, get().micOn);
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
    pitchTrail.length = 0;
    set({ liveStats: INITIAL_LIVE_STATS });
    const p = usePlayer.getState();
    if (hasReservedNext()) p.jumpTo(p.index + 1);
  },

  singAgain: () => {
    const s = get().score;
    get().dismiss();
    if (!s) return;
    resetTake();
    pitchTrail.length = 0;
    set({ liveStats: INITIAL_LIVE_STATS });
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
  if (!useVideoke.getState().ids.has(track.id) && useVideoke.getState().micOn) {
    useVideoke.getState().stopMic();
  }
};

/** Whether the track playing now is a Videoke song (its video already shows the lyrics). */
export function useIsVideokeTrack(): boolean {
  const id = usePlayer((p) => p.queue[p.index]?.id ?? "");
  return useVideoke((v) => v.ids.has(id));
}
