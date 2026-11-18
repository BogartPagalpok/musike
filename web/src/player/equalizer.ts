import { create } from "zustand";

export const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;
export type EqBandIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type EqPresetId =
  | "flat"
  | "bassBoost"
  | "electronic"
  | "pop"
  | "rock"
  | "hipHop"
  | "acoustic"
  | "vocal"
  | "classical"
  | "lateNight"
  | "trebleBoost"
  | "loudness"
  | "custom";

export const EQ_PRESETS: Record<Exclude<EqPresetId, "custom">, readonly number[]> = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  bassBoost: [6.5, 5.5, 4, 1.5, 0, 0, 0.5, 1, 1.5, 1.5],
  electronic: [5, 4.5, 1.5, 0, -1.5, 1.5, 1, 2.5, 4.5, 5],
  pop: [-1, 1.5, 3.5, 4.5, 3, 0.5, -1, 1.5, 2.5, 3],
  rock: [4.5, 3.5, 2, -1, -2, -0.5, 2, 3.5, 4.5, 4.5],
  hipHop: [6, 5, 2.5, 1.5, -1, -1, 1.5, 1, 2.5, 3.5],
  acoustic: [3.5, 3, 2, 1, 1.5, 1.5, 3, 3.5, 3, 2],
  vocal: [-2, -1.5, -1, 1, 3.5, 5, 4.5, 3, 1.5, 0.5],
  classical: [4, 3, 2, 1.5, -1, -1, 0, 2, 3, 4],
  lateNight: [3, 2, 0.5, 0, 1.5, 2.5, 2, 0.5, -1, -2],
  trebleBoost: [0, 0, 0, 0, 0.5, 1.5, 3, 4.5, 5.5, 6.5],
  loudness: [5.5, 4, 1.5, 0, -1.5, 0, 1.5, 3, 4.5, 5.5],
};

export const EQ_PRESET_IDS = Object.keys(EQ_PRESETS) as Exclude<EqPresetId, "custom">[];

const STORAGE_KEY = "musike:eq";

export interface EqualizerSaved {
  enabled: boolean;
  preset: EqPresetId;
  bands: number[];
  preamp: number;
  bassBoost: number;
  clarity: number;
  compressor: boolean;
}

export interface EqualizerState extends EqualizerSaved {
  setEnabled: (enabled: boolean) => void;
  toggleEnabled: () => void;
  setPreset: (preset: Exclude<EqPresetId, "custom">) => void;
  setBand: (index: number, gainDb: number) => void;
  setPreamp: (gainDb: number) => void;
  setBassBoost: (gainDb: number) => void;
  setClarity: (gainDb: number) => void;
  setCompressor: (on: boolean) => void;
  reset: () => void;
}

const clampDb = (v: number, min = -12, max = 12) => Math.max(min, Math.min(max, Math.round(v * 2) / 2));

function readSaved(): EqualizerSaved {
  const fallback: EqualizerSaved = {
    enabled: false,
    preset: "flat",
    bands: [...EQ_PRESETS.flat],
    preamp: 0,
    bassBoost: 0,
    clarity: 0,
    compressor: false,
  };
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<EqualizerSaved>;
    const bands =
      Array.isArray(raw.bands) && raw.bands.length === EQ_FREQUENCIES.length
        ? raw.bands.map((n) => clampDb(Number(n) || 0))
        : [...EQ_PRESETS.flat];
    const preset =
      typeof raw.preset === "string" && (raw.preset === "custom" || raw.preset in EQ_PRESETS)
        ? (raw.preset as EqPresetId)
        : "flat";
    return {
      enabled: Boolean(raw.enabled),
      preset,
      bands,
      preamp: clampDb(Number(raw.preamp) || 0),
      bassBoost: clampDb(Number(raw.bassBoost) || 0, 0, 12),
      clarity: clampDb(Number(raw.clarity) || 0, 0, 12),
      compressor: Boolean(raw.compressor),
    };
  } catch {
    return fallback;
  }
}

