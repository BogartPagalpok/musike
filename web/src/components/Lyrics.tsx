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
}

const lyricsCache = new Map<string, LyricsData | "none">();
const inflightLyrics = new Map<string, Promise<LyricsData | "none">>();

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
    for (const time of times) {
      out.push({ time, text: text || "♪" });
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
  if (rec.instrumental) return { synced: [], plain: [], instrumental: true };
  const synced = rec.syncedLyrics ? parseLrc(rec.syncedLyrics) : [];
  const plain = rec.plainLyrics
    ? rec.plainLyrics
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l, i, arr) => l !== "" || (i > 0 && arr[i - 1] !== ""))
    : [];
  if (!synced.length && !plain.length) return null;
  return { synced, plain };
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
  const seek = usePlayer((s) => s.seek);
  const t = useT();
  const [state, setState] = useState<"loading" | "none" | LyricsData>("loading");
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!track) return;
    let cancelled = false;
    const cached = lyricsCache.get(track.id);
    if (cached) {
      setState(cached);
      return;
    }
    setState("loading");
    void fetchLyricsFor(track).then((res) => {
      if (!cancelled) setState(res);
    });
    return () => {
      cancelled = true;
    };
  }, [track?.id]);

  // Active synced line index
  let activeIdx = -1;
  if (typeof state === "object" && state.synced.length > 0) {
    for (let i = 0; i < state.synced.length; i++) {
      if (position + 0.25 >= state.synced[i]!.time) activeIdx = i;
      else break;
    }
  }

  useEffect(() => {
    if (activeIdx < 0) return;
    const el = lineRefs.current[activeIdx];
    const container = containerRef.current;
    if (!el || !container) return;
    const targetTop = el.offsetTop - container.clientHeight * 0.45 + el.clientHeight / 2;
    container.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
  }, [activeIdx, track?.id]);

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
    return (
      <div
        ref={containerRef}
        className={cn(
          "scroll-area relative flex flex-col items-center gap-3 overflow-y-auto px-4 text-center",
          compact ? "py-5" : "py-8",
          className,
        )}
      >
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
              onClick={() => seek(line.time)}
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
        <p className="mt-3 px-2.5 text-center text-[11px] text-fg-3">{t.lyrics.syncedHint}</p>
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

