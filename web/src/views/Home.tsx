import { CaretDownIcon, CaretUpIcon, ClockCounterClockwiseIcon, DownloadSimpleIcon, HeartIcon, PlayIcon, TrendUpIcon } from "@phosphor-icons/react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { Artwork } from "../components/Artwork";
import { BrowseAllGrid, MoodCollections } from "../components/GenrePanel";
import { PageHeader, Section } from "../components/Page";
import { TrackList, TrackListSkeleton } from "../components/TrackList";
import { useI18n, useT } from "../i18n";
import { api } from "../lib/api";
import { cn } from "../lib/format";
import { paths } from "../lib/routes";
import type { ChartsData, Track } from "../lib/types";
import { usePlayer } from "../player/player";
import { useAppearance } from "../stores/appearance";
import { useLibrary } from "../stores/library";
import { useOffline } from "../stores/offline";

let chartsMemo: { lang: string; data: ChartsData } | null = null;

function Shortcut({ to, label, tracks, cover }: { to: string; label: string; tracks: Track[]; cover: ReactNode }) {
  const playList = usePlayer((s) => s.playList);
  const t = useT();
  return (
    <div className="group relative flex h-14 items-center gap-3 overflow-hidden rounded-[12px] bg-surface-2 pr-2 transition-colors hover:bg-surface-3 md:h-16">
      <Link to={to} className="absolute inset-0" aria-label={label} />
      <span className="pointer-events-none size-14 shrink-0 overflow-hidden md:size-16">{cover}</span>
      <span className="pointer-events-none min-w-0 flex-1 truncate text-[13px] font-semibold md:text-sm">{label}</span>
      {tracks.length > 0 && (
        <button
          type="button"
          onClick={() => playList(tracks, 0)}
          aria-label={t.common.playX(label)}
          className="relative z-10 hidden size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-ink opacity-0 shadow-[0_6px_18px_rgb(0_0_0/0.35)] transition-[opacity,transform] duration-200 ease-out-expo group-hover:opacity-100 hover:scale-105 active:scale-95 md:grid"
        >
          <PlayIcon size={18} weight="fill" />
        </button>
      )}
    </div>
  );
}

function RecentCard({ track, onPlay }: { track: Track; onPlay: () => void }) {
  return (
    <button type="button" onClick={onPlay} className="group flex w-36 shrink-0 snap-start flex-col gap-2 text-left md:w-44">
      <span className="relative block">
        <Artwork src={track.art} fallback={track.thumb} className="aspect-square w-full rounded-[14px]" />
        <span className="absolute right-2 bottom-2 grid size-11 translate-y-1 place-items-center rounded-full bg-accent text-accent-ink opacity-0 shadow-[0_8px_20px_rgb(0_0_0/0.4)] transition-[opacity,transform] duration-200 ease-out-expo group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:opacity-100">
          <PlayIcon size={20} weight="fill" />
        </span>
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{track.title}</span>
        <span className="block truncate text-xs text-fg-2">{track.artist}</span>
      </span>
    </button>
  );
}

