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
  palette: [string, string];
  monogram: string;
}

const POPULAR_SHOWS: ShowInfo[] = [
  {
    id: "jre",
    name: "The Joe Rogan Experience",
    host: "Joe Rogan",
    category: "Comedy & Culture",
    description: "Long-form conversations with comedians, scientists, fighters, authors, and artists.",
    query: "Joe Rogan Experience full episode podcast",
    palette: ["#7f1d1d", "#18181b"],
    monogram: "JRE",
  },
  {
    id: "huberman",
    name: "Huberman Lab",
    host: "Andrew Huberman, Ph.D.",
    category: "Science & Health",
    description: "Science-based tools for sleep, focus, dopamine, neuroplasticity, and physical health.",
    query: "Huberman Lab podcast full episode",
    palette: ["#0f172a", "#1e3a8a"],
    monogram: "HL",
  },
  {
    id: "lex",
    name: "Lex Fridman Podcast",
    host: "Lex Fridman",
    category: "AI, Tech & Philosophy",
    description: "Deep conversations about AI, science, history, philosophy, and human intelligence.",
    query: "Lex Fridman podcast full episode",
    palette: ["#1e1b4b", "#09090b"],
    monogram: "LEX",
  },
  {
    id: "doac",
    name: "The Diary Of A CEO",
    host: "Steven Bartlett",
    category: "Business & Mindset",
    description: "Unfiltered stories and lessons from the world's most influential founders and thinkers.",
    query: "The Diary Of A CEO full episode podcast",
    palette: ["#422006", "#18181b"],
    monogram: "CEO",
  },
  {
    id: "conan",
    name: "Conan O'Brien Needs A Friend",
    host: "Team Coco",
    category: "Comedy",
    description: "Conan sits down for hilarious, unscripted conversations with guests and friends.",
    query: "Conan O'Brien Needs A Friend full episode podcast",
    palette: ["#9a3412", "#1c1917"],
    monogram: "COCO",
  },
  {
    id: "smartless",
    name: "SmartLess",
    host: "Jason Bateman, Sean Hayes & Will Arnett",
    category: "Comedy & Talk",
    description: "One host reveals a mystery guest to the other two for spontaneous comedy and stories.",
    query: "SmartLess podcast full episode",
    palette: ["#065f46", "#090d16"],
    monogram: "SL",
  },
  {
    id: "rotten",
    name: "Rotten Mango",
    host: "Stephanie Soo",
    category: "True Crime",
    description: "Deep-dive storytelling into baffling true crime mysteries, psychology, and international cases.",
    query: "Rotten Mango Stephanie Soo podcast episode",
    palette: ["#831843", "#18181b"],
    monogram: "RM",
  },
  {
    id: "hardcore",
    name: "Hardcore History",
    host: "Dan Carlin",
    category: "History",
    description: "Epic cinematic narratives exploring the most dramatic moments in human history.",
    query: "Dan Carlin Hardcore History podcast episode",
    palette: ["#3f3f46", "#09090b"],
    monogram: "HH",
  },
];

const PODCAST_CATEGORIES = [
  { id: "all", label: "For You", query: "popular podcast full episode interview" },
  { id: "tech", label: "Tech & AI", query: "technology ai engineering podcast full episode" },
  { id: "comedy", label: "Comedy", query: "comedy podcast full episode conversation" },
  { id: "science", label: "Science & Health", query: "neuroscience health fitness podcast full episode" },
  { id: "business", label: "Business", query: "entrepreneurship investing business podcast full episode" },
  { id: "crime", label: "True Crime", query: "true crime documentary podcast full episode" },
  { id: "history", label: "History & Culture", query: "history culture storytelling podcast full episode" },
];

