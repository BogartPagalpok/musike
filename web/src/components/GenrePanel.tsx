import {
  BarbellIcon,
  CarProfileIcon,
  CassetteTapeIcon,
  CoffeeIcon,
  ConfettiIcon,
  DiscIcon,
  FireIcon,
  HeadphonesIcon,
  HeartIcon,
  LightningIcon,
  MoonStarsIcon,
  MusicNotesIcon,
  PlayIcon,
  SparkleIcon,
  SunHorizonIcon,
} from "@phosphor-icons/react";
import { useState, type ComponentType } from "react";
import { Link, useNavigate } from "react-router";
import { useRemote } from "../hooks/useRemote";
import { useI18n, useT } from "../i18n";
import { api } from "../lib/api";
import { cn } from "../lib/format";
import { paths } from "../lib/routes";
import type { Genre } from "../lib/types";
import { usePlayer } from "../player/player";

const TILE_ICONS: ComponentType<{ size?: number; weight?: "fill" | "regular" | "duotone"; className?: string }>[] = [
  SparkleIcon,
  HeadphonesIcon,
  FireIcon,
  MoonStarsIcon,
  SunHorizonIcon,
  MusicNotesIcon,
  DiscIcon,
  LightningIcon,
  HeartIcon,
  ConfettiIcon,
];

function hashIndex(s: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % mod;
}

