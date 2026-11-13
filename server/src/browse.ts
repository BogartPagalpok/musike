import type { Innertube } from "youtubei.js";
import { isLang, msg, type Lang } from "./i18n.js";
import { getActivityProfile } from "./library.js";
import { isUnwantedRegionalTrack, radio, search, sized, text, toTrack, withClient } from "./search.js";
import type { Track } from "./types.js";
import { HttpError, VIDEO_ID } from "./types.js";

export interface Genre {
  /** YouTube Music's opaque "params" for the genre/mood page. */
  id: string;
  name: string;
  kind?: "mood" | "genre";
}

export interface GenreArtist {
  id: string;
  name: string;
  /** Cover of one of their releases in this genre (artist photos would cost a request each). */
  thumb: string;
  art: string;
  /** A few of their songs in this genre, to recognize them by. */
  hits: string[];
}

export interface GenrePage {
  id: string;
  name: string;
  /** The first page of artists; more come from `genreArtists`. */
  artists: GenreArtist[];
  hasMoreArtists: boolean;
  tracks: Track[];
}

/** An album or single as a cover in a list (artist page, search). */
export interface AlbumCard {
  id: string;
  title: string;
  /** Empty on an artist's own page, where it goes without saying. */
  artist: string;
  year: string;
  thumb: string;
  art: string;
}

export interface ArtistPage {
  id: string;
  name: string;
  description: string;
  banner: string;
  tracks: Track[];
  albums: AlbumCard[];
  singles: AlbumCard[];
}

export interface AlbumPage {
  id: string;
  title: string;
  artist: string;
  artistId: string | null;
  /** YouTube Music's own lines, in the request's language: "Album • 1991", "13 songs • 49 minutes". */
  kind: string;
  info: string;
  thumb: string;
  art: string;
  tracks: Track[];
}

export interface ChartsData {
  global: Track[];
  trending: Track[];
  region: string;
}

export const ALBUM_ID = /^MPRE[\w-]{6,60}$/;

export const GENRE_ID = /^[\w-]{8,120}={0,2}$/;
export const ARTIST_ID = /^UC[\w-]{22}$/;

const MINUTE = 60_000;
const ARTISTS_PAGE = 40;
/** Enough for anyone browsing; stops reading playlists after that. */
const MAX_ARTISTS = 600;
const PLAYLISTS_PER_ROUND = 4;
const MAX_GENRE_TRACKS = 150;
const MAX_HITS = 50;

/** Time-boxed memo: these pages change slowly, and going back and forth between them should be instant. */
function cached<T>(ttl: number, load: (key: string) => Promise<T>): (key: string) => Promise<T> {
  const memo = new Map<string, { at: number; value: Promise<T> }>();
  return (key) => {
    const hit = memo.get(key);
    if (hit && Date.now() - hit.at < ttl) return hit.value;
    if (memo.size > 200) memo.delete(memo.keys().next().value!);
    const value = load(key);
    memo.set(key, { at: Date.now(), value });
    // Failures are not cached, so the next visit tries again.
    value.catch(() => memo.get(key)?.value === value && memo.delete(key));
    return value;
  };
}

// youtubei.js has no typed helper for the genre pages, so these responses are read defensively.
const browse = (yt: Innertube, payload: Record<string, unknown>): Promise<any> =>
  yt.actions.execute("/browse", { ...payload, client: "YTMUSIC", parse: true });

function shelvesOf(page: any): any[] {
  const root = typeof page?.contents?.item === "function" ? page.contents.item() : page?.contents;
  return root?.tabs?.[0]?.content?.contents ?? [];
}

const itemsOf = (shelf: any): any[] => shelf?.contents ?? shelf?.items ?? [];

function imagesOf(item: any): { thumb: string; art: string } {
  const thumbs = item?.thumbnail?.contents ?? item?.thumbnail ?? item?.thumbnails ?? [];
  const url: string | undefined = Array.isArray(thumbs) ? thumbs[0]?.url : undefined;
  return { thumb: sized(url, 240), art: sized(url, 544) };
}

