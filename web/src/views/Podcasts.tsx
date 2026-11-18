import {
  ArrowLeftIcon,
  BroadcastIcon,
  DotsThreeIcon,
  HeartIcon,
  ListPlusIcon,
  MagnifyingGlassIcon,
  PauseIcon,
  PlayIcon,
  WarningCircleIcon,
  XIcon,
} from "../components/icons";
import { useEffect, useState, type MouseEvent } from "react";
import { Artwork } from "../components/Artwork";
import { Equalizer } from "../components/Brand";
import { EmptyState, PageHeader } from "../components/Page";
import { useT } from "../i18n";
import { api } from "../lib/api";
import { cn } from "../lib/format";
import type { Track } from "../lib/types";
import { selectCurrent, usePlayer } from "../player/player";
import { useLibrary } from "../stores/library";
import { useUi } from "../stores/ui";

interface ShowInfo {
  id: string;
  name: string;
  host: string;
  category: string;
  description: string;
  query: string;
  swatch: string;
}

const POPULAR_SHOWS: ShowInfo[] = [
  {
    id: "jre",
    name: "The Joe Rogan Experience",
    host: "Joe Rogan",
    category: "Comedy & Culture",
    description: "Long-form conversations with comedians, scientists, fighters, authors, and artists.",
    query: "Joe Rogan Experience full episode podcast",
    swatch: "#451515",
  },
  {
    id: "huberman",
    name: "Huberman Lab",
    host: "Andrew Huberman, Ph.D.",
    category: "Science & Health",
    description: "Science-based tools for sleep, focus, dopamine, neuroplasticity, and physical health.",
    query: "Huberman Lab podcast full episode",
    swatch: "#13293d",
  },
  {
    id: "lex",
    name: "Lex Fridman Podcast",
    host: "Lex Fridman",
    category: "Technology & Philosophy",
    description: "Deep conversations about science, engineering, history, philosophy, and intelligence.",
    query: "Lex Fridman podcast full episode",
    swatch: "#18202c",
  },
  {
    id: "doac",
    name: "The Diary Of A CEO",
    host: "Steven Bartlett",
    category: "Business",
    description: "Unfiltered stories and lessons from founders, creators, and researchers.",
    query: "The Diary Of A CEO full episode podcast",
    swatch: "#332110",
  },
  {
    id: "conan",
    name: "Conan O'Brien Needs A Friend",
    host: "Team Coco",
    category: "Comedy",
    description: "Unscripted conversations with guests, comedians, and listeners.",
    query: "Conan O'Brien Needs A Friend full episode podcast",
    swatch: "#4a2211",
  },
  {
    id: "smartless",
    name: "SmartLess",
    host: "Jason Bateman, Sean Hayes & Will Arnett",
    category: "Comedy & Talk",
    description: "One host reveals a mystery guest to the other two for spontaneous conversation.",
    query: "SmartLess podcast full episode",
    swatch: "#113629",
  },
  {
    id: "rotten",
    name: "Rotten Mango",
    host: "Stephanie Soo",
    category: "True Crime",
    description: "Deep-dive storytelling into baffling true crime mysteries and international cases.",
    query: "Rotten Mango Stephanie Soo podcast episode",
    swatch: "#421625",
  },
  {
    id: "hardcore",
    name: "Hardcore History",
    host: "Dan Carlin",
    category: "History",
    description: "Long-form narratives exploring pivotal eras in world history.",
    query: "Dan Carlin Hardcore History podcast episode",
    swatch: "#26262a",
  },
];

const PODCAST_CATEGORIES = [
  { id: "all", label: "For You", query: "popular podcast full episode interview" },
  { id: "tech", label: "Technology", query: "technology engineering podcast full episode" },
  { id: "comedy", label: "Comedy", query: "comedy podcast full episode conversation" },
  { id: "science", label: "Science & Health", query: "neuroscience health fitness podcast full episode" },
  { id: "business", label: "Business", query: "entrepreneurship investing business podcast full episode" },
  { id: "crime", label: "True Crime", query: "true crime documentary podcast full episode" },
  { id: "history", label: "History & Culture", query: "history culture storytelling podcast full episode" },
];

function formatPodcastLength(seconds: number): string {
  if (!seconds || seconds <= 0) return "";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.max(1, Math.round((seconds % 3600) / 60));
  if (hrs > 0) return `${hrs} hr ${mins} min`;
  return `${mins} min`;
}

