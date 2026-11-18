import { api, streamSource } from "./api";
import type { Track } from "./types";

export interface GuideBar {
  /** Start time in karaoke track seconds */
  start: number;
  /** End time in karaoke track seconds */
  end: number;
  /** Real lead-vocal MIDI note in human vocal register (G3=55 .. G5=79) */
  midi: number;
  /** Sung word/syllable for this note when synced lyrics are available */
  syllable?: string;
}

export interface VocalGuideTrack {
  trackId: string;
  /** "studio-vocal" = extracted from original studio vocal audio; "synced" = lyric-synced preliminary; "live-only" = live mic only */
  source: "studio-vocal" | "synced" | "live-only";
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

const KARAOKE_NOISE_WORDS =
  /\b(?:sing\s*king(?:\s*karaoke)?|covers\s*ph|karafun(?:\s*karaoke)?|acoustic\s*heaven|my\s*all\s*(?:time\s*)?karaoke|myallkaraoke|stingray(?:\s*karaoke)?|the\s*karaoke\s*channel|zoom\s*karaoke|sunfly|platinum\s*karaoke|magic\s*sing|megapro|atomic\s*karaoke|we\s*sing|karaokey\s*tv|karaokey|karaoke\s*jp|edsong(?:\s*karaoke)?|musisi(?:\s*karaoke)?|nice\s*karaoke|top\s*hits\s*karaoke|vinyl\s*ktv|global\s*karaokey\s*tv|pro\s*music\s*cover|acoustic\s*lounge|jamming\s*sessions)\b/gi;

const GENERIC_UPLOADER_RX =
  /\b(?:karaoke|karaokey|videoke|ktv|minus\s*one|backing|instrumental|cover|covers|sing|acoustic|lounge|sessions|channel|studio|lyrics?|music\s*tv|hits|official\s*karaoke)\b/i;

const KARAOKE_TAG_PARENS =
  /\s*[([](?:[^)\]]*\b(?:karaoke|videoke|instrumental|off\s*vocal|backing\s*track|minus\s*one|lyrics?|lyric\s*video|in\s*the\s*style\s*of|originally\s*performed\s*by|made\s*famous\s*by|lower\s*key|higher\s*key|female\s*key|male\s*key|original\s*key|acoustic\s*karaoke|piano\s*karaoke|hd|4k|hq|official|version)\b[^)\]]*)[)\]]/gi;

const TRAILING_KARAOKE_TAGS =
  /\s*(?:[-–—:|•·|]\s*|\b)(?:karaoke(?:\s*songs?\s*with\s*lyrics|\s*version|\s*instrumental|\s*track)?|videoke(?:\s*version)?|instrumental(?:\s*version)?|minus\s*one|off\s*vocal|with\s*lyrics|lyric\s*video|original\s*key|hd)\s*$/gi;

export function parseKaraokeMetadata(track: Track): { query: string; titleHint: string; artistHint: string } {
  let cleanedTitle = track.title
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
      // Could be "Artist - Song" OR "Song - Artist"; keep clean combined query for YTM Song lookup!
      titleHint = parts[0]!;
      artistHint = parts[1]!;
    }
  }

  const query = parts.length >= 2
    ? `${parts[0]} ${parts[1]}`
    : [titleHint, artistHint].filter(Boolean).join(" ").trim() || cleanedTitle || track.title;

  return { query, titleHint: titleHint || cleanedTitle, artistHint };
}

const IS_KARAOKE_TRACK_RX =
  /\b(?:karaoke|karaokey|videoke|ktv|minus\s*one|off\s*vocal|backing\s*track|instrumental)\b/i;

/** Resolves the canonical studio vocal recording on YouTube Music (with real lead vocals, never karaoke). */
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
    // Prefer closest studio duration within reasonable Splash-Intro tolerance (±35s) while prioritizing top YTM relevance
    const scored = vocalTracks.slice(0, 6).map((c, idx) => {
      const durDiff = track.duration && c.duration ? Math.abs(track.duration - c.duration) : 12;
      const score = idx * 4 + (durDiff <= 30 ? durDiff * 0.35 : durDiff * 1.1);
      return { c, score };
    });
    scored.sort((a, b) => a.score - b.score);
    return scored[0]?.c ?? vocalTracks[0] ?? null;
  } catch {
    return null;
  }
}

