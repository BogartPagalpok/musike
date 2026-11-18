import {
  ArrowsOutIcon,
  ListPlusIcon,
  MagnifyingGlassIcon,
  MicrophoneStageIcon,
  PlayIcon,
  PlusIcon,
  SkipForwardIcon,
  TrashIcon,
  WarningCircleIcon,
  XIcon,
} from "../components/icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { Artwork } from "../components/Artwork";
import { EmptyState, PageHeader } from "../components/Page";
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
  queryName: string;
  match?: RegExp;
}

const KARAOKE_CHANNELS: KaraokeChannel[] = [
  { id: "all", name: "All Channels", queryName: "" },
  { id: "singking", name: "Sing King", queryName: "Sing King Karaoke", match: /\bsing\s*king\b/i },
  { id: "coversph", name: "CoversPH", queryName: "CoversPH", match: /\bcovers\s*ph\b/i },
  { id: "karafun", name: "KaraFun", queryName: "KaraFun Karaoke", match: /\bkarafun\b/i },
  { id: "acousticheaven", name: "AcousticHeaven", queryName: "AcousticHeaven", match: /\bacoustic\s*heaven\b/i },
  {
    id: "myallkaraoke",
    name: "MyAllKaraoke",
    queryName: "My All Time Karaoke",
    match: /\b(?:my\s*all\s*(?:time\s*)?karaoke|myallkaraoke|atomic\s*karaoke|platinum\s*karaoke|megapro)\b/i,
  },
  { id: "stingray", name: "Stingray", queryName: "Stingray Karaoke", match: /\bstingray\b/i },
];