function ShowArtworkTile({
  show,
  episodeThumb,
  className,
}: {
  show: ShowInfo;
  episodeThumb?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("relative overflow-hidden rounded-md", className)}
      style={{ backgroundColor: show.swatch }}
    >
      {episodeThumb && (
        <Artwork
          src={episodeThumb}
          className="absolute inset-0 size-full object-cover opacity-70 transition-opacity duration-150 group-hover:opacity-85"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <div className="absolute inset-x-3 bottom-3">
        <p className="line-clamp-2 text-[13.5px] leading-snug font-bold tracking-tight text-[#f4f4f5]">
          {show.name}
        </p>
      </div>
    </div>
  );
}

function EpisodeRow({
  episode,
  onPlayEpisode,
}: {
  episode: Track;
  onPlayEpisode: () => void;
}) {
  const isCurrent = usePlayer((s) => selectCurrent(s)?.id === episode.id);
  const status = usePlayer((s) => s.status);
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration) || episode.duration || 0;
  const toggle = usePlayer((s) => s.toggle);
  const addToQueue = usePlayer((s) => s.addToQueue);
  const isFavorite = useLibrary((s) => s.favorites.some((f) => f.id === episode.id));
  const toggleFavorite = useLibrary((s) => s.toggleFavorite);
  const openMenu = useUi((s) => s.openMenu);
  const t = useT();

  const isPlaying = isCurrent && (status === "playing" || status === "loading");
  const progressPct = isCurrent && duration > 0 ? Math.min(100, Math.round((position / duration) * 100)) : 0;
  const durationLabel = formatPodcastLength(episode.duration);

  const handlePrimaryPlay = (e: MouseEvent) => {
    e.stopPropagation();
    if (isCurrent) toggle();
    else onPlayEpisode();
  };

  const handleMenu = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    openMenu({ track: episode, x: Math.max(12, r.right - 200), y: r.bottom + 6 });
  };

  return (
    <article
      className={cn(
        "group relative flex items-start gap-4 rounded-md px-3 py-4 transition-colors duration-150 hover:bg-surface-2",
        isCurrent && "bg-surface-2",
      )}
    >
      <button
        type="button"
        onClick={onPlayEpisode}
        aria-label={t.common.playX(episode.title)}
        className="absolute inset-0 cursor-pointer rounded-md focus-visible:outline-offset-[-2px]"
      />

      <div className="pointer-events-none relative z-10 size-18 shrink-0 overflow-hidden rounded-md bg-surface-3 sm:size-22">
        <Artwork src={episode.art} fallback={episode.thumb} className="size-full object-cover" />
        {isCurrent && (
          <span className="absolute right-1.5 bottom-1.5 grid size-6 place-items-center rounded-full bg-black/80 text-accent-text">
            <Equalizer live={isPlaying} />
          </span>
        )}
      </div>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col gap-2">
        <div className="pointer-events-none min-w-0">
          <h3
            className={cn(
              "line-clamp-2 text-[15px] leading-snug font-semibold tracking-tight",
              isCurrent ? "text-accent-text" : "text-fg",
            )}
          >
            {episode.title}
          </h3>
          {episode.artist && (
            <p className="mt-0.5 truncate text-[13px] text-fg-2">
              {episode.artist}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="pointer-events-none flex min-w-0 items-center gap-3 text-xs text-fg-3 tabular-nums">
            <button
              type="button"
              onClick={handlePrimaryPlay}
              aria-label={isPlaying ? t.common.pause : t.common.playX(episode.title)}
              className="pointer-events-auto grid size-8 shrink-0 cursor-pointer place-items-center rounded-full bg-fg text-bg transition-opacity duration-150 hover:opacity-90 active:scale-95"
            >
              {isPlaying ? <PauseIcon size={14} weight="fill" /> : <PlayIcon size={14} weight="fill" />}
            </button>
            {durationLabel && <span>{durationLabel}</span>}
            {isCurrent && duration > 0 && (
              <div className="flex items-center gap-2">
                <div className="h-1 w-20 overflow-hidden rounded-full bg-surface-4">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${progressPct}%` }} />
                </div>
                <span className="text-accent-text font-medium">{progressPct}%</span>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void toggleFavorite(episode);
              }}
              aria-label={isFavorite ? t.common.removeFromFavorites : t.common.addToFavorites}
              title={isFavorite ? t.common.removeFromFavorites : t.common.addToFavorites}
              className={cn(
                "grid size-8 cursor-pointer place-items-center rounded-md transition-colors duration-150 hover:bg-surface-3",
                isFavorite ? "text-accent-text" : "text-fg-2 hover:text-fg",
              )}
            >
              <HeartIcon size={16} weight={isFavorite ? "fill" : "regular"} />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                addToQueue(episode);
              }}
              title={t.trackMenu.addToQueue}
              aria-label={t.trackMenu.addToQueue}
              className="grid size-8 cursor-pointer place-items-center rounded-md text-fg-2 transition-colors duration-150 hover:bg-surface-3 hover:text-fg"
            >
              <ListPlusIcon size={17} />
            </button>

            <button
              type="button"
              onClick={handleMenu}
              aria-label={t.trackList.moreFor(episode.title)}
              className="grid size-8 cursor-pointer place-items-center rounded-md text-fg-2 transition-colors duration-150 hover:bg-surface-3 hover:text-fg"
            >
              <DotsThreeIcon size={17} weight="bold" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function Podcasts() {
  const t = useT();
  const playList = usePlayer((s) => s.playList);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [queryTerm, setQueryTerm] = useState("");
  const [selectedShow, setSelectedShow] = useState<ShowInfo | null>(null);
  const [episodes, setEpisodes] = useState<Track[] | null>(null);
  const [showThumbs, setShowThumbs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (selectedShow) return;
    const trimmed = searchInput.trim();
    if (trimmed === queryTerm) return;
    const timer = setTimeout(() => setQueryTerm(trimmed), 380);
    return () => clearTimeout(timer);
  }, [searchInput, queryTerm, selectedShow]);

  const effectiveQuery = selectedShow
    ? selectedShow.query
    : queryTerm.trim() ||
      PODCAST_CATEGORIES.find((c) => c.id === activeCategory)?.query ||
      "popular podcast full episode interview";

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError("");

    api
      .search(effectiveQuery, "podcast", ctrl.signal)
      .then((tracks) => {
        setEpisodes(tracks);
        if (selectedShow && tracks[0]?.thumb) {
          setShowThumbs((prev) => ({ ...prev, [selectedShow.id]: tracks[0]!.art || tracks[0]!.thumb }));
        }
        setLoading(false);
      })
      .catch((e: Error) => {
        if (e.name === "AbortError") return;
        setError(e.message || "Failed to load podcast episodes");
        setLoading(false);
      });

    return () => ctrl.abort();
  }, [effectiveQuery, retry, selectedShow]);

  const handleShowSelect = (show: ShowInfo) => {
    if (selectedShow?.id === show.id) {
      setSelectedShow(null);
    } else {
      setSelectedShow(show);
      setSearchInput("");
      setQueryTerm("");
    }
  };

  const handleCategorySelect = (id: string) => {
    setActiveCategory(id);
    setSelectedShow(null);
    setQueryTerm("");
    setSearchInput("");
  };

  const currentCategoryLabel =
    PODCAST_CATEGORIES.find((c) => c.id === activeCategory)?.label || "For You";

  return (
    <div className="flex flex-col gap-6 pb-20">
      <PageHeader
        title={t.podcasts.title}
        actions={
          episodes && episodes.length > 0 ? (
            <button
              type="button"
              onClick={() => playList(episodes, 0)}
              className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-surface-2 px-3 text-xs font-medium text-fg transition-colors duration-150 hover:bg-surface-3"
            >
              <PlayIcon size={13} weight="fill" />
              <span>{t.common.playAll}</span>
            </button>
          ) : null
        }
      />

      <div className="flex flex-col gap-3 px-4 md:px-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSelectedShow(null);
            setQueryTerm(searchInput.trim());
          }}
          className="relative max-w-md"
        >
          <input
            type="search"
            aria-label={t.podcasts.searchPlaceholder}
            value={searchInput}
            onChange={(e) => {
              if (selectedShow) setSelectedShow(null);
              setSearchInput(e.target.value);
            }}
            placeholder={t.podcasts.searchPlaceholder}
            className="h-10 w-full rounded-md bg-surface-2 pr-9 pl-10 text-sm text-fg placeholder:text-fg-3 transition-colors duration-150 focus:bg-surface-3 focus:outline-none"
          />
          <MagnifyingGlassIcon
            size={16}
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-fg-3"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setQueryTerm("");
              }}
              aria-label={t.search.clear}
              className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-fg-3 hover:text-fg"
            >
              <XIcon size={15} />
            </button>
          )}
        </form>

        <div className="no-scrollbar flex gap-1.5 overflow-x-auto py-0.5">
          {PODCAST_CATEGORIES.map((cat) => {
            const active = activeCategory === cat.id && !queryTerm && !selectedShow;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategorySelect(cat.id)}
                className={cn(
                  "h-8 shrink-0 cursor-pointer rounded-md px-3.5 text-xs font-medium transition-colors duration-150",
                  active
                    ? "bg-fg font-semibold text-bg"
                    : "bg-surface-2 text-fg-2 hover:bg-surface-3 hover:text-fg",
                )}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {selectedShow ? (
        <div className="px-4 md:px-6">
          <div
            className="relative overflow-hidden rounded-lg p-5 text-[#f4f4f5] sm:p-6"
            style={{ backgroundColor: selectedShow.swatch }}
          >
            <button
              type="button"
              onClick={() => setSelectedShow(null)}
              className="mb-4 inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-black/40 px-3 py-1.5 text-xs font-medium text-[#f4f4f5] transition-colors duration-150 hover:bg-black/60"
            >
              <ArrowLeftIcon size={13} />
              <span>All Shows</span>
            </button>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
              <ShowArtworkTile
                show={selectedShow}
                episodeThumb={showThumbs[selectedShow.id] ?? episodes?.[0]?.art}
                className="size-28 shrink-0 sm:size-36"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-white/75">{selectedShow.category}</p>
                <h2 className="mt-1 text-2xl leading-tight font-bold tracking-tight sm:text-3xl">
                  {selectedShow.name}
                </h2>
                <p className="mt-0.5 text-sm font-semibold text-white/90">{selectedShow.host}</p>
                <p className="mt-2 max-w-prose text-sm leading-relaxed text-white/80">
                  {selectedShow.description}
                </p>
                {episodes && episodes.length > 0 && (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => playList(episodes, 0)}
                      className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md bg-[#f4f4f5] px-4 text-xs font-semibold text-[#09090b] transition-opacity duration-150 hover:opacity-90 active:scale-95"
                    >
                      <PlayIcon size={14} weight="fill" />
                      <span>Play Latest</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : !queryTerm ? (
        <section className="@container/shows px-4 md:px-6">
          <h2 className="mb-3 text-lg font-bold tracking-tight text-fg">{t.podcasts.popularShows}</h2>
          <div className="no-scrollbar -mx-2 flex snap-x snap-mandatory gap-1.5 overflow-x-auto px-2 @[640px]/shows:mx-0 @[640px]/shows:grid @[640px]/shows:grid-cols-4 @[640px]/shows:overflow-visible @[640px]/shows:px-0 @[1080px]/shows:grid-cols-8">
            {POPULAR_SHOWS.map((show) => (
              <button
                key={show.id}
                type="button"
                onClick={() => handleShowSelect(show)}
                className="group flex w-34 shrink-0 cursor-pointer snap-start flex-col gap-2 rounded-lg p-2 text-left transition-colors duration-150 hover:bg-surface-2 @[640px]/shows:w-auto"
              >
                <ShowArtworkTile
                  show={show}
                  episodeThumb={showThumbs[show.id]}
                  className="aspect-square w-full"
                />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold leading-snug text-fg">{show.name}</p>
                  <p className="truncate text-[12px] text-fg-2 leading-snug">{show.host}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="px-4 md:px-6">
        <div className="mb-2 flex max-w-5xl items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight text-fg">
            {selectedShow
              ? "Episodes"
              : queryTerm
                ? `Results for "${queryTerm}"`
                : `${currentCategoryLabel}`}
          </h2>
        </div>

        {loading && (
          <div className="flex max-w-5xl flex-col gap-2">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="skeleton h-28 rounded-md" />
            ))}
          </div>
        )}

        {!loading && error && (
          <EmptyState
            icon={<WarningCircleIcon size={28} weight="regular" />}
            title={t.search.failed}
            body={error}
            action={
              <button
                type="button"
                onClick={() => setRetry((n) => n + 1)}
                className="h-9 cursor-pointer rounded-md bg-surface-3 px-4 text-xs font-medium hover:bg-surface-4"
              >
                {t.common.retry}
              </button>
            }
          />
        )}

        {!loading && !error && episodes && episodes.length === 0 && (
          <EmptyState
            icon={<BroadcastIcon size={28} weight="regular" />}
            title={t.search.nothingFound}
            body="Try another podcast show, host, or topic."
          />
        )}

        {!loading && !error && episodes && episodes.length > 0 && (
          <div className="max-w-5xl divide-y divide-line">
            {episodes.map((ep, idx) => (
              <EpisodeRow
                key={ep.id}
                episode={ep}
                onPlayEpisode={() => playList(episodes, idx)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