/** Curated Mood & Vibe Mixes shown on Home and Search — sleek surface cards matching the app theme. */
export function MoodCollections({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const navigate = useNavigate();
  const playList = usePlayer((s) => s.playList);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const cards = [
    { key: "chill", ...t.home.collections.chill, Icon: CoffeeIcon },
    { key: "focus", ...t.home.collections.focus, Icon: HeadphonesIcon },
    { key: "energy", ...t.home.collections.energy, Icon: BarbellIcon },
    { key: "feelGood", ...t.home.collections.feelGood, Icon: SunHorizonIcon },
    { key: "lateNight", ...t.home.collections.lateNight, Icon: CarProfileIcon },
    { key: "party", ...t.home.collections.party, Icon: ConfettiIcon },
    { key: "romance", ...t.home.collections.romance, Icon: HeartIcon },
    { key: "throwback", ...t.home.collections.throwback, Icon: CassetteTapeIcon },
  ];

  const handlePlayMix = async (key: string, query: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (loadingKey) return;
    setLoadingKey(key);
    try {
      const tracks = await api.search(query, "song");
      if (tracks.length > 0) playList(tracks, 0);
    } catch {
      navigate(`${paths.search}?q=${encodeURIComponent(query)}`);
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <div className={cn("grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4", !compact && "px-4 md:px-6")}>
      {cards.map(({ key, title, sub, query, Icon }) => {
        const busy = loadingKey === key;
        return (
          <div
            key={key}
            role="button"
            tabIndex={0}
            onClick={() => navigate(`${paths.search}?q=${encodeURIComponent(query)}`)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                navigate(`${paths.search}?q=${encodeURIComponent(query)}`);
              }
            }}
            className="group relative flex items-center gap-3.5 overflow-hidden rounded-[14px] bg-surface-2 p-3.5 text-left ring-1 ring-line transition-colors duration-200 hover:bg-surface-3 hover:ring-line-strong"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-[10px] bg-surface-3 text-accent-text ring-1 ring-line transition-colors group-hover:bg-accent-soft">
              <Icon size={22} weight="duotone" />
            </span>
            <div className="min-w-0 flex-1 pr-8">
              <p className="truncate text-sm font-semibold tracking-tight text-fg">{title}</p>
              <p className="mt-0.5 truncate text-xs text-fg-2">{sub}</p>
            </div>
            <button
              type="button"
              onClick={(e) => handlePlayMix(key, query, e)}
              aria-label={t.home.playMix(title)}
              title={t.home.playMix(title)}
              className={cn(
                "absolute right-3 z-10 grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-ink shadow-[0_4px_14px_rgb(0_0_0/0.3)] transition-all duration-200 hover:scale-105 active:scale-95",
                busy ? "animate-pulse opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
              )}
            >
              <PlayIcon size={16} weight="fill" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Clean, understated category cards for Moods & Moments and Genres & Styles. */
export function BrowseAllGrid({ compact = false, limit }: { compact?: boolean; limit?: number }) {
  const lang = useI18n((s) => s.lang);
  const t = useT();
  const genres = useRemote<Genre[]>(`genres:${lang}`, () => api.genres());

  if (genres.status === "loading") {
    return (
      <div aria-label={t.common.loading} className={cn("grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6", !compact && "px-4 md:px-6")}>
        {Array.from({ length: limit ?? 12 }, (_, i) => (
          <span key={i} className="skeleton h-14 rounded-[12px]" />
        ))}
      </div>
    );
  }

  if (genres.status === "error") {
    return (
      <p className={cn("text-sm text-fg-2", !compact && "px-4 md:px-6")}>
        {genres.message}{" "}
        <button type="button" onClick={genres.retry} className="font-medium text-fg underline-offset-2 hover:underline">
          {t.common.retry}
        </button>
      </p>
    );
  }

  const all = genres.data ?? [];
  if (limit) {
    const items = all.slice(0, limit);
    return (
      <div className={cn("grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6", !compact && "px-4 md:px-6")}>
        {items.map((g) => (
          <CategoryTile key={g.id} genre={g} />
        ))}
      </div>
    );
  }

  const moods = all.filter((g) => g.kind === "mood");
  const styles = all.filter((g) => g.kind !== "mood");

  return (
    <div className={cn("flex flex-col gap-7", !compact && "px-4 md:px-6")}>
      {moods.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <h3 className="text-sm font-semibold tracking-tight text-fg-2">{t.search.moodsSection}</h3>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {moods.map((g) => (
              <CategoryTile key={g.id} genre={g} />
            ))}
          </div>
        </div>
      )}

      {styles.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <h3 className="text-sm font-semibold tracking-tight text-fg-2">{t.search.genresSection}</h3>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {styles.map((g) => (
              <CategoryTile key={g.id} genre={g} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryTile({ genre }: { genre: Genre }) {
  const Icon = TILE_ICONS[hashIndex(genre.id, TILE_ICONS.length)]!;
  return (
    <Link
      to={paths.genre(genre.id)}
      state={{ name: genre.name }}
      className="group relative flex h-14 items-center justify-between gap-2 overflow-hidden rounded-[12px] bg-surface-2 px-3.5 text-fg ring-1 ring-line transition-colors duration-200 hover:bg-surface-3 hover:ring-line-strong"
    >
      <span className="truncate text-sm font-medium tracking-tight">{genre.name}</span>
      <Icon
        size={20}
        weight="duotone"
        className="shrink-0 text-fg-3 transition-colors duration-200 group-hover:text-accent-text"
      />
    </Link>
  );
}

/** YouTube Music's mood & genre list as chips; each opens the category's artists and songs. */
export function GenrePanel({ id }: { id: string }) {
  const lang = useI18n((s) => s.lang);
  const t = useT();
  const genres = useRemote<Genre[]>(`genres:${lang}`, () => api.genres());

  const list = genres.status === "ok" ? genres.data : [];
  const moods = list.filter((g) => g.kind === "mood");
  const styles = list.filter((g) => g.kind !== "mood");

  return (
    <div id={id} className="rounded-[16px] bg-surface-2 p-3.5 ring-1 ring-line">
      {genres.status === "loading" && (
        <div aria-label={t.common.loading} className="flex flex-wrap gap-2">
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} className="skeleton h-9 rounded-full" style={{ width: `${64 + ((i * 23) % 56)}px` }} />
          ))}
        </div>
      )}

      {genres.status === "error" && (
        <p className="px-1 text-sm text-fg-2">
          {genres.message}{" "}
          <button type="button" onClick={genres.retry} className="font-medium text-fg underline-offset-2 hover:underline">
            {t.common.retry}
          </button>
        </p>
      )}

      {genres.status === "ok" && (
        <div className="flex flex-col gap-4">
          {moods.length > 0 && (
            <div>
              <p className="mb-2 px-1 text-xs font-semibold tracking-wider text-fg-2 uppercase">{t.search.moodsSection}</p>
              <ul className="flex flex-wrap gap-2">
                {moods.map((g) => (
                  <li key={g.id}>
                    <Link
                      to={paths.genre(g.id)}
                      state={{ name: g.name }}
                      className="block h-9 rounded-full bg-surface-3 px-4 text-sm leading-9 transition-colors hover:bg-surface-4"
                    >
                      {g.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {styles.length > 0 && (
            <div>
              <p className="mb-2 px-1 text-xs font-semibold tracking-wider text-fg-2 uppercase">{t.search.genresSection}</p>
              <ul className="flex flex-wrap gap-2">
                {styles.map((g) => (
                  <li key={g.id}>
                    <Link
                      to={paths.genre(g.id)}
                      state={{ name: g.name }}
                      className="block h-9 rounded-full bg-surface-3 px-4 text-sm leading-9 transition-colors hover:bg-surface-4"
                    >
                      {g.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
