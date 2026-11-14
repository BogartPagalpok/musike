import {
  BroadcastIcon,
  MagnifyingGlassIcon,
  PlayIcon,
  WarningCircleIcon,
  XIcon,
} from "../components/icons";
import { useEffect, useState } from "react";
import { Artwork } from "../components/Artwork";
import { EmptyState, PageHeader } from "../components/Page";
import { TrackList, TrackListSkeleton } from "../components/TrackList";
import { useT } from "../i18n";
import { api } from "../lib/api";
import { cn } from "../lib/format";
import type { Track } from "../lib/types";
import { usePlayer } from "../player/player";

interface ShowInfo {
  name: string;
  host: string;
  category: string;
  query: string;
  cover: string;
}

const POPULAR_SHOWS: ShowInfo[] = [
  {
    name: "The Joe Rogan Experience",
    host: "Joe Rogan",
    category: "Comedy & Culture",
    query: "Joe Rogan Experience full episode podcast",
    cover: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=360&auto=format&fit=crop&q=80",
  },
  {
    name: "Huberman Lab",
    host: "Dr. Andrew Huberman",
    category: "Science & Health",
    query: "Huberman Lab podcast full episode",
    cover: "https://images.unsplash.com/photo-1507668077129-56e32842fceb?w=360&auto=format&fit=crop&q=80",
  },
  {
    name: "Lex Fridman Podcast",
    host: "Lex Fridman",
    category: "AI, Tech & Science",
    query: "Lex Fridman podcast full episode",
    cover: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=360&auto=format&fit=crop&q=80",
  },
  {
    name: "The Diary Of A CEO",
    host: "Steven Bartlett",
    category: "Business & Life",
    query: "Diary Of A CEO podcast full episode",
    cover: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=360&auto=format&fit=crop&q=80",
  },
  {
    name: "Call Her Daddy",
    host: "Alex Cooper",
    category: "Relationships & Culture",
    query: "Call Her Daddy podcast full episode",
    cover: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=360&auto=format&fit=crop&q=80",
  },
  {
    name: "Conan O'Brien Needs A Friend",
    host: "Conan O'Brien",
    category: "Comedy & Entertainment",
    query: "Conan O'Brien Needs A Friend full episode",
    cover: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=360&auto=format&fit=crop&q=80",
  },
  {
    name: "SmartLess",
    host: "Jason Bateman, Sean Hayes, Will Arnett",
    category: "Comedy & Talk",
    query: "SmartLess podcast full episode",
    cover: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=360&auto=format&fit=crop&q=80",
  },
  {
    name: "Dan Carlin's Hardcore History",
    host: "Dan Carlin",
    category: "History",
    query: "Dan Carlin Hardcore History podcast episode",
    cover: "https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=360&auto=format&fit=crop&q=80",
  },
];

const PODCAST_CATEGORIES = [
  { id: "all", label: "Trending", query: "popular podcast full episode" },
  { id: "tech", label: "Tech & AI", query: "tech ai computer science podcast full episode" },
  { id: "comedy", label: "Comedy", query: "comedy talk show podcast full episode" },
  { id: "science", label: "Science & Health", query: "science health fitness neuroscience podcast full episode" },
  { id: "business", label: "Business & Finance", query: "business finance investing entrepreneurship podcast full episode" },
  { id: "crime", label: "True Crime", query: "true crime mystery investigation podcast full episode" },
  { id: "history", label: "History & Society", query: "history storytelling society podcast full episode" },
];