/** Same song twice (another upload, a playlist repeat) only shows once. */
function uniqueTracks(tracks: (Track | null)[]): Track[] {
  const seen = new Set<string>();
  return tracks.filter((t): t is Track => {
    if (!t) return false;
    const key = `${t.title}|${t.artist}`.toLocaleLowerCase("pt-BR");
    if (seen.has(t.id) || seen.has(key)) return false;
    seen.add(t.id);
    seen.add(key);
    return true;
  });
}

/** [[a1, a2], [b1]] → [a1, b1, a2] */
function roundRobin<T>(lists: T[][]): T[] {
  const out: T[] = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (i < l.length) out.push(l[i]!);
  return out;
}

/** "Céu Azul (Ao Vivo)" → "Céu Azul": enough to recognize the song in a short preview. */
const bareTitle = (title: string) => title.replace(/\s*[([].*?[)\]]/g, "").trim() || title;

// Pages are cached per language: YouTube Music words genre names and bios in the session's language.
const keyOf = (lang: Lang, id = "") => `${lang}|${id}`;
function parseKey(key: string): { lang: Lang; id: string } {
  const [lang = "", ...rest] = key.split("|");
  return { lang: isLang(lang) ? lang : "en", id: rest.join("|") };
}

const UNWANTED_GENRE_TILE = /\b(bollywood|indian|arabic|indonesian|thai|african)\b/i;

const UNWANTED_SHELF_OR_PLAYLIST =
  /\b(bollywood|indian|hindi|punjabi|tollywood|kollywood|mollywood|desi|bhangra|chai|qawwali|ghazal|sufi|dangdut|galau|turkish|arabesk|arabic|iraqi|khaleeji|dabkeh|sertanejo|pagode|schlager|russian|ukrainian|thai|jiwang|honsul|salsa|triste|a solas|11 no\.?\s*ki bus|sad bangers|brazilian)\b|[\u0600-\u06FF\u0900-\u0DFF\u0E00-\u0E7F\u0400-\u04FF]/i;

const MOOD_PRIORITY_PLAYLISTS: Record<string, string[]> = {
  // Sad: #sadforever, Wallow, Lonely Hearts Club, Burn the Photos, Classic R&B Breakup
  ggMPOg1uX3NISTh4UmtWcFgz: [
    "VLRDCLAK5uy_lp8LtelM9GiSwRFGGQjctKaGoHcrgQVEU",
    "VLRDCLAK5uy_lcM4s2QvgekvNoHcX6dmb0pCl2aMgFxdc",
    "VLRDCLAK5uy_lsdV5oBPFEC87QS1yTL1UFbqzVmKNAisE",
    "VLRDCLAK5uy_nRFKmL13urbE-A89oJfnt1-u1hfiCLriA",
    "VLRDCLAK5uy_k_rqLx4HcwIPeuLQHuda_ZahMCB6_Rt2A",
  ],
  // Chill: Super Chill, Coffee Shop Blend, Chill R&B, Unwind
  ggMPOg1uX1JOQWZFeDByc2Jm: [
    "VLRDCLAK5uy_mYa86YJNGqE4Jl5jG7DZP9NKdflw0hQL0",
    "VLRDCLAK5uy_nBE4bLuBHUXWZrF59ZrkPEToKt8M_I3Vc",
    "VLRDCLAK5uy_mX4JK0m7lhZ8Egv1E7bbXox_e0k6rGejo",
    "VLRDCLAK5uy_np_soSTj6w3-N7Dh_xmdDpQINJ8LsVpa8",
  ],
  // Romance: Sweetheart Pop, Ultimate Love Songs, Pop Ballads, Cuddle Weather
  ggMPOg1uX1JCQnB2QXVYVEIz: [
    "VLRDCLAK5uy_l1oO11DBO4FD8U7bOrqUKK5Y_PkISUMQM",
    "VLRDCLAK5uy_kW-moSFMAFOKAIVYn9IDrZKWEJA3cP9UU",
    "VLRDCLAK5uy_mibxs1G4XQF8vFFlnlyBimkbFP7fKUh3U",
    "VLRDCLAK5uy_mKB2zduLwMALlWPw98K0857E9c1HYkitI",
  ],
  // Feel good: Bubble Pop, Sunshine Indie, Feel-Good Hip Hop & R&B
  ggMPOg1uXzZQbDB5eThLRTQ3: [
    "VLRDCLAK5uy_lGEOjy5U8xV41C8_LyqNnAZKOH6sGyutI",
    "VLRDCLAK5uy_l808wsTOCKs6u9c1bqeLIpzTUOfns2BMs",
    "VLRDCLAK5uy_mkEwQuegHYB8_aAzBO8Q__6gGoaFblISw",
  ],
  // Late Night / R&B & soul: Chill R&B, Neo Soul Essentials, Essential '90s R&B, Soothing Soul
  ggMPOg1uX2JxQ2hxc2J5UFhR: [
    "VLRDCLAK5uy_mX4JK0m7lhZ8Egv1E7bbXox_e0k6rGejo",
    "VLRDCLAK5uy_nxZ3Bp0gO6_Wkb3bp9jESFoOz6bANXw4s",
    "VLRDCLAK5uy_ne3DJMol0EVIfwcuZnx2hQak0q6EbeBlY",
    "VLRDCLAK5uy_k0oJ5JQqsSSQQvYS8xzcAh29CFryqs0mc",
  ],
};

