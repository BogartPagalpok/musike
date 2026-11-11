import { useEffect, useRef, useState } from "react";
import { MicrophoneStageIcon } from "@phosphor-icons/react";
import { useT } from "../i18n";
import { cn } from "../lib/format";
import type { Track } from "../lib/types";
import { selectCurrent, usePlayer } from "../player/player";

export interface LyricLine {
  time: number;
  text: string;
}

export interface LyricsData {
  synced: LyricLine[];
  plain: string[];
  instrumental?: boolean;
  /** Studio track duration from LRCLIB (seconds), used to detect music video intro offsets. */
  duration?: number;
}

type TimeSegment = [number, number];

const lyricsCache = new Map<string, LyricsData | "none">();
const inflightLyrics = new Map<string, Promise<LyricsData | "none">>();
const nonMusicCache = new Map<string, TimeSegment[]>();
const inflightNonMusic = new Map<string, Promise<TimeSegment[]>>();

/**
 * Fetches non-music / intro skit segments for a YouTube video from SponsorBlock
 * so lyrics don't start during non-music cinematic intros or interludes of music videos.
 */
function fetchNonMusicSegments(videoId: string): Promise<TimeSegment[]> {
  const cached = nonMusicCache.get(videoId);
  if (cached) return Promise.resolve(cached);
  const existing = inflightNonMusic.get(videoId);
  if (existing) return existing;

  const job = (async (): Promise<TimeSegment[]> => {
    try {
      const categories = encodeURIComponent(JSON.stringify(["music_offtopic", "intro"]));
      const res = await fetch(`https://sponsor.ajay.app/api/skipSegments?videoID=${encodeURIComponent(videoId)}&categories=${categories}`, {
        signal: AbortSignal.timeout(4500),
      });
      if (!res.ok) {
        nonMusicCache.set(videoId, []);
        return [];
      }
      const data = (await res.json()) as Array<{ segment?: [number, number]; category?: string }>;
      if (!Array.isArray(data)) {
        nonMusicCache.set(videoId, []);
        return [];
      }
      // Merge overlapping segments and keep only valid ranges (exclude end-of-video outros)
      const raw = data
        .map((d) => d.segment)
        .filter((s): s is [number, number] => Array.isArray(s) && s.length === 2 && s[1] > s[0] && s[1] - s[0] >= 1.5)
        .sort((a, b) => a[0] - b[0]);

      const merged: TimeSegment[] = [];
      for (const seg of raw) {
        const prev = merged[merged.length - 1];
        if (prev && seg[0] <= prev[1] + 0.5) {
          prev[1] = Math.max(prev[1], seg[1]);
        } else {
          merged.push([seg[0], seg[1]]);
        }
      }
      nonMusicCache.set(videoId, merged);
      return merged;
    } catch {
      return [];
    }
  })().finally(() => inflightNonMusic.delete(videoId));

  inflightNonMusic.set(videoId, job);
  return job;
}

function cleanTitle(raw: string): string {
  return raw
    .replace(/\s*\((?:official|lyric|audio|video|visualizer|live|remaster|feat|ft|prod|with|hd|4k)[^)]*\)/gi, "")
    .replace(/\s*\[(?:official|lyric|audio|video|visualizer|live|remaster|feat|ft|prod|with|hd|4k)[^\]]*\]/gi, "")
    .replace(/\s*-\s*(?:official|lyric|audio|music\s+video).*$/i, "")
    .trim();
}

function cleanArtist(raw: string): string {
  return (raw.split(/[,&•·]|(?:\s+(?:feat|ft)\.?\s+)/i)[0] ?? raw)
    .replace(/\s*-\s*Topic$/i, "")
    .trim();
}

