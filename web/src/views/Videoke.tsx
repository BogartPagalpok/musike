import {
  ArrowsOutIcon,
  ListPlusIcon,
  MagnifyingGlassIcon,
  MicrophoneStageIcon,
  PlayIcon,
  PlusIcon,
  QueueIcon,
  SkipForwardIcon,
  TrashIcon,
  WarningCircleIcon,
  XIcon,
} from "../components/icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { Artwork } from "../components/Artwork";
import { EmptyState, PageHeader } from "../components/Page";
import { PitchGuide } from "../components/PitchGuide";
import { TrackListSkeleton } from "../components/TrackList";
import { SLOT, VideoSlot } from "../components/Video";
import { MD, useMediaQuery } from "../hooks/useMediaQuery";
import { useT } from "../i18n";
import { api } from "../lib/api";
import { cn, formatTime } from "../lib/format";
import type { Track } from "../lib/types";
import { selectCurrent, usePlayer, useStatusText } from "../player/player";
import { useAppearance } from "../stores/appearance";
import { useUi } from "../stores/ui";
import { songbookCode, useVideoke } from "../stores/videoke";

interface KaraokeChannel {
  id: string;
  name: string;
  tagline: string;
  queryName: string;
  badge: string;
  /** Strict matcher on YouTube uploader name (`track.artist`) so Sing King never leaks into other channel tabs. */
  match?: RegExp;
}

const KARAOKE_CHANNELS: KaraokeChannel[] = [
  {
    id: "all",
    name: "All Channels",
    tagline: "Balanced mix across karaoke channels",
    queryName: "",
    badge: "MIX",
  },
  {
    id: "singking",
    name: "Sing King",
    tagline: "World's #1 pop karaoke",
    queryName: "Sing King Karaoke",
    badge: "SK",
    match: /\bsing\s*king\b/i,
  },
  {
    id: "coversph",
    name: "CoversPH",
    tagline: "OPM & billboard hits",
    queryName: "CoversPH",
    badge: "PH",
    match: /\bcovers\s*ph\b/i,
  },
  {
    id: "karafun",
    name: "KaraFun",
    tagline: "Studio backing tracks",
    queryName: "KaraFun Karaoke",
    badge: "KF",
    match: /\bkarafun\b/i,
  },
  {
    id: "acousticheaven",
    name: "AcousticHeaven",
    tagline: "Guitar & unplugged",
    queryName: "AcousticHeaven",
    badge: "AH",
    match: /\bacoustic\s*heaven\b/i,
  },
  {
    id: "myallkaraoke",
    name: "MyAllKaraoke",
    tagline: "Classic videoke & OPM",
    queryName: "My All Time Karaoke",
    badge: "MA",
    match: /\b(?:my\s*all\s*(?:time\s*)?karaoke|myallkaraoke|atomic\s*karaoke|platinum\s*karaoke|megapro)\b/i,
  },
  {
    id: "stingray",
    name: "Stingray Karaoke",
    tagline: "Pro lyric videos",
    queryName: "Stingray Karaoke",
    badge: "ST",
    match: /\bstingray\b/i,
  },
];

const KARAOKE_CATEGORIES = [
  { id: "trending", label: "Trending Hits", query: "top hits karaoke", short: "hits" },
  { id: "pop", label: "Pop & R&B", query: "pop rnb hits karaoke", short: "pop" },
  { id: "opm", label: "OPM Videoke", query: "opm tagalog hits karaoke", short: "opm" },
  { id: "throwback", label: "90s & 2000s", query: "90s 2000s throwback karaoke", short: "90s 2000s" },
  { id: "rock", label: "Rock Anthems", query: "classic rock anthems karaoke", short: "rock" },
  { id: "ballads", label: "Power Ballads", query: "power ballads love songs karaoke", short: "ballads" },
  { id: "acoustic", label: "Acoustic & Duets", query: "acoustic duet love song karaoke", short: "acoustic" },
];

