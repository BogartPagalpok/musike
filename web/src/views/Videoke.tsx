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

      {/* Main Responsive Videoke Layout:
       *  - Sidebar mode (centerHasStage): Single clean Songbook + Reservation remote (main TV stage lives on the right).
       *  - Wide Default mode (@[980px]/videoke): 2-column Sticky Stage + Songbook Console side-by-side!
       *  - Mobile / Tablet: Compact Stage on top (when singing), Search + Filters + Results grouped right below!
       */}
      <div
        className={cn(
          "grid grid-cols-1 gap-5 px-4 md:px-6",
          !centerHasStage && "@[980px]/videoke:grid-cols-[minmax(0,1.32fr)_minmax(340px,1fr)] @[980px]/videoke:items-start",
        )}
      >
        {/* STAGE COLUMN (Hidden on mobile when nothing is playing so the Songbook sits right at the top!) */}
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

                  {/* Full 16:9 Karaoke Video Screen */}
                  {showsVideo ? (
                    <VideoSlot
                      priority={SLOT.videoke}
                      expandable
                      className="mx-auto aspect-video max-h-[56dvh] w-full rounded-[14px] bg-black shadow-2xl"
                      style={{ aspectRatio: Math.min(16 / 9, Math.max(4 / 3, aspect || 16 / 9)) }}
                    />
                  ) : (
                    <div className="relative flex aspect-video max-h-[50dvh] w-full flex-col items-center justify-center overflow-hidden rounded-[14px] bg-black/85 text-center">
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

                  {/* Utavie Scrolling Vocal Pitch Guide */}
                  <PitchGuide compact={!isMd} />

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

        {/* SONGBOOK & SEARCH CONSOLE COLUMN (Search Input + Channels + Results always stay together!) */}
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
                  : `${KARAOKE_CATEGORIES.find((c) => c.id === activeCategory)?.label ?? "Trending"} Songbook${
                      channelObj.id !== "all" ? ` · ${channelObj.name}` : ""
                    }`}
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
            <p className="py-10 text-center text-sm text-fg-2">{t.search.nothingFound}</p>
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
                        {track.artist && <span className="truncate">{track.artist}</span>}
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
