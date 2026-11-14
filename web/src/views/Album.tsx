import {
  ArrowRightIcon,
  ArrowsClockwiseIcon,
  MusicNotesIcon,
  PauseIcon,
  PlayIcon,
  PlaylistIcon,
  ShuffleIcon,
  WarningCircleIcon,
} from "../components/icons";
import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { Artwork } from "../components/Artwork";
import { IconButton, PlayDisc } from "../components/IconButton";
import { BackButton, EmptyState, PageHeader } from "../components/Page";
import { TrackList, TrackListSkeleton } from "../components/TrackList";
import { useRemote } from "../hooks/useRemote";
import { useI18n, useT } from "../i18n";
import { api } from "../lib/api";
import { shuffled } from "../lib/format";
import { paths } from "../lib/routes";
import type { AlbumPage, Track } from "../lib/types";
import { usePlayer } from "../player/player";
import { useLibrary } from "../stores/library";

/** An album, its tracks arranged like Spotify with dynamic related recommendations. */
export default function Album() {
  const { id = "" } = useParams();
  const location = useLocation();
  const lang = useI18n((s) => s.lang);
  const t = useT();
  const page = useRemote<AlbumPage>(`album:${lang}:${id}`, (signal) => api.album(id, signal));
  const playList = usePlayer((s) => s.playList);
  const toggle = usePlayer((s) => s.toggle);
  const queue = usePlayer((s) => s.queue);
  const status = usePlayer((s) => s.status);
  const createPlaylist = useLibrary((s) => s.createPlaylist);
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [recommended, setRecommended] = useState<Track[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  const album = page.status === "ok" ? page.data : null;
  const baseTracks = album?.tracks ?? [];

  // Dynamically fetch related songs for the album (and automatically merge if the release had fewer than 5 tracks)
  const loadRecommendations = async (seedTracks: Track[]) => {
    if (!seedTracks.length) return;
    setLoadingRecs(true);
    try {
      const seed = seedTracks[Math.floor(Math.random() * Math.min(3, seedTracks.length))] ?? seedTracks[0]!;
      const related = await api.radio(seed.id);
      const existing = new Set(seedTracks.map((x) => x.id));
      setRecommended(related.filter((x) => !existing.has(x.id)).slice(0, 12));
    } catch {
      /* ignore */
    } finally {
      setLoadingRecs(false);
    }
  };

  useEffect(() => {
    setRecommended([]);
    if (baseTracks.length > 0) {
      void loadRecommendations(baseTracks);
    }
  }, [id, baseTracks.length]);

  // Never allow a 1-song album: if the release has < 5 tracks, merge dynamic recommendations directly into the album list
  const tracks =
    baseTracks.length > 0 && baseTracks.length < 5 && recommended.length > 0
      ? [...baseTracks, ...recommended.slice(0, 12 - baseTracks.length)]
      : baseTracks;
  const extraRecs = baseTracks.length >= 5 ? recommended : [];

  const title = album?.title || (location.state as { name?: string } | null)?.name || t.album.fallbackName;
  // The queue holds this album: the big button pauses and resumes instead of starting over.
  const isThisPlaying = tracks.length > 0 && queue.length >= tracks.length && tracks.every((tr, i) => queue[i]?.id === tr.id);
  const playing = isThisPlaying && (status === "playing" || status === "loading");

  const save = async () => {
    if (!album) return;
    setSaving(true);
    const p = await createPlaylist(album.artist ? `${album.title} · ${album.artist}` : album.title, tracks);
    setSaving(false);
    if (p) setSaved(p.id);
  };

  return (
    <div className="@container/album pb-8">
      <PageHeader title={title} actions={<BackButton fallback={paths.search} />} />

      <div className="relative">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-20 h-72 bg-linear-to-b from-accent-soft to-transparent" />
        <div className="relative flex flex-col items-center gap-5 px-4 pt-2 pb-6 @[620px]/album:flex-row @[620px]/album:items-end @[620px]/album:gap-6 @[620px]/album:px-6 @[620px]/album:pt-6">
          {album ? (
            <Artwork
              src={album.art}
              fallback={album.thumb}
              iconSize={64}
              className="size-44 shrink-0 rounded-[18px] shadow-[0_24px_60px_rgb(0_0_0/0.4)] @[620px]/album:size-52"
            />
          ) : (
            <span className="skeleton size-44 shrink-0 rounded-[18px] @[620px]/album:size-52" />
          )}
          <div className="flex min-w-0 flex-col items-center gap-2 text-center @[620px]/album:items-start @[620px]/album:text-left">
            {album?.kind && <span className="text-xs font-medium text-fg-2">{album.kind}</span>}
            <h1 className="max-w-full text-[28px] leading-[1.1] font-bold tracking-tight break-words @[620px]/album:text-5xl">{title}</h1>
            {album?.artist &&
              (album.artistId ? (
                <Link to={paths.artist(album.artistId)} state={{ name: album.artist }} className="font-medium hover:underline">
                  {album.artist}
                </Link>
              ) : (
                <span className="font-medium">{album.artist}</span>
              ))}
            {album?.info && <p className="text-[13px] text-fg-2 tabular-nums">{album.info}</p>}
          </div>
        </div>
      </div>

      {album && tracks.length > 0 && (
        <div className="flex items-center gap-2 px-4 pb-4 @[620px]/album:px-6">
          <PlayDisc
            label={playing ? t.common.pause : t.album.play(album.title)}
            px={56}
            onClick={() => (isThisPlaying ? toggle() : playList(tracks, 0))}
          >
            {playing ? <PauseIcon size={24} weight="fill" /> : <PlayIcon size={24} weight="fill" />}
          </PlayDisc>
          <IconButton label={t.album.shuffle} size="lg" onClick={() => playList(shuffled(tracks), 0)}>
            <ShuffleIcon size={24} />
          </IconButton>
          {saved ? (
            <Link
              to={paths.playlist(saved)}
              className="ml-1 flex h-11 items-center gap-2 rounded-full bg-accent-soft px-4 text-sm font-medium text-accent-text"
            >
              {t.album.openPlaylist} <ArrowRightIcon size={16} />
            </Link>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="ml-1 flex h-11 items-center gap-2 rounded-full bg-surface-3 px-4 text-sm font-medium transition-transform hover:bg-surface-4 active:scale-[0.97] disabled:opacity-60"
            >
              <PlaylistIcon size={18} /> {t.album.saveAsPlaylist}
            </button>
          )}
        </div>
      )}

      {page.status === "loading" && <TrackListSkeleton />}

      {page.status === "error" && (
        <EmptyState
          icon={<WarningCircleIcon size={28} />}
          title={t.album.openFailed}
          body={page.message}
          action={
            <button
              type="button"
              onClick={page.retry}
              className="mt-2 h-11 rounded-full bg-surface-3 px-6 text-sm font-medium hover:bg-surface-4"
            >
              {t.common.retry}
            </button>
          }
        />
      )}

      {album &&
        (tracks.length ? (
          <div className="px-2 md:px-4">
            <TrackList key={id} tracks={tracks} context={[...tracks, ...extraRecs]} showArtwork={false} showAlbum={false} />

            {extraRecs.length > 0 && (
              <div className="mt-8 border-t border-line pt-6">
                <div className="mb-3 flex items-center justify-between px-2 md:px-3">
                  <div>
                    <h2 className="text-base font-semibold tracking-tight">Recommended</h2>
                    <p className="text-xs text-fg-2">More songs based on {album.title}</p>
                  </div>
                  <button
                    type="button"
                    disabled={loadingRecs}
                    onClick={() => void loadRecommendations(baseTracks)}
                    className="flex h-9 items-center gap-1.5 rounded-full bg-surface-3 px-3.5 text-xs font-medium text-fg-2 transition-colors hover:bg-surface-4 hover:text-fg disabled:opacity-50"
                  >
                    <ArrowsClockwiseIcon size={14} className={loadingRecs ? "animate-spin" : ""} />
                    Refresh
                  </button>
                </div>
                <TrackList tracks={extraRecs} context={[...extraRecs, ...tracks]} header={false} showAlbum />
              </div>
            )}
          </div>
        ) : (
          <EmptyState icon={<MusicNotesIcon size={28} />} title={t.album.noTracks} body={t.album.noTracksBody} />
        ))}
    </div>
  );
}