/**
 * Interleaves tracks round-robin by uploader channel (`track.artist`) so no single channel
 * (such as Sing King) monopolizes "All Channels" results.
 */
function interleaveByChannel(tracks: Track[]): Track[] {
  const buckets = new Map<string, Track[]>();
  const seenIds = new Set<string>();

  for (const tr of tracks) {
    if (seenIds.has(tr.id)) continue;
    seenIds.add(tr.id);
    const key = (tr.artist || "unknown").trim().toLowerCase();
    let list = buckets.get(key);
    if (!list) {
      list = [];
      buckets.set(key, list);
    }
    list.push(tr);
  }

  const queues = [...buckets.values()];
  const out: Track[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const q of queues) {
      const next = q.shift();
      if (next) {
        out.push(next);
        added = true;
      }
    }
  }
  return out;
}

export default function Videoke() {
  const t = useT();
  const isMd = useMediaQuery(MD);
  const layoutTemplate = useAppearance((s) => s.layoutTemplate);
  const centerHasStage = (layoutTemplate === "center-lyrics" || layoutTemplate === "cinema") && isMd;

  const currentTrack = usePlayer(selectCurrent);
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const showsVideo = usePlayer((s) => s.mediaKind === "video");
  const status = usePlayer((s) => s.status);
  const statusText = useStatusText();
  const aspect = usePlayer((s) => s.videoAspect);
  const jumpTo = usePlayer((s) => s.jumpTo);
  const removeAt = usePlayer((s) => s.removeAt);
  const clearUpcoming = usePlayer((s) => s.clearUpcoming);
  const setPreferVideo = usePlayer((s) => s.setPreferVideo);

  const videokeIds = useVideoke((v) => v.ids);
  const micOn = useVideoke((v) => v.micOn);
  const startMic = useVideoke((v) => v.startMic);
  const stopMic = useVideoke((v) => v.stopMic);
  const singNow = useVideoke((v) => v.singNow);
  const reserve = useVideoke((v) => v.reserve);
  const showScore = useVideoke((v) => v.showScore);

  const [searchInput, setSearchInput] = useState("");
  const [queryTerm, setQueryTerm] = useState("");
  const [activeChannel, setActiveChannel] = useState<string>("all");
  const [activeCategory, setActiveCategory] = useState<string>("trending");
  const [results, setResults] = useState<Track[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  // Release mic input stream automatically when leaving the Videoke tab if no Videoke song is actively playing
  useEffect(() => {
    return () => {
      const p = usePlayer.getState();
      const cur = p.queue[p.index];
      if (!cur || !useVideoke.getState().ids.has(cur.id) || p.status !== "playing") {
        if (useVideoke.getState().micOn) {
          useVideoke.getState().stopMic();
        }
      }
    };
  }, []);

  // Debounce title/artist search-as-you-type (ignore pure #code digits so local songbook code punch works too)
  useEffect(() => {
    const trimmed = searchInput.trim();
    const isCodeLookup = /^#?\d{3,5}$/.test(trimmed);
    const nextTerm = isCodeLookup ? "" : trimmed;
    if (nextTerm === queryTerm) return;
    const timer = setTimeout(() => setQueryTerm(nextTerm), 360);
    return () => clearTimeout(timer);
  }, [searchInput, queryTerm]);

  const channelObj = useMemo(
    () => KARAOKE_CHANNELS.find((c) => c.id === activeChannel) ?? KARAOKE_CHANNELS[0],
    [activeChannel],
  );

  const categoryObj = useMemo(
    () => KARAOKE_CATEGORIES.find((c) => c.id === activeCategory) ?? KARAOKE_CATEGORIES[0],
    [activeCategory],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError("");

    const base = queryTerm.trim();

    const runSearch = async () => {
      if (channelObj.id === "all") {
        // All Channels (MIX): blend multiple channel families and interleave round-robin so Sing King doesn't dominate!
        if (base) {
          const [general, alt] = await Promise.all([
            api.search(`${base} karaoke`, "karaoke", ctrl.signal),
            api.search(`${base} CoversPH KaraFun karaoke`, "karaoke", ctrl.signal).catch(() => [] as Track[]),
          ]);
          return interleaveByChannel([...general, ...alt]);
        }
        const [q1, q2, q3] = await Promise.all([
          api.search(categoryObj.query, "karaoke", ctrl.signal),
          api.search(`CoversPH ${categoryObj.short} karaoke`, "karaoke", ctrl.signal).catch(() => [] as Track[]),
          api.search(`KaraFun AcousticHeaven ${categoryObj.short} karaoke`, "karaoke", ctrl.signal).catch(() => [] as Track[]),
        ]);
        return interleaveByChannel([...q2, ...q3, ...q1]);
      }

      // Specific Channel Selected: query specifically for that channel AND strictly filter out other channels!
      const primaryQuery = base
        ? `${channelObj.queryName} ${base} karaoke`
        : `${channelObj.queryName} ${categoryObj.short} karaoke`;
      const backupQuery = base ? `${base} ${channelObj.queryName}` : `${channelObj.queryName} karaoke`;

      const [primary, backup] = await Promise.all([
        api.search(primaryQuery, "karaoke", ctrl.signal),
        api.search(backupQuery, "karaoke", ctrl.signal).catch(() => [] as Track[]),
      ]);

      const merged: Track[] = [];
      const seen = new Set<string>();
      for (const item of [...primary, ...backup]) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        if (!channelObj.match || channelObj.match.test(item.artist) || channelObj.match.test(item.title)) {
          merged.push(item);
        }
      }
      return merged;
    };

    runSearch()
      .then((list) => {
        setResults(list);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (e.name === "AbortError") return;
        setError(e.message || "Failed to load karaoke songs");
        setLoading(false);
      });

    return () => ctrl.abort();
  }, [queryTerm, channelObj, categoryObj, retry]);

  // Filter visible results if the user typed a 3-5 digit #code from the songbook
  const displayedResults = useMemo(() => {
    if (!results) return null;
    const trimmed = searchInput.trim();
    if (/^#?\d{3,5}$/.test(trimmed)) {
      const digits = trimmed.replace(/^#/, "");
      return results.filter((tr) => songbookCode(tr.id).includes(digits));
    }
    return results;
  }, [results, searchInput]);

  // Only show songs explicitly reserved in Videoke (never auto-radio tracks)
  const upNext = useMemo(
    () =>
      queue
        .slice(index + 1)
        .map((track, offset) => ({ track, queueIndex: index + 1 + offset }))
        .filter((entry) => videokeIds.has(entry.track.id)),
    [queue, index, videokeIds],
  );

  const currentCode = currentTrack ? songbookCode(currentTrack.id) : "00000";

  const reservedQueueCard = (
    <div className="flex min-h-0 flex-col rounded-[16px] border border-line bg-surface-2/75 p-3 backdrop-blur-md">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-extrabold tracking-wider text-fg-2 uppercase">
          <QueueIcon size={14} className="text-accent-text" />
          <span>
            {t.videoke.reservedQueue} ({upNext.length})
          </span>
        </span>
        {upNext.length > 0 && (
          <button
            type="button"
            onClick={clearUpcoming}
            className="text-[11px] font-semibold text-fg-3 transition-colors hover:text-danger"
          >
            {t.videoke.clearQueue}
          </button>
        )}
      </div>

      {upNext.length === 0 ? (
        <p className="py-1.5 text-xs text-fg-3">
          No songs reserved yet — tap <strong>Reserve</strong> on any song to line up your turn.
        </p>
      ) : (
        <ul className="scroll-area flex max-h-36 flex-col gap-1.5 overflow-y-auto pr-1">
          {upNext.map(({ track: item, queueIndex }, idx) => (
            <li
              key={`${item.id}-${queueIndex}`}
              className="flex items-center gap-2 rounded-[10px] border border-line/60 bg-bg/65 px-2.5 py-1.5"
            >
              <span className="w-6 shrink-0 font-mono text-[11px] font-extrabold text-accent-text">
                #{String(idx + 1).padStart(2, "0")}
              </span>
              <button
                type="button"
                onClick={() => jumpTo(queueIndex)}
                className="min-w-0 flex-1 text-left transition-colors hover:text-accent-text"
              >
                <p className="truncate text-xs font-semibold text-fg">{item.title}</p>
                <p className="truncate text-[10.5px] text-fg-3">{item.artist}</p>
              </button>
              <button
                type="button"
                onClick={() => removeAt(queueIndex)}
                aria-label={t.queue.removeX(item.title)}
                className="grid size-7 shrink-0 place-items-center rounded-full text-fg-3 transition-colors hover:bg-surface-3 hover:text-danger"
              >
                <TrashIcon size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="@container/videoke flex flex-col gap-4 pb-24">
      <PageHeader
        title={t.videoke.title}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => (micOn ? stopMic() : void startMic())}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition-colors active:scale-95",
                micOn
                  ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/45"
                  : "bg-surface-3 text-fg-2 hover:bg-surface-4 hover:text-fg",
              )}
            >
              <MicrophoneStageIcon size={14} weight={micOn ? "fill" : "regular"} />
              <span>{micOn ? "Mic On" : "Mic Off"}</span>
            </button>
            {currentTrack && (
              <button
                type="button"
                onClick={() => showScore(currentTrack)}
                className="flex h-9 items-center gap-1.5 rounded-full bg-accent px-3.5 text-xs font-bold text-accent-ink transition-transform hover:scale-105 active:scale-95"
              >
                <MicrophoneStageIcon size={15} weight="fill" />
                <span>{t.videoke.scoreMe}</span>
              </button>
            )}
          </div>
        }
      />

      <div
        className={cn(
          "grid grid-cols-1 gap-5 px-4 md:px-6",
          !centerHasStage && "@[980px]/videoke:grid-cols-[minmax(0,1.32fr)_minmax(340px,1fr)] @[980px]/videoke:items-start",
        )}
      >
        {/* STAGE COLUMN */}
        {centerHasStage ? (
          (currentTrack || upNext.length > 0) && (
            <div className="flex flex-col gap-2.5">
              {currentTrack && (
                <div className="flex items-center justify-between gap-2 rounded-[14px] border border-accent/30 bg-accent-soft/35 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-extrabold tracking-wider text-accent-text uppercase">
                      <span className={cn("size-1.5 rounded-full", status === "playing" ? "animate-pulse bg-emerald-400" : "bg-fg-3")} />
                      <span>NOW SINGING · #{currentCode}</span>
                    </div>
                    <p className="truncate text-xs font-bold text-fg">{currentTrack.title}</p>
                  </div>
                  {upNext[0] && (
                    <button
                      type="button"
                      onClick={() => jumpTo(upNext[0].queueIndex)}
                      className="flex h-7 shrink-0 items-center gap-1 rounded-full bg-surface-3 px-2.5 text-[11px] font-bold text-fg-2 hover:bg-surface-4 hover:text-fg"
                      title="Skip to next reserved song"
                    >
                      <SkipForwardIcon size={12} weight="fill" />
                      <span>Next</span>
                    </button>
                  )}
                </div>
              )}
              {reservedQueueCard}
            </div>
          )
        ) : (
          <div
            className={cn(
              "flex flex-col gap-3 @[980px]/videoke:sticky @[980px]/videoke:top-3",
              !currentTrack && "hidden @[980px]/videoke:flex",
            )}
          >
            <div className="overflow-hidden rounded-[22px] border border-line-strong bg-surface-2/85 p-3 shadow-xl backdrop-blur-xl md:p-4">
              {currentTrack ? (
                <div className="flex flex-col gap-3">
                  {/* Top Arcade TV Marquee */}
                  <div className="flex items-center justify-between gap-2 rounded-full border border-white/10 bg-black/55 px-3 py-1.5 text-[11px] text-white/85">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className={cn("size-2 shrink-0 rounded-full", status === "playing" ? "animate-pulse bg-emerald-400" : "bg-fg-3")} />
                      <span className="font-mono font-extrabold text-accent-text">SONG #{currentCode}</span>
                      <span className="truncate text-white/75">· {currentTrack.title}</span>
                    </div>
                    {upNext[0] ? (
                      <button
                        type="button"
                        onClick={() => jumpTo(upNext[0].queueIndex)}
                        className="flex max-w-[46%] shrink-0 items-center gap-1 rounded-full bg-white/12 px-2.5 py-0.5 font-semibold text-white hover:bg-white/20"
                      >
                        <span className="text-accent-text">NEXT:</span>
                        <span className="truncate">{upNext[0].track.title}</span>
                        <SkipForwardIcon size={10} weight="fill" className="shrink-0" />
                      </button>
                    ) : (
                      <span className="shrink-0 text-white/45">Queue open</span>
                    )}
                  </div>

                  {/* Unified DAM/Utavie Karaoke TV Monitor: Scrolling Vocal Guide on Top + 16:9 Karaoke Video Below! */}
                  <div className="flex flex-col overflow-hidden rounded-[16px] border border-white/15 bg-black shadow-2xl">
                    <PitchGuide overlay />
                    {showsVideo ? (
                      <VideoSlot
                        priority={SLOT.videoke}
                        expandable
                        className="mx-auto aspect-video max-h-[52dvh] w-full bg-black"
                        style={{ aspectRatio: Math.min(16 / 9, Math.max(4 / 3, aspect || 16 / 9)) }}
                      />
                    ) : (
                      <div className="relative flex aspect-video max-h-[46dvh] w-full flex-col items-center justify-center overflow-hidden bg-black/85 text-center">
                        <Artwork
                          src={currentTrack.art}
                          fallback={currentTrack.thumb}
                          className="absolute inset-0 size-full object-cover opacity-35 blur-sm"
                        />
                        <div className="relative z-10 flex flex-col items-center gap-2 px-4">
                          <span className="rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">
                            {statusText ?? "Loading Videoke screen…"}
                          </span>
                          <button
                            type="button"
                            onClick={() => setPreferVideo(true)}
                            className="rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-accent-ink"
                          >
                            Switch to Video Screen
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Stage Footer Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-fg md:text-base">{currentTrack.title}</p>
                      <p className="truncate text-xs text-fg-2">{currentTrack.artist}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {showsVideo && (
                        <button
                          type="button"
                          onClick={() => useUi.getState().setTheater(true)}
                          className="flex h-9 items-center gap-1.5 rounded-full bg-surface-3 px-3 text-xs font-semibold text-fg-2 transition-colors hover:bg-surface-4 hover:text-fg active:scale-95"
                        >
                          <ArrowsOutIcon size={14} />
                          <span className="hidden sm:inline">{t.videoke.fullscreen}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => showScore(currentTrack)}
                        className="flex h-9 items-center gap-1.5 rounded-full bg-accent px-3.5 text-xs font-bold text-accent-ink transition-transform hover:brightness-110 active:scale-95"
                      >
                        <MicrophoneStageIcon size={15} weight="fill" />
                        <span>{t.videoke.finishAndScore}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2.5 py-12 text-center">
                  <span className="grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent-text">
                    <MicrophoneStageIcon size={28} weight="fill" />
                  </span>
                  <p className="text-base font-bold text-fg">{t.videoke.noActiveSong}</p>
                  <p className="max-w-sm text-xs leading-relaxed text-fg-2">{t.videoke.subtitle}</p>
                </div>
              )}
            </div>

            {currentTrack && reservedQueueCard}
          </div>
        )}

        {/* SONGBOOK & SEARCH CONSOLE COLUMN */}
        <div className="flex min-w-0 flex-col gap-3.5">
          <div className="flex flex-col gap-2.5">
            <form
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                inputRef.current?.blur();
                const trimmed = searchInput.trim();
                if (!/^#?\d{3,5}$/.test(trimmed)) setQueryTerm(trimmed);
              }}
              className="relative w-full"
            >
              <MagnifyingGlassIcon
                size={18}
                className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-fg-3"
              />
              <input
                ref={inputRef}
                type="search"
                inputMode="search"
                enterKeyHint="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search song title, artist, or #code…"
                aria-label={t.videoke.searchPlaceholder}
                className="h-11 w-full rounded-full border border-line-strong bg-surface-2 pr-10 pl-11 text-[16px] text-fg placeholder:text-fg-3 transition-colors focus:border-accent focus:bg-surface-1 focus:outline-none md:text-sm [&::-webkit-search-cancel-button]:hidden"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                    setQueryTerm("");
                    inputRef.current?.focus();
                  }}
                  aria-label={t.search.clear}
                  className="absolute top-1/2 right-2.5 grid size-8 -translate-y-1/2 place-items-center rounded-full text-fg-2 hover:bg-surface-3 hover:text-fg"
                >
                  <XIcon size={15} />
                </button>
              )}
            </form>

            {/* Karaoke Channel Chips */}
            <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0">
              {KARAOKE_CHANNELS.map((ch) => {
                const active = activeChannel === ch.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setActiveChannel(ch.id)}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-left transition-all active:scale-95",
                      active
                        ? "border-accent bg-accent-soft text-accent-text"
                        : "border-line bg-surface-2 text-fg-2 hover:bg-surface-3 hover:text-fg",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-5 place-items-center rounded-full text-[9.5px] font-black tracking-tight",
                        active ? "bg-accent text-accent-ink" : "bg-surface-3 text-fg",
                      )}
                    >
                      {ch.badge}
                    </span>
                    <span className="text-xs font-semibold whitespace-nowrap">{ch.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Category Chips (Active when browsing without a typed song) */}
            {!queryTerm && (
              <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0">
                {KARAOKE_CATEGORIES.map((cat) => {
                  const active = activeCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveCategory(cat.id)}
                      className={cn(
                        "h-7 shrink-0 rounded-full px-3 text-xs font-semibold transition-colors",
                        active ? "bg-fg text-bg" : "bg-fg/[0.07] text-fg-2 hover:bg-fg/[0.12] hover:text-fg",
                      )}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Songbook Section Heading */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <h2 className="flex min-w-0 items-center gap-1.5 text-sm font-bold tracking-tight text-fg md:text-[15px]">
              <MicrophoneStageIcon size={16} className="shrink-0 text-accent-text" />
              <span className="truncate">
                {queryTerm
                  ? `Results for "${queryTerm}"${channelObj.id !== "all" ? ` · ${channelObj.name}` : ""}`
                  : `${categoryObj.label} Songbook${channelObj.id !== "all" ? ` · ${channelObj.name}` : ""}`}
              </span>
            </h2>
            {displayedResults && (
              <span className="shrink-0 font-mono text-[11px] font-semibold text-fg-3">
                {displayedResults.length} songs
              </span>
            )}
          </div>

          {loading && <TrackListSkeleton rows={7} />}

          {error && !loading && (
            <EmptyState
              icon={<WarningCircleIcon size={28} />}
              title={t.search.failed}
              body={error}
              action={
                <button
                  type="button"
                  onClick={() => setRetry((n) => n + 1)}
                  className="mt-2 h-10 rounded-full bg-surface-3 px-6 text-sm font-medium hover:bg-surface-4"
                >
                  {t.common.retry}
                </button>
              }
            />
          )}

          {!loading && !error && displayedResults && displayedResults.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-[16px] border border-line bg-surface-1/60 px-4 py-8 text-center">
              <p className="text-sm font-semibold text-fg">
                {channelObj.id !== "all"
                  ? `No matching upload found on ${channelObj.name}`
                  : t.search.nothingFound}
              </p>
              {channelObj.id !== "all" && (
                <button
                  type="button"
                  onClick={() => setActiveChannel("all")}
                  className="mt-1 rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-accent-ink hover:brightness-110"
                >
                  Search across All Channels instead
                </button>
              )}
            </div>
          )}

          {!loading && !error && displayedResults && displayedResults.length > 0 && (
            <ul
              className={cn(
                "grid grid-cols-1 gap-2",
                !centerHasStage && "@[640px]/videoke:grid-cols-2 @[980px]/videoke:grid-cols-1 @[1380px]/videoke:grid-cols-2",
              )}
            >
              {displayedResults.map((track) => {
                const isCurrent = currentTrack?.id === track.id;
                const reservedIdx = upNext.findIndex((x) => x.track.id === track.id);
                const code = songbookCode(track.id);
                return (
                  <li
                    key={track.id}
                    className={cn(
                      "group flex items-center gap-3 rounded-[15px] border p-2.5 transition-colors",
                      isCurrent
                        ? "border-accent/60 bg-accent-soft/45"
                        : "border-line bg-surface-1/85 hover:border-line-strong hover:bg-surface-2",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => singNow(track)}
                      aria-label={`${t.videoke.singNow}: ${track.title}`}
                      className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-[10px] bg-black sm:w-28"
                    >
                      <Artwork
                        src={track.thumb}
                        fallback={track.art}
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <span className="absolute inset-0 grid place-items-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                        <span className="grid size-8 place-items-center rounded-full bg-accent text-accent-ink shadow-md">
                          <PlayIcon size={14} weight="fill" />
                        </span>
                      </span>
                      {track.duration > 0 && (
                        <span className="absolute right-1 bottom-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">
                          {formatTime(track.duration)}
                        </span>
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-fg-3 uppercase">
                        <span className="rounded bg-accent-soft/70 px-1.5 py-0.2 font-mono text-accent-text">
                          #{code}
                        </span>
                        {track.artist && <span className="truncate text-fg-2">{track.artist}</span>}
                      </div>
                      <button
                        type="button"
                        onClick={() => singNow(track)}
                        className={cn(
                          "mt-0.5 line-clamp-2 text-left text-[13px] leading-snug font-semibold hover:text-accent-text",
                          isCurrent ? "text-accent-text" : "text-fg",
                        )}
                      >
                        {track.title}
                      </button>

                      <div className="mt-2 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => singNow(track)}
                          className="flex h-7 items-center gap-1 rounded-full bg-accent px-2.5 text-[11px] font-bold text-accent-ink transition-transform hover:brightness-110 active:scale-95"
                        >
                          <PlayIcon size={11} weight="fill" />
                          <span>{isCurrent ? "Restart" : t.videoke.singNow}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => reserve(track)}
                          disabled={reservedIdx >= 0 || isCurrent}
                          className={cn(
                            "flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold transition-colors active:scale-95",
                            reservedIdx >= 0
                              ? "bg-accent-soft text-accent-text"
                              : isCurrent
                                ? "bg-surface-3/50 text-fg-3"
                                : "bg-surface-3 text-fg-2 hover:bg-surface-4 hover:text-fg",
                          )}
                        >
                          {reservedIdx >= 0 ? <ListPlusIcon size={12} /> : <PlusIcon size={12} />}
                          <span>
                            {reservedIdx >= 0 ? `Queued #${reservedIdx + 1}` : isCurrent ? "Singing" : t.videoke.reserve}
                          </span>
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
