import {
  CaretDownIcon,
  CaretUpIcon,
  CheckCircleIcon,
  ClockCounterClockwiseIcon,
  DotsThreeIcon,
  DownloadSimpleIcon,
  HeartIcon,
  PlayIcon,
} from "@phosphor-icons/react";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
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

const chartsCache = new Map<string, ChartsData>();

function Shortcut({ to, label, tracks, cover }: { to: string; label: string; tracks: Track[]; cover: ReactNode }) {
  const playList = usePlayer((s) => s.playList);
  const t = useT();
  return (
    <div className="group relative flex h-14 items-center gap-2.5 overflow-hidden rounded-[12px] bg-fg/[0.05] pr-2 transition-all hover:bg-surface-3 active:scale-[0.98] sm:gap-3 sm:pr-2.5">
      <Link to={to} className="absolute inset-0" aria-label={label} />
      <span className="pointer-events-none size-14 shrink-0 overflow-hidden">{cover}</span>
      <span className="pointer-events-none min-w-0 flex-1 truncate text-[13px] font-semibold tracking-tight">{label}</span>
      {tracks.length > 0 && (
        <button
          type="button"
          onClick={() => playList(tracks, 0)}
          aria-label={t.common.playX(label)}
          className="relative z-10 grid size-8 shrink-0 place-items-center rounded-full bg-accent text-accent-ink opacity-0 shadow-sm transition-all duration-150 group-hover:opacity-100 hover:scale-105 active:scale-95"
        >
          <PlayIcon size={14} weight="fill" />
        </button>
      )}
    </div>
  );
}

function RecentCard({ track, onPlay }: { track: Track; onPlay: () => void }) {
  return (
    <button type="button" onClick={onPlay} className="group flex w-36 shrink-0 snap-start flex-col gap-2 text-left md:w-42">
      <span className="relative block overflow-hidden rounded-[12px] shadow-sm">
        <Artwork src={track.art} fallback={track.thumb} className="aspect-square w-full transition-transform duration-300 group-hover:scale-[1.03]" />
        <span className="absolute right-2 bottom-2 grid size-9 translate-y-1 place-items-center rounded-full bg-black/65 text-white opacity-0 backdrop-blur-md transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:opacity-100">
          <PlayIcon size={16} weight="fill" />
        </span>
      </span>
      <span className="min-w-0 px-0.5">
        <span className="block truncate text-[13px] font-medium tracking-tight text-fg">{track.title}</span>
        <span className="block truncate text-xs text-fg-2">{track.artist}</span>
      </span>
    </button>
  );
}