function saveState(s: EqualizerSaved) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        enabled: s.enabled,
        preset: s.preset,
        bands: s.bands,
        preamp: s.preamp,
        bassBoost: s.bassBoost,
        clarity: s.clarity,
        compressor: s.compressor,
      }),
    );
  } catch {
    /* ignore */
  }
}

interface EqGraph {
  ctx: AudioContext;
  sources: WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>;
  preampNode: GainNode;
  bassNode: BiquadFilterNode;
  clarityNode: BiquadFilterNode;
  bandNodes: BiquadFilterNode[];
  compressorNode: DynamicsCompressorNode;
  dryGain: GainNode;
  wetGain: GainNode;
  analyser: AnalyserNode;
  harmonicAnalyser: AnalyserNode;
}

const eqHost = globalThis as {
  __musikeEqGraph?: EqGraph;
  __musikeEqElements?: Set<HTMLMediaElement>;
};

export function registerEqMedia(media: HTMLMediaElement) {
  if (!(media instanceof HTMLMediaElement)) return;
  eqHost.__musikeEqElements ??= new Set();
  eqHost.__musikeEqElements.add(media);
}

function getOrCreateGraph(): EqGraph | null {
  if (eqHost.__musikeEqGraph) return eqHost.__musikeEqGraph;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  try {
    const ctx = new Ctx();
    const preampNode = ctx.createGain();

    const bassNode = ctx.createBiquadFilter();
    bassNode.type = "lowshelf";
    bassNode.frequency.value = 85;

    const clarityNode = ctx.createBiquadFilter();
    clarityNode.type = "peaking";
    clarityNode.frequency.value = 3200;
    clarityNode.Q.value = 1.1;

    const bandNodes = EQ_FREQUENCIES.map((freq, idx) => {
      const f = ctx.createBiquadFilter();
      f.type = idx === 0 ? "lowshelf" : idx === EQ_FREQUENCIES.length - 1 ? "highshelf" : "peaking";
      f.frequency.value = freq;
      f.Q.value = 1.4;
      f.gain.value = 0;
      return f;
    });

    const compressorNode = ctx.createDynamicsCompressor();
    // Transparent studio mastering glue: gentle ratio + slow release prevents audible volume pumping/breathing
    compressorNode.threshold.value = -9;
    compressorNode.knee.value = 24;
    compressorNode.ratio.value = 1.75;
    compressorNode.attack.value = 0.035;
    compressorNode.release.value = 0.45;

    const dryGain = ctx.createGain();
    const wetGain = ctx.createGain();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.82;

    // High-resolution passive harmonic & beat analyser (~11.7 Hz/bin at 48 kHz) for Videoke key/chord & onset scoring
    const harmonicAnalyser = ctx.createAnalyser();
    harmonicAnalyser.fftSize = 4096;
    harmonicAnalyser.smoothingTimeConstant = 0.5;

    // Connect chain: preamp -> bass -> clarity -> band[0..9] -> (dryGain + compressor->wetGain) -> analyser -> destination
    preampNode.connect(bassNode);
    bassNode.connect(clarityNode);
    let prev: AudioNode = clarityNode;
    for (const b of bandNodes) {
      prev.connect(b);
      prev = b;
    }
    prev.connect(dryGain);
    prev.connect(compressorNode);
    compressorNode.connect(wetGain);

    dryGain.connect(analyser);
    wetGain.connect(analyser);
    dryGain.connect(harmonicAnalyser);
    wetGain.connect(harmonicAnalyser);
    analyser.connect(ctx.destination);

    const graph: EqGraph = {
      ctx,
      sources: new WeakMap(),
      preampNode,
      bassNode,
      clarityNode,
      bandNodes,
      compressorNode,
      dryGain,
      wetGain,
      analyser,
      harmonicAnalyser,
    };
    eqHost.__musikeEqGraph = graph;
    return graph;
  } catch {
    return null;
  }
}

const dbToLinear = (db: number) => Math.pow(10, db / 20);