function parseLrc(lrc: string): LyricLine[] {
  const out: LyricLine[] = [];
  const rx = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
  for (const rawLine of lrc.split(/\r?\n/)) {
    rx.lastIndex = 0;
    const times: number[] = [];
    let match: RegExpExecArray | null;
    let lastIdx = 0;
    while ((match = rx.exec(rawLine)) !== null) {
      const mins = Number(match[1]);
      const secs = Number(match[2]);
      const msStr = match[3] ?? "0";
      const frac = Number(msStr) / Math.pow(10, msStr.length);
      times.push(mins * 60 + secs + frac);
      lastIdx = rx.lastIndex;
    }
    if (!times.length) continue;
    const text = rawLine.slice(lastIdx).trim();
    // Skip empty timestamp markers (e.g. "[00:00.20] ") so lyrics don't highlight before vocals start
    if (!text) continue;
    for (const time of times) {
      out.push({ time, text });
    }
  }
  return out.sort((a, b) => a.time - b.time);
}

interface LrcLibRecord {
  trackName?: string;
  artistName?: string;
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

function toLyricsData(rec: LrcLibRecord): LyricsData | null {
  if (rec.instrumental) return { synced: [], plain: [], instrumental: true, duration: rec.duration };
  const synced = rec.syncedLyrics ? parseLrc(rec.syncedLyrics) : [];
  const plain = rec.plainLyrics
    ? rec.plainLyrics
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l, i, arr) => l !== "" || (i > 0 && arr[i - 1] !== ""))
    : [];
  if (!synced.length && !plain.length) return null;
  return { synced, plain, duration: rec.duration };
}

async function fetchLyricsFor(track: Track): Promise<LyricsData | "none"> {
  const cached = lyricsCache.get(track.id);
  if (cached) return cached;
  const existing = inflightLyrics.get(track.id);
  if (existing) return existing;

  const job = (async (): Promise<LyricsData | "none"> => {
    const title = cleanTitle(track.title) || track.title;
    const artist = cleanArtist(track.artist) || track.artist;

    // 1. Try search with cleaned title + artist
    const queries = [
      `https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`,
      `https://lrclib.net/api/search?q=${encodeURIComponent(`${title} ${artist}`)}`,
    ];

    for (const url of queries) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
        if (!res.ok) continue;
        const list = (await res.json()) as LrcLibRecord[];
        if (!Array.isArray(list) || !list.length) continue;

        // Score candidates: prefer synced lyrics and close duration match
        const best = list
          .map((item) => {
            let score = 0;
            if (item.syncedLyrics) score += 10;
            else if (item.plainLyrics) score += 3;
            if (track.duration && item.duration) {
              const diff = Math.abs(item.duration - track.duration);
              if (diff <= 3) score += 6;
              else if (diff <= 10) score += 3;
              else if (diff > 30) score -= 4;
            }
            return { item, score };
          })
          .sort((a, b) => b.score - a.score)[0];

        if (best) {
          const parsed = toLyricsData(best.item);
          if (parsed) {
            lyricsCache.set(track.id, parsed);
            return parsed;
          }
        }
      } catch {
        /* try next query */
      }
    }

    lyricsCache.set(track.id, "none");
    return "none";
  })().finally(() => inflightLyrics.delete(track.id));

  inflightLyrics.set(track.id, job);
  return job;
}