function Top50Section() {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const playList = usePlayer((s) => s.playList);
  const [charts, setCharts] = useState<ChartsData | null>(() => (chartsMemo?.lang === lang ? chartsMemo.data : null));
  const [loading, setLoading] = useState(!charts);
  const [tab, setTab] = useState<"global" | "trending">("global");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (chartsMemo?.lang === lang) {
      setCharts(chartsMemo.data);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    api
      .charts(ctrl.signal)
      .then((data) => {
        chartsMemo = { lang, data };
        setCharts(data);
        setLoading(false);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [lang]);

  const activeTracks = (tab === "global" ? charts?.global : charts?.trending) ?? [];
  const visibleTracks = expanded ? activeTracks : activeTracks.slice(0, 10);

  return (
    <Section
      title={t.home.top50Title}
      action={
        activeTracks.length > 0 ? (
          <button
            type="button"
            onClick={() => playList(activeTracks, 0)}
            className="flex h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-xs font-semibold text-accent-ink transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <PlayIcon size={14} weight="fill" /> {t.home.playTop50}
          </button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 md:px-6">
          <div role="tablist" aria-label={t.home.top50Title} className="flex gap-2">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "global"}
              onClick={() => setTab("global")}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold transition-colors",
                tab === "global" ? "bg-fg text-bg" : "bg-surface-2 text-fg-2 ring-1 ring-line hover:bg-surface-3 hover:text-fg",
              )}
            >
              <TrendUpIcon size={15} weight="bold" />
              {t.home.top50Global}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "trending"}
              onClick={() => setTab("trending")}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold transition-colors",
                tab === "trending" ? "bg-fg text-bg" : "bg-surface-2 text-fg-2 ring-1 ring-line hover:bg-surface-3 hover:text-fg",
              )}
            >
              <TrendUpIcon size={15} weight="bold" />
              {t.home.top50Trending(charts?.region)}
            </button>
          </div>
        </div>

        {loading ? (
          <TrackListSkeleton rows={8} />
        ) : activeTracks.length > 0 ? (
          <div className="px-2 md:px-3">
            <TrackList tracks={visibleTracks} context={activeTracks} header={false} showAlbum={false} />
            {activeTracks.length > 10 && (
              <div className="mt-2 flex justify-center px-2">
                <button
                  type="button"
                  onClick={() => setExpanded((e) => !e)}
                  className="flex h-10 items-center gap-1.5 rounded-full bg-surface-2 px-5 text-xs font-semibold text-fg-2 ring-1 ring-line transition-colors hover:bg-surface-3 hover:text-fg"
                >
                  {expanded ? (
                    <>
                      <CaretUpIcon size={14} weight="bold" />
                      {t.home.showTop10}
                    </>
                  ) : (
                    <>
                      <CaretDownIcon size={14} weight="bold" />
                      {t.home.showAll50(activeTracks.length)}
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
    <div className="pb-8">
      <PageHeader />

      <div className="px-4 pt-2 pb-6 md:px-6 md:pt-8">
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight md:text-4xl">{t.time.greeting(new Date().getHours())}</h1>
      </div>

      {status === "loading" && <TrackListSkeleton rows={6} />}

      {status === "ready" && (
        <div className="flex flex-col gap-10">
          {!empty && show.homeShortcuts && (
            <div className="grid grid-cols-2 gap-2 px-4 md:px-6 lg:grid-cols-3 2xl:grid-cols-4">
              <Shortcut
                to={paths.favorites}
                label={t.nav.favorites}
                tracks={favorites}
                cover={
                  <span className="grid size-full place-items-center bg-accent-soft text-accent-text">
                    <HeartIcon size={24} weight="fill" />
                  </span>
                }
              />
              <Shortcut
                to={paths.downloads}
                label={t.nav.downloads}
                tracks={offlineTracks}
                cover={
                  <span className="grid size-full place-items-center bg-surface-3 text-accent-text">
                    <DownloadSimpleIcon size={24} weight="bold" />
                  </span>
                }
              />
              <Shortcut
                to={paths.history}
                label={t.nav.recentlyPlayed}
                tracks={history}
                cover={
                  <span className="grid size-full place-items-center bg-surface-3 text-fg-2">
                    <ClockCounterClockwiseIcon size={24} />
                  </span>
                }
              />
              {playlists.slice(0, 6).map((p) => (
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
              <Link to={paths.search} className="text-sm font-medium text-fg-2 hover:text-fg">
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
                <Link to={paths.history} className="text-sm font-medium text-fg-2 hover:text-fg">
                  {t.home.seeAll}
                </Link>
              }
            >
              <div className="no-scrollbar flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 md:scroll-px-6 md:px-6">
                {history.slice(0, 16).map((t, i) => (
                  <RecentCard key={t.id} track={t} onPlay={() => playList(history, i)} />
                ))}
              </div>
            </Section>
          )}

          {show.homeFavorites && favorites.length > 0 && (
            <Section
              title={t.home.yourFavorites}
              action={
                <Link to={paths.favorites} className="text-sm font-medium text-fg-2 hover:text-fg">
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
              <Link to={paths.search} className="text-sm font-medium text-fg-2 hover:text-fg">
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
