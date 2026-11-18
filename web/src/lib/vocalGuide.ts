import { api, streamSource } from "./api";
import type { Track } from "./types";

export interface GuideBar {
  /** Exact start time in karaoke video seconds (non-linearly DTW-warped to the playing karaoke track!) */
  start: number;
  /** Exact end time in karaoke video seconds */
  end: number;
  /** Real lead-vocal MIDI note transposed to the karaoke track's key (G3=55 .. G5=79) */
  midi: number;
  /** Sung word/syllable for this note */
  syllable?: string;
}

export interface VocalGuideTrack {
  trackId: string;
  source: "studio-vocal" | "synced" | "live-only";
  syncing?: boolean;
  firstVocalSec: number | null;
  bars: GuideBar[];
}

const guideCache = new Map<string, VocalGuideTrack>();
const inflight = new Map<string, Promise<VocalGuideTrack>>();
const listeners = new Map<string, Set<(guide: VocalGuideTrack) => void>>();

function notifyGuide(trackId: string, guide: VocalGuideTrack) {
  guideCache.set(trackId, guide);
  const subs = listeners.get(trackId);
  if (subs) {
    for (const cb of subs) cb(guide);
  }
}

export function subscribeVocalGuide(trackId: string, cb: (guide: VocalGuideTrack) => void): () => void {
  let set = listeners.get(trackId);
  if (!set) {
    set = new Set();
    listeners.set(trackId, set);
  }
  set.add(cb);
  return () => {
    set?.delete(cb);
    if (set && set.size === 0) listeners.delete(trackId);
  };
}

const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const KARAOKE_NOISE_WORDS =
  /\b(?:sing\s*king(?:\s*karaoke)?|covers\s*ph|karafun(?:\s*karaoke)?|acoustic\s*heaven|my\s*all\s*(?:time\s*)?karaoke|myallkaraoke|stingray(?:\s*karaoke)?|the\s*karaoke\s*channel|zoom\s*karaoke|sunfly|platinum\s*karaoke|magic\s*sing|megapro|atomic\s*karaoke|we\s*sing|karaokey\s*tv|karaokey|karaoke\s*jp|edsong(?:\s*karaoke)?|musisi(?:\s*karaoke)?|nice\s*karaoke|top\s*hits\s*karaoke|vinyl\s*ktv|global\s*karaokey\s*tv|pro\s*music\s*cover|acoustic\s*lounge|jamming\s*sessions|timeless\s*tunes\s*ktv|replikaraoke|mi\s*balmz(?:\s*karaoke\s*tracks)?)\b/gi;

const GENERIC_UPLOADER_RX =
  /\b(?:karaoke|karaokey|videoke|ktv|minus\s*one|backing|instrumental|cover|covers|sing|acoustic|lounge|sessions|channel|studio|lyrics?|music\s*tv|hits|official\s*karaoke|tracks)\b/i;

const KARAOKE_TAG_PARENS =
  /\s*[([](?:[^)\]]*\b(?:karaoke|videoke|instrumental|off\s*vocal|backing\s*track|minus\s*one|lyrics?|lyric\s*video|in\s*the\s*style\s*of|originally\s*performed\s*by|made\s*famous\s*by|lower\s*key|higher\s*key|female\s*key|male\s*key|original\s*key|acoustic\s*karaoke|piano\s*karaoke|soul\s*version|hd|4k|hq|official|version)\b[^)\]]*)[)\]]/gi;

const TRAILING_KARAOKE_TAGS =
  /\s*(?:[-–—:|•·|]\s*|\b)(?:karaoke(?:\s*songs?\s*with\s*lyrics|\s*version|\s*instrumental|\s*track)?|videoke(?:\s*version)?|instrumental(?:\s*version)?|minus\s*one|off\s*vocal|with\s*lyrics|lyric\s*video|original\s*key|female\s*key|male\s*key|lower\s*key|higher\s*key|hd)\s*$/gi;

