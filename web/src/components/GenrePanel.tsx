import { PlayIcon } from "./icons";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useRemote } from "../hooks/useRemote";
import { useI18n, useT } from "../i18n";
import { api } from "../lib/api";
import { cn } from "../lib/format";
import { NOW_PLAYING_HASH, paths } from "../lib/routes";
import type { Genre, Track } from "../lib/types";
import { usePlayer } from "../player/player";
import { useLibrary } from "../stores/library";

/** Solid matte editorial swatches (zero purple/indigo, contrast >= 7:1 with #f4f4f5 text). */
const EDITORIAL_SWATCHES = [
  "#143829", // Studio Forest
  "#172f42", // Deep Atlantic
  "#3d2219", // Roasted Terracotta
  "#2f2b16", // Aged Olive
  "#133436", // Deep Petrol
  "#3b1921", // Oxblood Wine
  "#232933", // Carbon Slate
  "#382714", // Warm Umber
];

function hashIndex(s: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % mod;
}

export function MoodCollections({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const navigate = useNavigate();
  const playList = usePlayer((s) => s.playList);
  const history = useLibrary((s) => s.history);
  const favorites = useLibrary((s) => s.favorites);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const karaokeRe = /\b(karaoke|videoke|minus\s*one|sing\s*king|covers\s*ph|karafun|acoustic\s*heaven|myallkaraoke)\b/i;
  const seenSeeds = new Set<string>();
  const activitySeeds = [...favorites.slice(0, 12), ...history.slice(0, 18)].filter(
    (tr) => !karaokeRe.test(`${tr.title} ${tr.artist}`) && !seenSeeds.has(tr.id) && !!seenSeeds.add(tr.id),
  );

  const cards = [
    ...(activitySeeds.length > 0
      ? [
          {
            key: "activity",
            genreId: undefined as string | undefined,
            title: "Daily Mix",
            query: "",
          },
        ]
      : []),
    { key: "chill", genreId: "ggMPOg1uX1JOQWZFeDByc2Jm", title: t.home.collections.chill.title, query: t.home.collections.chill.query },
    { key: "sad", genreId: "ggMPOg1uX3NISTh4UmtWcFgz", title: "Sad & Acoustic", query: "sad heartbreak emotional songs" },
    { key: "focus", genreId: "ggMPOg1uX0NvNGNhWThMYWRh", title: t.home.collections.focus.title, query: t.home.collections.focus.query },
    { key: "energy", genreId: "ggMPOg1uXzIxYkNac21YZ2Z0", title: t.home.collections.energy.title, query: t.home.collections.energy.query },
    { key: "feelGood", genreId: "ggMPOg1uXzZQbDB5eThLRTQ3", title: t.home.collections.feelGood.title, query: t.home.collections.feelGood.query },
    { key: "lateNight", genreId: "ggMPOg1uX2JxQ2hxc2J5UFhR", title: t.home.collections.lateNight.title, query: t.home.collections.lateNight.query },
    { key: "party", genreId: "ggMPOg1uX2w1aW1CRDFTSUNo", title: t.home.collections.party.title, query: t.home.collections.party.query },
    { key: "romance", genreId: "ggMPOg1uX1JCQnB2QXVYVEIz", title: t.home.collections.romance.title, query: t.home.collections.romance.query },
    { key: "throwback", genreId: "ggMPOg1uX1F0bWVKNFlyWG9I", title: t.home.collections.throwback.title, query: t.home.collections.throwback.query },
  ];

  const handlePlayMix = async (key: string, genreId: string | undefined, query: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (loadingKey) return;
    setLoadingKey(key);
    try {
      if (key === "activity" && activitySeeds.length > 0) {
        const radios = await Promise.all(
          activitySeeds.slice(0, 2).map((s) => api.radio(s.id).catch(() => [] as Track[])),
        );
        const related = radios.flat();
        const combined: Track[] = [];
        const seen = new Set<string>();
        const maxLen = Math.max(activitySeeds.length, related.length);
        for (let i = 0; i < maxLen && combined.length < 50; i++) {
          for (const candidate of [activitySeeds[i], related[i]]) {
            if (candidate && !seen.has(candidate.id)) {
              seen.add(candidate.id);
              combined.push(candidate);
            }
          }
        }
        playList(combined.length > 0 ? combined : activitySeeds, 0);
        return;
      }
      if (genreId) {
        const page = await api.genre(genreId);
        if (page.tracks.length > 0) {
          playList(page.tracks, 0);
          return;
        }
      }
      const tracks = await api.search(query, "song");
      if (tracks.length > 0) playList(tracks, 0);
    } catch {
      if (key === "activity" && activitySeeds.length > 0) {
        playList(activitySeeds, 0);
      } else {
        navigate(genreId ? `${paths.genre(genreId)}?view=songs` : `${paths.search}?q=${encodeURIComponent(query)}`);
      }
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <div className={cn("@container", !compact && "px-4 md:px-6")}>
      <div className="grid grid-cols-2 gap-3 @[620px]:grid-cols-3 @[960px]:grid-cols-5">
        {cards.map(({ key, genreId, title, query }, idx) => {
          const busy = loadingKey === key;
          const swatch = EDITORIAL_SWATCHES[idx % EDITORIAL_SWATCHES.length]!;
          const targetUrl = genreId ? `${paths.genre(genreId)}?view=songs` : `${paths.search}?q=${encodeURIComponent(query)}`;
          const openCard = (e: React.MouseEvent) => {
            if (key === "activity") {
              void handlePlayMix(key, genreId, query, e).then(() => navigate({ hash: NOW_PLAYING_HASH }));
              return;
            }
            navigate(targetUrl, { state: { name: title } });
          };
          return (
            <article
              key={key}
              style={{ backgroundColor: swatch }}
              className="group relative flex h-24 flex-col justify-between overflow-hidden rounded-lg p-3.5 text-left transition-[filter] duration-150 hover:brightness-110"
            >
              <button
                type="button"
                onClick={openCard}
                aria-label={title}
                className="absolute inset-0 cursor-pointer rounded-lg focus-visible:outline-offset-[-2px]"
              />
              <p className="pointer-events-none relative z-10 line-clamp-2 text-[15px] leading-snug font-bold tracking-tight text-[#f4f4f5]">
                {title}
              </p>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={(e) => handlePlayMix(key, genreId, query, e)}
                  aria-label={t.home.playMix(title)}
                  title={t.home.playMix(title)}
                  className={cn(
                    "relative z-10 grid size-8 shrink-0 cursor-pointer place-items-center rounded-full bg-[#f4f4f5] text-[#09090b] shadow-sm transition-opacity duration-150 active:scale-95",
                    busy ? "animate-pulse opacity-100" : "opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100",
                  )}
                >
                  <PlayIcon size={14} weight="fill" className="translate-x-[1px]" />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function BrowseAllGrid({ compact = false, limit }: { compact?: boolean; limit?: number }) {
  const lang = useI18n((s) => s.lang);
  const t = useT();
  const genres = useRemote<Genre[]>(`genres:${lang}`, () => api.genres());

  if (genres.status === "loading") {
    return (
      <div aria-label={t.common.loading} className={cn("@container", !compact && "px-4 md:px-6")}>
        <div className="grid grid-cols-2 gap-3 @[520px]:grid-cols-3 @[780px]:grid-cols-4 @[1080px]:grid-cols-6">
          {Array.from({ length: limit ?? 12 }, (_, i) => (
            <span key={i} className="skeleton h-20 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (genres.status === "error") {
    return (
      <p className={cn("text-sm text-fg-2", !compact && "px-4 md:px-6")}>
        {genres.message}{" "}
        <button type="button" onClick={genres.retry} className="cursor-pointer font-medium text-fg underline-offset-2 hover:underline">
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
        <div className="grid grid-cols-2 gap-3 @[520px]:grid-cols-3 @[780px]:grid-cols-4 @[1080px]:grid-cols-6">
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
        <div className="flex flex-col gap-3">
          <h3 className="text-base font-bold tracking-tight text-fg">{t.search.moodsSection}</h3>
          <div className="grid grid-cols-2 gap-3 @[520px]:grid-cols-3 @[780px]:grid-cols-4 @[1040px]:grid-cols-5">
            {moods.map((g) => (
              <CategoryTile key={g.id} genre={g} />
            ))}
          </div>
        </div>
      )}

      {styles.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-base font-bold tracking-tight text-fg">{t.search.genresSection}</h3>
          <div className="grid grid-cols-2 gap-3 @[520px]:grid-cols-3 @[780px]:grid-cols-4 @[1040px]:grid-cols-5">
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
  const swatch = EDITORIAL_SWATCHES[hashIndex(genre.id, EDITORIAL_SWATCHES.length)]!;
  return (
    <Link
      to={genre.kind === "mood" ? `${paths.genre(genre.id)}?view=songs` : paths.genre(genre.id)}
      state={{ name: genre.name }}
      style={{ backgroundColor: swatch }}
      className="group relative flex h-20 items-start overflow-hidden rounded-lg p-3.5 text-[#f4f4f5] transition-[filter] duration-150 hover:brightness-110"
    >
      <span className="line-clamp-2 text-[14.5px] leading-snug font-bold tracking-tight">{genre.name}</span>
    </Link>
  );
}

export function GenrePanel({ id }: { id: string }) {
  const lang = useI18n((s) => s.lang);
  const t = useT();
  const genres = useRemote<Genre[]>(`genres:${lang}`, () => api.genres());

  const list = genres.status === "ok" ? genres.data : [];
  const moods = list.filter((g) => g.kind === "mood");
  const styles = list.filter((g) => g.kind !== "mood");

  return (
    <div id={id} className="rounded-lg bg-surface-2 p-3.5">
      {genres.status === "loading" && (
        <div aria-label={t.common.loading} className="flex flex-wrap gap-2">
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} className="skeleton h-8 rounded-md" style={{ width: `${64 + ((i * 23) % 56)}px` }} />
          ))}
        </div>
      )}

      {genres.status === "error" && (
        <p className="px-1 text-sm text-fg-2">
          {genres.message}{" "}
          <button type="button" onClick={genres.retry} className="cursor-pointer font-medium text-fg underline-offset-2 hover:underline">
            {t.common.retry}
          </button>
        </p>
      )}

      {genres.status === "ok" && (
        <div className="flex flex-col gap-4">
          {moods.length > 0 && (
            <div>
              <p className="mb-2 px-1 text-xs font-semibold text-fg-2">{t.search.moodsSection}</p>
              <ul className="flex flex-wrap gap-1.5">
                {moods.map((g) => (
                  <li key={g.id}>
                    <Link
                      to={`${paths.genre(g.id)}?view=songs`}
                      state={{ name: g.name }}
                      className="block h-8 rounded-md bg-surface-3 px-3 text-xs font-medium leading-8 transition-colors duration-150 hover:bg-surface-4"
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
              <p className="mb-2 px-1 text-xs font-semibold text-fg-2">{t.search.genresSection}</p>
              <ul className="flex flex-wrap gap-1.5">
                {styles.map((g) => (
                  <li key={g.id}>
                    <Link
                      to={`${paths.genre(g.id)}?view=songs`}
                      state={{ name: g.name }}
                      className="block h-8 rounded-md bg-surface-3 px-3 text-xs font-medium leading-8 transition-colors duration-150 hover:bg-surface-4"
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