const MOOD_SEARCH_HINTS: Record<string, string> = {
  ggMPOg1uX3NISTh4UmtWcFgz: "sad emotional acoustic",
  ggMPOg1uX1JOQWZFeDByc2Jm: "chill acoustic relax",
  ggMPOg1uX1JCQnB2QXVYVEIz: "love song romantic",
  ggMPOg1uXzZQbDB5eThLRTQ3: "upbeat feel good",
  ggMPOg1uX0NvNGNhWThMYWRh: "chill study focus",
  ggMPOg1uXzIxYkNac21YZ2Z0: "upbeat energy hype",
  ggMPOg1uX2w1aW1CRDFTSUNo: "party dance hits",
  ggMPOg1uX2JxQ2hxc2J5UFhR: "late night r&b chill",
  ggMPOg1uX044Z2o5WERLckpU: "drive hits",
  ggMPOg1uX2lRZUZiMnNrQnJW: "energetic hits",
  ggMPOg1uX1MxaFQ3Z0JMZkN4: "calm sleep acoustic",
};

const genreList = cached(6 * 60 * MINUTE, async (key): Promise<Genre[]> => {
  const { lang } = parseKey(key);
  const page = await withClient((yt) => browse(yt, { browseId: "FEmusic_moods_and_genres" }), lang).catch(() => {
    throw new HttpError(502, msg("genresUnavailable"));
  });
  const grids = shelvesOf(page);
  const seen = new Set<string>();
  const out: Genre[] = [];
  for (let idx = 0; idx < grids.length; idx++) {
    const grid = grids[idx];
    const title = text(grid?.header?.title ?? grid?.title);
    const isGenreShelf = /g[eéê]ne?r/i.test(title) || (grids.length > 1 && idx === grids.length - 1);
    const kind: "mood" | "genre" = isGenreShelf ? "genre" : "mood";
    for (const b of itemsOf(grid)) {
      const id = String(b.endpoint?.payload?.params ?? "");
      const name = text(b.button_text ?? b.title);
      if (!GENRE_ID.test(id) || !name || seen.has(id) || UNWANTED_GENRE_TILE.test(name)) continue;
      seen.add(id);
      out.push({ id, name, kind });
    }
  }
  return out;
});

