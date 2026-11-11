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
    compressorNode.threshold.value = -20;
    compressorNode.knee.value = 18;
    compressorNode.ratio.value = 3.5;
    compressorNode.attack.value = 0.008;
    compressorNode.release.value = 0.18;

    const dryGain = ctx.createGain();
    const wetGain = ctx.createGain();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.82;

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

  // Automatic headroom compensation when strong boosts are active and preamp is 0
  const maxBoost = Math.max(0, ...state.bands) + state.bassBoost * 0.6 + state.clarity * 0.5;
  const autoHeadroom = state.compressor ? 1.5 : Math.max(0, (maxBoost - 6) * 0.35);
  const effectivePreamp = state.preamp - autoHeadroom;

  preampNode.gain.setTargetAtTime(dbToLinear(effectivePreamp), now, 0.015);
  bassNode.gain.setTargetAtTime(state.bassBoost, now, 0.015);
  clarityNode.gain.setTargetAtTime(state.clarity, now, 0.015);

  bandNodes.forEach((node, idx) => {
    node.gain.setTargetAtTime(state.bands[idx] ?? 0, now, 0.015);
  });

  if (state.compressor) {
    dryGain.gain.setTargetAtTime(0, now, 0.02);
    // Makeup gain for compressor
    wetGain.gain.setTargetAtTime(dbToLinear(2.5), now, 0.02);
  } else {
    dryGain.gain.setTargetAtTime(1, now, 0.02);
    wetGain.gain.setTargetAtTime(0, now, 0.02);
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
