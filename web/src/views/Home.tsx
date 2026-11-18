import {
  ArrowsClockwiseIcon,
  CaretDownIcon,
  CaretUpIcon,
  CheckCircleIcon,
  ClockCounterClockwiseIcon,
  DotsThreeIcon,
  DownloadSimpleIcon,
  HeartIcon,
  PlayIcon,
} from "../components/icons";
import { useCallback, useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { Link } from "react-router";
import { Artwork } from "../components/Artwork";
import { Equalizer } from "../components/Brand";
import { BrowseAllGrid, MoodCollections } from "../components/GenrePanel";
import { PageHeader, Section } from "../components/Page";
import { TrackList, TrackListSkeleton } from "../components/TrackList";
import { useI18n, useT } from "../i18n";
import { api } from "../lib/api";
import { cn, formatTime } from "../lib/format";
import { paths } from "../lib/routes";
import type { ChartsData, Track } from "../lib/types";
import { selectCurrent, usePlayer } from "../player/player";
import { useAppearance } from "../stores/appearance";
import { useLibrary } from "../stores/library";
import { useOffline } from "../stores/offline";
import { useUi } from "../stores/ui";

const CHARTS_TTL_MS = 3 * 60_000;
const chartsCache = new Map<string, { data: ChartsData; fetchedAt: number }>();

function Shortcut({ to, label, tracks, cover }: { to: string; label: string; tracks: Track[]; cover: ReactNode }) {
  const playList = usePlayer((s) => s.playList);
  const currentId = usePlayer((s) => selectCurrent(s)?.id ?? null);
  const isPlaying = usePlayer((s) => s.status === "playing");
  const hasCurrent = !!currentId && tracks.some((tr) => tr.id === currentId);
  const t = useT();
  return (
    <div className="group relative flex h-13 items-center gap-3 overflow-hidden rounded-md bg-surface-2 pr-2.5 transition-colors duration-150 hover:bg-surface-3">
      <Link to={to} className="absolute inset-0" aria-label={label} />
      <span className="pointer-events-none size-13 shrink-0 overflow-hidden">{cover}</span>
      <span className="pointer-events-none min-w-0 flex-1 truncate text-[13.5px] font-semibold tracking-tight text-fg">
        {label}
      </span>
      {hasCurrent && isPlaying ? (
        <span className="pointer-events-none relative z-10 pr-1 text-accent-text">
          <Equalizer live />
        </span>
      ) : tracks.length > 0 ? (
        <button
          type="button"
          onClick={() => playList(tracks, 0)}
          aria-label={t.common.playX(label)}
          className="relative z-10 grid size-8 shrink-0 cursor-pointer place-items-center rounded-full bg-accent text-accent-ink opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 active:scale-95"
        >
          <PlayIcon size={14} weight="fill" className="translate-x-[1px]" />
        </button>
      ) : null}
    </div>
  );
}

function RecentCard({ track, onPlay }: { track: Track; onPlay: () => void }) {
  const isCurrent = usePlayer((s) => selectCurrent(s)?.id === track.id);
  const isPlaying = usePlayer((s) => s.status === "playing" || s.status === "loading");
  return (
    <button
      type="button"
      onClick={onPlay}
      className="group flex w-34 shrink-0 cursor-pointer snap-start flex-col gap-2 rounded-lg p-2 text-left transition-colors duration-150 hover:bg-surface-2 md:w-38"
    >
      <span className="relative block aspect-square w-full overflow-hidden rounded-md bg-surface-3">
        <Artwork src={track.art} fallback={track.thumb} className="size-full object-cover" />
        {isCurrent ? (
          <span className="absolute right-2 bottom-2 grid size-9 place-items-center rounded-full bg-accent text-accent-ink shadow-md">
            <Equalizer live={isPlaying} />
          </span>
        ) : (
          <span className="absolute right-2 bottom-2 grid size-9 translate-y-1 place-items-center rounded-full bg-accent text-accent-ink opacity-0 shadow-md transition-[transform,opacity] duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:opacity-100">
            <PlayIcon size={16} weight="fill" className="translate-x-[1px]" />
          </span>
        )}
      </span>
      <span className="min-w-0">
        <span className={cn("block truncate text-[13px] font-medium leading-snug", isCurrent ? "text-accent-text" : "text-fg")}>
          {track.title}
        </span>
        <span className="mt-0.5 block truncate text-[12px] text-fg-2 leading-snug">{track.artist}</span>
      </span>
    </button>
  );
}

function ChartTrackCell({
  track,
  rank,
  context,
  onPlay,
}: {
  track: Track;
  rank: number;
  context: Track[];
  onPlay: () => void;
}) {
  const isCurrent = usePlayer((s) => selectCurrent(s)?.id === track.id);
  const isPlaying = usePlayer((s) => s.status === "playing" || s.status === "loading");
  const isFavorite = useLibrary((s) => s.favorites.some((t) => t.id === track.id));
  const isOffline = useOffline((s) => s.tracks.some((t) => t.id === track.id));
  const toggleFavorite = useLibrary((s) => s.toggleFavorite);
  const openMenu = useUi((s) => s.openMenu);
  const t = useT();

  const menuAt = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const fromButton = e.type === "click";
    openMenu({
      track,
      context,
      ordered: true,
      x: fromButton ? Math.max(12, r.right - 220) : e.clientX,
      y: fromButton ? r.bottom + 6 : e.clientY,
    });
  };

  return (
    <li
      onContextMenu={menuAt}
      className={cn(
        "group relative mb-0.5 flex break-inside-avoid items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors duration-150 hover:bg-surface-2",
        isCurrent && "bg-surface-2",
      )}
    >
      <button
        type="button"
        onClick={onPlay}
        aria-label={t.common.playX(track.title)}
        className="absolute inset-0 cursor-pointer rounded-md focus-visible:outline-offset-[-2px]"
      />

      <span
        className={cn(
          "pointer-events-none w-5 shrink-0 text-right text-[12.5px] font-medium tabular-nums",
          isCurrent ? "text-accent-text font-semibold" : "text-fg-3",
        )}
      >
        {rank}
      </span>

      <div className="pointer-events-none relative size-10 shrink-0 overflow-hidden rounded-sm bg-surface-3">
        <Artwork src={track.thumb} className="size-full object-cover" />
        <span
          className={cn(
            "absolute inset-0 grid place-items-center bg-black/50 text-white transition-opacity duration-150",
            isCurrent ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        >
          {isCurrent ? <Equalizer live={isPlaying} /> : <PlayIcon size={15} weight="fill" />}
        </span>
      </div>

      <div className="pointer-events-none min-w-0 flex-1">
        <p className={cn("truncate text-[13.5px] leading-snug font-medium", isCurrent ? "text-accent-text" : "text-fg")}>
          {track.title}
        </p>
        <p className="flex items-center gap-1 truncate text-[12px] text-fg-2 leading-snug">
          {isOffline && <CheckCircleIcon size={12} weight="fill" className="shrink-0 text-accent-text" />}
          <span className="truncate">{track.artist || t.common.youtube}</span>
        </p>
      </div>

      <div className="relative z-10 flex shrink-0 items-center gap-0.5">
        <span className="pointer-events-none hidden pr-1 text-[11.5px] text-fg-3 tabular-nums sm:inline group-hover:hidden">
          {track.duration ? formatTime(track.duration) : ""}
        </span>
        <button
          type="button"
          onClick={() => void toggleFavorite(track)}
          aria-label={isFavorite ? t.common.removeFromFavorites : t.common.addToFavorites}
          className={cn(
            "size-7 cursor-pointer place-items-center rounded-md transition-colors duration-150 md:group-hover:grid",
            isFavorite ? "grid text-accent-text" : "hidden text-fg-2 hover:bg-surface-3 hover:text-fg",
          )}
        >
          <HeartIcon size={15} weight={isFavorite ? "fill" : "regular"} />
        </button>
        <button
          type="button"
          onClick={menuAt}
          aria-label={t.trackList.moreFor(track.title)}
          className="grid size-7 cursor-pointer place-items-center rounded-md text-fg-2 transition-colors duration-150 md:hidden md:group-hover:grid hover:bg-surface-3 hover:text-fg"
        >
          <DotsThreeIcon size={17} weight="bold" />
        </button>
      </div>
    </li>
  );
}

function Top50Section() {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const playList = usePlayer((s) => s.playList);
  const [region, setRegion] = useState<string>(() => {
    try {
      return localStorage.getItem("musike:chart-region") || "GLOBAL";
    } catch {
      return "GLOBAL";
    }
  });
  const cacheKey = `${lang}:${region}`;
  const [charts, setCharts] = useState<ChartsData | null>(() => chartsCache.get(cacheKey)?.data ?? null);
  const [loading, setLoading] = useState(!charts);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<"global" | "trending">("global");
  const [expanded, setExpanded] = useState(false);

  const fetchCharts = useCallback(
    (force = false, signal?: AbortSignal) => {
      const entry = chartsCache.get(cacheKey);
      const isFresh = entry && Date.now() - entry.fetchedAt < CHARTS_TTL_MS;
      if (entry) {
        setCharts(entry.data);
        setLoading(false);
      }
      if (!force && isFresh) return;

      if (entry) setRefreshing(true);
      else setLoading(true);

      api
        .charts(signal, region)
        .then((data) => {
          chartsCache.set(cacheKey, { data, fetchedAt: Date.now() });
          setCharts(data);
          setLoading(false);
          setRefreshing(false);
        })
        .catch(() => {
          if (!signal?.aborted) {
            setLoading(false);
            setRefreshing(false);
          }
        });
    },
    [cacheKey, region],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    fetchCharts(false, ctrl.signal);
    const interval = setInterval(() => fetchCharts(true), CHARTS_TTL_MS);
    const onFocus = () => fetchCharts(false);
    window.addEventListener("focus", onFocus);
    return () => {
      ctrl.abort();
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchCharts]);

  const activeTracks = (tab === "global" ? charts?.global : charts?.trending) ?? [];
  const defaultCount = 16;
  const visibleTracks = expanded ? activeTracks : activeTracks.slice(0, defaultCount);

  const countries = [
    { id: "GLOBAL", label: "Global" },
    { id: "US", label: "United States" },
    { id: "PH", label: "Philippines" },
    { id: "GB", label: "UK" },
  ];
  const primaryTabLabel = region === "GLOBAL" ? t.home.top50Global : (charts?.region || region);

  return (
    <Section
      title={t.home.top50Title}
      action={
        <div className="flex shrink-0 items-center gap-1.5">
          {activeTracks.length > 0 && (
            <button
              type="button"
              onClick={() => playList(activeTracks, 0, { ordered: true })}
              aria-label={t.home.playTop50}
              className="flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-surface-2 px-3 text-xs font-medium text-fg transition-colors duration-150 hover:bg-surface-3"
            >
              <PlayIcon size={12} weight="fill" />
              <span>{t.common.playAll}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => fetchCharts(true)}
            title="Refresh charts"
            aria-label="Refresh charts"
            className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-fg-2 transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
          >
            <ArrowsClockwiseIcon size={15} className={cn(refreshing && "animate-spin text-accent-text")} />
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 md:px-6">
          <div role="tablist" aria-label="Chart region" className="no-scrollbar flex items-center gap-1.5 overflow-x-auto">
            {countries.map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={region === c.id}
                onClick={() => {
                  setRegion(c.id);
                  try {
                    localStorage.setItem("musike:chart-region", c.id);
                  } catch {
                    /* ignore */
                  }
                }}
                className={cn(
                  "h-7 shrink-0 cursor-pointer rounded-md px-3 text-xs font-medium whitespace-nowrap transition-colors duration-150",
                  region === c.id
                    ? "bg-fg text-bg font-semibold"
                    : "bg-surface-2 text-fg-2 hover:bg-surface-3 hover:text-fg",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div role="tablist" aria-label={t.home.top50Title} className="flex items-center gap-3 text-xs">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "global"}
              onClick={() => setTab("global")}
              className={cn(
                "cursor-pointer border-b-2 pb-1 font-medium whitespace-nowrap transition-colors duration-150",
                tab === "global" ? "border-accent text-fg font-semibold" : "border-transparent text-fg-3 hover:text-fg-2",
              )}
            >
              {primaryTabLabel}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "trending"}
              onClick={() => setTab("trending")}
              className={cn(
                "cursor-pointer border-b-2 pb-1 font-medium whitespace-nowrap transition-colors duration-150",
                tab === "trending" ? "border-accent text-fg font-semibold" : "border-transparent text-fg-3 hover:text-fg-2",
              )}
            >
              Trending
            </button>
          </div>
        </div>

        {loading ? (
          <TrackListSkeleton rows={8} />
        ) : activeTracks.length > 0 ? (
          <div className="px-2 md:px-4">
            <ol className="columns-1 gap-x-6 @[640px]/home:columns-2 @[1080px]/home:columns-3 @[1440px]/home:columns-4">
              {visibleTracks.map((tr, i) => (
                <ChartTrackCell
                  key={tr.id}
                  track={tr}
                  rank={i + 1}
                  context={activeTracks}
                  onPlay={() => playList(activeTracks, i, { ordered: true })}
                />
              ))}
            </ol>

            {activeTracks.length > defaultCount && (
              <div className="mt-3 px-2">
                <button
                  type="button"
                  onClick={() => setExpanded((e) => !e)}
                  className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-3 text-xs font-medium text-fg-2 transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
                >
                  {expanded ? (
                    <>
                      <CaretUpIcon size={13} />
                      <span>{t.home.showTop10}</span>
                    </>
                  ) : (
                    <>
                      <CaretDownIcon size={13} />
                      <span>{t.home.showAll50(activeTracks.length)}</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </Section>
  );
}

export default function Home() {
  const { favorites, playlists, history, status } = useLibrary();
  const offlineTracks = useOffline((s) => s.tracks);
  const playList = usePlayer((s) => s.playList);
  const t = useT();
  const show = useAppearance();
  const [hour, setHour] = useState(() => new Date().getHours());

  useEffect(() => {
    const id = setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => clearInterval(id);
  }, []);

  const empty = status === "ready" && !favorites.length && !playlists.length && !history.length && !offlineTracks.length;

  return (
    <div className="@container/home pb-10">
      <PageHeader />

      <div className="px-4 pt-3 pb-4 md:px-6 md:pt-5">
        <h1 className="text-2xl leading-tight font-bold tracking-tight md:text-[26px]">
          {t.time.greeting(hour)}
        </h1>
      </div>

      {status === "loading" && <TrackListSkeleton rows={6} />}

      {status === "ready" && (
        <div className="flex flex-col gap-9">
          {!empty && show.homeShortcuts && (
            <div className="grid grid-cols-2 gap-2.5 px-4 @[700px]/home:grid-cols-3 @[1020px]/home:grid-cols-4 md:px-6">
              <Shortcut
                to={paths.favorites}
                label={t.nav.favorites}
                tracks={favorites}
                cover={
                  <span className="grid size-full place-items-center bg-accent-soft text-accent-text">
                    <HeartIcon size={20} weight="fill" />
                  </span>
                }
              />
              <Shortcut
                to={paths.downloads}
                label={t.nav.downloads}
                tracks={offlineTracks}
                cover={
                  <span className="grid size-full place-items-center bg-surface-3 text-fg-2">
                    <DownloadSimpleIcon size={20} />
                  </span>
                }
              />
              <Shortcut
                to={paths.history}
                label={t.nav.recentlyPlayed}
                tracks={history}
                cover={
                  history[0]?.thumb ? (
                    <Artwork src={history[0].thumb} className="size-full" />
                  ) : (
                    <span className="grid size-full place-items-center bg-surface-3 text-fg-2">
                      <ClockCounterClockwiseIcon size={20} />
                    </span>
                  )
                }
              />
              {playlists.slice(0, 5).map((p) => (
                <Shortcut
                  key={p.id}
                  to={paths.playlist(p.id)}
                  label={p.name}
                  tracks={p.tracks}
                  cover={<Artwork src={p.tracks[0]?.thumb} className="size-full" />}
                />
              ))}
            </div>
          )}

          {show.homeRecent && history.length > 0 && (
            <Section
              title={t.nav.recentlyPlayed}
              action={
                <Link to={paths.history} className="text-xs font-medium text-fg-2 hover:text-fg">
                  {t.home.seeAll}
                </Link>
              }
            >
              <div className="no-scrollbar flex snap-x snap-mandatory scroll-px-4 gap-1.5 overflow-x-auto px-2 md:scroll-px-6 md:px-4">
                {history.slice(0, 16).map((tr, i) => (
                  <RecentCard key={tr.id} track={tr} onPlay={() => playList(history, i)} />
                ))}
              </div>
            </Section>
          )}

          <Top50Section />

          <Section
            title={t.home.curatedCollections}
            action={
              <Link to={paths.search} className="text-xs font-medium text-fg-2 hover:text-fg">
                {t.home.seeAll}
              </Link>
            }
          >
            <MoodCollections />
          </Section>

          {show.homeFavorites && favorites.length > 0 && (
            <Section
              title={t.home.yourFavorites}
              action={
                <Link to={paths.favorites} className="text-xs font-medium text-fg-2 hover:text-fg">
                  {t.home.seeAll}
                </Link>
              }
            >
              <div className="px-2 md:px-4">
                <TrackList tracks={favorites.slice(0, 5)} context={favorites} header={false} showAlbum={false} />
              </div>
            </Section>
          )}

          <Section
            title={t.home.exploreGenres}
            action={
              <Link to={paths.search} className="text-xs font-medium text-fg-2 hover:text-fg">
                {t.home.seeAll}
              </Link>
            }
          >
            <BrowseAllGrid limit={12} />
          </Section>
        </div>
      )}
    </div>
  );
}