export const genres = (lang: Lang) => genreList(keyOf(lang));

async function playlistItems(id: string, limit: number, lang: Lang): Promise<any[]> {
  try {
    const list = await withClient((yt) => yt.music.getPlaylist(id), lang);
    return ((list as any).items ?? (list as any).contents ?? []).slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Ranks the artists credited on `sources` by how often they show up (times the source's weight),
 * skipping the ones already `known`. Channels that are not artist pages (labels, uploaders) are left out.
 */
function rankArtists(sources: { items: any[]; weight: number; hits: boolean }[], known: Set<string>): GenreArtist[] {
  const ranked = new Map<string, GenreArtist & { score: number }>();
  for (const { items, weight, hits } of sources) {
    for (const item of items) {
      const hit = hits ? bareTitle(text(item.title)) : "";
      for (const a of item.artists ?? []) {
        const pageType = a?.endpoint?.payload?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType;
        if (!ARTIST_ID.test(a?.channel_id ?? "") || known.has(a.channel_id)) continue;
        if (pageType && pageType !== "MUSIC_PAGE_TYPE_ARTIST") continue;
        let entry = ranked.get(a.channel_id);
        if (!entry) {
          entry = { id: a.channel_id, name: text(a.name), ...imagesOf(item), hits: [], score: 0 };
          ranked.set(a.channel_id, entry);
        }
        entry.score += weight;
        if (hit && entry.hits.length < 3 && !entry.hits.includes(hit)) entry.hits.push(hit);
      }
    }
  }
  return [...ranked.values()]
    .filter((a) => a.name)
    .sort((a, b) => b.score - a.score)
    .map(({ score: _, ...a }) => a);
}

/** What a genre has turned up so far. "Load more" keeps reading its playlists for artists not seen yet. */
interface GenreState {
  page: GenrePage;
  /** Every artist found so far, in a fixed order: later pages append, never reshuffle earlier ones. */
  pool: GenreArtist[];
  /** Playlists not read yet. */
  queue: string[];
  lang: Lang;
  extending?: Promise<void>;
}

/**
 * A genre's songs and the artists behind them. The page lists ~50 songs, playlists and albums;
 * two editorial playlists widen the song list (and are all there is for pages like "Décadas").
 */
const genreState = cached(30 * MINUTE, async (key): Promise<GenreState> => {
  const { lang, id } = parseKey(key);
  const [all, page] = await Promise.all([
    genres(lang).catch(() => [] as Genre[]),
    withClient((yt) => browse(yt, { browseId: "FEmusic_moods_and_genres_category", params: id }), lang).catch(() => {
      throw new HttpError(502, msg("genreUnavailable"));
    }),
  ]);
  const rawShelves = shelvesOf(page);
  const filteredShelves = rawShelves.filter((s) => !UNWANTED_SHELF_OR_PLAYLIST.test(text(s?.header?.title ?? s?.title)));
  const shelves = filteredShelves.length > 0 ? filteredShelves : rawShelves;
  const items = shelves.flatMap(itemsOf);
  const songs = items.filter((i) => {
    if (i.item_type !== "song") return false;
    const track = toTrack(i, "song");
    return !track || !isUnwantedRegionalTrack(track);
  });
  const albums = items.filter((i) => i.item_type === "album");

  // One playlist from each shelf in turn (so "Décadas" mixes decades), editorial ("RDCLAK...") before
  // community ones, which are hit and miss. Exclude unrelated regional shelves/playlists (e.g. Bollywood).
  const perShelf = shelves.map((s) =>
    itemsOf(s).filter((i) => {
      if (i.item_type !== "playlist" || typeof i.id !== "string") return false;
      const label = `${text(i.title)} ${text(i.subtitle)}`;
      return !UNWANTED_SHELF_OR_PLAYLIST.test(label);
    }),
  );
  const editorial = (p: any) => /RDCLAK/.test(p.id);
  const shelfPlaylists = [
    ...roundRobin(perShelf.map((list) => list.filter(editorial))),
    ...roundRobin(perShelf.map((list) => list.filter((p) => !editorial(p)))),
  ].map((p): string => p.id);
  const priority = MOOD_PRIORITY_PLAYLISTS[id] ?? [];
  const playlists = [...new Set([...priority, ...shelfPlaylists])];
  const first = priority.length > 0 ? Math.min(playlists.length, Math.max(5, priority.length)) : songs.length >= 10 ? 2 : 4;
  const playlistLists = await Promise.all(playlists.slice(0, first).map((p) => playlistItems(p, 50, lang)));
  const fromPlaylists = roundRobin(playlistLists).filter((i) => {
    const track = toTrack(i, "song");
    return !track || !isUnwantedRegionalTrack(track);
  });

  // Filter out any abnormal tracks (e.g. >15 min compilations/DJ sets) and unwanted regional tracks
  const tracks = uniqueTracks([...songs, ...fromPlaylists].map((i) => toTrack(i, "song")))
    .filter((t) => !isUnwantedRegionalTrack(t) && (t.duration === 0 || (t.duration >= 25 && t.duration <= 15 * 60)))
    .slice(0, MAX_GENRE_TRACKS);
  if (!tracks.length && !albums.length) throw new HttpError(404, msg("genreEmpty"));

  // The genre's own song and album shelves weigh more than playlists.
  const pool = rankArtists(
    [
      { items: songs, weight: 2, hits: true },
      { items: albums, weight: 2, hits: false },
      { items: fromPlaylists, weight: 1, hits: true },
    ],
    new Set(),
  );
  // More artists come from the remaining editorial playlists; community ones only when there is nothing else.
  const rest = playlists.slice(first);
  const queue = rest.some((p) => /RDCLAK/.test(p)) ? rest.filter((p) => /RDCLAK/.test(p)) : rest;

  return {
    page: {
      id,
      name: all.find((g) => g.id === id)?.name ?? "",
      artists: pool.slice(0, ARTISTS_PAGE),
      hasMoreArtists: pool.length > ARTISTS_PAGE || queue.length > 0,
      tracks,
    },
    pool,
    queue,
    lang,
  };
});

const activitySeedTracks = cached(5 * MINUTE, async (key): Promise<Track[]> => {
  const [langRaw = "en", id = ""] = key.split("|");
  const lang: Lang = isLang(langRaw) ? langRaw : "en";
  const activity = await getActivityProfile();
  const hint = MOOD_SEARCH_HINTS[id];
  const batches = await Promise.all([
    ...activity.topArtists.slice(0, 3).map((artist) =>
      search(`${artist} ${hint ?? ""}`.trim(), "song", lang)
        .then((res) =>
          res
            .filter(
              (t) =>
                !isUnwantedRegionalTrack(t) &&
                (t.duration === 0 || (t.duration >= 25 && t.duration <= 15 * 60)),
            )
            .slice(0, 5),
        )
        .catch(() => [] as Track[]),
    ),
    ...(!hint
      ? activity.topTracks.slice(0, 2).map((seed) =>
          radio(seed.id)
            .then((res) => res.filter((t) => !isUnwantedRegionalTrack(t)).slice(0, 6))
            .catch(() => [] as Track[]),
        )
      : []),
  ]);
  return roundRobin(batches);
});

export const genre = async (id: string, lang: Lang): Promise<GenrePage> => {
  const [state, activity] = await Promise.all([genreState(keyOf(lang, id)), getActivityProfile()]);
  const base = state.page;
  if (!activity.topArtists.length && !activity.topTracks.length) return base;

  const matchesKnownArtist = (artist: string) =>
    artist.split(",").some((a) => activity.knownArtists.has(a.trim().toLowerCase()));
  const familiarBase = base.tracks.filter((t) => matchesKnownArtist(t.artist));
  const discoveryBase = base.tracks.filter((t) => !matchesKnownArtist(t.artist));

  const sig = `${lang}|${id}|${activity.topArtists.slice(0, 4).join(",")}|${activity.topTracks[0]?.id ?? ""}`;
  const activityTracks = await activitySeedTracks(sig).catch(() => [] as Track[]);

  const merged = uniqueTracks([...roundRobin([activityTracks, familiarBase, discoveryBase]), ...base.tracks])
    .filter((t) => !isUnwantedRegionalTrack(t))
    .slice(0, MAX_GENRE_TRACKS);

  return { ...base, tracks: merged };
};

/** Reads the next few playlists of the genre and appends the artists they bring. */
async function extend(state: GenreState): Promise<void> {
  const batch = state.queue.splice(0, PLAYLISTS_PER_ROUND);
  const items = (await Promise.all(batch.map((p) => playlistItems(p, 100, state.lang))))
    .flat()
    .filter((i) => {
      const track = toTrack(i, "song");
      return !track || !isUnwantedRegionalTrack(track);
    });
  state.pool.push(...rankArtists([{ items, weight: 1, hits: true }], new Set(state.pool.map((a) => a.id))));
  if (state.pool.length >= MAX_ARTISTS) state.queue.length = 0;
}

/** The next page of a genre's artists, reading more of its playlists when the ones found so far run out. */
export async function genreArtists(id: string, offset: number, lang: Lang): Promise<{ artists: GenreArtist[]; hasMore: boolean }> {
  const state = await genreState(keyOf(lang, id));
  // A few rounds at most per request, so a run of playlists with no new names can't stall it.
  for (let round = 0; round < 5 && state.pool.length < offset + ARTISTS_PAGE && state.queue.length; round++) {
    // Two "load more" taps at once share the same read instead of skipping playlists.
    state.extending ??= extend(state).finally(() => (state.extending = undefined));
    await state.extending;
  }
  return {
    artists: state.pool.slice(offset, offset + ARTISTS_PAGE),
    hasMore: state.pool.length > offset + ARTISTS_PAGE || state.queue.length > 0,
  };
}

/** An artist's most played songs (the "Top songs" shelf, expanded to its full list). */
function albumCard(item: any): AlbumCard | null {
  const id = typeof item?.id === "string" ? item.id : "";
  if (!ALBUM_ID.test(id)) return null;
  const subtitle = text(item.subtitle);
  const artists: string[] = (item.artists ?? []).map((a: { name?: string }) => text(a?.name)).filter(Boolean);
  return {
    id,
    title: text(item.title),
    artist: artists.join(", ") || text(item.author?.name),
    year: String(item.year ?? subtitle.match(/\b(19|20)\d\d\b/)?.[0] ?? ""),
    ...imagesOf(item),
  };
}

const isSingleItem = (item: any): boolean => /\b(single|sencillo)\b/i.test(text(item?.subtitle));

const albumCards = (items: any[], excludeSingles = false) => {
  const filtered = excludeSingles ? items.filter((i) => !isSingleItem(i)) : items;
  const source = filtered.length > 0 ? filtered : items;
  return source.map(albumCard).filter((a): a is AlbumCard => !!a && !!a.title);
};

/** Every album of an artist: the page shows ten, its "more" link opens the whole discography. */
async function allAlbums(shelf: any, lang: Lang): Promise<AlbumCard[]> {
  const shown = albumCards(itemsOf(shelf), true);
  const more = shelf?.header?.more_content?.endpoint?.payload;
  if (!more?.browseId) return shown;
  try {
    const page = await withClient((yt) => browse(yt, { browseId: more.browseId, params: more.params }), lang);
    const all = albumCards(page.contents_memo?.get("MusicTwoRowItem") ?? [], true);
    return all.length >= shown.length ? all : shown;
  } catch {
    return shown;
  }
}

const artistPage = cached(30 * MINUTE, async (key): Promise<ArtistPage> => {
  const { lang, id } = parseKey(key);
  const page = await withClient((yt) => yt.music.getArtist(id), lang).catch(() => {
    throw new HttpError(502, msg("artistUnavailable"));
  });
  const header: any = page.header;
  const shelf: any = page.sections.find((s) => s.type === "MusicShelf");
  // Album shelves are told apart by what they hold, not by their (translated) titles: filter out 1-song singles.
  const releaseShelves: any[] = page.sections.filter((s: any) =>
    itemsOf(s).some((i) => i.item_type === "album" && !isSingleItem(i)),
  );
  let items: any[] = itemsOf(shelf);
  // The shelf shows 5; its "show all" link is a playlist with the full ranking.
  const fullList = shelf?.endpoint?.payload?.browseId;
  const [more, albums] = await Promise.all([
    typeof fullList === "string" && fullList.startsWith("VL") ? playlistItems(fullList, MAX_HITS * 2, lang) : Promise.resolve([]),
    releaseShelves[0] ? allAlbums(releaseShelves[0], lang) : Promise.resolve([]),
  ]);
  if (more.length) items = more;
  const banner = (header?.thumbnail?.contents ?? header?.thumbnail ?? [])[0]?.url;
  const name = text(header?.title);
  const tracks = uniqueTracks(items.map((i) => toTrack(i, "song"))).slice(0, MAX_HITS);
  if (!name && !tracks.length) throw new HttpError(404, msg("artistNotFound"));
  return {
    id,
    name,
    description: text(header?.description),
    banner: typeof banner === "string" && banner.startsWith("https://") ? banner : "",
    tracks,
    albums,
    singles: [],
  };
});

export const artist = (id: string, lang: Lang) => artistPage(keyOf(lang, id));

/** An album's tracks in order. Its tracks carry no cover or artist of their own: they get the album's. */
const albumPage = cached(60 * MINUTE, async (key): Promise<AlbumPage> => {
  const { lang, id } = parseKey(key);
  const album: any = await withClient((yt) => yt.music.getAlbum(id), lang).catch(() => {
    throw new HttpError(502, msg("albumUnavailable"));
  });
  const header = album.header;
  const title = text(header?.title);
  const artistRuns: any[] = header?.strapline_text_one?.runs ?? [];
  const artistName = text(header?.strapline_text_one) || text(header?.author?.name);
  const artistId: string | null = artistRuns.map((r) => r?.endpoint?.payload?.browseId).find((b) => ARTIST_ID.test(b ?? "")) ?? null;
  const cover = imagesOf(header);
  let tracks: Track[] = (album.contents ?? [])
    .filter((i: any) => typeof i?.id === "string" && VIDEO_ID.test(i.id))
    .map(
      (i: any): Track => ({
        id: i.id,
        title: text(i.title) || "Untitled",
        artist: (i.artists ?? []).map((a: { name?: string }) => text(a?.name)).filter(Boolean).join(", ") || artistName,
        album: title,
        duration: i.duration?.seconds ?? 0,
        thumb: sized(cover.art, 120),
        art: cover.art,
        kind: "song",
      }),
    );
  if (!title && !tracks.length) throw new HttpError(404, msg("albumNotFound"));

  let kindLabel = text(header?.subtitle);
  let infoLabel = text(header?.second_subtitle);

  // Never let an album be composed of just 1-3 songs: dynamically expand singles/short releases
  // with the artist's catalog and related tracks.
  if (tracks.length < 5) {
    const seedId = tracks[0]?.id;
    const [artistTracks, relatedTracks] = await Promise.all([
      artistName ? search(artistName, "song", lang).catch(() => [] as Track[]) : Promise.resolve([] as Track[]),
      seedId ? radio(seedId).catch(() => [] as Track[]) : Promise.resolve([] as Track[]),
    ]);
    tracks = uniqueTracks([...tracks, ...artistTracks.slice(0, 10), ...relatedTracks]).slice(0, 18);
    kindLabel = kindLabel.replace(/\b(Single|Sencillo)\b/i, "Dynamic Album");
    infoLabel = `${tracks.length} songs`;
  }

  return {
    id,
    title,
    artist: artistName,
    artistId,
    kind: kindLabel,
    info: infoLabel,
    thumb: cover.thumb,
    art: cover.art,
    tracks,
  };
});

export const album = (id: string, lang: Lang) => albumPage(keyOf(lang, id));

export async function searchAlbums(query: string, lang: Lang): Promise<AlbumCard[]> {
  const result: any = await withClient((yt) => yt.music.search(query, { type: "album" }), lang);
  return albumCards(itemsOf(result.contents?.[0]), true);
}

const GLOBAL_HIT_LIST = "VLRDCLAK5uy_kmPRjHDECIcuVwnKsx2Ng7fyNgFKWNJFs";
const GLOBAL_POP_HITS = "VLRDCLAK5uy_kPX0g3hZ9R0j11N3vPj0E2gQo32P5A";

const REGION_CHARTS: Record<string, { name: string; playlistId: string }> = {
  US: { name: "United States", playlistId: "VLPL4fGSI1pDJn68CQ3wSuhzcL6H78uP_" },
  PH: { name: "Philippines", playlistId: "VLPL4fGSI1pDJn68W-r1k_H3nSbgqfE01" },
  GB: { name: "United Kingdom", playlistId: "VLPL4fGSI1pDJn67W9b7W3YkG0l0zS2n_" },
  GLOBAL: { name: "Global", playlistId: GLOBAL_POP_HITS },
};

const chartsList = cached(60 * MINUTE, async (key): Promise<ChartsData> => {
  const { lang, id: regionCode } = parseKey(key);
  const targetRegion = regionCode && REGION_CHARTS[regionCode.toUpperCase()] ? regionCode.toUpperCase() : "GLOBAL";
  const regionalConfig = REGION_CHARTS[targetRegion] ?? REGION_CHARTS.GLOBAL!;

  const [hitListItems, regionalItems, chartsPage] = await Promise.all([
    playlistItems(GLOBAL_HIT_LIST, 60, lang).catch(() => []),
    playlistItems(regionalConfig.playlistId, 60, lang).catch(() => []),
    withClient((yt) => browse(yt, { browseId: "FEmusic_charts" }), lang).catch(() => null),
  ]);

  const global = uniqueTracks([...hitListItems, ...regionalItems].map((i) => toTrack(i, "song")))
    .filter((t) => !isUnwantedRegionalTrack(t))
    .slice(0, 50);

  let detectedRegion = regionalConfig.name;
  const localPlaylistIds: string[] = [];
  for (const shelf of shelvesOf(chartsPage)) {
    for (const item of itemsOf(shelf)) {
      const bid = String(item?.endpoint?.payload?.browseId ?? item?.id ?? "");
      const title = text(item?.title);
      if (bid.startsWith("VL")) {
        localPlaylistIds.push(bid);
        if (!detectedRegion && title) {
          const m = /(?:-\s*|\bVideos\s+)([A-Z][A-Za-z\s]+)$/.exec(title.trim());
          if (m?.[1]) detectedRegion = m[1].trim();
        }
      }
    }
  }

  const localItems = (await Promise.all(localPlaylistIds.slice(0, 2).map((id) => playlistItems(id, 60, lang).catch(() => [])))).flat();
  const trending = uniqueTracks([...regionalItems, ...localItems, ...hitListItems].map((i) => toTrack(i, "song")))
    .filter((t) => !isUnwantedRegionalTrack(t))
    .slice(0, 50);

  return {
    global: global.length ? global : trending,
    trending: trending.length ? trending : global,
    region: detectedRegion || regionalConfig.name,
  };
});

export const charts = (lang: Lang, region?: string): Promise<ChartsData> => chartsList(keyOf(lang, region || "GLOBAL"));
