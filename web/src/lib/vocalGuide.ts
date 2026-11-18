import type { Track } from "./types";

export interface GuideBar {
  /** Start time in track seconds */
  start: number;
  /** End time in track seconds */
  end: number;
  /** Base MIDI note in comfortable mid-register (C4 = 60); auto-octaves to singer's voice */
  midi: number;
  /** Sung word/syllable for this note */
  syllable?: string;
}

export interface VocalGuideTrack {
  trackId: string;
  /** "synced" when real vocal timestamps were loaded; "live-only" when no synced vocal map exists */
  source: "synced" | "live-only";
  firstVocalSec: number | null;
  bars: GuideBar[];
}

const guideCache = new Map<string, VocalGuideTrack>();
const inflight = new Map<string, Promise<VocalGuideTrack>>();

const KARAOKE_CHANNEL_WORDS =
  /\b(?:sing\s*king(?:\s*karaoke)?|covers\s*ph|karafun(?:\s*karaoke)?|acoustic\s*heaven|my\s*all\s*(?:time\s*)?karaoke|myallkaraoke|stingray(?:\s*karaoke)?|the\s*karaoke\s*channel|zoom\s*karaoke|sunfly|platinum\s*karaoke|magic\s*sing|megapro|atomic\s*karaoke|we\s*sing)\b/gi;

const KARAOKE_TAG_PARENS =
  /\s*[([](?:[^)\]]*\b(?:karaoke|videoke|instrumental|off\s*vocal|backing\s*track|minus\s*one|lyrics?|lyric\s*video|in\s*the\s*style\s*of|originally\s*performed\s*by|made\s*famous\s*by|lower\s*key|higher\s*key|female\s*key|male\s*key|original\s*key|hd|4k|hq|official|version)\b[^)\]]*)[)\]]/gi;

const TRAILING_KARAOKE_TAGS =
  /\s*(?:[-–—:|•·]\s*|\b)(?:karaoke(?:\s*version|\s*instrumental|\s*track)?|videoke(?:\s*version)?|instrumental(?:\s*version)?|minus\s*one|off\s*vocal|with\s*lyrics|lyric\s*video)\s*$/gi;

/** Extracts clean { title, artist } from YouTube karaoke titles like "Miley Cyrus - Flowers (Karaoke Version)". */
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

  const parts = rawTitle
    .split(/\s+[-–—]\s+/)
    .map((p) => p.replace(TRAILING_KARAOKE_TAGS, "").trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    if (!rawArtist) {
      rawArtist = parts[0];
      rawTitle = parts.slice(1).join(" - ");
    } else {
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

const NON_VOCAL_MARKER_RX =
  /^(?:\[[^\]]*\]|\([^)]*\)|\{[^}]*\}|<[^>]*>|\b(?:intro|instrumental|interlude|music|guitar\s*solo|piano\s*solo|solo|break|dance\s*break|outro|end|fade\s*out|verse\s*\d*|chorus|pre-?chorus|bridge|hook)\b[\s.:!-]*)+$/i;

const CREDIT_LINE_RX =
  /\b(?:lyrics?\s*by|written\s*by|composed\s*by|arranged\s*by|produced\s*by|synced\s*by|transcribed\s*by|lrc\s*by|karaoke|instrumental|www\.|\.com|\.net|http)\b/i;

/** Returns true if an LRC line is an instrumental marker, stage direction, or title/credit header rather than sung vocals. */
function isNonVocalLine(text: string, time: number, songTitle: string, songArtist: string): boolean {
  const cleaned = text
    .replace(/[♪♫♬♩~•·*_=+\-—–.,!?'"`()[\]{}\s]/g, "")
    .trim();
  if (!cleaned) return true;
  if (NON_VOCAL_MARKER_RX.test(text.trim())) return true;
  if (CREDIT_LINE_RX.test(text)) return true;

  // Strip bracketed cues like "[Verse 1] Hello" -> check remaining words
  const withoutBrackets = text
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\((?:instrumental|music|intro|interlude|solo|outro|break|guitar|piano)[^)]*\)/gi, " ")
    .trim();
  if (!withoutBrackets) return true;

  // Many LRC files put "Artist - Song Title" at 00:00-00:06 during the instrumental intro
  if (time < 7.5 && songTitle) {
    const normLine = withoutBrackets.toLowerCase();
    const normTitle = songTitle.toLowerCase();
    const normArtist = songArtist.toLowerCase();
    if (normArtist && normLine.includes(normTitle) && normLine.includes(normArtist)) {
      return true;
    }
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
    const rawText = rawLine
      .slice(lastIdx)
      .replace(/^[♪♫♬♩\s]+|[♪♫♬♩\s]+$/g, "")
      .trim();
    if (!rawText) continue;

    for (const t of times) {
      if (isNonVocalLine(rawText, t, songTitle, songArtist)) continue;
      const vocalText = rawText
        .replace(/\[[^\]]*\]/g, " ")
        .replace(/\((?:instrumental|music|intro|interlude|solo|outro|break)[^)]*\)/gi, " ")
        .replace(/\s{2,}/g, " ")
        .trim();
      if (vocalText) {
        out.push({ time: t, text: vocalText });
      }
    }
  }
  return out.sort((a, b) => a.time - b.time);
}