function applyGraphParams(state: EqualizerSaved) {
  const graph = eqHost.__musikeEqGraph;
  if (!graph) return;
  const { ctx, preampNode, bassNode, clarityNode, bandNodes, dryGain, wetGain } = graph;
  const now = ctx.currentTime;

  if (!state.enabled) {
    preampNode.gain.setTargetAtTime(1, now, 0.015);
    bassNode.gain.setTargetAtTime(0, now, 0.015);
    clarityNode.gain.setTargetAtTime(0, now, 0.015);
    for (const node of bandNodes) {
      node.gain.setTargetAtTime(0, now, 0.015);
    }
    dryGain.gain.setTargetAtTime(1, now, 0.015);
    wetGain.gain.setTargetAtTime(0, now, 0.015);
    return;
  }

  // Steady static headroom compensation across all boosted bands so positive boosts never clip OS audio output or pump
  const sampleFreqs = [32, 64, 85, 125, 250, 500, 1000, 2000, 3200, 4000, 8000, 16000];
  const rawCurve = computeEqCurveDb(sampleFreqs, { ...state, preamp: 0 });
  const peakBoostDb = Math.max(0, ...rawCurve);
  const autoHeadroom = state.compressor ? Math.max(0.8, peakBoostDb * 0.65) : Math.max(0, (peakBoostDb - 0.5) * 0.85);
  const effectivePreamp = Math.max(-15, Math.min(12, state.preamp - autoHeadroom));

  preampNode.gain.setTargetAtTime(dbToLinear(effectivePreamp), now, 0.025);
  bassNode.gain.setTargetAtTime(state.bassBoost, now, 0.025);
  clarityNode.gain.setTargetAtTime(state.clarity, now, 0.025);

  bandNodes.forEach((node, idx) => {
    node.gain.setTargetAtTime(state.bands[idx] ?? 0, now, 0.025);
  });

  if (state.compressor) {
    dryGain.gain.setTargetAtTime(0, now, 0.03);
    // Gentle static makeup gain without causing dynamic loudness pumping
    wetGain.gain.setTargetAtTime(dbToLinear(0.8), now, 0.03);
  } else {
    dryGain.gain.setTargetAtTime(1, now, 0.03);
    wetGain.gain.setTargetAtTime(0, now, 0.03);
  }
}

/**
 * Connects a media element (`<audio>` or `<video>`) to the Web Audio Equalizer graph
 * when streaming from a same-origin URL (`/api/...`).
 */
export function attachEqualizer(media: HTMLMediaElement) {
  if (!(media instanceof HTMLMediaElement)) return;
  const src = media.currentSrc || media.src || media.getAttribute("src") || "";
  // Only route same-origin / server-proxied / local blob streams through Web Audio API to avoid CORS silence on direct URLs.
  if (src && !src.startsWith("/") && !src.startsWith("blob:") && !src.startsWith(window.location.origin)) return;

  const graph = getOrCreateGraph();
  if (!graph) return;

  if (graph.ctx.state === "suspended") {
    graph.ctx.resume().catch(() => {});
  }

  if (!graph.sources.has(media)) {
    try {
      const source = graph.ctx.createMediaElementSource(media);
      source.connect(graph.preampNode);
      graph.sources.set(media, source);
    } catch {
      /* already connected or unsupported */
    }
  }
  applyGraphParams(useEqualizer.getState());
}

/** Reads real-time frequency spectrum bars (0..255) when playback is active. */
export function readEqSpectrum(target: Uint8Array<ArrayBuffer>): boolean {
  const graph = eqHost.__musikeEqGraph;
  if (!graph || graph.ctx.state !== "running") return false;
  graph.analyser.getByteFrequencyData(target);
  return true;
}

/** Ensures the passive playback analyser is attached to active same-origin media even when EQ is disabled. */
export function ensurePlaybackAnalyser() {
  getOrCreateGraph();
  for (const el of eqHost.__musikeEqElements ?? []) {
    if (el.getAttribute("src") || el.src || el.currentSrc) {
      attachEqualizer(el);
    }
  }
}

export const ECHO_BAND_EDGES_HZ = [80, 150, 250, 400, 650, 1050, 1750, 2800, 4200] as const;
export const ECHO_BIN_COUNT = 512;

