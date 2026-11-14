import { MusicNotesIcon, PauseIcon, PlayIcon, ShuffleIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { useLocation, useParams } from "react-router";
import { AlbumRow } from "../components/AlbumTiles";
import { Artwork } from "../components/Artwork";
import { IconButton, PlayDisc } from "../components/IconButton";
import { BackButton, EmptyState, PageHeader } from "../components/Page";
import { TrackList, TrackListSkeleton } from "../components/TrackList";
import { useRemote } from "../hooks/useRemote";
import { useI18n, useT } from "../i18n";
import { api } from "../lib/api";
import { paths } from "../lib/routes";
import { cn, shuffled } from "../lib/format";
import type { ArtistPage } from "../lib/types";
import { usePlayer } from "../player/player";

/** An artist's greatest hits and albums, arranged like Spotify. */
export default function Artist() {
  const { id = "" } = useParams();
  const location = useLocation();
  const lang = useI18n((s) => s.lang);
  const t = useT();
  // The bio comes from YouTube Music in the app language.
  const page = useRemote<ArtistPage>(`artist:${lang}:${id}`, (signal) => api.artist(id, signal));
  const playList = usePlayer((s) => s.playList);
  const toggle = usePlayer((s) => s.toggle);
  const queue = usePlayer((s) => s.queue);
  const status = usePlayer((s) => s.status);
  const [fullBio, setFullBio] = useState(false);
  const name = (page.status === "ok" && page.data.name) || (location.state as { name?: string } | null)?.name || t.artist.fallbackName;
  const tracks = page.status === "ok" ? page.data.tracks : [];
  const isThisPlaying = tracks.length > 0 && queue.length === tracks.length && queue.every((q, i) => q.id === tracks[i]?.id);
  const playing = isThisPlaying && (status === "playing" || status === "loading");

  return (
    <div className="pb-8">
      <PageHeader title={name} actions={<BackButton fallback={paths.search} />} />

      <div className="relative mx-4 overflow-hidden rounded-[20px] bg-surface-2 md:mx-6">
        {page.status === "ok" && page.data.banner && (
          <div className="absolute inset-0">
            <Artwork src={page.data.banner} className="size-full" />
          </div>
        )}
        {page.status === "loading" && <div className="skeleton absolute inset-0" />}
        <div aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-black/80 via-black/25 to-transparent" />
        <div className="@container/artist relative flex min-h-44 flex-col justify-end gap-1 p-5 @[620px]/artist:min-h-60 @[620px]/artist:p-8">
          <span className="text-xs font-medium text-white/75">{t.artist.label}</span>
          <h1 className="text-[28px] leading-[1.1] font-bold tracking-tight break-words text-white @[620px]/artist:text-5xl">{name}</h1>
        </div>
      </div>

      {page.status === "ok" && page.data.description && (
        <button
          type="button"
          onClick={() => setFullBio((v) => !v)}
          aria-expanded={fullBio}
          className={cn("mx-4 mt-4 max-w-[75ch] text-left text-sm text-fg-2 hover:text-fg md:mx-6", !fullBio && "line-clamp-3")}
        >
          {page.data.description}
        </button>
      )}

      {page.status === "ok" && page.data.albums.length > 0 && <AlbumRow title={t.artist.albums} albums={page.data.albums} />}

      <div className="flex items-center justify-between px-4 pt-6 pb-2 md:px-6">
        <h2 className="text-xl font-semibold tracking-tight">{t.artist.hits}</h2>
        {tracks.length > 0 && (
          <div className="flex items-center gap-2">
            <IconButton label={t.collection.shuffle} size="md" onClick={() => playList(shuffled(tracks), 0)}>
              <ShuffleIcon size={20} />
            </IconButton>
            <PlayDisc
              label={playing ? t.common.pause : t.common.playAll}
              px={44}
              onClick={() => (isThisPlaying ? toggle() : playList(tracks, 0))}
            >
              {playing ? <PauseIcon size={20} weight="fill" /> : <PlayIcon size={20} weight="fill" />}
            </PlayDisc>
          </div>
        )}
      </div>

      {page.status === "loading" && <TrackListSkeleton />}

      {page.status === "error" && (
        <EmptyState
          icon={<WarningCircleIcon size={28} />}
          title={t.artist.openFailed}
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

      {page.status === "ok" &&
        (tracks.length ? (
          <div className="px-2 md:px-4">
            <TrackList key={id} tracks={tracks} showAlbum />
          </div>
        ) : (
          <EmptyState icon={<MusicNotesIcon size={28} />} title={t.artist.noHits} body={t.artist.noHitsBody} />
        ))}
    </div>
  );
}