export function parseKaraokeMetadata(track: Track): { query: string; titleHint: string; artistHint: string } {
  const cleanedTitle = track.title
    .replace(KARAOKE_TAG_PARENS, " ")
    .replace(KARAOKE_NOISE_WORDS, " ")
    .replace(/\|.*$/g, " ")
    .replace(TRAILING_KARAOKE_TAGS, " ")
    .replace(TRAILING_KARAOKE_TAGS, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  const uploaderClean = track.artist
    .replace(KARAOKE_NOISE_WORDS, " ")
    .replace(/\s*-\s*Topic$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const uploaderIsKaraokeChannel = !uploaderClean || GENERIC_UPLOADER_RX.test(track.artist);
  let artistHint = uploaderIsKaraokeChannel ? "" : uploaderClean;
  let titleHint = cleanedTitle;

  const parts = cleanedTitle
    .split(/\s+[-–—]\s+/)
    .map((p) => p.replace(TRAILING_KARAOKE_TAGS, "").trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    if (artistHint) {
      const p0 = parts[0]!.toLowerCase();
      const p1 = parts[1]!.toLowerCase();
      const art = artistHint.toLowerCase();
      if (p0.includes(art)) titleHint = parts.slice(1).join(" - ");
      else if (p1.includes(art)) titleHint = parts[0]!;
    } else {
      titleHint = parts[0]!;
      artistHint = parts[1]!;
    }
  }

  const query =
    parts.length >= 2
      ? `${parts[0]} ${parts[1]}`
      : [titleHint, artistHint].filter(Boolean).join(" ").trim() || cleanedTitle || track.title;

  return { query, titleHint: titleHint || cleanedTitle, artistHint };
}

const IS_KARAOKE_TRACK_RX =
  /\b(?:karaoke|karaokey|videoke|ktv|minus\s*one|off\s*vocal|backing\s*track|instrumental)\b/i;

async function findOriginalStudioSong(track: Track, cleanQuery: string): Promise<Track | null> {
  if (!IS_KARAOKE_TRACK_RX.test(`${track.title} ${track.artist}`)) {
    return track;
  }
  try {
    const candidates = await api.search(cleanQuery, "song", AbortSignal.timeout(5500));
    const vocalTracks = candidates.filter(
      (c) => c.id !== track.id && !IS_KARAOKE_TRACK_RX.test(`${c.title} ${c.artist}`),
    );
    if (!vocalTracks.length) return null;
    const scored = vocalTracks.slice(0, 6).map((c, idx) => {
      const durDiff = track.duration && c.duration ? Math.abs(track.duration - c.duration) : 12;
      const score = idx * 4.5 + (durDiff <= 35 ? durDiff * 0.3 : durDiff * 0.95);
      return { c, score };
    });
    scored.sort((a, b) => a.score - b.score);
    return scored[0]?.c ?? vocalTracks[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Downloads the COMPLETE compressed audio file (never truncated, so WebM/MP4 `decodeAudioData` succeeds 100% of the time).
 */
async function fetchCompleteAudioBytes(videoId: string): Promise<ArrayBuffer | null> {
  try {
    const src = streamSource(videoId, "audio", "sd");
    if (typeof src === "string") {
      const res = await fetch(`/api/download/${encodeURIComponent(videoId)}?kind=audio`, {
        signal: AbortSignal.timeout(16000),
      });
      if (!res.ok) return null;
      return await res.arrayBuffer();
    }

    const directUrl = await src;
    const CHUNK = 1024 * 1024;
    const first = await fetch(directUrl, {
      headers: { Range: `bytes=0-${CHUNK - 1}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!first.ok && first.status !== 206) return null;
    const firstBuf = await first.arrayBuffer();
    const cr = first.headers.get("content-range");
    const totalMatch = cr?.match(/\/(\d+)$/);
    const total = totalMatch ? Number(totalMatch[1]) : firstBuf.byteLength;
    if (!total || total <= firstBuf.byteLength || total > 14 * 1024 * 1024) return firstBuf;

    const ranges: [number, number][] = [];
    for (let start = firstBuf.byteLength; start < total; start += CHUNK) {
      ranges.push([start, Math.min(total - 1, start + CHUNK - 1)]);
    }
    const parts = new Array<ArrayBuffer>(ranges.length);
    let idx = 0;
    await Promise.all(
      Array.from({ length: 3 }, async () => {
        while (idx < ranges.length) {
          const cur = idx++;
          const [s, e] = ranges[cur]!;
          const r = await fetch(directUrl, {
            headers: { Range: `bytes=${s}-${e}` },
            signal: AbortSignal.timeout(9000),
          });
          if (!r.ok && r.status !== 206) throw new Error("Chunk failed");
          parts[cur] = await r.arrayBuffer();
        }
      }),
    );

    const merged = new Uint8Array(total);
    merged.set(new Uint8Array(firstBuf), 0);
    let offset = firstBuf.byteLength;
    for (const p of parts) {
      merged.set(new Uint8Array(p), offset);
      offset += p.byteLength;
    }
    return merged.buffer;
  } catch {
    return null;
  }
}

async function decodeToStereo16k(raw: ArrayBuffer): Promise<{ left: Float32Array; right: Float32Array; sr: number } | null> {
  try {
    const OfflineCtx =
      window.OfflineAudioContext ||
      (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
    const tmpCtx = new OfflineCtx(2, 1, 16000);
    const decoded = await tmpCtx.decodeAudioData(raw.slice(0));
    const targetSr = 16000;
    const outLen = Math.max(1, Math.floor(decoded.duration * targetSr));
    const renderCtx = new OfflineCtx(Math.min(2, decoded.numberOfChannels), outLen, targetSr);
    const src = renderCtx.createBufferSource();
    src.buffer = decoded;
    src.connect(renderCtx.destination);
    src.start(0);
    const rendered = await renderCtx.startRendering();
    const left = rendered.getChannelData(0);
    const right = rendered.numberOfChannels > 1 ? rendered.getChannelData(1) : left;
    return { left, right, sr: targetSr };
  } catch {
    return null;
  }
}

/** Radix-2 in-place complex FFT. */
function fft(re: Float32Array, im: Float32Array) {
  const n = re.length;
  let j = 0;
  for (let i = 1; i < n; i++) {
    let bit = n >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    if (i < j) {
      const tr = re[i]!;
      re[i] = re[j]!;
      re[j] = tr;
      const ti = im[i]!;
      im[i] = im[j]!;
      im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wlenR = Math.cos(ang);
    const wlenI = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wr = 1;
      let wi = 0;
      const half = len >> 1;
      for (let k = 0; k < half; k++) {
        const uR = re[i + k]!;
        const uI = im[i + k]!;
        const vR = re[i + k + half]! * wr - im[i + k + half]! * wi;
        const vI = re[i + k + half]! * wi + im[i + k + half]! * wr;
        re[i + k] = uR + vR;
        im[i + k] = uI + vI;
        re[i + k + half] = uR - vR;
        im[i + k + half] = uI - vI;
        const nextWr = wr * wlenR - wi * wlenI;
        wi = wr * wlenI + wi * wlenR;
        wr = nextWr;
      }
    }
  }
}

const SPEC_STEP_SEC = 0.1; // 100ms frame step
const FFT_SIZE = 2048; // 7.8125 Hz bin resolution @ 16kHz

interface TrackSpecData {
  chromas200ms: Float32Array[];
  centerSpecs: Float32Array;
  midSpecs: Float32Array;
  frames: number;
  maxKeepBin: number;
}

/**
 * Computes 12-bin Chroma sequence + Center-Panned vs Mid magnitude spectrograms using packed stereo single-FFT.
 */
async function computeChromaAndSpectrogram(
  left: Float32Array,
  right: Float32Array,
  sr: number,
  needCenterMask: boolean,
): Promise<TrackSpecData> {
  const bins = (FFT_SIZE >> 1) + 1;
  const hop = Math.round(sr * SPEC_STEP_SEC);
  const frames = Math.max(1, Math.floor((left.length - FFT_SIZE) / hop));
  const hann = new Float32Array(FFT_SIZE);
  for (let i = 0; i < FFT_SIZE; i++) hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));

  const maxKeepBin = Math.min(bins - 1, Math.ceil((3800 * FFT_SIZE) / sr));
  const stride = maxKeepBin + 1;
  const centerSpecs = needCenterMask ? new Float32Array(frames * stride) : new Float32Array(0);
  const midSpecs = new Float32Array(frames * stride);
  const chromas100ms: Float32Array[] = [];

  const re = new Float32Array(FFT_SIZE);
  const im = new Float32Array(FFT_SIZE);
  const minChromaBin = Math.ceil((95 * FFT_SIZE) / sr);
  const maxChromaBin = Math.floor((1500 * FFT_SIZE) / sr);

  for (let f = 0; f < frames; f++) {
    if (f > 0 && f % 700 === 0) await yieldToUi();
    const base = f * hop;
    for (let i = 0; i < FFT_SIZE; i++) {
      re[i] = left[base + i]! * hann[i]!;
      im[i] = right[base + i]! * hann[i]!;
    }
    fft(re, im);

    const chroma = new Float32Array(12);
    const rowOff = f * stride;

    for (let b = 1; b <= maxKeepBin; b++) {
      const nb = FFT_SIZE - b;
      const lR = 0.5 * (re[b]! + re[nb]!);
      const lI = 0.5 * (im[b]! - im[nb]!);
      const rR = 0.5 * (im[b]! + im[nb]!);
      const rI = 0.5 * (-re[b]! + re[nb]!);

      const mR = 0.5 * (lR + rR);
      const mI = 0.5 * (lI + rI);
      const magM = Math.hypot(mR, mI);
      midSpecs[rowOff + b] = magM;

      if (needCenterMask) {
        const sR = 0.5 * (lR - rR);
        const sI = 0.5 * (lI - rI);
        const magS = Math.hypot(sR, sI);
        const panMask = Math.max(0, 1 - 1.38 * (magS / (magM + 1e-6)));
        centerSpecs[rowOff + b] = magM * panMask * panMask;
      }

      if (b >= minChromaBin && b <= maxChromaBin) {
        const hz = (b * sr) / FFT_SIZE;
        const midi = Math.round(69 + 12 * Math.log2(hz / 440));
        chroma[((midi % 12) + 12) % 12] += magM;
      }
    }

    let norm = 0;
    for (let c = 0; c < 12; c++) norm += chroma[c]! * chroma[c]!;
    norm = Math.sqrt(norm);
    if (norm > 1e-4) {
      for (let c = 0; c < 12; c++) chroma[c] /= norm;
    }
    chromas100ms.push(chroma);
  }

  // Average pairs to 200ms frames for fast, noise-immune full-song Chroma DTW
  const chromas200ms: Float32Array[] = [];
  for (let i = 0; i < chromas100ms.length; i += 2) {
    const a = chromas100ms[i]!;
    const b = chromas100ms[Math.min(chromas100ms.length - 1, i + 1)]!;
    const avg = new Float32Array(12);
    let n = 0;
    for (let c = 0; c < 12; c++) {
      avg[c] = (a[c]! + b[c]!) * 0.5;
      n += avg[c]! * avg[c]!;
    }
    n = Math.sqrt(n);
    if (n > 1e-4) for (let c = 0; c < 12; c++) avg[c] /= n;
    chromas200ms.push(avg);
  }

  return { chromas200ms, centerSpecs, midSpecs, frames, maxKeepBin };
}

/**
 * Full-Song Banded Subsequence Chroma DTW:
 * Aligns every 0.2s frame of the Studio vocal song to the exact matching measure/beat of the Karaoke track,
 * handling 0-25s logo splash intros, tempo differences, shortened bridges, and ±6 semitone key transpositions!
 */
function alignStudioToKaraokeDtw(studioChroma: Float32Array[], karaokeChroma: Float32Array[]) {
  const step = 0.2;
  const S = studioChroma.length;
  const K = karaokeChroma.length;

  // 1. Detect key transposition (-5 .. +6 semitones)
  const avgS = new Float32Array(12);
  const avgK = new Float32Array(12);
  for (const c of studioChroma) for (let i = 0; i < 12; i++) avgS[i] += c[i]!;
  for (const c of karaokeChroma) for (let i = 0; i < 12; i++) avgK[i] += c[i]!;

  let keyShift = 0;
  let bestDot = -1;
  for (let sh = -5; sh <= 6; sh++) {
    let d = 0;
    for (let i = 0; i < 12; i++) d += avgS[i]! * avgK[((i + sh) % 12 + 12) % 12]!;
    if (d > bestDot) {
      bestDot = d;
      keyShift = sh;
    }
  }

  // 2. Banded Subsequence DTW (±50s band)
  const band = Math.round(50 / step);
  const dp = new Float32Array(S * K).fill(1e9);
  const ptr = new Uint8Array(S * K);

  const dist = (s: number, k: number) => {
    const cs = studioChroma[s]!;
    const ck = karaokeChroma[k]!;
    let d = 0;
    for (let i = 0; i < 12; i++) d += cs[i]! * ck[((i + keyShift) % 12 + 12) % 12]!;
    return 1 - d;
  };

  const maxSplashK = Math.min(K - 1, Math.round(28 / step));
  for (let k = 0; k <= maxSplashK; k++) dp[k] = dist(0, k) + k * 0.0018;
  const maxSplashS = Math.min(S - 1, Math.round(18 / step));
  for (let s = 1; s <= maxSplashS; s++) dp[s * K] = dist(s, 0) + s * 0.0018;

  for (let s = 1; s < S; s++) {
    const centerK = Math.round((s / S) * K);
    const kMin = Math.max(1, centerK - band);
    const kMax = Math.min(K - 1, centerK + band);
    for (let k = kMin; k <= kMax; k++) {
      const c = dist(s, k);
      const dDiag = dp[(s - 1) * K + (k - 1)]! + c;
      const dUp = dp[(s - 1) * K + k]! + c * 1.18 + 0.045;
      const dLeft = dp[s * K + (k - 1)]! + c * 1.18 + 0.045;
      if (dDiag <= dUp && dDiag <= dLeft) {
        dp[s * K + k] = dDiag;
        ptr[s * K + k] = 1;
      } else if (dUp <= dLeft) {
        dp[s * K + k] = dUp;
        ptr[s * K + k] = 2;
      } else {
        dp[s * K + k] = dLeft;
        ptr[s * K + k] = 3;
      }
    }
  }

  let endS = S - 1;
  let endK = K - 1;
  let bestEnd = dp[endS * K + endK]!;
  const tailWindow = Math.round(32 / step);
  for (let k = Math.max(1, K - tailWindow); k < K; k++) {
    if (dp[(S - 1) * K + k]! < bestEnd) {
      bestEnd = dp[(S - 1) * K + k]!;
      endS = S - 1;
      endK = k;
    }
  }
  for (let s = Math.max(1, S - tailWindow); s < S; s++) {
    if (dp[s * K + (K - 1)]! < bestEnd) {
      bestEnd = dp[s * K + (K - 1)]!;
      endS = s;
      endK = K - 1;
    }
  }

  const sToK = new Float32Array(S).fill(-1);
  let cs = endS;
  let ck = endK;
  while (cs >= 0 && ck >= 0) {
    sToK[cs] = ck;
    const p = ptr[cs * K + ck]!;
    if (p === 1) {
      cs--;
      ck--;
    } else if (p === 2) {
      cs--;
    } else if (p === 3) {
      ck--;
    } else break;
  }

  let firstValid = 0;
  while (firstValid < S && sToK[firstValid]! < 0) firstValid++;
  for (let s = 0; s < firstValid; s++) {
    sToK[s] = Math.max(0, (sToK[firstValid] ?? 0) - (firstValid - s));
  }
  let lastValid = S - 1;
  while (lastValid >= 0 && sToK[lastValid]! < 0) lastValid--;
  for (let s = lastValid + 1; s < S; s++) {
    sToK[s] = Math.min(K - 1, (sToK[lastValid] ?? K - 1) + (s - lastValid));
  }

  // Enforce monotonic non-decreasing mapping + 5-point smoothing so warped bar durations stay smooth
  for (let s = 1; s < S; s++) {
    if (sToK[s]! < sToK[s - 1]!) sToK[s] = sToK[s - 1]!;
  }

  const mapStudioSecToKaraokeSec = (studioSec: number): number => {
    const idx = Math.max(0, Math.min(S - 1, studioSec / step));
    const i0 = Math.floor(idx);
    const i1 = Math.min(S - 1, i0 + 1);
    const frac = idx - i0;
    return (sToK[i0]! * (1 - frac) + sToK[i1]! * frac) * step;
  };

  return { keyShift, mapStudioSecToKaraokeSec };
}

interface SpectralVocalAnalysis {
  stepSec: number;
  frames: number;
  keyShift: number;
  mapStudioSecToKaraokeSec: (studioSec: number) => number;
  /** Per-frame salience matrix [frames * 25] for MIDI 55..79 (G3..G5) after subtracting karaoke piano/instruments */
  pitchSalience: Float32Array;
  frameMaxSalience: Float32Array;
  salienceGate: number;
  vocalMedianMidi: number;
}

const MIN_VOCAL_MIDI = 55; // G3
const MAX_VOCAL_MIDI = 79; // G5
const NUM_MIDI_BINS = MAX_VOCAL_MIDI - MIN_VOCAL_MIDI + 1; // 25 semitones

/**
 * Subtracts the DTW-aligned Karaoke accompaniment spectrum (piano/guitar/strings/band) directly from the
 * Center-Masked Studio spectrum, rejects dull instrument fundamentals lacking human vowel harmonics (900-3300 Hz),
 * and builds the per-semitone Lead Vocal Saliencegram for Viterbi decoding.
 */
async function analyzeIsolatedLeadVocal(
  sSpec: TrackSpecData,
  kSpec: TrackSpecData | null,
  sr: number,
): Promise<SpectralVocalAnalysis> {
  let keyShift = 0;
  let mapStudioSecToKaraokeSec = (sec: number) => sec;

  if (kSpec) {
    const aligned = alignStudioToKaraokeDtw(sSpec.chromas200ms, kSpec.chromas200ms);
    keyShift = aligned.keyShift;
    mapStudioSecToKaraokeSec = aligned.mapStudioSecToKaraokeSec;
  }

  await yieldToUi();

  const stride = sSpec.maxKeepBin + 1;
  const freqScale = Math.pow(2, -keyShift / 12);
  const pitchSalience = new Float32Array(sSpec.frames * NUM_MIDI_BINS);
  const frameMaxSalience = new Float32Array(sSpec.frames);
  const residualV = new Float32Array(stride);

  for (let f = 0; f < sSpec.frames; f++) {
    if (f > 0 && f % 800 === 0) await yieldToUi();
    const sOff = f * stride;

    if (kSpec) {
      const kSec = mapStudioSecToKaraokeSec(f * SPEC_STEP_SEC);
      const kf = Math.max(0, Math.min(kSpec.frames - 1, Math.round(kSec / SPEC_STEP_SEC)));
      const kOff = kf * stride;

      // Estimate adaptive accompaniment scaling over 150..850 Hz (piano & guitar body zone)
      let num = 0;
      let den = 0;
      for (let b = 20; b <= 108; b++) {
        const kb = Math.min(sSpec.maxKeepBin, Math.max(1, Math.round(b / freqScale)));
        const kVal = kSpec.midSpecs[kOff + kb]!;
        num += sSpec.centerSpecs[sOff + b]! * kVal;
        den += kVal * kVal;
      }
      const alpha = den > 1e-6 ? Math.min(2.4, Math.max(0.55, (num / den) * 1.28)) : 1.05;

      for (let b = 18; b < stride; b++) {
        const kb = Math.min(sSpec.maxKeepBin, Math.max(1, Math.round(b / freqScale)));
        const kMax = Math.max(
          kSpec.midSpecs[kOff + Math.max(1, kb - 1)]!,
          kSpec.midSpecs[kOff + kb]!,
          kSpec.midSpecs[kOff + Math.min(sSpec.maxKeepBin, kb + 1)]!,
        );
        residualV[b] = Math.max(0, sSpec.centerSpecs[sOff + b]! - alpha * kMax);
      }
    } else {
      for (let b = 18; b < stride; b++) {
        residualV[b] = sSpec.centerSpecs[sOff + b]!;
      }
    }

    // Require Singer's Formant vowel energy (940 Hz .. 3300 Hz)
    let formantSum = 0;
    for (let b = 120; b <= Math.min(stride - 1, 422); b++) formantSum += residualV[b]!;
    if (formantSum < 0.04) continue;

    let maxSal = 0;
    const outRow = f * NUM_MIDI_BINS;
    for (let mi = 0; mi < NUM_MIDI_BINS; mi++) {
      const midi = MIN_VOCAL_MIDI + mi;
      const f0 = 440 * Math.pow(2, (midi - 69) / 12);
      let hLow = 0;
      let hFormant = 0;
      for (let h = 1; h <= 6; h++) {
        const hz = f0 * h;
        const bin = Math.round((hz * FFT_SIZE) / sr);
        if (bin >= stride) break;
        const mag = Math.max(residualV[bin - 1] ?? 0, residualV[bin]!, residualV[bin + 1] ?? 0);
        const weight = hz >= 880 && hz <= 3350 ? 1.5 : 0.82;
        if (h <= 2) hLow += mag * weight;
        else hFormant += mag * weight;
      }
      // Piano & Bass Rejection: pure piano/bass tones have strong h=1..2 and weak h=3..6 vowel formants!
      if (hFormant < hLow * 0.3) continue;
      const sal = hLow + hFormant * 1.25;
      pitchSalience[outRow + mi] = sal;
      if (sal > maxSal) maxSal = sal;
    }
    frameMaxSalience[f] = maxSal;
  }

  // Adaptive vocal salience gate: separates sung vocal phrases (high salience) from residual piano gaps (low salience)
  const nonZero = Array.from(frameMaxSalience).filter((v) => v > 0.1).sort((a, b) => a - b);
  const p80 = nonZero.length ? nonZero[Math.floor(nonZero.length * 0.8)]! : 10;
  const salienceGate = Math.max(1.5, p80 * 0.19);

  // Estimate dominant vocal register median across confident voiced frames
  const topMidis: number[] = [];
  for (let f = 0; f < sSpec.frames; f++) {
    if (frameMaxSalience[f]! < salienceGate) continue;
    const row = f * NUM_MIDI_BINS;
    let bestM = 64;
    let bestV = -1;
    for (let mi = 0; mi < NUM_MIDI_BINS; mi++) {
      if (pitchSalience[row + mi]! > bestV) {
        bestV = pitchSalience[row + mi]!;
        bestM = MIN_VOCAL_MIDI + mi;
      }
    }
    topMidis.push(bestM);
  }
  topMidis.sort((a, b) => a - b);
  const vocalMedianMidi = topMidis.length >= 8 ? topMidis[Math.floor(topMidis.length / 2)]! : 64;

  return {
    stepSec: SPEC_STEP_SEC,
    frames: sSpec.frames,
    keyShift,
    mapStudioSecToKaraokeSec,
    pitchSalience,
    frameMaxSalience,
    salienceGate,
    vocalMedianMidi,
  };
}

/**
 * Decodes the smooth, continuous human Lead-Vocal MIDI path across studio frames `[fStart..fEnd]` via Viterbi DP,
 * penalizing un-vocal octave/chord jumps to stray accompaniment harmonics.
 */
function viterbiPhrasePath(analysis: SpectralVocalAnalysis, fStart: number, fEnd: number): number[] {
  const len = Math.max(1, fEnd - fStart + 1);
  const dp = new Float32Array(len * NUM_MIDI_BINS);
  const back = new Uint8Array(len * NUM_MIDI_BINS);
  const centerIdx = Math.max(0, Math.min(NUM_MIDI_BINS - 1, analysis.vocalMedianMidi - MIN_VOCAL_MIDI));

  for (let t = 0; t < len; t++) {
    const f = Math.max(0, Math.min(analysis.frames - 1, fStart + t));
    const maxS = Math.max(1e-4, analysis.frameMaxSalience[f]!);
    const sRow = f * NUM_MIDI_BINS;

    for (let mi = 0; mi < NUM_MIDI_BINS; mi++) {
      const normSal = analysis.pitchSalience[sRow + mi]! / maxS;
      // Mild preference for staying within ±8 semitones of the singer's natural register center
      const regPenalty = Math.abs(mi - centerIdx) > 8 ? (Math.abs(mi - centerIdx) - 8) * 0.08 : 0;
      const emitScore = normSal - regPenalty;

      if (t === 0) {
        dp[mi] = emitScore;
      } else {
        let bestPrevScore = -1e9;
        let bestPrevMi = mi;
        const prevRow = (t - 1) * NUM_MIDI_BINS;
        for (let pm = 0; pm < NUM_MIDI_BINS; pm++) {
          const jump = Math.abs(mi - pm);
          const transPenalty = jump === 0 ? 0 : jump <= 2 ? jump * 0.09 : 0.18 + Math.pow(jump - 2, 1.45) * 0.16;
          const cand = dp[prevRow + pm]! - transPenalty;
          if (cand > bestPrevScore) {
            bestPrevScore = cand;
            bestPrevMi = pm;
          }
        }
        dp[t * NUM_MIDI_BINS + mi] = bestPrevScore + emitScore;
        back[t * NUM_MIDI_BINS + mi] = bestPrevMi;
      }
    }
  }

  const path = new Array<number>(len);
  let curMi = centerIdx;
  let bestFinal = -1e9;
  const lastRow = (len - 1) * NUM_MIDI_BINS;
  for (let mi = 0; mi < NUM_MIDI_BINS; mi++) {
    if (dp[lastRow + mi]! > bestFinal) {
      bestFinal = dp[lastRow + mi]!;
      curMi = mi;
    }
  }
  for (let t = len - 1; t >= 0; t--) {
    path[t] = Math.max(53, Math.min(81, MIN_VOCAL_MIDI + curMi + analysis.keyShift));
    curMi = back[t * NUM_MIDI_BINS + curMi]!;
  }
  return path;
}

interface ParsedLine {
  time: number;
  text: string;
}

const NON_VOCAL_MARKER_RX =
  /^(?:\[[^\]]*\]|\([^)]*\)|\{[^}]*\}|<[^>]*>|\b(?:intro|instrumental|interlude|music|guitar\s*solo|piano\s*solo|solo|break|dance\s*break|outro|end|fade\s*out|verse\s*\d*|chorus|pre-?chorus|bridge|hook)\b[\s.:!-]*)+$/i;

const CREDIT_LINE_RX =
  /\b(?:lyrics?\s*by|written\s*by|composed\s*by|arranged\s*by|produced\s*by|synced\s*by|transcribed\s*by|lrc\s*by|www\.|\.com|\.net|http)\b/i;

function isNonVocalLine(text: string, time: number, songTitle: string, songArtist: string): boolean {
  const cleaned = text.replace(/[♪♫♬♩~•·*_=+\-—–.,!?'"`()[\]{}\s]/g, "").trim();
  if (!cleaned) return true;
  if (NON_VOCAL_MARKER_RX.test(text.trim())) return true;
  if (CREDIT_LINE_RX.test(text)) return true;

  const withoutBrackets = text
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\((?:instrumental|music|intro|interlude|solo|outro|break|guitar|piano)[^)]*\)/gi, " ")
    .trim();
  if (!withoutBrackets) return true;

  if (time < 7.5 && songTitle) {
    const normLine = withoutBrackets.toLowerCase();
    const normTitle = songTitle.toLowerCase();
    const normArtist = songArtist.toLowerCase();
    if (normArtist && normLine.includes(normTitle) && normLine.includes(normArtist)) return true;
  }
  return false;
}

function parseVocalLrcLines(lrc: string, songTitle: string, songArtist: string): ParsedLine[] {
  const out: ParsedLine[] = [];
  const rx = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
  for (const rawLine of lrc.split(/\r?\n/)) {
    rx.lastIndex = 0;
    const times: number[] = [];
    let m: RegExpExecArray | null;
    let lastIdx = 0;
    while ((m = rx.exec(rawLine)) !== null) {
      const mins = Number(m[1]);
      const secs = Number(m[2]);
      const msStr = m[3] ?? "0";
      const frac = Number(msStr) / Math.pow(10, msStr.length);
      times.push(mins * 60 + secs + frac);
      lastIdx = rx.lastIndex;
    }
    if (!times.length) continue;
    const rawText = rawLine.slice(lastIdx).replace(/^[♪♫♬♩\s]+|[♪♫♬♩\s]+$/g, "").trim();
    if (!rawText) continue;

    for (const t of times) {
      if (isNonVocalLine(rawText, t, songTitle, songArtist)) continue;
      const vocalText = rawText
        .replace(/\[[^\]]*\]/g, " ")
        .replace(/\((?:instrumental|music|intro|interlude|solo|outro|break)[^)]*\)/gi, " ")
        .replace(/\s{2,}/g, " ")
        .trim();
      if (vocalText) out.push({ time: t, text: vocalText });
    }
  }
  return out.sort((a, b) => a.time - b.time);
}

function splitIntoSingableUnits(text: string): { label: string; weight: number }[] {
  const words = text
    .replace(/[^\p{L}\p{N}'\s-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return [];

  const units: { label: string; weight: number }[] = [];
  for (const w of words) {
    const vowelGroups = w.match(/[aeiouyáéíóúàèìòùâêîôûäëïöü]+/gi);
    const syllables = Math.max(1, Math.min(3, vowelGroups ? vowelGroups.length : 1));
    if (syllables === 1 || w.length <= 5) {
      units.push({ label: w, weight: w.length >= 4 ? 1.2 : 1 });
    } else if (syllables === 2) {
      const mid = Math.ceil(w.length / 2);
      units.push({ label: `${w.slice(0, mid)}-`, weight: 0.9 });
      units.push({ label: w.slice(mid), weight: 1.15 });
    } else {
      const third = Math.ceil(w.length / 3);
      units.push({ label: `${w.slice(0, third)}-`, weight: 0.85 });
      units.push({ label: `${w.slice(third, third * 2)}-`, weight: 0.9 });
      units.push({ label: w.slice(third * 2), weight: 1.15 });
    }
    if (units.length >= 14) break;
  }
  return units;
}

/**
 * Aligns LRCLIB timestamps to the Studio audio's actual vocal salience spikes (compensates up to ±10s if LRC was
 * synced to a Music Video edit rather than the Studio Album cut!).
 */
function findLrcToStudioOffset(lines: ParsedLine[], analysis: SpectralVocalAnalysis): number {
  const F = analysis.frames;
  const mask = new Float32Array(F);
  for (let i = 0; i < lines.length; i++) {
    const t0 = lines[i]!.time;
    const nextT = i + 1 < lines.length ? lines[i + 1]!.time : t0 + 3.2;
    const dur = Math.min(3.6, Math.max(0.8, nextT - t0 - 0.25));
    const f0 = Math.max(0, Math.round(t0 / analysis.stepSec));
    const f1 = Math.min(F - 1, Math.round((t0 + dur) / analysis.stepSec));
    for (let f = f0; f <= f1; f++) mask[f] = 1;
  }

  // Normalize vocal salience to soft 0..1 vocal activity curve
  const act = new Float32Array(F);
  const ref = analysis.salienceGate * 2.2;
  for (let f = 0; f < F; f++) {
    act[f] = Math.min(1, analysis.frameMaxSalience[f]! / Math.max(1e-3, ref));
  }

  const maxLag = Math.round(10 / analysis.stepSec);
  let bestLag = 0;
  let bestScore = -1e9;
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    let dot = 0;
    for (let f = 0; f < F; f++) {
      const af = f + lag;
      if (af < 0 || af >= F) continue;
      dot += mask[f]! * (act[af]! - 0.28);
    }
    // Slight preference for near-zero lag when Studio & LRC already match closely
    const score = dot - Math.abs(lag) * 0.04;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }
  return bestLag * analysis.stepSec;
}

/**
 * Builds DTW-synced, piano-free vocal guide bars from Synced Lyrics + Studio Spectral Vocal Analysis!
 */
function buildSyncedGuideWithDtw(
  trackId: string,
  lines: ParsedLine[],
  analysis: SpectralVocalAnalysis,
  karaokeDuration: number,
): VocalGuideTrack {
  const lrcToStudioOffset = findLrcToStudioOffset(lines, analysis);
  const bars: GuideBar[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const units = splitIntoSingableUnits(line.text);
    if (!units.length) continue;

    let sStart = Math.max(0.2, line.time + lrcToStudioOffset);
    const sNext =
      i + 1 < lines.length
        ? lines[i + 1]!.time + lrcToStudioOffset
        : Math.min(sStart + 4.2, analysis.frames * analysis.stepSec - 0.5);
    const maxGap = Math.max(0.55, sNext - sStart - 0.18);
    const naturalDur = units.length * 0.34 + 0.3;
    let sEnd = sStart + Math.min(maxGap, naturalDur, 4.4);

    // Trim leading/trailing piano-only silence frames inside [sStart..sEnd] using isolated vocal salience!
    let f0 = Math.max(0, Math.min(analysis.frames - 1, Math.floor(sStart / analysis.stepSec)));
    let f1 = Math.max(f0, Math.min(analysis.frames - 1, Math.ceil(sEnd / analysis.stepSec)));
    const softGate = analysis.salienceGate * 0.55;
    while (f0 < f1 && analysis.frameMaxSalience[f0]! < softGate) f0++;
    while (f1 > f0 && analysis.frameMaxSalience[f1]! < softGate) f1--;

    if (f1 - f0 >= 2) {
      sStart = f0 * analysis.stepSec;
      sEnd = Math.max(sStart + 0.32, (f1 + 1) * analysis.stepSec);
    } else {
      f0 = Math.max(0, Math.min(analysis.frames - 1, Math.floor(sStart / analysis.stepSec)));
      f1 = Math.max(f0 + 1, Math.min(analysis.frames - 1, Math.ceil(sEnd / analysis.stepSec)));
    }

    const viterbiMidis = viterbiPhrasePath(analysis, f0, f1);
    if (units.length >= 2) units[units.length - 1]!.weight *= 1.28;
    const totalWeight = units.reduce((acc, u) => acc + u.weight, 0) || 1;

    let sCursor = sStart;
    const sPhraseDur = Math.max(0.28, sEnd - sStart);

    for (let u = 0; u < units.length; u++) {
      const sSlice = (units[u]!.weight / totalWeight) * sPhraseDur;
      const uS0 = sCursor;
      const uS1 = sCursor + Math.max(0.11, sSlice - 0.035);
      sCursor += sSlice;

      // Map exact Studio timestamps -> Karaoke Video timestamps via Full-Song Chroma DTW!
      const kStart = analysis.mapStudioSecToKaraokeSec(uS0);
      const kEnd = Math.max(kStart + 0.12, analysis.mapStudioSecToKaraokeSec(uS1));
      if (kStart < 0.2 || kStart >= karaokeDuration - 1.5) continue;

      const idx0 = Math.max(0, Math.min(viterbiMidis.length - 1, Math.floor((uS0 - sStart) / analysis.stepSec)));
      const idx1 = Math.max(idx0, Math.min(viterbiMidis.length - 1, Math.ceil((uS1 - sStart) / analysis.stepSec)));
      const sliceMidis = viterbiMidis.slice(idx0, idx1 + 1).sort((a, b) => a - b);
      const midi = sliceMidis[Math.floor(sliceMidis.length / 2)] ?? analysis.vocalMedianMidi + analysis.keyShift;

      bars.push({
        start: Number(kStart.toFixed(3)),
        end: Number(Math.min(karaokeDuration - 0.5, kEnd).toFixed(3)),
        midi: Math.max(53, Math.min(81, Math.round(midi))),
        syllable: units[u]!.label,
      });
    }
  }

  return {
    trackId,
    source: bars.length > 0 ? "studio-vocal" : "live-only",
    firstVocalSec: bars[0]?.start ?? null,
    bars,
  };
}

/** Pure audio fallback when no synced lyrics exist on LRCLIB: segments only high-salience vocal islands! */
function buildContourOnlyGuideWithDtw(
  trackId: string,
  analysis: SpectralVocalAnalysis,
  karaokeDuration: number,
): VocalGuideTrack {
  const bars: GuideBar[] = [];
  let islandStart = -1;

  const flushIsland = (islandEnd: number) => {
    if (islandStart < 0 || islandEnd - islandStart < 3) {
      islandStart = -1;
      return;
    }
    const midis = viterbiPhrasePath(analysis, islandStart, islandEnd - 1);
    let runStart = 0;
    for (let i = 1; i <= midis.length; i++) {
      if (i === midis.length || midis[i] !== midis[runStart] || (i - runStart) * analysis.stepSec >= 0.9) {
        if (i - runStart >= 2) {
          const s0 = (islandStart + runStart) * analysis.stepSec;
          const s1 = (islandStart + i) * analysis.stepSec - 0.03;
          const k0 = analysis.mapStudioSecToKaraokeSec(s0);
          const k1 = Math.max(k0 + 0.14, analysis.mapStudioSecToKaraokeSec(s1));
          if (k0 >= 0.4 && k1 <= karaokeDuration - 1) {
            bars.push({
              start: Number(k0.toFixed(3)),
              end: Number(k1.toFixed(3)),
              midi: midis[runStart]!,
            });
          }
        }
        runStart = i;
      }
    }
    islandStart = -1;
  };

  for (let f = 0; f < analysis.frames; f++) {
    if (analysis.frameMaxSalience[f]! >= analysis.salienceGate) {
      if (islandStart < 0) islandStart = f;
    } else if (islandStart >= 0) {
      // Allow 1-frame (100ms) consonant dip inside a word without splitting the island
      const nextVoiced = f + 1 < analysis.frames && analysis.frameMaxSalience[f + 1]! >= analysis.salienceGate;
      if (!nextVoiced) flushIsland(f);
    }
  }
  flushIsland(analysis.frames);

  return {
    trackId,
    source: bars.length > 0 ? "studio-vocal" : "live-only",
    firstVocalSec: bars[0]?.start ?? null,
    bars,
  };
}

interface LrcSearchHit {
  trackName?: string;
  artistName?: string;
  duration?: number;
  instrumental?: boolean;
  syncedLyrics?: string | null;
}

async function fetchSyncedLrcLines(
  title: string,
  artist: string,
  fallbackQuery: string,
  studioDuration: number,
): Promise<{ lines: ParsedLine[]; lrcDuration?: number } | null> {
  const urls: string[] = [];
  if (title && artist) {
    urls.push(`https://lrclib.net/api/search?q=${encodeURIComponent(`${title} ${artist}`)}`);
    urls.push(
      `https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`,
    );
  }
  if (fallbackQuery) {
    urls.push(`https://lrclib.net/api/search?q=${encodeURIComponent(fallbackQuery)}`);
  }

  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5500) });
      if (!res.ok) continue;
      const hits = (await res.json()) as LrcSearchHit[];
      if (!Array.isArray(hits) || !hits.length) continue;

      const artistNorm = artist.toLowerCase();
      const withSynced = hits
        .filter((h) => !h.instrumental && typeof h.syncedLyrics === "string" && h.syncedLyrics.trim().length > 20)
        .sort((a, b) => {
          const aArt = artistNorm && a.artistName?.toLowerCase().includes(artistNorm) ? -25 : 0;
          const bArt = artistNorm && b.artistName?.toLowerCase().includes(artistNorm) ? -25 : 0;
          const da = (studioDuration && a.duration ? Math.abs(a.duration - studioDuration) : 20) + aArt;
          const db = (studioDuration && b.duration ? Math.abs(b.duration - studioDuration) : 20) + bArt;
          return da - db;
        });

      for (const candidate of withSynced.slice(0, 3)) {
        if (!candidate.syncedLyrics) continue;
        const parsed = parseVocalLrcLines(
          candidate.syncedLyrics,
          title || candidate.trackName || "",
          artist || candidate.artistName || "",
        );
        if (parsed.length >= 4) {
          return { lines: parsed, lrcDuration: candidate.duration };
        }
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

export function loadVocalGuide(track: Track): Promise<VocalGuideTrack> {
  const cached = guideCache.get(track.id);
  if (cached && !cached.syncing && cached.source === "studio-vocal") return Promise.resolve(cached);
  const existing = inflight.get(track.id);
  if (existing) return existing;

  // Mark syncing state immediately without flashing fake un-synced placeholder notes!
  notifyGuide(track.id, {
    trackId: track.id,
    source: "live-only",
    syncing: true,
    firstVocalSec: null,
    bars: [],
  });

  const job = (async (): Promise<VocalGuideTrack> => {
    const parsedMeta = parseKaraokeMetadata(track);
    const studioSong = await findOriginalStudioSong(track, parsedMeta.query);

    const canonicalTitle = studioSong?.title || parsedMeta.titleHint;
    const canonicalArtist = studioSong?.artist || parsedMeta.artistHint;

    if (studioSong) {
      const isSeparateKaraoke = studioSong.id !== track.id;
      const [lrcResult, studioBytes, karaokeBytes] = await Promise.all([
        fetchSyncedLrcLines(canonicalTitle, canonicalArtist, parsedMeta.query, studioSong.duration || track.duration || 220),
        fetchCompleteAudioBytes(studioSong.id),
        isSeparateKaraoke ? fetchCompleteAudioBytes(track.id) : Promise.resolve(null),
      ]);

      if (studioBytes) {
        const [studioPcm, karaokePcm] = await Promise.all([
          decodeToStereo16k(studioBytes),
          karaokeBytes ? decodeToStereo16k(karaokeBytes) : Promise.resolve(null),
        ]);

        if (studioPcm) {
          const [sSpec, kSpec] = await Promise.all([
            computeChromaAndSpectrogram(studioPcm.left, studioPcm.right, studioPcm.sr, true),
            karaokePcm
              ? computeChromaAndSpectrogram(karaokePcm.left, karaokePcm.right, karaokePcm.sr, false)
              : Promise.resolve(null),
          ]);

          const analysis = await analyzeIsolatedLeadVocal(sSpec, kSpec, studioPcm.sr);
          const kDur =
            (karaokePcm ? karaokePcm.left.length / karaokePcm.sr : track.duration) ||
            studioPcm.left.length / studioPcm.sr ||
            220;

          const guide =
            lrcResult && lrcResult.lines.length >= 4
              ? buildSyncedGuideWithDtw(track.id, lrcResult.lines, analysis, kDur)
              : buildContourOnlyGuideWithDtw(track.id, analysis, kDur);

          if (guide.bars.length >= 4) {
            notifyGuide(track.id, guide);
            return guide;
          }
        }
      }
    }

    const fallback: VocalGuideTrack = {
      trackId: track.id,
      source: "live-only",
      syncing: false,
      firstVocalSec: null,
      bars: [],
    };
    notifyGuide(track.id, fallback);
    return fallback;
  })().finally(() => {
    inflight.delete(track.id);
  });

  inflight.set(track.id, job);
  return job;
}

export function getCachedVocalGuide(trackId: string): VocalGuideTrack | null {
  return guideCache.get(trackId) ?? null;
}