const KARAOKE_CATEGORIES = [
  { id: "trending", label: "Top Hits", query: "top hits karaoke", short: "hits" },
  { id: "pop", label: "Pop & R&B", query: "pop rnb hits karaoke", short: "pop" },
  { id: "opm", label: "OPM", query: "opm tagalog hits karaoke", short: "opm" },
  { id: "throwback", label: "90s & 2000s", query: "90s 2000s throwback karaoke", short: "90s 2000s" },
  { id: "rock", label: "Rock", query: "classic rock anthems karaoke", short: "rock" },
  { id: "ballads", label: "Ballads", query: "power ballads love songs karaoke", short: "ballads" },
  { id: "acoustic", label: "Acoustic", query: "acoustic duet love song karaoke", short: "acoustic" },
];

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
  const statusText = useStatusText();
  const aspect = usePlayer((s) => s.videoAspect);
  const jumpTo = usePlayer((s) => s.jumpTo);
  const removeAt = usePlayer((s) => s.removeAt);
  const clearUpcoming = usePlayer((s) => s.clearUpcoming);
  const setPreferVideo = usePlayer((s) => s.setPreferVideo);

  const videokeIds = useVideoke((v) => v.ids);
  const micOn = useVideoke((v) => v.micOn);
  const micLevel = useVideoke((v) => v.micLevel);
  const liveStats = useVideoke((v) => v.liveStats);
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

  const displayedResults = useMemo(() => {
    if (!results) return null;
    const trimmed = searchInput.trim();
    if (/^#?\d{3,5}$/.test(trimmed)) {
      const digits = trimmed.replace(/^#/, "");
      return results.filter((tr) => songbookCode(tr.id).includes(digits));
    }
    return results;
  }, [results, searchInput]);

  const upNext = useMemo(
    () =>
      queue
        .slice(index + 1)
        .map((track, offset) => ({ track, queueIndex: index + 1 + offset }))
        .filter((entry) => videokeIds.has(entry.track.id)),
    [queue, index, videokeIds],
  );

  const currentCode = currentTrack ? songbookCode(currentTrack.id) : "";

  const reservedQueueSection = (
    <div className="flex min-h-0 flex-col rounded-lg border border-line bg-surface-2 p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-fg">
            {t.videoke.reservedQueue}
          </span>
          <span className="rounded-sm bg-surface-3 px-1.5 py-0.5 text-[11px] font-semibold text-fg-2 tabular-nums">
            {upNext.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {upNext[0] && (
            <button
              type="button"
              onClick={() => jumpTo(upNext[0].queueIndex)}
              className="inline-flex cursor-pointer items-center gap-1 rounded-sm bg-fg px-2 py-0.5 text-[11px] font-semibold text-bg transition-opacity duration-150 hover:opacity-90"
            >
              <SkipForwardIcon size={10} weight="fill" />
              <span>{t.videoke.playNext}</span>
            </button>
          )}
          {upNext.length > 0 && (
            <button
              type="button"
              onClick={clearUpcoming}
              className="cursor-pointer text-xs font-medium text-fg-3 transition-colors duration-150 hover:text-danger"
            >
              {t.videoke.clearQueue}
            </button>
          )}
        </div>
      </div>

      {upNext.length === 0 ? (
        <p className="py-2 text-xs leading-relaxed text-fg-2">
          No songs reserved yet — click <strong>+ {t.videoke.reserve}</strong> on any song in the Songbook to line up your next turn.
        </p>
      ) : (
        <ul className="scroll-area flex max-h-44 flex-col divide-y divide-line overflow-y-auto">
          {upNext.map(({ track: item, queueIndex }, idx) => (
            <li
              key={`${item.id}-${queueIndex}`}
              className="flex items-center gap-2.5 py-2"
            >
              <span className="w-6 shrink-0 font-mono text-[11px] font-semibold text-accent-text tabular-nums">
                #{String(idx + 1).padStart(2, "0")}
              </span>
              <button
                type="button"
                onClick={() => jumpTo(queueIndex)}
                className="min-w-0 flex-1 cursor-pointer text-left transition-colors duration-150 hover:text-accent-text"
              >
                <p className="truncate text-[13px] font-medium text-fg">{item.title}</p>
                <p className="truncate text-[11.5px] text-fg-3">
                  {item.artist} · #{songbookCode(item.id)}
                </p>
              </button>
              <button
                type="button"
                onClick={() => removeAt(queueIndex)}
                aria-label={t.queue.removeX(item.title)}
                className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-md text-fg-3 transition-colors duration-150 hover:bg-surface-3 hover:text-danger"
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
    <div className="@container/videoke flex flex-col gap-5 pb-20">
      <PageHeader
        title={t.videoke.title}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => (micOn ? stopMic(true) : void startMic())}
              className={cn(
                "flex h-8 cursor-pointer items-center gap-2 rounded-md px-3 text-xs font-medium transition-colors duration-150",
                micOn
                  ? "bg-accent-soft text-accent-text font-semibold"
                  : "bg-surface-2 text-fg-2 hover:bg-surface-3 hover:text-fg",
              )}
              title={micOn ? t.videoke.micOnTitle : t.videoke.micOffTitle}
            >
              <MicrophoneStageIcon size={14} weight={micOn ? "fill" : "regular"} />
              <span>{micOn ? t.videoke.micOn : t.videoke.micOff}</span>
              {micOn && (
                <>
                  <span className="h-1.5 w-10 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
                    <span
                      className="block h-full bg-emerald-500 transition-[width] duration-75"
                      style={{ width: `${Math.max(6, Math.round(micLevel * 100))}%` }}
                    />
                  </span>
                  <span className="hidden font-mono text-[11px] tabular-nums sm:inline">
                    {liveStats.currentNoteLabel
                      ? `${liveStats.currentNoteLabel} · ${liveStats.sungSeconds.toFixed(0)}s`
                      : `${liveStats.sungSeconds.toFixed(0)}s`}
                  </span>
                </>
              )}
            </button>
            {currentTrack && (
              <button
                type="button"
                onClick={() => showScore(currentTrack)}
                className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-fg px-3 text-xs font-semibold text-bg transition-opacity duration-150 hover:opacity-90 active:scale-95"
              >
                <MicrophoneStageIcon size={14} weight="fill" />
                <span>{t.videoke.scoreMe}</span>
              </button>
            )}
          </div>
        }
      />

      <div
        className={cn(
          "grid grid-cols-1 gap-6 px-4 md:px-6",
          !centerHasStage && "@[980px]/videoke:grid-cols-[minmax(0,1.25fr)_minmax(340px,1fr)] @[980px]/videoke:items-start",
        )}
      >
        {centerHasStage ? (
          <div className="flex flex-col gap-3">
            {currentTrack && (
              <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3.5 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-fg">{currentTrack.title}</p>
                  <p className="truncate text-xs text-fg-2">#{currentCode} · {currentTrack.artist}</p>
                </div>
                {upNext[0] && (
                  <button
                    type="button"
                    onClick={() => jumpTo(upNext[0].queueIndex)}
                    className="flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-md bg-surface-3 px-2.5 text-xs font-medium text-fg-2 hover:bg-surface-4 hover:text-fg"
                  >
                    <SkipForwardIcon size={12} weight="fill" />
                    <span>{t.videoke.next}</span>
                  </button>
                )}
              </div>
            )}
            {reservedQueueSection}
          </div>
        ) : (
          <div className="flex flex-col gap-3 @[980px]/videoke:sticky @[980px]/videoke:top-3">
            <div className={cn("overflow-hidden rounded-lg bg-surface-2 p-3", !currentTrack && "hidden @[980px]/videoke:block")}>
              {currentTrack ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col overflow-hidden rounded-md bg-black">
                    {showsVideo ? (
                      <VideoSlot
                        priority={SLOT.videoke}
                        expandable
                        className="mx-auto aspect-video max-h-[52dvh] w-full bg-black"
                        style={{ aspectRatio: Math.min(16 / 9, Math.max(4 / 3, aspect || 16 / 9)) }}
                      />
                    ) : (
                      <div className="relative flex aspect-video max-h-[46dvh] w-full flex-col items-center justify-center overflow-hidden bg-black text-center">
                        <Artwork
                          src={currentTrack.art}
                          fallback={currentTrack.thumb}
                          className="absolute inset-0 size-full object-cover opacity-35"
                        />
                        <div className="relative z-10 flex flex-col items-center gap-2.5 px-4">
                          <span className="rounded-md bg-black/80 px-3 py-1 text-xs font-medium text-white">
                            {statusText ?? t.videoke.loadingKaraoke}
                          </span>
                          <button
                            type="button"
                            onClick={() => setPreferVideo(true)}
                            className="cursor-pointer rounded-md bg-fg px-4 py-1.5 text-xs font-semibold text-bg"
                          >
                            {t.videoke.showVideo}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-fg">{currentTrack.title}</p>
                      <p className="truncate text-xs text-fg-2 tabular-nums">
                        {currentTrack.artist} · #{currentCode}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {upNext[0] && (
                        <button
                          type="button"
                          onClick={() => jumpTo(upNext[0].queueIndex)}
                          className="flex h-8 cursor-pointer items-center gap-1 rounded-md bg-surface-3 px-2.5 text-xs font-medium text-fg-2 transition-colors duration-150 hover:bg-surface-4 hover:text-fg"
                        >
                          <SkipForwardIcon size={12} weight="fill" />
                          <span>{t.videoke.next}</span>
                        </button>
                      )}
                      {showsVideo && (
                        <button
                          type="button"
                          onClick={() => useUi.getState().setTheater(true)}
                          className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-surface-3 px-2.5 text-xs font-medium text-fg-2 transition-colors duration-150 hover:bg-surface-4 hover:text-fg"
                        >
                          <ArrowsOutIcon size={14} />
                          <span className="hidden sm:inline">{t.videoke.fullscreen}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => showScore(currentTrack)}
                        className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-fg px-3 text-xs font-semibold text-bg transition-opacity duration-150 hover:opacity-90"
                      >
                        <MicrophoneStageIcon size={14} weight="fill" />
                        <span>{t.videoke.finishAndScore}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                  <span className="grid size-12 place-items-center rounded-lg bg-surface-3 text-fg-2">
                    <MicrophoneStageIcon size={24} />
                  </span>
                  <p className="text-sm font-semibold text-fg">{t.videoke.noActiveSong}</p>
                  <p className="max-w-xs text-xs leading-relaxed text-fg-2">{t.videoke.subtitle}</p>
                </div>
              )}
            </div>

            {reservedQueueSection}
          </div>
        )}

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
                size={16}
                className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-fg-3"
              />
              <input
                ref={inputRef}
                type="search"
                inputMode="search"
                enterKeyHint="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search song, artist, or #code…"
                aria-label={t.videoke.searchPlaceholder}
                className="h-10 w-full rounded-md bg-surface-2 pr-9 pl-10 text-sm text-fg placeholder:text-fg-3 transition-colors duration-150 focus:bg-surface-3 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
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
                  className="absolute top-1/2 right-2.5 grid size-7 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-fg-3 hover:text-fg"
                >
                  <XIcon size={15} />
                </button>
              )}
            </form>

            <div role="tablist" aria-label="Karaoke channels" className="no-scrollbar flex items-center gap-4 border-b border-line overflow-x-auto">
              {KARAOKE_CHANNELS.map((ch) => {
                const active = activeChannel === ch.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveChannel(ch.id)}
                    className={cn(
                      "shrink-0 cursor-pointer border-b-2 pb-2 text-xs font-medium whitespace-nowrap transition-colors duration-150",
                      active
                        ? "border-accent text-fg font-semibold"
                        : "border-transparent text-fg-3 hover:text-fg-2",
                    )}
                  >
                    {ch.name}
                  </button>
                );
              })}
            </div>

            {!queryTerm && (
              <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
                {KARAOKE_CATEGORIES.map((cat) => {
                  const active = activeCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveCategory(cat.id)}
                      className={cn(
                        "h-7 shrink-0 cursor-pointer rounded-md px-3 text-xs font-medium transition-colors duration-150",
                        active ? "bg-fg text-bg font-semibold" : "bg-surface-2 text-fg-2 hover:bg-surface-3 hover:text-fg",
                      )}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
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
                  className="mt-2 h-9 cursor-pointer rounded-md bg-surface-3 px-4 text-xs font-medium hover:bg-surface-4"
                >
                  {t.common.retry}
                </button>
              }
            />
          )}

          {!loading && !error && displayedResults && displayedResults.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-lg bg-surface-2 px-4 py-8 text-center">
              <p className="text-sm font-medium text-fg">
                {channelObj.id !== "all"
                  ? t.videoke.noUploads(channelObj.name)
                  : t.search.nothingFound}
              </p>
              {channelObj.id !== "all" && (
                <button
                  type="button"
                  onClick={() => setActiveChannel("all")}
                  className="mt-1 cursor-pointer rounded-md bg-fg px-3.5 py-1.5 text-xs font-semibold text-bg hover:opacity-90"
                >
                  {t.videoke.searchAllChannels}
                </button>
              )}
            </div>
          )}

          {!loading && !error && displayedResults && displayedResults.length > 0 && (
            <ul className="divide-y divide-line">
              {displayedResults.map((track) => {
                const isCurrent = currentTrack?.id === track.id;
                const reservedIdx = upNext.findIndex((x) => x.track.id === track.id);
                const code = songbookCode(track.id);
                return (
                  <li
                    key={track.id}
                    className={cn(
                      "group flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors duration-150 hover:bg-surface-2",
                      isCurrent && "bg-surface-2",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => singNow(track)}
                      aria-label={`${t.videoke.singNow}: ${track.title}`}
                      className="relative aspect-video w-20 shrink-0 cursor-pointer overflow-hidden rounded-sm bg-surface-3 sm:w-22"
                    >
                      <Artwork
                        src={track.thumb}
                        fallback={track.art}
                        className="size-full object-cover"
                      />
                      <span className="absolute inset-0 grid place-items-center bg-black/45 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                        <PlayIcon size={15} weight="fill" className="text-white" />
                      </span>
                      {track.duration > 0 && (
                        <span className="absolute right-1 bottom-1 rounded-xs bg-black/75 px-1 py-0.5 text-[10px] font-medium text-white tabular-nums">
                          {formatTime(track.duration)}
                        </span>
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => singNow(track)}
                        className={cn(
                          "line-clamp-1 cursor-pointer text-left text-[13.5px] leading-snug font-medium hover:underline",
                          isCurrent ? "text-accent-text font-semibold" : "text-fg",
                        )}
                      >
                        {track.title}
                      </button>
                      <p className="mt-0.5 truncate text-xs text-fg-2 tabular-nums">
                        {track.artist}
                        <span className="text-fg-3"> · #{code}</span>
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => reserve(track)}
                        disabled={reservedIdx >= 0 || isCurrent}
                        className={cn(
                          "flex h-8 cursor-pointer items-center gap-1 rounded-md px-2.5 text-xs font-medium transition-colors duration-150",
                          reservedIdx >= 0
                            ? "bg-accent-soft text-accent-text"
                            : isCurrent
                              ? "bg-surface-3 text-fg-3"
                              : "bg-surface-2 text-fg-2 hover:bg-surface-3 hover:text-fg",
                        )}
                      >
                        {reservedIdx >= 0 ? <ListPlusIcon size={13} /> : <PlusIcon size={13} />}
                        <span className="hidden sm:inline">
                          {reservedIdx >= 0 ? `#${reservedIdx + 1}` : isCurrent ? t.videoke.singing : t.videoke.reserve}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => singNow(track)}
                        className="flex h-8 cursor-pointer items-center gap-1 rounded-md bg-fg px-3 text-xs font-semibold text-bg transition-opacity duration-150 hover:opacity-90"
                      >
                        <PlayIcon size={11} weight="fill" />
                        <span>{isCurrent ? t.videoke.restart : t.videoke.sing}</span>
                      </button>
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