/** Karaoke-style centered synchronized lyrics view with click-to-seek and smooth center auto-scroll. */
export function LyricsView({ className, compact = false }: { className?: string; compact?: boolean }) {
  const track = usePlayer(selectCurrent);
  const position = usePlayer((s) => s.position);
  const playerDuration = usePlayer((s) => s.duration);
  const mediaKind = usePlayer((s) => s.mediaKind);
  const activeMediaId = usePlayer((s) => s.activeMediaId);
  const seek = usePlayer((s) => s.seek);
  const t = useT();
  const [state, setState] = useState<"loading" | "none" | LyricsData>("loading");
  const [segments, setSegments] = useState<TimeSegment[]>([]);
  const [userOffset, setUserOffset] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const streamVideoId = activeMediaId ?? track?.id ?? null;
  const isVideoStream = mediaKind === "video" || track?.kind === "video";

  useEffect(() => {
    setUserOffset(0);
    if (!track) return;
    let cancelled = false;
    const cached = lyricsCache.get(track.id);
    if (cached) {
      setState(cached);
    } else {
      setState("loading");
      void fetchLyricsFor(track).then((res) => {
        if (!cancelled) setState(res);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [track?.id]);

  useEffect(() => {
    if (!streamVideoId || !isVideoStream) {
      setSegments([]);
      return;
    }
    let cancelled = false;
    const cached = nonMusicCache.get(streamVideoId);
    if (cached) {
      setSegments(cached);
      return;
    }
    void fetchNonMusicSegments(streamVideoId).then((segs) => {
      if (!cancelled) setSegments(segs);
    });
    return () => {
      cancelled = true;
    };
  }, [streamVideoId, isVideoStream]);

  // Compute non-music intro / interlude offset so music videos with skits or long intros stay in sync with studio LRC
  const videoDur = playerDuration || track?.duration || 0;
  const lrcDur = typeof state === "object" ? (state.duration ?? 0) : 0;

  // Only treat segments that start before the final 15% of the video as intro/interlude offsets (ignore outro credits)
  const introSegments = isVideoStream
    ? segments.filter(([start]) => (videoDur > 0 ? start < videoDur * 0.8 : start < 180))
    : [];

  let nonMusicElapsed = 0;
  let inNonMusicSegment = false;
  for (const [start, end] of introSegments) {
    if (position >= end) {
      nonMusicElapsed += end - start;
    } else if (position >= start) {
      nonMusicElapsed += position - start;
      inNonMusicSegment = true;
    }
  }

  // Fallback when SponsorBlock has no entry yet: if a music video is significantly longer than the studio track,
  // treat the extra duration as a music-video intro offset unless the user overrides it.
  const durationDiffOffset =
    isVideoStream && introSegments.length === 0 && lrcDur > 30 && videoDur - lrcDur >= 4.5 && videoDur - lrcDur <= 90
      ? videoDur - lrcDur
      : 0;

  const autoIntroOffset = introSegments.length > 0 ? nonMusicElapsed : durationDiffOffset;
  const totalOffset = autoIntroOffset + userOffset;
  const songTime = position - totalOffset;

  const firstLineTime = typeof state === "object" && state.synced.length > 0 ? state.synced[0]!.time : 0;
  const waitingForVocals =
    typeof state === "object" &&
    state.synced.length > 0 &&
    (inNonMusicSegment || songTime < firstLineTime);

  // Active synced line index (no early lead so lyrics never jump ahead of the vocals)
  let activeIdx = -1;
  if (typeof state === "object" && state.synced.length > 0 && !inNonMusicSegment) {
    for (let i = 0; i < state.synced.length; i++) {
      if (songTime >= state.synced[i]!.time) activeIdx = i;
      else break;
    }
  }

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (activeIdx < 0) {
      container.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const raf = requestAnimationFrame(() => {
      const el = lineRefs.current[activeIdx];
      const box = containerRef.current;
      if (!el || !box) return;
      const boxRect = box.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const targetTop = box.scrollTop + (elRect.top - boxRect.top) - boxRect.height / 2 + elRect.height / 2;
      box.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
    });
    return () => cancelAnimationFrame(raf);
  }, [activeIdx, track?.id, state]);

  if (!track) {
    return <p className="px-2 py-16 text-center text-sm text-fg-2">{t.nowPlaying.playSomething}</p>;
  }

  if (state === "loading") {
    return (
      <div
        aria-label={t.common.loading}
        className={cn("flex flex-col items-center gap-3.5 px-4", compact ? "py-4" : "py-8", className)}
      >
        {Array.from({ length: compact ? 5 : 8 }, (_, i) => (
          <span key={i} className="skeleton h-6 rounded-full" style={{ width: `${45 + ((i * 29) % 45)}%` }} />
        ))}
      </div>
    );
  }

  if (state === "none") {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2.5 px-4 text-center",
          compact ? "py-8" : "py-16",
          className,
        )}
      >
        <span className="grid size-11 place-items-center rounded-full bg-surface-2 text-fg-3 ring-1 ring-line">
          <MicrophoneStageIcon size={22} />
        </span>
        <p className="text-sm font-medium text-fg">{t.lyrics.notFound}</p>
        <p className="max-w-[28ch] text-xs text-fg-2">{t.lyrics.notFoundBody}</p>
      </div>
    );
  }

  if (state.instrumental) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 px-4 text-center",
          compact ? "py-8" : "py-16",
          className,
        )}
      >
        <span className="grid size-11 place-items-center rounded-full bg-surface-2 text-accent-text ring-1 ring-line">
          <MicrophoneStageIcon size={22} />
        </span>
        <p className="text-sm font-medium text-fg">{t.lyrics.instrumental}</p>
      </div>
    );
  }

  if (state.synced.length > 0) {
    // Total intro shift before a given song timestamp so clicking a lyric line seeks to the right point in the video
    const videoTimeFor = (lyricTime: number) => {
      let target = lyricTime + userOffset + durationDiffOffset;
      for (const [start, end] of introSegments) {
        if (target >= start) target += end - start;
      }
      return Math.max(0, target);
    };

    return (
      <div
        ref={containerRef}
        className={cn(
          "scroll-area relative flex min-h-0 flex-col items-center gap-3 overflow-y-auto overscroll-contain touch-pan-y px-4 text-center",
          compact ? "py-16" : "py-[28dvh] md:py-24",
          className,
        )}
      >
        {waitingForVocals && (
          <div className="mb-1 flex items-center gap-2 rounded-full bg-accent-soft px-3.5 py-1.5 text-xs font-semibold text-accent-text ring-1 ring-accent/30 animate-pulse">
            <span>{t.lyrics.waitingForVocals}</span>
          </div>
        )}
        {state.synced.map((line, i) => {
          const isCurrent = i === activeIdx;
          const isPast = activeIdx >= 0 && i < activeIdx;
          return (
            <button
              key={`${i}-${line.time}`}
              ref={(el) => {
                lineRefs.current[i] = el;
              }}
              type="button"
              onClick={() => seek(videoTimeFor(line.time))}
              className={cn(
                "w-full origin-center rounded-[12px] px-3 py-2 text-center leading-snug transition-all duration-300 hover:bg-surface-2/70 hover:opacity-100",
                isCurrent
                  ? compact
                    ? "scale-[1.03] text-[22px] font-extrabold tracking-tight text-accent-text drop-shadow-[0_0_16px_var(--accent-soft)] md:text-[17px]"
                    : "scale-[1.04] text-[24px] font-extrabold tracking-tight text-accent-text drop-shadow-[0_0_18px_var(--accent-soft)] sm:text-[26px] md:text-[20px]"
                  : isPast
                    ? compact
                      ? "text-[18px] font-semibold text-fg-3/60 md:text-[14px]"
                      : "text-[19px] font-semibold text-fg-3/60 sm:text-[20px] md:text-[16px]"
                    : compact
                      ? "text-[18px] font-semibold text-fg-2/85 md:text-[14px]"
                      : "text-[19px] font-semibold text-fg-2/85 sm:text-[20px] md:text-[16px]",
              )}
            >
              {line.text}
            </button>
          );
        })}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 px-2.5 text-[11px] text-fg-3">
          <span>{t.lyrics.syncedHint}</span>
          <div className="flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 ring-1 ring-line">
            <button
              type="button"
              onClick={() => setUserOffset((o) => Math.round((o - 0.5) * 10) / 10)}
              className="px-1 font-mono font-semibold text-fg-2 hover:text-fg"
              title="Lyrics earlier (-0.5s)"
            >
              -0.5s
            </button>
            <span className="font-mono text-[10px] text-fg-3">
              {userOffset === 0 ? "sync" : `${userOffset > 0 ? "+" : ""}${userOffset.toFixed(1)}s`}
            </span>
            <button
              type="button"
              onClick={() => setUserOffset((o) => Math.round((o + 0.5) * 10) / 10)}
              className="px-1 font-mono font-semibold text-fg-2 hover:text-fg"
              title="Lyrics later (+0.5s)"
            >
              +0.5s
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "scroll-area flex flex-col items-center gap-2.5 overflow-y-auto px-4 text-center",
        compact ? "py-4" : "py-6",
        className,
      )}
    >
      {state.plain.map((line, i) => (
        <p
          key={i}
          className={cn(
            "text-center leading-relaxed font-semibold text-fg-2",
            compact ? "text-[17px] md:text-[14px]" : "text-[19px] sm:text-[20px] md:text-[16px]",
            !line && "h-3",
          )}
        >
          {line}
        </p>
      ))}
    </div>
  );
}