function ChartTrackCell({
  track,
  rank,
  onPlay,
}: {
  track: Track;
  rank: number;
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
      x: fromButton ? Math.max(12, r.right - 220) : e.clientX,
      y: fromButton ? r.bottom + 6 : e.clientY,
    });
  };

  return (
    <li
      onContextMenu={menuAt}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-[10px] px-2 py-1.5 transition-all duration-150 hover:bg-fg/[0.05] active:scale-[0.99] active:bg-fg/[0.08]",
        isCurrent && "bg-surface-2/80",
      )}
    >
      <button
        type="button"
        onClick={onPlay}
        aria-label={t.common.playX(track.title)}
        className="absolute inset-0 rounded-[10px] focus-visible:outline-offset-[-2px]"
      />

      {/* Artwork with Apple Music hover play overlay */}
      <div className="pointer-events-none relative size-11 shrink-0 overflow-hidden rounded-[8px] shadow-xs">
        <Artwork src={track.thumb} className="size-full object-cover" />
        <span
          className={cn(
            "absolute inset-0 grid place-items-center bg-black/45 text-white transition-opacity duration-150",
            isCurrent ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        >
          {isCurrent ? <Equalizer live={isPlaying} /> : <PlayIcon size={16} weight="fill" />}
        </span>
      </div>

      {/* Rank Number (Apple Music tabular chart numeral) */}
      <span
        className={cn(
          "pointer-events-none w-5 shrink-0 text-center text-[13px] font-semibold tabular-nums",
          isCurrent ? "text-accent-text" : "text-fg-3",
        )}
      >
        {rank}
      </span>

      {/* Title & Artist */}
      <div className="pointer-events-none min-w-0 flex-1 border-b border-line/50 py-1.5 group-hover:border-transparent">
        <p className={cn("truncate text-[13.5px] leading-snug font-medium tracking-tight", isCurrent ? "text-accent-text" : "text-fg")}>
          {track.title}
        </p>
        <p className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-fg-2">
          {isOffline && <CheckCircleIcon size={12} weight="fill" className="shrink-0 text-accent-text" />}
          <span className="truncate">{track.artist || t.common.youtube}</span>
        </p>
      </div>

      {/* Right metadata / hover actions */}
      <div className="relative z-10 flex shrink-0 items-center gap-0.5">
        <span className="pointer-events-none hidden pr-1 font-mono text-[11.5px] text-fg-3 tabular-nums sm:inline group-hover:hidden">
          {track.duration ? formatTime(track.duration) : ""}
        </span>
        <button
          type="button"
          onClick={() => void toggleFavorite(track)}
          aria-label={isFavorite ? t.common.removeFromFavorites : t.common.addToFavorites}
          className={cn(
            "size-8 place-items-center rounded-full transition-colors md:size-7 md:group-hover:grid",
            isFavorite ? "grid text-accent-text" : "hidden text-fg-2 hover:bg-surface-3 hover:text-fg",
          )}
        >
          <HeartIcon size={15} weight={isFavorite ? "fill" : "regular"} />
        </button>
        <button
          type="button"
          onClick={menuAt}
          aria-label={t.trackList.moreFor(track.title)}
          className="grid size-8 place-items-center rounded-full text-fg-2 transition-colors md:hidden md:size-7 md:group-hover:grid hover:bg-surface-3 hover:text-fg"
        >
          <DotsThreeIcon size={18} weight="bold" />
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
  const [charts, setCharts] = useState<ChartsData | null>(() => chartsCache.get(cacheKey) ?? null);
  const [loading, setLoading] = useState(!charts);
  const [tab, setTab] = useState<"global" | "trending">("global");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const cached = chartsCache.get(cacheKey);
    if (cached) {
      setCharts(cached);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    api
      .charts(ctrl.signal, region)
      .then((data) => {
        chartsCache.set(cacheKey, data);
        setCharts(data);
        setLoading(false);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [cacheKey, region]);

  const activeTracks = (tab === "global" ? charts?.global : charts?.trending) ?? [];
  const defaultCount = 20;
  const visibleTracks = expanded ? activeTracks : activeTracks.slice(0, defaultCount);

  const countries = [
    { id: "GLOBAL", label: "Global" },
    { id: "US", label: "United States" },
    { id: "PH", label: "Philippines" },
    { id: "GB", label: "UK" },
  ];

  return (
    <Section
      title={
        <div className="flex max-w-full flex-wrap items-center gap-2.5 sm:gap-3">
          <span className="whitespace-nowrap">{t.home.top50Title}</span>
          <div
            role="tablist"
            aria-label="Country Filter"
            className="no-scrollbar flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-fg/[0.07] p-1"
          >
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
                  "h-6.5 shrink-0 rounded-full px-3 text-xs font-medium whitespace-nowrap transition-colors",
                  region === c.id ? "bg-surface-4 text-fg shadow-2xs font-semibold" : "text-fg-2 hover:text-fg",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      }
      action={
        <div className="flex items-center gap-2 shrink-0">
          {activeTracks.length > 0 && (
            <button
              type="button"
              onClick={() => playList(activeTracks, 0)}
              aria-label={t.home.playTop50}
              title={t.home.playTop50}
              className="flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-accent text-accent-ink font-semibold text-xs whitespace-nowrap shadow-sm transition-transform hover:scale-105 active:scale-95 shrink-0"
            >
              <PlayIcon size={13} weight="fill" />
              <span>{t.home.playTop50}</span>
            </button>
          )}
          <div
            role="tablist"
            aria-label={t.home.top50Title}
            className="flex items-center rounded-lg bg-fg/[0.07] p-0.5 shrink-0"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "global"}
              onClick={() => setTab("global")}
              className={cn(
                "h-7 rounded-[6px] px-2.5 text-xs font-medium whitespace-nowrap transition-colors",
                tab === "global" ? "bg-surface-4 text-fg shadow-2xs" : "text-fg-2 hover:text-fg",
              )}
            >
              {t.home.top50Global}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "trending"}
              onClick={() => setTab("trending")}
              className={cn(
                "h-7 rounded-[6px] px-2.5 text-xs font-medium whitespace-nowrap transition-colors",
                tab === "trending" ? "bg-surface-4 text-fg shadow-2xs" : "text-fg-2 hover:text-fg",
              )}
            >
              {t.home.top50Trending(charts?.region)}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {loading ? (
          <TrackListSkeleton rows={8} />
        ) : activeTracks.length > 0 ? (
          <div className="px-3 md:px-5">
            {/* Responsive 1 to 5 Column Apple Music Chart Grid adapting to container width */}
            <ol className="grid grid-cols-1 gap-x-5 gap-y-0.5 @[500px]/home:grid-cols-2 @[780px]/home:grid-cols-3 @[1060px]/home:grid-cols-4 @[1360px]/home:grid-cols-5">
              {visibleTracks.map((tr, i) => (
                <ChartTrackCell
                  key={tr.id}
                  track={tr}
                  rank={i + 1}
                  onPlay={() => playList(activeTracks, i)}
                />
              ))}
            </ol>

            {activeTracks.length > defaultCount && (
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={() => setExpanded((e) => !e)}
                  className="flex h-8 items-center gap-1.5 rounded-lg bg-surface-2 px-4 text-xs font-medium text-fg-2 transition-colors hover:bg-surface-3 hover:text-fg"
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
  const empty = status === "ready" && !favorites.length && !playlists.length && !history.length && !offlineTracks.length;

  return (
    <div className="@container/home pb-8">
      <PageHeader />

      <div className="px-4 pt-2 pb-4 md:px-6 md:pt-4">
        <h1 className="text-2xl leading-tight font-bold tracking-tight md:text-[28px]">
          {t.time.greeting(new Date().getHours())}
        </h1>
      </div>

      {status === "loading" && <TrackListSkeleton rows={6} />}

      {status === "ready" && (
        <div className="flex flex-col gap-8">
          {!empty && show.homeShortcuts && (
            <div className="grid grid-cols-2 gap-2 px-4 sm:gap-2.5 @[720px]/home:grid-cols-3 @[1040px]/home:grid-cols-4 md:px-6">
              <Shortcut
                to={paths.favorites}
                label={t.nav.favorites}
                tracks={favorites}
                cover={
                  <span className="grid size-full place-items-center bg-accent-soft text-accent-text">
                    <HeartIcon size={22} weight="fill" />
                  </span>
                }
              />
              <Shortcut
                to={paths.downloads}
                label={t.nav.downloads}
                tracks={offlineTracks}
                cover={
                  <span className="grid size-full place-items-center bg-surface-3 text-accent-text">
                    <DownloadSimpleIcon size={22} />
                  </span>
                }
              />
              <Shortcut
                to={paths.history}
                label={t.nav.recentlyPlayed}
                tracks={history}
                cover={
                  <span className="grid size-full place-items-center bg-surface-3 text-fg-2">
                    <ClockCounterClockwiseIcon size={22} />
                  </span>
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

          {show.homeRecent && history.length > 0 && (
            <Section
              title={t.nav.recentlyPlayed}
              action={
                <Link to={paths.history} className="text-xs font-medium text-fg-2 hover:text-fg">
                  {t.home.seeAll}
                </Link>
              }
            >
              <div className="no-scrollbar flex snap-x snap-mandatory scroll-px-4 gap-3.5 overflow-x-auto px-4 md:scroll-px-6 md:px-6">
                {history.slice(0, 16).map((tr, i) => (
                  <RecentCard key={tr.id} track={tr} onPlay={() => playList(history, i)} />
                ))}
              </div>
            </Section>
          )}

          {show.homeFavorites && favorites.length > 0 && (
            <Section
              title={t.home.yourFavorites}
              action={
                <Link to={paths.favorites} className="text-xs font-medium text-fg-2 hover:text-fg">
                  {t.home.seeAll}
                </Link>
              }
            >
              <div className="px-2 md:px-3">
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