/** Splits a sung lyric line into singable word/syllable note units (never empty/instrumental). */
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

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10, 12, 14, 15];

/**
 * Builds vocal-only guide bars strictly over sung lyric phrases.
 * Instrumental intros, mid-song solos/breaks, and outros remain 100% empty!
 */
function buildGuideFromLines(
  trackId: string,
  songKeySeed: string,
  lines: ParsedLine[],
  trackDuration: number,
  lrcDuration?: number,
): VocalGuideTrack {
  const seed = hashStr(songKeySeed.toLowerCase());
  const tonicMidi = 57 + (seed % 6);
  const scale = seed % 3 === 0 ? MINOR_SCALE : MAJOR_SCALE;

  // Align title-card intro offset if karaoke video has a 2-7s splash screen compared to studio track
  let offset = 0;
  if (lrcDuration && trackDuration > 30) {
    const diff = trackDuration - lrcDuration;
    if (diff >= 1.5 && diff <= 7.0) offset = Math.round(diff * 0.55 * 10) / 10;
  }

  const lineFreq = new Map<string, number>();
  for (const l of lines) {
    const norm = l.text.toLowerCase();
    lineFreq.set(norm, (lineFreq.get(norm) ?? 0) + 1);
  }

  const motifCache = new Map<string, number[]>();
  const bars: GuideBar[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const units = splitIntoSingableUnits(line.text);
    if (!units.length) continue;

    const startSec = Math.max(0.5, line.time + offset);
    const nextLineSec =
      i + 1 < lines.length
        ? lines[i + 1].time + offset
        : Math.min(startSec + 4.0, Math.max(startSec + 1.5, trackDuration - 4));
    const availableGap = Math.max(0.55, nextLineSec - startSec);

    // Strictly size phrase duration to actual syllable count so long instrumental gaps stay 100% empty!
    const naturalVocalDur = units.length * 0.33 + 0.28;
    const phraseDur = Math.min(availableGap - 0.22, naturalVocalDur, 4.1);
    if (phraseDur < 0.25) continue;

    const normKey = line.text.toLowerCase();
    const isChorus = (lineFreq.get(normKey) ?? 1) >= 2;

    let degrees = motifCache.get(normKey);
    if (!degrees || degrees.length !== units.length) {
      const lineRng = mulberry32(hashStr(`${songKeySeed}:${normKey}`));
      degrees = [];
      let deg = isChorus ? 4 + Math.floor(lineRng() * 3) : 1 + Math.floor(lineRng() * 3);
      for (let u = 0; u < units.length; u++) {
        const progress = units.length > 1 ? u / (units.length - 1) : 1;
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

    if (units.length >= 2) {
      units[units.length - 1].weight *= 1.35;
    }
    const totalWeight = units.reduce((acc, u) => acc + u.weight, 0) || 1;
    let cursor = startSec;

    for (let u = 0; u < units.length; u++) {
      const sliceDur = (units[u].weight / totalWeight) * phraseDur;
      const noteDur = Math.max(0.12, sliceDur - 0.045);
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
  }

  return {
    trackId,
    source: bars.length > 0 ? "synced" : "live-only",
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

/** Loads vocal-only target note bars synced to real lyric phrases (never generates bars during instrumentals). */
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
      urls.push(
        `https://lrclib.net/api/search?q=${encodeURIComponent(`${title} ${artist}`)}`,
      );
    }
    if (title) {
      urls.push(`https://lrclib.net/api/search?q=${encodeURIComponent(title)}`);
    }

    for (const url of urls) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
        if (!res.ok) continue;
        const hits = (await res.json()) as LrcSearchHit[];
        if (!Array.isArray(hits) || !hits.length) continue;

        const withSynced = hits
          .filter((h) => !h.instrumental && typeof h.syncedLyrics === "string" && h.syncedLyrics.trim().length > 20)
          .sort((a, b) => {
            const artistMatchA =
              artist && a.artistName?.toLowerCase().includes(artist.toLowerCase()) ? -12 : 0;
            const artistMatchB =
              artist && b.artistName?.toLowerCase().includes(artist.toLowerCase()) ? -12 : 0;
            const da = (track.duration && a.duration ? Math.abs(a.duration - track.duration) : 25) + artistMatchA;
            const db = (track.duration && b.duration ? Math.abs(b.duration - track.duration) : 25) + artistMatchB;
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
            const built = buildGuideFromLines(
              track.id,
              `${artist || candidate.artistName || ""}:${title || candidate.trackName || ""}`,
              parsed,
              track.duration || candidate.duration || 200,
              candidate.duration,
            );
            if (built.bars.length >= 4) {
              guideCache.set(track.id, built);
              return built;
            }
          }
        }
      } catch {
        /* try next search query */
      }
    }

    const liveOnly: VocalGuideTrack = {
      trackId: track.id,
      source: "live-only",
      firstVocalSec: null,
      bars: [],
    };
    guideCache.set(track.id, liveOnly);
    return liveOnly;
  })().finally(() => {
    inflight.delete(track.id);
  });

  inflight.set(track.id, job);
  return job;
}

export function getCachedVocalGuide(trackId: string): VocalGuideTrack | null {
  return guideCache.get(trackId) ?? null;
}