/** Downloads compressed audio bytes (optionally capped to `maxBytes` for fast intro alignment) on Web, Desktop & Mobile. */
async function fetchTrackAudioBytes(videoId: string, maxBytes?: number): Promise<ArrayBuffer | null> {
  try {
    const src = streamSource(videoId, "audio", "sd");
    if (typeof src === "string") {
      const headers: Record<string, string> = {};
      if (maxBytes) headers.Range = `bytes=0-${maxBytes - 1}`;
      const url = maxBytes
        ? `/api/stream/${encodeURIComponent(videoId)}/audio`
        : `/api/download/${encodeURIComponent(videoId)}?kind=audio`;
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(12000) });
      if (!res.ok && res.status !== 206) return null;
      return await res.arrayBuffer();
    }

    const directUrl = await src;
    const chunk = 512 * 1024;
    const cap = maxBytes ?? 4 * 1024 * 1024;
    const firstEnd = Math.min(chunk - 1, cap - 1);
    const first = await fetch(directUrl, {
      headers: { Range: `bytes=0-${firstEnd}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!first.ok && first.status !== 206) return null;
    const firstBuf = await first.arrayBuffer();
    const cr = first.headers.get("content-range");
    const totalMatch = cr?.match(/\/(\d+)$/);
    const total = Math.min(cap, totalMatch ? Number(totalMatch[1]) : firstBuf.byteLength);
    if (total <= firstBuf.byteLength) return firstBuf;

    const parts: ArrayBuffer[] = [firstBuf];
    for (let start = firstBuf.byteLength; start < total; start += chunk) {
      const end = Math.min(total - 1, start + chunk - 1);
      const r = await fetch(directUrl, {
        headers: { Range: `bytes=${start}-${end}` },
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok && r.status !== 206) break;
      parts.push(await r.arrayBuffer());
    }
    const totalLen = parts.reduce((s, b) => s + b.byteLength, 0);
    const merged = new Uint8Array(totalLen);
    let offset = 0;
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
    const OfflineCtx = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
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

/** Simple 2-pole biquad filter pass on a Float32Array for crisp vocal band isolation. */
function biquadFilter(
  input: Float32Array,
  sr: number,
  type: "highpass" | "lowpass" | "bandpass",
  freq: number,
  q = 0.707,
): Float32Array {
  const out = new Float32Array(input.length);
  const w0 = (2 * Math.PI * freq) / sr;
  const cosW0 = Math.cos(w0);
  const sinW0 = Math.sin(w0);
  const alpha = sinW0 / (2 * q);

  let b0 = 0, b1 = 0, b2 = 0, a0 = 1, a1 = 0, a2 = 0;
  if (type === "highpass") {
    b0 = (1 + cosW0) / 2;
    b1 = -(1 + cosW0);
    b2 = (1 + cosW0) / 2;
    a0 = 1 + alpha;
    a1 = -2 * cosW0;
    a2 = 1 - alpha;
  } else if (type === "lowpass") {
    b0 = (1 - cosW0) / 2;
    b1 = 1 - cosW0;
    b2 = (1 - cosW0) / 2;
    a0 = 1 + alpha;
    a1 = -2 * cosW0;
    a2 = 1 - alpha;
  } else {
    b0 = alpha;
    b1 = 0;
    b2 = -alpha;
    a0 = 1 + alpha;
    a1 = -2 * cosW0;
    a2 = 1 - alpha;
  }

  const nb0 = b0 / a0, nb1 = b1 / a0, nb2 = b2 / a0, na1 = a1 / a0, na2 = a2 / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const x0 = input[i]!;
    const y0 = nb0 * x0 + nb1 * x1 + nb2 * x2 - na1 * y1 - na2 * y2;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
    out[i] = y0;
  }
  return out;
}

const HOP_SEC = 0.05; // 50ms frame step (20 Hz)

/** Computes positive onset flux envelope at 20 Hz for sub-100ms Studio <-> Karaoke splash-intro alignment. */
function computeOnsetFlux(mid: Float32Array, sr: number, maxSec = 60): Float32Array {
  const hop = Math.round(sr * HOP_SEC);
  const maxSamples = Math.min(mid.length, Math.floor(maxSec * sr));
  const frames = Math.max(1, Math.floor(maxSamples / hop));
  const env = new Float32Array(frames);
  let prevLogE = -12;
  for (let f = 0; f < frames; f++) {
    const start = f * hop;
    let sum = 0;
    for (let i = 0; i < hop; i++) {
      const v = mid[start + i] ?? 0;
      sum += v * v;
    }
    const logE = Math.log(sum / hop + 1e-8);
    env[f] = Math.max(0, logE - prevLogE);
    prevLogE = logE;
  }
  return env;
}

/**
 * Finds `offsetSec = karaokeTime - studioTime` (positive when karaoke video has a 2-15s intro title card).
 */
function findKaraokeIntroOffsetSec(studioMid: Float32Array, karaokeMid: Float32Array, sr: number): number {
  const sFlux = computeOnsetFlux(studioMid, sr, 50);
  const kFlux = computeOnsetFlux(karaokeMid, sr, 65);
  if (sFlux.length < 120 || kFlux.length < 120) return 0;

  const minLag = Math.round(-4 / HOP_SEC);
  const maxLag = Math.round(16 / HOP_SEC);
  let bestLag = 0;
  let bestCorr = -Infinity;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let dot = 0;
    let normS = 0;
    let normK = 0;
    let count = 0;
    for (let i = 10; i < sFlux.length - 10; i++) {
      const j = i + lag;
      if (j < 5 || j >= kFlux.length - 5) continue;
      const sv = sFlux[i]!;
      const kv = kFlux[j]!;
      dot += sv * kv;
      normS += sv * sv;
      normK += kv * kv;
      count++;
    }
    if (count < 100 || normS <= 1e-9 || normK <= 1e-9) continue;
    const corr = dot / Math.sqrt(normS * normK);
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  return bestCorr >= 0.22 ? Number((bestLag * HOP_SEC).toFixed(2)) : 0;
}

interface StudioVocalContour {
  /** Frame step in seconds (0.05s) */
  hopSec: number;
  /** MIDI pitch per frame on studio timeline, or null when unvoiced / instrumental */
  frames: (number | null)[];
  /** Median vocal MIDI register of the studio singer (clamped to human vocal range 57..71) */
  vocalMedian: number;
  /** Offset `karaokeSec - studioSec` when aligned against karaoke audio */
  introOffsetSec: number;
}

/**
 * Extracts ONLY the center-panned Lead Vocal melody from the Studio Stereo AudioBuffer:
 * - Rejects bass/kick/low-guitar chords via cascaded 205 Hz High-Pass filter (floor = G3, 196 Hz).
 * - Rejects wide-panned guitars/keys/pads via Mid-vs-Side ratio + Singer's Formant (1.0–3.2 kHz) weighting.
 * - Rejects instrumental sections via Karaoke-vs-Studio vocal energy comparison when karaoke audio is present.
 * - Tracks human lead-vocal F0 strictly in G3..G5 (MIDI 55..79) via YIN CMNDF + octave continuity smoothing.
 */
function extractStudioVocalContour(
  studio: { left: Float32Array; right: Float32Array; sr: number },
  karaoke: { left: Float32Array; right: Float32Array; sr: number } | null,
): StudioVocalContour {
  const { left, right, sr } = studio;
  const n = left.length;
  const rawMid = new Float32Array(n);
  const rawSide = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const l = left[i]!;
    const r = right[i]!;
    rawMid[i] = (l + r) * 0.5;
    rawSide[i] = (l - r) * 0.5;
  }

  // Cascaded 205 Hz high-pass (-24 dB/oct below G#3) + 1150 Hz low-pass completely strips basslines & kick/low guitar!
  const vocalBand = biquadFilter(biquadFilter(biquadFilter(rawMid, sr, "highpass", 205, 0.75), sr, "highpass", 195, 0.75), sr, "lowpass", 1150, 0.75);
  const sideBand = biquadFilter(biquadFilter(rawSide, sr, "highpass", 205, 0.75), sr, "lowpass", 1150, 0.75);
  // Singer's Formant band (1.1 kHz - 3.2 kHz) strongly highlights human vocal vowels over warm instruments
  const formantMid = biquadFilter(rawMid, sr, "bandpass", 1950, 0.9);
  const formantSide = biquadFilter(rawSide, sr, "bandpass", 1950, 0.9);

  let introOffsetSec = 0;
  let karaokeMidBand: Float32Array | null = null;
  if (karaoke) {
    const kn = karaoke.left.length;
    const kMid = new Float32Array(kn);
    for (let i = 0; i < kn; i++) {
      kMid[i] = (karaoke.left[i]! + karaoke.right[i]!) * 0.5;
    }
    karaokeMidBand = biquadFilter(biquadFilter(kMid, sr, "highpass", 210, 0.75), sr, "lowpass", 2400, 0.75);
    introOffsetSec = findKaraokeIntroOffsetSec(vocalBand, karaokeMidBand, sr);
  }

  const hop = Math.round(sr * HOP_SEC); // 800 samples @ 16kHz
  const winLen = Math.round(sr * 0.064); // 1024 samples (64ms window)
  const totalFrames = Math.max(1, Math.floor((n - winLen) / hop));

  // Strict human lead-vocal F0 search range: G3 (196 Hz, MIDI 55) .. G5 (784 Hz, MIDI 79)
  const minTau = Math.max(4, Math.floor(sr / 790));
  const maxTau = Math.min(Math.floor(sr / 192), Math.floor(winLen / 2) - 2);
  const yinWin = winLen - maxTau - 1;
  const cmndf = new Float32Array(maxTau + 1);

  // Measure median studio vocal-band RMS for adaptive energy gating
  const rmsArr: number[] = [];
  for (let f = 0; f < totalFrames; f += 2) {
    const base = f * hop;
    let sum = 0;
    for (let i = 0; i < winLen; i++) {
      const v = vocalBand[base + i]!;
      sum += v * v;
    }
    const r = Math.sqrt(sum / winLen);
    if (r > 0.002) rmsArr.push(r);
  }
  rmsArr.sort((a, b) => a - b);
  const medianRms = rmsArr[Math.floor(rmsArr.length * 0.45)] ?? 0.015;
  const minVocalRms = Math.max(0.004, medianRms * 0.36);

  const rawFrames: (number | null)[] = new Array(totalFrames).fill(null);

  for (let f = 0; f < totalFrames; f++) {
    const base = f * hop;
    let sumM = 0, sumS = 0, sumFM = 0, sumFS = 0;
    for (let i = 0; i < winLen; i++) {
      const vm = vocalBand[base + i]!;
      const vs = sideBand[base + i]!;
      const fm = formantMid[base + i]!;
      const fs = formantSide[base + i]!;
      sumM += vm * vm;
      sumS += vs * vs;
      sumFM += fm * fm;
      sumFS += fs * fs;
    }
    const rmsM = Math.sqrt(sumM / winLen);
    if (rmsM < minVocalRms) continue;

    // Reject frames dominated by wide-panned stereo instruments
    if (sumS > sumM * 0.92 && sumFS > sumFM * 0.85) continue;

    // If aligned karaoke instrumental buffer covers this timestamp, reject frames with no extra center vocal energy
    if (karaokeMidBand) {
      const kSec = f * HOP_SEC + introOffsetSec;
      const kBase = Math.round(kSec * sr);
      if (kBase >= 0 && kBase + winLen < karaokeMidBand.length) {
        let sumK = 0;
        for (let i = 0; i < winLen; i++) {
          const vk = karaokeMidBand[kBase + i]!;
          sumK += vk * vk;
        }
        const rmsK = Math.sqrt(sumK / winLen);
        if (rmsM < rmsK * 1.08 && sumFM < sumFS * 1.4) continue;
      }
    }

    cmndf[0] = 1;
    let running = 0;
    for (let tau = 1; tau <= maxTau; tau++) {
      let diff = 0;
      for (let i = 0; i < yinWin; i++) {
        const d = vocalBand[base + i]! - vocalBand[base + i + tau]!;
        diff += d * d;
      }
      running += diff;
      cmndf[tau] = running > 0 ? (diff * tau) / running : 1;
    }

    let bestTau = -1;
    for (let tau = minTau; tau <= maxTau - 1; tau++) {
      if (cmndf[tau]! < 0.22) {
        while (tau + 1 <= maxTau - 1 && cmndf[tau + 1]! < cmndf[tau]!) tau++;
        bestTau = tau;
        break;
      }
    }
    if (bestTau < 0) {
      let minVal = 1;
      for (let tau = minTau; tau <= maxTau - 1; tau++) {
        if (cmndf[tau]! < minVal) {
          minVal = cmndf[tau]!;
          bestTau = tau;
        }
      }
      if (minVal > 0.3) continue;
    }

    const s0 = cmndf[bestTau - 1] ?? cmndf[bestTau]!;
    const s1 = cmndf[bestTau]!;
    const s2 = cmndf[bestTau + 1] ?? s1;
    const denom = 2 * (2 * s1 - s0 - s2);
    const shift = denom !== 0 ? Math.max(-0.5, Math.min(0.5, (s0 - s2) / denom)) : 0;
    const hz = sr / (bestTau + shift);
    const midi = 69 + 12 * Math.log2(hz / 440);
    if (midi >= 55 && midi <= 79) {
      rawFrames[f] = midi;
    }
  }

  // Compute natural vocal center & fold any stray ±12 harmonic jumps into continuous lead-vocal range
  const allVoiced = rawFrames.filter((m): m is number => m !== null).sort((a, b) => a - b);
  const rawMedian = allVoiced.length >= 8 ? allVoiced[Math.floor(allVoiced.length / 2)]! : 64;
  const vocalMedian = Math.max(59, Math.min(71, Math.round(rawMedian)));

  const folded: (number | null)[] = rawFrames.map((m) => {
    if (m === null) return null;
    let v = m;
    while (v - vocalMedian > 8.5) v -= 12;
    while (vocalMedian - v > 7.5) v += 12;
    return Math.max(55, Math.min(79, v));
  });

  // 5-frame (~250ms) median smoothing to remove consonant plosive glitches while preserving real vocal melody steps
  const smoothed: (number | null)[] = new Array(totalFrames).fill(null);
  for (let f = 0; f < totalFrames; f++) {
    const win: number[] = [];
    for (let k = Math.max(0, f - 2); k <= Math.min(totalFrames - 1, f + 2); k++) {
      if (folded[k] !== null) win.push(folded[k]!);
    }
    if (win.length >= 3) {
      win.sort((a, b) => a - b);
      smoothed[f] = win[Math.floor(win.length / 2)]!;
    }
  }

  return {
    hopSec: HOP_SEC,
    frames: smoothed,
    vocalMedian,
    introOffsetSec,
  };
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

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const VOCAL_MAJOR = [0, 2, 4, 5, 7, 9, 11, 12];

/**
 * Builds vocal guide bars over synced lyric lines:
 * - When `contour` (real extracted studio vocal F0) is provided, every syllable bar gets the ACTUAL sung MIDI pitch
 *   from the original singer's vocal recording!
 * - While audio decoding is still in flight, uses a clean mid-vocal register (C4–C5, MIDI 60–72) placeholder.
 */
function buildBarsFromSyncedLines(
  trackId: string,
  songKey: string,
  lines: ParsedLine[],
  karaokeDuration: number,
  studioDuration: number | undefined,
  lrcDuration: number | undefined,
  contour: StudioVocalContour | null,
): VocalGuideTrack {
  // Determine how LRC timestamps relate to the Karaoke video timeline vs Studio audio timeline
  let lrcToKaraokeOffset = 0;
  if (contour) {
    const lrcMatchesStudio =
      lrcDuration && studioDuration
        ? Math.abs(lrcDuration - studioDuration) <= Math.abs(lrcDuration - karaokeDuration) + 1.5
        : true;
    lrcToKaraokeOffset = lrcMatchesStudio ? contour.introOffsetSec : 0;
  } else if (lrcDuration && karaokeDuration > 30) {
    const diff = karaokeDuration - lrcDuration;
    if (diff >= 1.5 && diff <= 14) lrcToKaraokeOffset = Number((diff * 0.65).toFixed(2));
  }

  const fallbackTonic = 62 + (hashStr(songKey.toLowerCase()) % 4); // D4..F4 (62..65) — strictly real vocal range!
  const bars: GuideBar[] = [];
  let lastMidi = contour?.vocalMedian ?? fallbackTonic + 2;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const units = splitIntoSingableUnits(line.text);
    if (!units.length) continue;

    const startKaraokeSec = Math.max(0.4, line.time + lrcToKaraokeOffset);
    const nextKaraokeSec =
      i + 1 < lines.length
        ? lines[i + 1]!.time + lrcToKaraokeOffset
        : Math.min(startKaraokeSec + 4.2, Math.max(startKaraokeSec + 1.6, karaokeDuration - 3));
    const availableGap = Math.max(0.55, nextKaraokeSec - startKaraokeSec);
    const naturalVocalDur = units.length * 0.35 + 0.32;
    const phraseDur = Math.min(availableGap - 0.18, naturalVocalDur, 4.4);
    if (phraseDur < 0.25) continue;

    if (units.length >= 2) units[units.length - 1]!.weight *= 1.3;
    const totalWeight = units.reduce((acc, u) => acc + u.weight, 0) || 1;
    let cursor = startKaraokeSec;

    for (let u = 0; u < units.length; u++) {
      const sliceDur = (units[u]!.weight / totalWeight) * phraseDur;
      const noteDur = Math.max(0.13, sliceDur - 0.04);
      let midi = lastMidi;

      if (contour) {
        // Sample the actual studio singer's pitch at the corresponding studio timestamp!
        const studioStart = cursor - contour.introOffsetSec;
        const studioEnd = studioStart + sliceDur;
        const f0 = Math.max(0, Math.floor((studioStart - 0.08) / contour.hopSec));
        const f1 = Math.min(contour.frames.length - 1, Math.ceil((studioEnd + 0.08) / contour.hopSec));
        const samples: number[] = [];
        for (let f = f0; f <= f1; f++) {
          const val = contour.frames[f];
          if (val !== null && val !== undefined) samples.push(val);
        }
        if (samples.length > 0) {
          samples.sort((a, b) => a - b);
          midi = Math.round(samples[Math.floor(samples.length / 2)]!);
        } else {
          // Search nearby ±0.35s in studio vocal contour if singer attacked slightly ahead/behind LRC line stamp
          const near0 = Math.max(0, f0 - 7);
          const near1 = Math.min(contour.frames.length - 1, f1 + 7);
          const near: number[] = [];
          for (let f = near0; f <= near1; f++) {
            const val = contour.frames[f];
            if (val !== null && val !== undefined) near.push(val);
          }
          if (near.length > 0) {
            near.sort((a, b) => a - b);
            midi = Math.round(near[Math.floor(near.length / 2)]!);
          }
        }
      } else {
        // Gentle melodic arch in mid-vocal register until real studio audio decode completes (<1s)
        const arch = Math.sin((u / Math.max(1, units.length - 1)) * Math.PI);
        const deg = Math.min(VOCAL_MAJOR.length - 1, Math.max(0, Math.round(arch * 3) + (i % 2)));
        midi = fallbackTonic + (VOCAL_MAJOR[deg] ?? 0);
      }

      lastMidi = midi;
      bars.push({
        start: Number(cursor.toFixed(3)),
        end: Number((cursor + noteDur).toFixed(3)),
        midi: Math.max(55, Math.min(79, midi)),
        syllable: units[u]!.label,
      });
      cursor += sliceDur;
    }
  }

  return {
    trackId,
    source: contour ? "studio-vocal" : bars.length > 0 ? "synced" : "live-only",
    firstVocalSec: bars[0]?.start ?? null,
    bars,
  };
}

/** Fallback when LRCLIB has no synced LRC: segments the Studio-minus-Karaoke vocal contour directly into note bars! */
function buildBarsFromContourOnly(trackId: string, contour: StudioVocalContour, karaokeDuration: number): VocalGuideTrack {
  const bars: GuideBar[] = [];
  let segStart = -1;
  let segMidis: number[] = [];

  const flush = (endFrame: number) => {
    if (segStart < 0 || segMidis.length < 4) {
      segStart = -1;
      segMidis = [];
      return;
    }
    const startSec = segStart * contour.hopSec + contour.introOffsetSec;
    const endSec = endFrame * contour.hopSec + contour.introOffsetSec;
    if (startSec >= 0.5 && endSec <= karaokeDuration - 1 && endSec - startSec >= 0.18) {
      const sorted = [...segMidis].sort((a, b) => a - b);
      const midi = Math.max(55, Math.min(79, Math.round(sorted[Math.floor(sorted.length / 2)]!)));
      bars.push({
        start: Number(startSec.toFixed(3)),
        end: Number(endSec.toFixed(3)),
        midi,
      });
    }
    segStart = -1;
    segMidis = [];
  };

  for (let f = 0; f < contour.frames.length; f++) {
    const m = contour.frames[f];
    if (m === null || m === undefined) {
      flush(f);
      continue;
    }
    if (segStart < 0) {
      segStart = f;
      segMidis = [m];
    } else {
      const curMed = segMidis[Math.floor(segMidis.length / 2)]!;
      if (Math.abs(m - curMed) >= 1.35 || (f - segStart) * contour.hopSec >= 1.1) {
        flush(f);
        segStart = f;
        segMidis = [m];
      } else {
        segMidis.push(m);
      }
    }
  }
  flush(contour.frames.length);

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
  targetDuration: number,
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
          const da = (targetDuration && a.duration ? Math.abs(a.duration - targetDuration) : 20) + aArt;
          const db = (targetDuration && b.duration ? Math.abs(b.duration - targetDuration) : 20) + bArt;
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

/**
 * Loads the real Lead-Vocal Pitch Guide for `track`:
 * 1) Resolves canonical studio vocal song via YouTube Music + synced LRCLIB lyrics for instant phrase timing.
 * 2) Decodes the original studio vocal recording (and aligns against karaoke intro splash offset) to extract
 *    the singer's actual vocal melody notes in real human singing register (G3..G5) — never bass/instrumental!
 */
export function loadVocalGuide(track: Track): Promise<VocalGuideTrack> {
  const cached = guideCache.get(track.id);
  if (cached && cached.source === "studio-vocal") return Promise.resolve(cached);
  const existing = inflight.get(track.id);
  if (existing) return existing;

  const job = (async (): Promise<VocalGuideTrack> => {
    const parsedMeta = parseKaraokeMetadata(track);
    const studioSong = await findOriginalStudioSong(track, parsedMeta.query);

    const canonicalTitle = studioSong?.title || parsedMeta.titleHint;
    const canonicalArtist = studioSong?.artist || parsedMeta.artistHint;
    const songKey = `${canonicalArtist}:${canonicalTitle}`;

    const lrcResult = await fetchSyncedLrcLines(
      canonicalTitle,
      canonicalArtist,
      parsedMeta.query,
      studioSong?.duration || track.duration || 220,
    );

    // Stage 1: Publish preliminary vocal-register bars immediately so singer isn't waiting while audio decodes
    let currentGuide: VocalGuideTrack = {
      trackId: track.id,
      source: "live-only",
      firstVocalSec: null,
      bars: [],
    };
    if (lrcResult && lrcResult.lines.length >= 4) {
      currentGuide = buildBarsFromSyncedLines(
        track.id,
        songKey,
        lrcResult.lines,
        track.duration || studioSong?.duration || 220,
        studioSong?.duration,
        lrcResult.lrcDuration,
        null,
      );
      notifyGuide(track.id, currentGuide);
    }

    // Stage 2: Decode the Original Studio Vocal Recording (+ Karaoke intro for exact splash-screen alignment!)
    if (studioSong) {
      const needKaraokeAlign = studioSong.id !== track.id;
      const [studioBytes, karaokeIntroBytes] = await Promise.all([
        fetchTrackAudioBytes(studioSong.id),
        needKaraokeAlign ? fetchTrackAudioBytes(track.id, 1024 * 1024) : Promise.resolve(null),
      ]);

      if (studioBytes) {
        const [studioPcm, karaokePcm] = await Promise.all([
          decodeToStereo16k(studioBytes),
          karaokeIntroBytes ? decodeToStereo16k(karaokeIntroBytes) : Promise.resolve(null),
        ]);

        if (studioPcm) {
          const contour = extractStudioVocalContour(studioPcm, karaokePcm);
          const hiFiGuide =
            lrcResult && lrcResult.lines.length >= 4
              ? buildBarsFromSyncedLines(
                  track.id,
                  songKey,
                  lrcResult.lines,
                  track.duration || studioSong.duration || 220,
                  studioSong.duration,
                  lrcResult.lrcDuration,
                  contour,
                )
              : buildBarsFromContourOnly(track.id, contour, track.duration || studioSong.duration || 220);

          if (hiFiGuide.bars.length >= 4) {
            notifyGuide(track.id, hiFiGuide);
            return hiFiGuide;
          }
        }
      }
    }

    notifyGuide(track.id, currentGuide);
    return currentGuide;
  })().finally(() => {
    inflight.delete(track.id);
  });

  inflight.set(track.id, job);
  return job;
}

export function getCachedVocalGuide(trackId: string): VocalGuideTrack | null {
  return guideCache.get(trackId) ?? null;
}