function formatPodcastLength(seconds: number): string {
  if (!seconds || seconds <= 0) return "Episode";
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
      className={cn("relative overflow-hidden rounded-[12px] shadow-md", className)}
      style={{
        background: `linear-gradient(145deg, ${show.palette[0]} 0%, ${show.palette[1]} 100%)`,
      }}
    >
      {episodeThumb && (
        <Artwork
          src={episodeThumb}
          className="absolute inset-0 size-full object-cover opacity-55 mix-blend-luminosity transition-transform duration-300 group-hover:scale-105"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
      <span className="absolute top-2.5 left-2.5 rounded-md bg-white/15 px-1.5 py-0.5 font-mono text-[9.5px] font-black tracking-wider text-white backdrop-blur-sm">
        PODCAST
      </span>
      <div className="absolute inset-x-2.5 bottom-2.5">
        <p className="line-clamp-2 text-[13px] leading-tight font-extrabold tracking-tight text-white">
          {show.name}
        </p>
      </div>
    </div>
  );
}

function EpisodeCard({
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
      onClick={onPlayEpisode}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPlayEpisode();
        }
      }}
      className={cn(
        "group flex flex-col gap-3 rounded-[14px] border p-3.5 transition-colors sm:p-4",
        isCurrent
          ? "border-accent/45 bg-surface-2/95"
          : "border-line/70 bg-surface-2/45 hover:border-line hover:bg-surface-2/90",
      )}
    >
      <div className="flex items-start gap-3.5 sm:gap-4">
        {/* Square Spotify Episode Cover */}
        <div className="relative size-20 shrink-0 overflow-hidden rounded-[10px] shadow-sm sm:size-24">
          <Artwork src={episode.art} fallback={episode.thumb} className="size-full object-cover" />
          {isCurrent && (
            <span className="absolute right-1.5 bottom-1.5 grid size-6 place-items-center rounded-full bg-black/75 text-accent-text backdrop-blur-sm">
              <Equalizer live={isPlaying} />
            </span>
          )}
        </div>

        {/* Show Name, Bold Episode Title & Description */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11.5px] font-bold tracking-tight text-accent-text">
            {episode.artist || "Podcast"}
          </p>
          <h3
            className={cn(
              "mt-0.5 line-clamp-2 text-[15px] leading-snug font-bold tracking-tight sm:text-base",
              isCurrent ? "text-accent-text" : "text-fg group-hover:underline",
            )}
          >
            {episode.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-fg-2">
            Full episode conversation with {episode.artist || "featured guests"} · Stream audio or switch to video anytime in the player.
          </p>
        </div>
      </div>

      {/* Bottom Spotify Action Row: Duration + Progress + Save / Queue / Circular Play Button */}
      <div className="flex items-center justify-between gap-3 pl-0 sm:pl-28">
        <div className="flex min-w-0 items-center gap-2.5 text-xs font-medium text-fg-2">
          <span className="rounded-full bg-surface-3 px-2.5 py-0.5 text-[11px] font-semibold text-fg-2 tabular-nums">
            {formatPodcastLength(episode.duration)}
          </span>
          {isCurrent && duration > 0 && (
            <div className="flex items-center gap-2">
              <div className="h-1 w-20 overflow-hidden rounded-full bg-surface-4">
                <div className="h-full rounded-full bg-accent" style={{ width: `${progressPct}%` }} />
              </div>
              <span className="text-[11px] font-semibold text-accent-text">{progressPct}%</span>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void toggleFavorite(episode);
            }}
            aria-label={isFavorite ? t.common.removeFromFavorites : t.common.addToFavorites}
            title={isFavorite ? t.common.removeFromFavorites : t.common.addToFavorites}
            className={cn(
              "grid size-8 place-items-center rounded-full transition-colors hover:bg-surface-3",
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
            className="grid size-8 place-items-center rounded-full text-fg-2 transition-colors hover:bg-surface-3 hover:text-fg"
          >
            <ListPlusIcon size={17} />
          </button>

          <button
            type="button"
            onClick={handleMenu}
            aria-label={t.trackList.moreFor(episode.title)}
            className="grid size-8 place-items-center rounded-full text-fg-2 transition-colors hover:bg-surface-3 hover:text-fg"
          >
            <DotsThreeIcon size={17} weight="bold" />
          </button>

          {/* Signature Spotify Circular Play/Pause Button */}
          <button
            type="button"
            onClick={handlePrimaryPlay}
            aria-label={isPlaying ? "Pause" : t.common.playX(episode.title)}
            className="ml-1 grid size-9 place-items-center rounded-full bg-fg text-bg shadow-md transition-transform hover:scale-105 hover:bg-accent hover:text-accent-ink active:scale-95"
          >
            {isPlaying ? <PauseIcon size={15} weight="fill" /> : <PlayIcon size={15} weight="fill" />}
          </button>
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

  // Live debounced search-as-you-type
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
    <div className="flex flex-col gap-5 pb-20">
      <PageHeader
        title={t.podcasts.title}
        actions={
          episodes && episodes.length > 0 ? (
            <button
              type="button"
              onClick={() => playList(episodes, 0)}
              className="flex h-9 items-center gap-2 rounded-full bg-accent px-4 text-xs font-bold text-accent-ink shadow-sm transition-transform hover:scale-105 active:scale-95"
            >
              <PlayIcon size={14} weight="fill" />
              <span>{t.common.playAll}</span>
            </button>
          ) : null
        }
      />

      {/* Clean Spotify Search Bar + Category Chips */}
      <div className="flex flex-col gap-3 px-4 md:px-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSelectedShow(null);
            setQueryTerm(searchInput.trim());
          }}
          className="relative max-w-xl"
        >
          <input
            type="search"
            value={searchInput}
            onChange={(e) => {
              if (selectedShow) setSelectedShow(null);
              setSearchInput(e.target.value);
            }}
            placeholder={t.podcasts.searchPlaceholder}
            className="h-11 w-full rounded-full bg-surface-2 pr-10 pl-11 text-[15px] text-fg ring-1 ring-line placeholder:text-fg-3 transition-all focus:bg-surface-3 focus:ring-2 focus:ring-accent focus:outline-none md:text-sm"
          />
          <MagnifyingGlassIcon
            size={17}
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-fg-3"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setQueryTerm("");
              }}
              aria-label={t.search.clear}
              className="absolute top-1/2 right-3.5 -translate-y-1/2 text-fg-3 hover:text-fg"
            >
              <XIcon size={15} />
            </button>
          )}
        </form>

        <div className="no-scrollbar flex gap-2 overflow-x-auto py-0.5">
          {PODCAST_CATEGORIES.map((cat) => {
            const active = activeCategory === cat.id && !queryTerm && !selectedShow;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategorySelect(cat.id)}
                className={cn(
                  "h-8 shrink-0 rounded-full px-4 text-xs font-semibold tracking-tight transition-colors",
                  active
                    ? "bg-accent font-bold text-accent-ink shadow-xs"
                    : "bg-surface-2 text-fg-2 ring-1 ring-line hover:bg-surface-3 hover:text-fg",
                )}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Spotify Show Hero Banner OR Top Shows Shelf */}
      {selectedShow ? (
        <div className="px-4 md:px-6">
          <div
            className="relative overflow-hidden rounded-[20px] border border-white/10 p-5 text-white shadow-xl sm:p-6"
            style={{
              background: `linear-gradient(135deg, ${selectedShow.palette[0]} 0%, ${selectedShow.palette[1]} 100%)`,
            }}
          >
            <button
              type="button"
              onClick={() => setSelectedShow(null)}
              className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/25"
            >
              <ArrowLeftIcon size={13} />
              <span>All Podcasts</span>
            </button>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <ShowArtworkTile
                show={selectedShow}
                episodeThumb={showThumbs[selectedShow.id] ?? episodes?.[0]?.art}
                className="size-28 shrink-0 ring-1 ring-white/20 sm:size-36"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-extrabold tracking-widest text-white/75 uppercase">
                  Podcast · {selectedShow.category}
                </p>
                <h2 className="mt-1 text-2xl leading-tight font-black tracking-tight sm:text-3xl">
                  {selectedShow.name}
                </h2>
                <p className="mt-0.5 text-sm font-bold text-white/90">{selectedShow.host}</p>
                <p className="mt-2 max-w-2xl text-xs leading-relaxed text-white/75 sm:text-sm">
                  {selectedShow.description}
                </p>
                {episodes && episodes.length > 0 && (
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => playList(episodes, 0)}
                      className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-xs font-bold text-accent-ink shadow-md transition-transform hover:scale-105 active:scale-95"
                    >
                      <PlayIcon size={15} weight="fill" />
                      <span>Play Latest Episode</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : !queryTerm ? (
        <section className="@container/shows px-4 md:px-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight text-fg">{t.podcasts.popularShows}</h2>
            <span className="text-xs font-medium text-fg-3">{t.podcasts.showsCount(POPULAR_SHOWS.length)}</span>
          </div>
          <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 @[560px]/shows:mx-0 @[560px]/shows:grid @[560px]/shows:grid-cols-4 @[560px]/shows:overflow-visible @[560px]/shows:px-0 @[980px]/shows:grid-cols-8">
            {POPULAR_SHOWS.map((show) => (
              <button
                key={show.id}
                type="button"
                onClick={() => handleShowSelect(show)}
                className="group flex w-34 shrink-0 snap-start flex-col gap-2 rounded-[14px] p-2 text-left transition-colors hover:bg-surface-2 @[560px]/shows:w-auto"
              >
                <ShowArtworkTile
                  show={show}
                  episodeThumb={showThumbs[show.id]}
                  className="aspect-square w-full"
                />
                <div className="min-w-0 px-0.5">
                  <p className="truncate text-[13px] font-bold tracking-tight text-fg">{show.name}</p>
                  <p className="truncate text-[11.5px] text-fg-2">{show.host}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {/* Spotify Episode Feed */}
      <section className="px-4 md:px-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight text-fg">
            {selectedShow
              ? "All Episodes"
              : queryTerm
                ? `Results for "${queryTerm}"`
                : `${currentCategoryLabel} Episodes`}
          </h2>
          {episodes && episodes.length > 0 && (
            <span className="text-xs font-medium text-fg-3 tabular-nums">
              {episodes.length} episodes
            </span>
          )}
        </div>

        {loading && (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="skeleton h-36 rounded-[14px]" />
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
                className="h-9 rounded-[10px] bg-surface-3 px-4 text-xs font-medium hover:bg-surface-4"
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
            body="Try searching for another podcast show, host, or topic."
          />
        )}

        {!loading && !error && episodes && episodes.length > 0 && (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {episodes.map((ep, idx) => (
              <EpisodeCard
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