export function echoBandForHz(hz: number): number {
  for (let k = 0; k < 8; k++) {
    if (hz < ECHO_BAND_EDGES_HZ[k + 1]!) return k;
  }
  return 7;
}

/** Converts `AnalyserNode.getFloatFrequencyData` (dBFS) into linear amplitude bins + 8 sub-band RMS envelopes. */
export function extractLinearBinsAndBands(
  dbBuf: Float32Array,
  binHz: number,
  outBins: Float32Array,
  outBands: Float32Array,
) {
  const limit = Math.min(outBins.length, dbBuf.length);
  for (let b = 0; b < limit; b++) {
    const db = dbBuf[b]!;
    outBins[b] = db > -110 && Number.isFinite(db) ? Math.pow(10, db / 20) : 0;
  }
  for (let k = 0; k < 8; k++) {
    const b0 = Math.max(1, Math.round(ECHO_BAND_EDGES_HZ[k]! / binHz));
    const b1 = Math.min(limit - 1, Math.round(ECHO_BAND_EDGES_HZ[k + 1]! / binHz));
    let sq = 0;
    let cnt = 0;
    for (let b = b0; b <= b1; b++) {
      const v = outBins[b]!;
      sq += v * v;
      cnt++;
    }
    outBands[k] = cnt > 0 ? Math.sqrt(sq / cnt) : 0;
  }
}

const harmSpecBuf = new Uint8Array(2048);
const harmFloatDb = new Float32Array(2048);
const harmTimeBuf = new Float32Array(4096);
const curPlayBins = new Float32Array(ECHO_BIN_COUNT);
const curPlayBands = new Float32Array(8);
const maxHoldPlayBins = new Float32Array(ECHO_BIN_COUNT);
const maxHoldPlayBands = new Float32Array(8);
const prevLowMidBins = new Float32Array(40);
let rollingFluxMean = 0;
let lastBeatOnsetMs = 0;

export interface PlaybackHarmonicSnapshot {
  available: boolean;
  binHz: number;
  playRms: number;
  maxHoldBins: Float32Array;
  maxHoldBands: Float32Array;
  chroma: Float32Array;
  beatOnset: boolean;
  binLevel: number;
  overallLevel: number;
}

/** Resets max-hold speaker echo buffers when starting a new song or mic take. */
export function resetPlaybackEchoHold() {
  maxHoldPlayBins.fill(0);
  maxHoldPlayBands.fill(0);
}

/**
 * Extracts real-time 12-bin pitch-class chroma, bass/snare beat onsets, linear `playRms`,
 * and ~220ms decaying max-hold 8-band/512-bin speaker reference spectra for acoustic echo cancellation.
 */