export default function Podcasts() {
  const t = useT();
  const playList = usePlayer((s) => s.playList);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [queryTerm, setQueryTerm] = useState("");
  const [selectedShow, setSelectedShow] = useState<ShowInfo | null>(null);
  const [episodes, setEpisodes] = useState<Track[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  // Active query determined by selected show, search bar, or selected category
  const effectiveQuery =
    selectedShow
      ? selectedShow.query
      : queryTerm.trim() ||
        PODCAST_CATEGORIES.find((c) => c.id === activeCategory)?.query ||
        "popular podcast full episode";

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError("");

    api
      .search(effectiveQuery, "podcast", ctrl.signal)
      .then((tracks) => {
        setEpisodes(tracks);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (e.name === "AbortError") return;
        setError(e.message || "Failed to load podcast episodes");
        setLoading(false);
      });

    return () => ctrl.abort();
  }, [effectiveQuery, retry]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSelectedShow(null);
    setQueryTerm(searchQuery.trim());
  };

  const handleShowSelect = (show: ShowInfo) => {
    if (selectedShow?.name === show.name) {
      setSelectedShow(null);
      setSearchQuery("");
      setQueryTerm("");
    } else {
      setSelectedShow(show);
      setSearchQuery(show.name);
      setQueryTerm(show.query);
    }
  };

  const handleCategorySelect = (id: string) => {
    setActiveCategory(id);
    setSelectedShow(null);
    setQueryTerm("");
    setSearchQuery("");
  };

  const currentCategoryLabel =
    PODCAST_CATEGORIES.find((c) => c.id === activeCategory)?.label || "Trending";

  return (
    <div className="flex flex-col gap-6 pb-20">
      <PageHeader
        title={t.podcasts.title}
        actions={
          episodes && episodes.length > 0 ? (
            <button
              type="button"
              onClick={() => playList(episodes, 0)}
              className="flex h-9 items-center gap-2 rounded-full bg-accent px-4 text-xs font-semibold text-accent-ink transition-transform hover:scale-105 active:scale-95"
            >
              <PlayIcon size={14} weight="fill" />
              <span>{t.common.playAll}</span>
            </button>
          ) : null
        }
      />

      {/* Podcast Search Box */}
      <div className="px-4 md:px-6">
        <form onSubmit={handleSearchSubmit} className="relative max-w-xl">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.podcasts.searchPlaceholder}
            className="h-12 w-full rounded-[14px] bg-fg/[0.06] pr-10 pl-11 text-[16px] text-fg placeholder:text-fg-3 transition-colors focus:bg-fg/[0.09] focus:outline-none focus:ring-1 focus:ring-accent md:text-sm"
          />
          <MagnifyingGlassIcon
            size={18}
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-fg-3"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setQueryTerm("");
                setSelectedShow(null);
              }}
              aria-label={t.search.clear}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-fg-3 hover:text-fg"
            >
              <XIcon size={16} />
            </button>
          )}
        </form>
      </div>

      {/* Category Filter Pills */}
      <div className="flex gap-2 overflow-x-auto px-4 md:px-6 no-scrollbar">
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
                  ? "bg-accent text-accent-ink"
                  : "bg-fg/[0.06] text-fg-2 hover:bg-fg/[0.1] hover:text-fg",
              )}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Featured Popular Shows Grid */}
      <div className="@container/shows px-4 @[680px]/shows:px-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight text-fg">
            {t.podcasts.popularShows}
          </h2>
          <span className="text-xs text-fg-3">{t.podcasts.showsCount(POPULAR_SHOWS.length)}</span>
        </div>
        <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 @[520px]/shows:mx-0 @[520px]/shows:grid @[520px]/shows:grid-cols-4 @[520px]/shows:overflow-visible @[520px]/shows:px-0 @[900px]/shows:grid-cols-8">
          {POPULAR_SHOWS.map((show) => {
            const isSelected = selectedShow?.name === show.name;
            return (
              <button
                key={show.name}
                type="button"
                onClick={() => handleShowSelect(show)}
                className={cn(
                  "group flex w-36 shrink-0 snap-start flex-col rounded-[16px] p-1.5 text-left transition-transform active:scale-[0.98] @[520px]/shows:w-auto",
                  isSelected && "bg-accent/15 ring-2 ring-accent",
                )}
              >
                <div className="relative aspect-square w-full overflow-hidden rounded-[14px] bg-surface-2 shadow-sm group-hover:shadow-md">
                  <Artwork src={show.cover} className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  <span
                    className={cn(
                      "absolute right-2 bottom-2 grid size-9 place-items-center rounded-full bg-accent text-accent-ink shadow-sm transition-all duration-200",
                      isSelected ? "opacity-100 scale-100" : "opacity-0 group-hover:opacity-100 group-hover:scale-100",
                    )}
                  >
                    <BroadcastIcon size={16} weight="bold" />
                  </span>
                </div>
                <p className={cn("mt-2 line-clamp-1 text-xs font-semibold", isSelected ? "text-accent-text" : "text-fg group-hover:text-accent-text")}>
                  {show.name}
                </p>
                <p className="line-clamp-1 text-[11px] text-fg-3">{show.category}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Episodes List Section */}
      <div className="px-4 md:px-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight text-fg flex items-center gap-2">
            <BroadcastIcon size={18} className="text-accent-text" />
            <span>
              {selectedShow
                ? `Episodes • ${selectedShow.name}`
                : queryTerm
                  ? `Results for "${searchQuery || queryTerm}"`
                  : `${currentCategoryLabel} Episodes`}
            </span>
          </h2>
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

        {!loading && !error && episodes && episodes.length > 0 && (
          <TrackList
            tracks={episodes}
            context={episodes}
            showAlbum={false}
            header={true}
          />
        )}

        {!loading && !error && episodes && episodes.length === 0 && (
          <p className="py-12 text-center text-sm text-fg-2">{t.search.nothingFound}</p>
        )}
      </div>
    </div>
  );
}
