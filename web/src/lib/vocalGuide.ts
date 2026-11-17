import type { Track } from "./types";

export interface GuideBar {
  /** Start time in track seconds */
  start: number;
  /** End time in track seconds */
  end: number;
  /** Base MIDI note in default mid-register (C4 = 60); auto-octaves to singer's voice */
  midi: number;
  /** Short syllable/word hint if synced lyrics were matched */
  syllable?: string;
}

export interface VocalGuideTrack {
  trackId: string;
  source: "synced" | "generated";
  /** First vocal entry timestamp (seconds), used for intro countdown */
  firstVocalSec: number;
  bars: GuideBar[];
}

const guideCache = new Map<string, VocalGuideTrack>();
const inflight = new Map<string, Promise<VocalGuideTrack>>();

const KARAOKE_CHANNEL_WORDS =
  /\b(?:sing\s*king(?:\s*karaoke)?|covers\s*ph|karafun(?:\s*karaoke)?|acoustic\s*heaven|my\s*all\s*(?:time\s*)?karaoke|stingray(?:\s*karaoke)?|the\s*karaoke\s*channel|zoom\s*karaoke|sunfly|platinum\s*karaoke|magic\s*sing|megapro)\b/gi;

const KARAOKE_TAG_PARENS =
  /\s*[([](?:[^)\]]*\b(?:karaoke|instrumental|off\s*vocal|backing\s*track|minus\s*one|lyrics?|lyric\s*video|acoustic|piano|guitar|lower\s*key|higher\s*key|female\s*key|male\s*key|original\s*key|hd|4k|hq|official)\b[^)\]]*)[)\]]/gi;

const TRAILING_KARAOKE_TAGS =
  /\s*(?:[-–—:|•·]\s*|\b)(?:karaoke(?:\s*version|\s*instrumental|\s*track)?|instrumental(?:\s*version)?|minus\s*one|off\s*vocal|with\s*lyrics|lyric\s*video)\s*$/gi;