export function samplePlaybackHarmonics(sungHz: number | null, nowMs = performance.now()): PlaybackHarmonicSnapshot {
  const chroma = new Float32Array(12);
  const graph = eqHost.__musikeEqGraph;
  if (!graph || graph.ctx.state !== "running") {
    return {
      available: false,
      binHz: 11.71875,
      playRms: 0,
      maxHoldBins: maxHoldPlayBins,
      maxHoldBands: maxHoldPlayBands,
      chroma,
      beatOnset: false,
      binLevel: 0,
      overallLevel: 0,
    };
  }

  graph.harmonicAnalyser.getByteFrequencyData(harmSpecBuf);
  graph.harmonicAnalyser.getFloatFrequencyData(harmFloatDb);
  graph.harmonicAnalyser.getFloatTimeDomainData(harmTimeBuf);
  const binHz = graph.ctx.sampleRate / graph.harmonicAnalyser.fftSize;

  let tSq = 0;
  for (let i = 0; i < harmTimeBuf.length; i++) tSq += harmTimeBuf[i]! * harmTimeBuf[i]!;
  const playRms = Math.sqrt(tSq / harmTimeBuf.length);

  extractLinearBinsAndBands(harmFloatDb, binHz, curPlayBins, curPlayBands);
  // ~220ms exponential max-hold covers OS output/input audio buffer latency + room acoustic propagation
  for (let b = 0; b < ECHO_BIN_COUNT; b++) {
    maxHoldPlayBins[b] = Math.max(curPlayBins[b]!, maxHoldPlayBins[b]! * 0.85);
  }
  let holdBandSum = 0;
  for (let k = 0; k < 8; k++) {
    maxHoldPlayBands[k] = Math.max(curPlayBands[k]!, maxHoldPlayBands[k]! * 0.85);
    holdBandSum += maxHoldPlayBands[k]!;
  }

  // 1. Overall playback energy check (active either now or within the 220ms acoustic echo tail)
  const b60 = Math.max(1, Math.round(60 / binHz));
  const b2500 = Math.min(harmSpecBuf.length - 2, Math.round(2500 / binHz));
  let energySum = 0;
  for (let b = b60; b <= b2500; b++) energySum += harmSpecBuf[b]!;
  const overallLevel = energySum / (Math.max(1, b2500 - b60 + 1) * 255);
  if (overallLevel < 0.01 && playRms < 0.002 && holdBandSum < 1e-4) {
    return {
      available: false,
      binHz,
      playRms,
      maxHoldBins: maxHoldPlayBins,
      maxHoldBands: maxHoldPlayBands,
      chroma,
      beatOnset: false,
      binLevel: 0,
      overallLevel,
    };
  }

  // 2. Peak-picked 12-bin Pitch-Class Chroma across 82 Hz (E2) .. 1320 Hz (E6)
  const bMin = Math.max(2, Math.round(82 / binHz));
  const bMax = Math.min(harmSpecBuf.length - 3, Math.round(1320 / binHz));
  let chromaSum = 0;
  for (let b = bMin; b <= bMax; b++) {
    const mag = harmSpecBuf[b]!;
    if (mag < 68) continue;
    if (mag >= harmSpecBuf[b - 1]! && mag >= harmSpecBuf[b + 1]!) {
      const hz = b * binHz;
      const midi = 69 + 12 * Math.log2(hz / 440);
      const pc = ((Math.round(midi) % 12) + 12) % 12;
      const w = Math.pow((mag - 60) / 195, 1.8);
      chroma[pc] += w;
      chromaSum += w;
    }
  }
  if (chromaSum > 0) {
    for (let i = 0; i < 12; i++) chroma[i] /= chromaSum;
  }

  // 3. Real-time half-wave rectified spectral flux across 65 Hz .. 420 Hz for beat/chord onset detection
  const fluxEnd = Math.min(bMin + prevLowMidBins.length - 1, Math.round(420 / binHz));
  let flux = 0;
  for (let b = bMin, idx = 0; b <= fluxEnd && idx < prevLowMidBins.length; b++, idx++) {
    const cur = harmSpecBuf[b]! / 255;
    const diff = cur - prevLowMidBins[idx]!;
    if (diff > 0) flux += diff;
    prevLowMidBins[idx] = cur;
  }
  rollingFluxMean = rollingFluxMean * 0.88 + flux * 0.12;
  const beatOnset =
    flux > Math.max(0.32, rollingFluxMean * 1.65) && nowMs - lastBeatOnsetMs >= 190;
  if (beatOnset) lastBeatOnsetMs = nowMs;

  // 4. Accompaniment energy around sungHz & 2*sungHz
  let binLevel = 0;
  if (sungHz !== null && sungHz > 65) {
    const b1 = Math.min(harmSpecBuf.length - 2, Math.max(1, Math.round(sungHz / binHz)));
    const b2 = Math.min(harmSpecBuf.length - 2, Math.max(1, Math.round((sungHz * 2) / binHz)));
    const p1 = Math.max(harmSpecBuf[b1 - 1]!, harmSpecBuf[b1]!, harmSpecBuf[b1 + 1]!) / 255;
    const p2 = Math.max(harmSpecBuf[b2 - 1]!, harmSpecBuf[b2]!, harmSpecBuf[b2 + 1]!) / 255;
    binLevel = p1 * 0.7 + p2 * 0.3;
  }

  return {
    available: playRms > 0.002 || holdBandSum > 1e-4,
    binHz,
    playRms,
    maxHoldBins: maxHoldPlayBins,
    maxHoldBands: maxHoldPlayBands,
    chroma,
    beatOnset,
    binLevel,
    overallLevel,
  };
}

