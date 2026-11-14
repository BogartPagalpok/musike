import {
  ArrowsOutIcon,
  ListPlusIcon,
  MagnifyingGlassIcon,
  MicrophoneStageIcon,
  PlayIcon,
  PlusIcon,
  QueueIcon,
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
import { useVideoke } from "../stores/videoke";

interface KaraokeChannel {
  id: string;
  name: string;
  tagline: string;
  suffix: string;
  badge: string;
}

const KARAOKE_CHANNELS: KaraokeChannel[] = [
  { id: "all", name: "All Channels", tagline: "Best match across YouTube", suffix: "", badge: "MIX" },
  { id: "singking", name: "Sing King", tagline: "World's #1 pop karaoke", suffix: "Sing King", badge: "SK" },
  { id: "coversph", name: "CoversPH", tagline: "OPM & billboard hits", suffix: "CoversPH", badge: "PH" },
  { id: "karafun", name: "KaraFun", tagline: "Studio backing tracks", suffix: "KaraFun", badge: "KF" },
  { id: "acousticheaven", name: "AcousticHeaven", tagline: "Guitar & unplugged", suffix: "AcousticHeaven", badge: "AH" },
  { id: "myallkaraoke", name: "MyAllKaraoke", tagline: "Classic videoke & OPM", suffix: "My All Time Karaoke", badge: "MA" },
  { id: "stingray", name: "Stingray Karaoke", tagline: "Pro lyric videos", suffix: "Stingray Karaoke", badge: "ST" },
];

const KARAOKE_CATEGORIES = [
  { id: "trending", label: "Trending Hits", query: "top hits karaoke Sing King" },
  { id: "pop", label: "Pop & R&B", query: "pop rnb hits karaoke Sing King" },
  { id: "opm", label: "OPM Videoke", query: "opm classic hits karaoke CoversPH" },
  { id: "throwback", label: "90s & 2000s", query: "90s 2000s throwback hits karaoke" },
  { id: "rock", label: "Rock Anthems", query: "classic rock anthems karaoke" },
  { id: "ballads", label: "Power Ballads", query: "birit power ballads love songs karaoke" },
  { id: "acoustic", label: "Acoustic & Duets", query: "acoustic duet love song karaoke" },
];

/** Deterministic 5-digit videoke book code for any track ID. */
function songbookCode(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 90000;
  }
  return String(10000 + Math.abs(hash)).slice(0, 5);
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

  // Debounce title/artist search-as-you-type (user does NOT need to type "karaoke")
  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === queryTerm) return;
    const timer = setTimeout(() => setQueryTerm(trimmed), 380);
    return () => clearTimeout(timer);
  }, [searchInput, queryTerm]);

  const channelObj = useMemo(
    () => KARAOKE_CHANNELS.find((c) => c.id === activeChannel) ?? KARAOKE_CHANNELS[0],
    [activeChannel],
  );

  const effectiveQuery = useMemo(() => {
    const base = queryTerm.trim();
    if (base) {
      return channelObj.suffix ? `${base} ${channelObj.suffix} karaoke` : base;
    }
    const catQuery = KARAOKE_CATEGORIES.find((c) => c.id === activeCategory)?.query ?? KARAOKE_CATEGORIES[0].query;
    return channelObj.suffix ? `${catQuery} ${channelObj.suffix}` : catQuery;
  }, [queryTerm, activeCategory, channelObj]);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError("");
    api
      .search(effectiveQuery, "karaoke", ctrl.signal)
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
  }, [effectiveQuery, retry]);

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

  return (
    <div className="@container/videoke flex flex-col gap-5 pb-24">
      <PageHeader
        title={t.videoke.title}
        actions={
          currentTrack ? (
            <button
              type="button"
              onClick={() => showScore(currentTrack)}
              className="flex h-9 items-center gap-1.5 rounded-full bg-accent px-3.5 text-xs font-semibold text-accent-ink transition-transform hover:scale-105 active:scale-95"
            >
              <MicrophoneStageIcon size={15} weight="fill" />
              <span>{t.videoke.scoreMe}</span>
            </button>
          ) : null
        }
      />

      {/* Sticky Title/Artist Search & Quick Channel Selector */}
      <div className="flex flex-col gap-3 px-4 md:px-6">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            inputRef.current?.blur();
            setQueryTerm(searchInput.trim());
          }}
          className="relative max-w-2xl"
        >
          <MagnifyingGlassIcon
            size={19}
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-fg-3"
          />
          <input
            ref={inputRef}
            type="search"
            inputMode="search"
            enterKeyHint="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t.videoke.searchPlaceholder}
            aria-label={t.videoke.searchPlaceholder}
            className="h-12 w-full rounded-full border border-line-strong bg-surface-2 pr-11 pl-11 text-[16px] text-fg placeholder:text-fg-3 transition-colors focus:border-accent focus:bg-surface-1 focus:outline-none md:text-sm [&::-webkit-search-cancel-button]:hidden"
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
              className="absolute top-1/2 right-3 grid size-8 -translate-y-1/2 place-items-center rounded-full text-fg-2 hover:bg-surface-3 hover:text-fg"
            >
              <XIcon size={16} />
            </button>
          )}
        </form>

        {/* Karaoke Channel Selector */}
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          {KARAOKE_CHANNELS.map((ch) => {
            const active = activeChannel === ch.id;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => setActiveChannel(ch.id)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-left transition-all active:scale-95",
                  active
                    ? "border-accent bg-accent-soft text-accent-text"
                    : "border-line bg-surface-2 text-fg-2 hover:bg-surface-3 hover:text-fg",
                )}
              >
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded-full text-[10px] font-black tracking-tight",
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

        {/* Category Pills (Active when browsing without a typed song) */}
        {!queryTerm && (
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
            {KARAOKE_CATEGORIES.map((cat) => {
              const active = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "h-8 shrink-0 rounded-full px-3.5 text-xs font-semibold transition-colors",
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

      {/* Live Videoke Stage Monitor + Pitch Guide + Reservation HUD */}
      <div className="px-4 md:px-6">
        <div className="overflow-hidden rounded-[22px] border border-line-strong bg-surface-2/85 p-3 shadow-lg backdrop-blur-xl md:p-5">
          {currentTrack ? (
            <div className="flex flex-col gap-4">
              {!centerHasStage && (
                <div className="flex w-full flex-col gap-3">
                  {showsVideo ? (
                    <VideoSlot
                      priority={SLOT.videoke}
                      expandable
                      className="mx-auto aspect-video max-h-[64dvh] w-full rounded-[16px] bg-black shadow-2xl"
                      style={{ aspectRatio: Math.min(16 / 9, Math.max(4 / 3, aspect || 16 / 9)) }}
                    />
                  ) : (
                    <div className="relative flex aspect-video max-h-[60dvh] w-full flex-col items-center justify-center overflow-hidden rounded-[16px] bg-black/80 text-center">
                      <Artwork src={currentTrack.art} fallback={currentTrack.thumb} className="absolute inset-0 size-full object-cover opacity-35 blur-sm" />
                      <div className="relative z-10 flex flex-col items-center gap-2 px-4">
                        <span className="rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">
                          {statusText ?? "Loading Videoke screen…"}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPreferVideo(true)}
                          className="rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-accent-ink"
                        >
                          Switch to Video Screen
                        </button>
                      </div>
                    </div>
                  )}
                  <PitchGuide />
                </div>
              )}

              {/* Videoke HUD & Song Reservation Queue */}
              <div className="grid grid-cols-1 gap-3 @[760px]/videoke:grid-cols-2">
                <div className="flex flex-col justify-between gap-3 rounded-[14px] border border-line bg-bg/60 p-3.5">
                  <div>
                    <div className="flex items-center justify-between gap-2 text-[11px] font-bold tracking-wider text-accent-text uppercase">
                      <span className="flex items-center gap-1.5">
                        <span className={cn("size-2 rounded-full", status === "playing" ? "animate-pulse bg-emerald-400" : "bg-fg-3")} />
                        {t.videoke.nowSinging}
                      </span>
                      <span className="font-mono text-fg-2">SONG #{currentCode}</span>
                    </div>
                    <p className="mt-1.5 truncate text-base font-bold text-fg">{currentTrack.title}</p>
                    <p className="truncate text-xs text-fg-2">{currentTrack.artist}</p>
                  </div>

                  {centerHasStage && <PitchGuide compact />}

                  {/* Action Controls: Stage Fullscreen & Finish & Score */}
                  <div className="flex flex-wrap items-center gap-2">
                    {showsVideo && (
                      <button
                        type="button"
                        onClick={() => useUi.getState().setTheater(true)}
                        className="flex h-9 items-center gap-1.5 rounded-full bg-surface-3 px-3 text-xs font-semibold text-fg-2 transition-colors hover:bg-surface-4 hover:text-fg active:scale-95"
                      >
                        <ArrowsOutIcon size={15} />
                        <span>{t.videoke.fullscreen}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => showScore(currentTrack)}
                      className="flex h-9 items-center gap-1.5 rounded-full bg-accent px-3.5 text-xs font-semibold text-accent-ink transition-transform hover:brightness-110 active:scale-95"
                    >
                      <MicrophoneStageIcon size={15} weight="fill" />
                      <span>{t.videoke.finishAndScore}</span>
                    </button>
                  </div>
                </div>

                {/* Reserved Up Next List */}
                <div className="flex min-h-0 flex-col rounded-[14px] border border-line bg-bg/50 p-3.5">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-fg-2 uppercase">
                      <QueueIcon size={14} />
                      <span>
                        {t.videoke.reservedQueue} ({upNext.length})
                      </span>
                    </span>
                    {upNext.length > 0 && (
                      <button
                        type="button"
                        onClick={clearUpcoming}
                        className="text-[11px] font-medium text-fg-3 hover:text-danger"
                      >
                        {t.videoke.clearQueue}
                      </button>
                    )}
                  </div>

                  {upNext.length === 0 ? (
                    <p className="py-3 text-xs text-fg-3">
                      Tap <strong>Reserve</strong> on any song below to line up your next videoke turn.
                    </p>
                  ) : (
                    <ul className="flex max-h-40 flex-col gap-1.5 overflow-y-auto pr-1">
                      {upNext.map(({ track: item, queueIndex }, idx) => (
                        <li
                          key={`${item.id}-${queueIndex}`}
                          className="flex items-center gap-2 rounded-[10px] bg-surface-2/80 px-2.5 py-1.5"
                        >
                          <span className="w-6 shrink-0 font-mono text-[11px] font-bold text-accent-text">
                            #{String(idx + 1).padStart(2, "0")}
                          </span>
                          <button
                            type="button"
                            onClick={() => jumpTo(queueIndex)}
                            className="min-w-0 flex-1 text-left hover:text-accent-text"
                          >
                            <p className="truncate text-xs font-semibold text-fg">{item.title}</p>
                            <p className="truncate text-[11px] text-fg-3">{item.artist}</p>
                          </button>
                          <button
                            type="button"
                            onClick={() => removeAt(queueIndex)}
                            aria-label={t.queue.removeX(item.title)}
                            className="grid size-7 shrink-0 place-items-center rounded-full text-fg-3 hover:bg-surface-3 hover:text-danger"
                          >
                            <TrashIcon size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent-text">
                <MicrophoneStageIcon size={24} weight="fill" />
              </span>
              <p className="text-sm font-semibold text-fg">{t.videoke.noActiveSong}</p>
              <p className="max-w-md text-xs text-fg-2">{t.videoke.subtitle}</p>
            </div>
          )}
        </div>
      </div>

      {/* Karaoke Songbook Results */}
      <div className="px-4 md:px-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-fg">
            <MicrophoneStageIcon size={18} className="text-accent-text" />
            <span>
              {queryTerm
                ? `Karaoke results for "${queryTerm}"${channelObj.id !== "all" ? ` · ${channelObj.name}` : ""}`
                : `${KARAOKE_CATEGORIES.find((c) => c.id === activeCategory)?.label ?? "Trending"} Karaoke${
                    channelObj.id !== "all" ? ` · ${channelObj.name}` : ""
                  }`}
            </span>
          </h2>
          {results && <span className="text-xs text-fg-3">{results.length} videos</span>}
        </div>

        {loading && <TrackListSkeleton rows={8} />}

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

        {!loading && !error && results && results.length === 0 && (
          <p className="py-12 text-center text-sm text-fg-2">{t.search.nothingFound}</p>
        )}

        {!loading && !error && results && results.length > 0 && (
          <ul className="grid grid-cols-1 gap-2 @[720px]/videoke:grid-cols-2 @[1120px]/videoke:grid-cols-3">
            {results.map((track) => {
              const isCurrent = currentTrack?.id === track.id;
              const reservedIdx = upNext.findIndex((x) => x.track.id === track.id);
              const code = songbookCode(track.id);
              return (
                <li
                  key={track.id}
                  className={cn(
                    "group flex items-center gap-3 rounded-[16px] border p-2.5 transition-colors",
                    isCurrent
                      ? "border-accent/60 bg-accent-soft/50"
                      : "border-line bg-surface-1/80 hover:border-line-strong hover:bg-surface-2",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => singNow(track)}
                    aria-label={`${t.videoke.singNow}: ${track.title}`}
                    className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-[10px] bg-black"
                  >
                    <Artwork src={track.thumb} fallback={track.art} className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    <span className="absolute inset-0 grid place-items-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="grid size-8 place-items-center rounded-full bg-accent text-accent-ink shadow-md">
                        <PlayIcon size={15} weight="fill" />
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
                      <span className="font-mono text-accent-text">#{code}</span>
                      {track.artist && (
                        <>
                          <span>·</span>
                          <span className="truncate">{track.artist}</span>
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => singNow(track)}
                      className={cn(
                        "mt-0.5 line-clamp-2 text-left text-[13.5px] leading-snug font-semibold hover:text-accent-text",
                        isCurrent ? "text-accent-text" : "text-fg",
                      )}
                    >
                      {track.title}
                    </button>

                    <div className="mt-2 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => singNow(track)}
                        className="flex h-7 items-center gap-1 rounded-full bg-accent px-2.5 text-[11px] font-semibold text-accent-ink transition-transform hover:brightness-110 active:scale-95"
                      >
                        <PlayIcon size={11} weight="fill" />
                        <span>{t.videoke.singNow}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => reserve(track)}
                        disabled={reservedIdx >= 0}
                        className={cn(
                          "flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold transition-colors active:scale-95",
                          reservedIdx >= 0
                            ? "bg-surface-3 text-accent-text"
                            : "bg-surface-3 text-fg-2 hover:bg-surface-4 hover:text-fg",
                        )}
                      >
                        {reservedIdx >= 0 ? <ListPlusIcon size={12} /> : <PlusIcon size={12} />}
                        <span>{reservedIdx >= 0 ? `#${reservedIdx + 1}` : t.videoke.reserve}</span>
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
  );
}