/** Extracts clean { title, artist } from messy YouTube karaoke titles like "Miley Cyrus - Flowers (Karaoke Version)". */
export function parseKaraokeMetadata(track: Track): { title: string; artist: string } {
  let rawTitle = track.title
    .replace(KARAOKE_TAG_PARENS, " ")
    .replace(KARAOKE_CHANNEL_WORDS, " ")
    .replace(TRAILING_KARAOKE_TAGS, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  let rawArtist = track.artist
    .replace(KARAOKE_CHANNEL_WORDS, " ")
    .replace(/\s*-\s*Topic$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  // Most karaoke videos encode "Artist - Song Title" inside track.title while track.artist is the karaoke channel.
  const parts = rawTitle
    .split(/\s+[-–—]\s+/)
    .map((p) => p.replace(TRAILING_KARAOKE_TAGS, "").trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    if (!rawArtist) {
      rawArtist = parts[0];
      rawTitle = parts.slice(1).join(" - ");
    } else {
      // If one side matches rawArtist, the other is the title; otherwise assume "Artist - Title"
      const p0Lower = parts[0].toLowerCase();
      const p1Lower = parts[1].toLowerCase();
      const artLower = rawArtist.toLowerCase();
      if (p1Lower.includes(artLower)) {
        rawTitle = parts[0];
      } else if (p0Lower.includes(artLower)) {
        rawTitle = parts.slice(1).join(" - ");
      } else {
        rawArtist = parts[0];
        rawTitle = parts.slice(1).join(" - ");
      }
    }
  }

  return {
    title: rawTitle || track.title,
    artist: rawArtist,
  };
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface ParsedLine {
  time: number;
  text: string;
}

function parseLrcLines(lrc: string): ParsedLine[] {
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
    const text = rawLine
      .slice(lastIdx)
      .replace(/^[♪♫♬\s]+|[♪♫♬\s]+$/g, "")
      .trim();
    if (!text) continue;
    for (const t of times) out.push({ time: t, text });
  }
  return out.sort((a, b) => a.time - b.time);
}

/** Splits a lyric line into singable word/syllable chunks for realistic karaoke note bars. */
function splitIntoSingableUnits(text: string): { label: string; weight: number }[] {
  const words = text
    .replace(/[^\p{L}\p{N}'\s-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return [{ label: "♪", weight: 1 }];

  const units: { label: string; weight: number }[] = [];
  for (const w of words) {
    const vowelGroups = w.match(/[aeiouyáéíóúàèìòùâêîôûäëïöü]+/gi);
    const syllables = Math.max(1, Math.min(3, vowelGroups ? vowelGroups.length : 1));
    if (syllables === 1 || w.length <= 5) {
      units.push({ label: w, weight: w.length >= 4 ? 1.25 : 1 });
    } else if (syllables === 2) {
      const mid = Math.ceil(w.length / 2);
      units.push({ label: `${w.slice(0, mid)}-`, weight: 0.95 });
      units.push({ label: w.slice(mid), weight: 1.15 });
    } else {
      const third = Math.ceil(w.length / 3);
      units.push({ label: `${w.slice(0, third)}-`, weight: 0.85 });
      units.push({ label: `${w.slice(third, third * 2)}-`, weight: 0.9 });
      units.push({ label: w.slice(third * 2), weight: 1.2 });
    }
    if (units.length >= 14) break;
  }
  return units;
}

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10, 12, 14, 15];

/**
 * Builds musical, phrase-consistent guide bars from synced LRC lines.
 * Repeated lines (chorus hooks!) receive the exact same melodic motif.
 */
function buildGuideFromLines(
  trackId: string,
  songKeySeed: string,
  lines: ParsedLine[],
  trackDuration: number,
  lrcDuration?: number,
): VocalGuideTrack {
  const seed = hashStr(songKeySeed.toLowerCase());
  const rng = mulberry32(seed);
  // Root between G3 (55) and D4 (62) so phrases sit comfortably in C4-C5 (58..74)
  const tonicMidi = 57 + (seed % 6);
  const scale = seed % 3 === 0 ? MINOR_SCALE : MAJOR_SCALE;

  // Detect small title-card offset if karaoke video is 2-7s longer than studio audio
  let offset = 0;
  if (lrcDuration && trackDuration > 30) {
    const diff = trackDuration - lrcDuration;
    if (diff >= 1.5 && diff <= 6.5) offset = Math.round(diff * 0.5 * 10) / 10;
  }

  // Count line occurrences so chorus lines (>1 occurrence) lift into the chorus register
  const lineFreq = new Map<string, number>();
  for (const l of lines) {
    const norm = l.text.toLowerCase();
    lineFreq.set(norm, (lineFreq.get(norm) ?? 0) + 1);
  }

  const motifCache = new Map<string, number[]>();
  const bars: GuideBar[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const startSec = Math.max(0.5, line.time + offset);
    const nextLineSec = i + 1 < lines.length ? lines[i + 1].time + offset : Math.max(startSec + 3.5, trackDuration - 3);
    const gap = Math.max(0.8, nextLineSec - startSec);
    // Typical sung phrase occupies ~78% of the interval up to max 5.2s, leaving breath space
    const phraseDur = Math.min(gap * 0.82, 5.2, Math.max(0.7, gap - 0.28));

    const units = splitIntoSingableUnits(line.text);
    const normKey = line.text.toLowerCase();
    const isChorus = (lineFreq.get(normKey) ?? 1) >= 2;

    let degrees = motifCache.get(normKey);
    if (!degrees || degrees.length !== units.length) {
      const lineRng = mulberry32(hashStr(`${songKeySeed}:${normKey}`));
      degrees = [];
      let deg = isChorus ? 4 + Math.floor(lineRng() * 3) : 1 + Math.floor(lineRng() * 3);
      for (let u = 0; u < units.length; u++) {
        const progress = units.length > 1 ? u / (units.length - 1) : 1;
        // Natural arch contour: rise toward middle of line, resolve near end
        if (u === units.length - 1) {
          deg = i % 2 === 1 ? (isChorus ? 4 : 0) : Math.max(0, deg - 1);
        } else {
          const bias = progress < 0.55 ? 0.58 : 0.4;
          const r = lineRng();
          const step = r < 0.25 ? 0 : r < bias + 0.2 ? 1 : -1;
          deg = Math.max(0, Math.min(scale.length - 1, deg + step));
        }
        degrees.push(deg);
      }
      motifCache.set(normKey, degrees);
    }

    // Hold final note of phrase slightly longer
    if (units.length >= 2) {
      units[units.length - 1].weight *= 1.45;
    }
    const totalWeight = units.reduce((acc, u) => acc + u.weight, 0) || 1;
    let cursor = startSec;

    for (let u = 0; u < units.length; u++) {
      const sliceDur = (units[u].weight / totalWeight) * phraseDur;
      const noteDur = Math.max(0.14, sliceDur - 0.04);
      const deg = degrees[u] ?? 2;
      const midi = tonicMidi + (scale[deg] ?? 0);
      bars.push({
        start: Number(cursor.toFixed(3)),
        end: Number((cursor + noteDur).toFixed(3)),
        midi,
        syllable: units[u].label,
      });
      cursor += sliceDur;
    }
    void rng;
  }

  return {
    trackId,
    source: "synced",
    firstVocalSec: bars[0]?.start ?? 6,
    bars,
  };
}

/** Fallback musical guide phrases when offline or when LRCLIB has no synced timestamps for a track. */
function buildFallbackGuide(track: Track): VocalGuideTrack {
  const { title, artist } = parseKaraokeMetadata(track);
  const seed = hashStr(`${artist}:${title}`.toLowerCase());
  const rng = mulberry32(seed);
  const tonicMidi = 58 + (seed % 5);
  const scale = seed % 3 === 0 ? MINOR_SCALE : MAJOR_SCALE;

  const dur = track.duration && track.duration > 35 ? track.duration : 210;
  const introSec = Math.min(10, Math.max(5, Math.round(dur * 0.045)));
  const outroStop = Math.max(introSec + 16, dur - 8);

  const bars: GuideBar[] = [];
  let t = introSec;
  let phraseIdx = 0;

  while (t < outroStop) {
    // Occasional 4-second instrumental breather between 4-line sections
    if (phraseIdx > 0 && phraseIdx % 8 === 0) {
      t += 3.6;
      if (t >= outroStop) break;
    }
    const isChorus = Math.floor(phraseIdx / 4) % 2 === 1;
    const notesInPhrase = 5 + Math.floor(rng() * 4);
    let deg = isChorus ? 4 : 2;

    for (let n = 0; n < notesInPhrase && t < outroStop; n++) {
      const isLast = n === notesInPhrase - 1;
      const noteLen = isLast ? 0.75 + rng() * 0.45 : 0.28 + rng() * 0.26;
      if (isLast) {
        deg = phraseIdx % 2 === 1 ? 0 : 4;
      } else {
        const r = rng();
        const step = r < 0.28 ? 0 : r < 0.66 ? 1 : -1;
        deg = Math.max(0, Math.min(scale.length - 1, deg + step));
      }
      bars.push({
        start: Number(t.toFixed(3)),
        end: Number((t + noteLen - 0.045).toFixed(3)),
        midi: tonicMidi + scale[deg],
      });
      t += noteLen;
    }
    t += 0.65 + rng() * 0.45; // breath between phrases
    phraseIdx++;
  }

  return {
    trackId: track.id,
    source: "generated",
    firstVocalSec: bars[0]?.start ?? introSec,
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

/** Loads (or synthesizes) the scrolling vocal guide note track for a Videoke song. */
export function loadVocalGuide(track: Track): Promise<VocalGuideTrack> {
  const cached = guideCache.get(track.id);
  if (cached) return Promise.resolve(cached);
  const existing = inflight.get(track.id);
  if (existing) return existing;

  const job = (async (): Promise<VocalGuideTrack> => {
    const { title, artist } = parseKaraokeMetadata(track);
    const urls: string[] = [];
    if (title && artist) {
      urls.push(
        `https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`,
      );
    }
    urls.push(`https://lrclib.net/api/search?q=${encodeURIComponent([title, artist].filter(Boolean).join(" "))}`);

    for (const url of urls) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5500) });
        if (!res.ok) continue;
        const hits = (await res.json()) as LrcSearchHit[];
        if (!Array.isArray(hits) || !hits.length) continue;

        const withSynced = hits
          .filter((h) => !h.instrumental && typeof h.syncedLyrics === "string" && h.syncedLyrics.trim().length > 20)
          .sort((a, b) => {
            const da = track.duration && a.duration ? Math.abs(a.duration - track.duration) : 30;
            const db = track.duration && b.duration ? Math.abs(b.duration - track.duration) : 30;
            return da - db;
          });

        const best = withSynced[0];
        if (best?.syncedLyrics) {
          const parsed = parseLrcLines(best.syncedLyrics);
          if (parsed.length >= 4) {
            const built = buildGuideFromLines(
              track.id,
              `${artist || best.artistName || ""}:${title || best.trackName || ""}`,
              parsed,
              track.duration || best.duration || 200,
              best.duration,
            );
            guideCache.set(track.id, built);
            return built;
          }
        }
      } catch {
        /* fall through to next query or generated fallback */
      }
    }

    const fallback = buildFallbackGuide(track);
    guideCache.set(track.id, fallback);
    return fallback;
  })().finally(() => {
    inflight.delete(track.id);
  });

  inflight.set(track.id, job);
  return job;
}

/** Immediate synchronous preview guide while LRCLIB resolves in the background, so the display is NEVER empty. */
export function getImmediateFallbackGuide(track: Track): VocalGuideTrack {
  return guideCache.get(track.id) ?? buildFallbackGuide(track);
}