/**
 * Returns 0..1 indicating how strongly the active music/karaoke playback is currently outputting energy
 * around `hz`.
 */
export function getPlaybackPitchDominance(hz: number): { binLevel: number; overallLevel: number } {
  const snap = samplePlaybackHarmonics(hz);
  return { binLevel: snap.binLevel, overallLevel: snap.overallLevel };
}

/** Computes the composite dB response across a set of frequencies for the interactive curve visualizer. */
export function computeEqCurveDb(
  freqs: number[],
  state: Pick<EqualizerSaved, "enabled" | "bands" | "preamp" | "bassBoost" | "clarity">,
): number[] {
  if (!state.enabled) return freqs.map(() => 0);

  return freqs.map((f) => {
    const logF = Math.log2(f);
    let db = state.preamp;

    // 10-band interpolation in log-frequency space using smooth Gaussian bell / shelf approximation
    EQ_FREQUENCIES.forEach((center, idx) => {
      const gain = state.bands[idx] ?? 0;
      if (gain === 0) return;
      const distOctaves = logF - Math.log2(center);
      if (idx === 0) {
        // Low shelf
        const weight = 1 / (1 + Math.exp(distOctaves * 2.6));
        db += gain * weight;
      } else if (idx === EQ_FREQUENCIES.length - 1) {
        // High shelf
        const weight = 1 / (1 + Math.exp(-distOctaves * 2.6));
        db += gain * weight;
      } else {
        // Peaking bell (~1 octave bandwidth)
        const weight = Math.exp(-(distOctaves * distOctaves) / 0.42);
        db += gain * weight;
      }
    });

    // Bass boost shelf around 85 Hz
    if (state.bassBoost > 0) {
      const dist = logF - Math.log2(85);
      db += state.bassBoost * (1 / (1 + Math.exp(dist * 2.2)));
    }

    // Vocal / clarity bell around 3.2 kHz
    if (state.clarity > 0) {
      const dist = logF - Math.log2(3200);
      db += state.clarity * Math.exp(-(dist * dist) / 0.65);
    }

    return Math.max(-18, Math.min(18, db));
  });
}

const initial = readSaved();

export const useEqualizer = create<EqualizerState>((set, get) => {
  const update = (patch: Partial<EqualizerSaved>) => {
    const next: EqualizerSaved = { ...get(), ...patch };
    saveState(next);
    if (next.enabled) {
      getOrCreateGraph();
      for (const el of eqHost.__musikeEqElements ?? []) {
        if (el.getAttribute("src") || el.src) attachEqualizer(el);
      }
    }
    applyGraphParams(next);
    set(patch);
  };

  return {
    ...initial,

    setEnabled: (enabled) => update({ enabled }),
    toggleEnabled: () => update({ enabled: !get().enabled }),

    setPreset: (preset) => {
      const bands = [...EQ_PRESETS[preset]];
      update({ enabled: true, preset, bands });
    },

    setBand: (index, gainDb) => {
      const bands = get().bands.slice();
      bands[index] = clampDb(gainDb);
      update({ enabled: true, preset: "custom", bands });
    },

    setPreamp: (preamp) => update({ enabled: true, preamp: clampDb(preamp) }),
    setBassBoost: (bassBoost) => update({ enabled: true, bassBoost: clampDb(bassBoost, 0, 12) }),
    setClarity: (clarity) => update({ enabled: true, clarity: clampDb(clarity, 0, 12) }),
    setCompressor: (compressor) => update({ enabled: true, compressor }),

    reset: () =>
      update({
        preset: "flat",
        bands: [...EQ_PRESETS.flat],
        preamp: 0,
        bassBoost: 0,
        clarity: 0,
        compressor: false,
      }),
  };
});
