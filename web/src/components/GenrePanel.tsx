import {
  BarbellIcon,
  CarProfileIcon,
  CassetteTapeIcon,
  CoffeeIcon,
  ConfettiIcon,
  HeadphonesIcon,
  HeartIcon,
  PlayIcon,
  SunHorizonIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useRemote } from "../hooks/useRemote";
import { useI18n, useT } from "../i18n";
import { api } from "../lib/api";
import { cn } from "../lib/format";
import { paths } from "../lib/routes";
import type { Genre } from "../lib/types";
import { usePlayer } from "../player/player";

const ACCENT_VARS = [
  "var(--c1, var(--accent))",
  "var(--c2, var(--accent))",
  "var(--c3, var(--accent))",
  "var(--c4, var(--accent))",
  "var(--c5, var(--accent))",
  "var(--c6, var(--accent))",
];

function hashIndex(s: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % mod;
}

/** Curated Mood & Vibe Mixes — Apple Music editorial cards with container-responsive layout. */
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
    <div className={cn("@container", !compact && "px-4 md:px-6")}>
      <div className="grid grid-cols-2 gap-2.5 @[620px]:grid-cols-4">
        {cards.map(({ key, title, sub, query, Icon }, idx) => {
          const busy = loadingKey === key;
          const tone = ACCENT_VARS[idx % ACCENT_VARS.length]!;
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
              style={{
                backgroundImage: `radial-gradient(circle at 100% 0%, color-mix(in srgb, ${tone} 14%, transparent), transparent 65%)`,
              }}
              className="group relative flex flex-col justify-between gap-2 overflow-hidden rounded-[12px] bg-surface-2/90 p-3.5 text-left ring-1 ring-line transition-colors duration-150 hover:bg-surface-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span style={{ color: tone }} className=" inline-flex items-center">
                  <Icon size={18} weight="regular" />
                </span>
                <button
                  type="button"
                  onClick={(e) => handlePlayMix(key, query, e)}
                  aria-label={t.home.playMix(title)}
                  title={t.home.playMix(title)}
                  className={cn(
                    "relative z-10 grid size-7 shrink-0 place-items-center rounded-full bg-accent text-accent-ink shadow-xs transition-all duration-150 hover:scale-105 active:scale-95",
                    busy ? "animate-pulse opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                  )}
                >
                  <PlayIcon size={13} weight="fill" />
                </button>
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-semibold tracking-tight text-fg">{title}</p>
                <p className="mt-0.5 line-clamp-1 text-[11.5px] text-fg-2">{sub}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Apple Music-style category tiles for Moods & Moments and Genres & Styles (container-responsive). */
export function BrowseAllGrid({ compact = false, limit }: { compact?: boolean; limit?: number }) {
  const lang = useI18n((s) => s.lang);
  const t = useT();
  const genres = useRemote<Genre[]>(`genres:${lang}`, () => api.genres());

  if (genres.status === "loading") {
    return (
      <div aria-label={t.common.loading} className={cn("@container", !compact && "px-4 md:px-6")}>
        <div className="grid grid-cols-2 gap-2.5 @[520px]:grid-cols-3 @[780px]:grid-cols-4 @[1080px]:grid-cols-6">
          {Array.from({ length: limit ?? 12 }, (_, i) => (
            <span key={i} className="skeleton h-13 rounded-[11px]" />
          ))}
        </div>
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
      <div className={cn("@container", !compact && "px-4 md:px-6")}>
        <div className="grid grid-cols-2 gap-2.5 @[520px]:grid-cols-3 @[780px]:grid-cols-4 @[1080px]:grid-cols-6">
          {items.map((g) => (
            <CategoryTile key={g.id} genre={g} />
          ))}
        </div>
      </div>
    );
  }

  const moods = all.filter((g) => g.kind === "mood");
  const styles = all.filter((g) => g.kind !== "mood");

  return (
    <div className={cn("@container flex flex-col gap-7", !compact && "px-4 md:px-6")}>
      {moods.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <h3 className="text-sm font-semibold tracking-tight text-fg-2">{t.search.moodsSection}</h3>
          <div className="grid grid-cols-2 gap-2.5 @[520px]:grid-cols-3 @[780px]:grid-cols-4 @[1040px]:grid-cols-5">
            {moods.map((g) => (
              <CategoryTile key={g.id} genre={g} />
            ))}
          </div>
        </div>
      )}

      {styles.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <h3 className="text-sm font-semibold tracking-tight text-fg-2">{t.search.genresSection}</h3>
          <div className="grid grid-cols-2 gap-2.5 @[520px]:grid-cols-3 @[780px]:grid-cols-4 @[1040px]:grid-cols-5">
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
  const tone = ACCENT_VARS[hashIndex(genre.id, ACCENT_VARS.length)]!;
  return (
    <Link
      to={paths.genre(genre.id)}
      state={{ name: genre.name }}
      style={{
        backgroundImage: `linear-gradient(135deg, color-mix(in srgb, ${tone} 12%, transparent), transparent 65%)`,
      }}
      className="group relative flex h-13 items-center gap-2.5 overflow-hidden rounded-[11px] bg-surface-2/90 px-3.5 text-fg ring-1 ring-line transition-colors duration-150 hover:bg-surface-3"
    >
      <span style={{ backgroundColor: tone }} className="h-5 w-1 shrink-0 rounded-full opacity-85 transition-transform duration-150 group-hover:scale-y-125" />
      <span className="truncate text-[13px] font-semibold tracking-tight">{genre.name}</span>
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
