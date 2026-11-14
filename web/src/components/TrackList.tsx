import { CheckCircleIcon, ClockIcon, DotsThreeIcon, HeartIcon, PlayIcon, VideoCameraIcon } from "./icons";
import { memo, type MouseEvent } from "react";
import { useT } from "../i18n";
import { cn, formatTime } from "../lib/format";
import type { Track } from "../lib/types";
import { selectCurrent, usePlayer } from "../player/player";
import { useAppearance } from "../stores/appearance";
import { useLibrary } from "../stores/library";
import { useOffline } from "../stores/offline";
import { useUi } from "../stores/ui";
import { Artwork } from "./Artwork";
import { Equalizer } from "./Brand";

interface RowProps {
  track: Track;
  position: number;
  onPlay: () => void;
  playlistId?: string;
  showAlbum: boolean;
  showArtwork: boolean;
}

const TrackRow = memo(function TrackRow({ track, position, onPlay, playlistId, showAlbum, showArtwork }: RowProps) {
  const isCurrent = usePlayer((s) => selectCurrent(s)?.id === track.id);
  const isPlaying = usePlayer((s) => s.status === "playing" || s.status === "loading");
  const isFavorite = useLibrary((s) => s.favorites.some((t) => t.id === track.id));
  const isOffline = useOffline((s) => s.tracks.some((t) => t.id === track.id));
  const toggleFavorite = useLibrary((s) => s.toggleFavorite);
  const openMenu = useUi((s) => s.openMenu);
  const t = useT();

  const menuAt = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const fromButton = e.type === "click";
    openMenu({ track, playlistId, x: fromButton ? r.right - 256 : e.clientX, y: fromButton ? r.bottom + 6 : e.clientY });
  };

  return (
    <li
      onContextMenu={menuAt}
      className={cn(
        "group relative grid items-center gap-3 rounded-xl px-2 py-2 transition-colors duration-150 hover:bg-surface-2 @[500px]/tracklist:px-3",
        !showArtwork
          ? "grid-cols-[28px_1fr_auto_auto]"
          : showAlbum
            ? "grid-cols-[auto_1fr_auto] @[500px]/tracklist:grid-cols-[28px_auto_1fr_auto_auto] @[720px]/tracklist:grid-cols-[28px_auto_minmax(0,1.4fr)_minmax(0,1fr)_auto_auto]"
            : "grid-cols-[auto_1fr_auto] @[500px]/tracklist:grid-cols-[28px_auto_1fr_auto_auto]",
      )}
    >
      <button
        type="button"
        onClick={onPlay}
        aria-label={t.common.playX(track.title)}
        className="absolute inset-0 rounded-xl focus-visible:outline-offset-[-2px]"
      />

      <span
        className={cn(
          "pointer-events-none items-center justify-center text-[13px] text-fg-3 tabular-nums",
          showArtwork ? "hidden @[500px]/tracklist:flex" : "flex",
        )}
      >
        {isCurrent ? (
          <Equalizer live={isPlaying} />
        ) : (
          <>
            <span className="group-hover:hidden">{position + 1}</span>
            <PlayIcon size={14} weight="fill" className="hidden text-fg group-hover:block" />
          </>
        )}
      </span>

      {showArtwork && (
        <div className="pointer-events-none relative">
          <Artwork src={track.thumb} className="size-11 rounded-[10px]" />
          {isCurrent && (
            <span className="absolute inset-0 grid place-items-center rounded-[10px] bg-black/45 @[500px]/tracklist:hidden">
              <Equalizer live={isPlaying} />
            </span>
          )}
        </div>
      )}

      <div className="pointer-events-none min-w-0">
        <p className={cn("truncate text-[15px] leading-tight font-medium", isCurrent ? "text-accent-text" : "text-fg")}>
          {track.title}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-fg-2">
          {isOffline && <CheckCircleIcon size={13} weight="fill" className="shrink-0 text-accent-text" aria-label={t.nav.offline} />}
          {track.kind === "video" && <VideoCameraIcon size={13} className="shrink-0 text-fg-3" aria-label={t.common.video} />}
          <span className="truncate">{track.artist || t.common.youtube}</span>
        </p>
      </div>

      {showArtwork && showAlbum && <p className="pointer-events-none hidden truncate text-sm text-fg-2 @[720px]/tracklist:block">{track.album ?? ""}</p>}

      <div className={cn("relative z-10 items-center gap-1", showArtwork ? "hidden @[500px]/tracklist:flex" : "flex")}>
        <button
          type="button"
          onClick={() => void toggleFavorite(track)}
          aria-label={isFavorite ? t.common.removeFromFavorites : t.common.addToFavorites}
          title={isFavorite ? t.common.removeFromFavorites : t.common.addToFavorites}
          className={cn(
            "grid size-8 place-items-center rounded-full transition-[opacity,transform] active:scale-90",
            isFavorite ? "text-accent-text" : "text-fg-2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-fg",
          )}
        >
          <HeartIcon size={17} weight={isFavorite ? "fill" : "regular"} />
        </button>
        <span className="pointer-events-none w-11 text-right text-[13px] text-fg-3 tabular-nums">
          {track.duration ? formatTime(track.duration) : ""}
        </span>
      </div>

      <button
        type="button"
        onClick={menuAt}
        aria-label={t.trackList.moreFor(track.title)}
        title={t.trackList.more}
        className="relative z-10 grid size-9 place-items-center rounded-full text-fg-2 transition-[opacity,background-color] hover:bg-surface-3 hover:text-fg md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
      >
        <DotsThreeIcon size={22} weight="bold" />
      </button>
    </li>
  );
});

interface ListProps {
  tracks: Track[];
  /** Full list to queue when a row is played, if `tracks` is only a preview of it. */
  context?: Track[];
  playlistId?: string;
  showAlbum?: boolean;
  showArtwork?: boolean;
  header?: boolean;
  /** `"related"` plays the clicked song and dynamically queues songs related to it (used in Search). */
  playMode?: "context" | "related";
}

export function TrackList({
  tracks,
  context,
  playlistId,
  showAlbum: albumWanted = true,
  showArtwork = true,
  header = true,
  playMode = "context",
}: ListProps) {
  const playList = usePlayer((s) => s.playList);
  const playRelated = usePlayer((s) => s.playRelated);
  const t = useT();
  // Pages ask for the album column where it makes sense; Settings can turn it off everywhere.
  const showAlbum = useAppearance((s) => s.albumColumn) && albumWanted && showArtwork;
  return (
    <div className="@container/tracklist">
      {header && (
        <div
          className={cn(
            "mb-1 items-center gap-3 border-b border-line px-2 pb-2 text-xs font-medium tracking-wide text-fg-3 @[500px]/tracklist:px-3",
            !showArtwork
              ? "grid grid-cols-[28px_1fr_auto_auto]"
              : showAlbum
                ? "hidden @[500px]/tracklist:grid @[500px]/tracklist:grid-cols-[28px_44px_1fr_auto_auto] @[720px]/tracklist:grid-cols-[28px_44px_minmax(0,1.4fr)_minmax(0,1fr)_auto_auto]"
                : "hidden @[500px]/tracklist:grid @[500px]/tracklist:grid-cols-[28px_44px_1fr_auto_auto]",
          )}
        >
          <span className="text-center">#</span>
          {showArtwork && <span />}
          <span>{t.trackList.title}</span>
          {showAlbum && <span className="hidden @[720px]/tracklist:block">{t.trackList.album}</span>}
          <span className="flex w-[84px] justify-end pr-0.5">
            <ClockIcon size={15} aria-label={t.trackList.duration} />
          </span>
          <span className="w-9" />
        </div>
      )}
      <ul className="flex flex-col">
        {tracks.map((tr, i) => (
          <TrackRow
            key={`${tr.id}-${i}`}
            track={tr}
            position={i}
            playlistId={playlistId}
            showAlbum={showAlbum}
            showArtwork={showArtwork}
            onPlay={() => (playMode === "related" ? playRelated(tr) : playList(context ?? tracks, i))}
          />
        ))}
      </ul>
    </div>
  );
}

export function TrackListSkeleton({ rows = 8 }: { rows?: number }) {
  const t = useT();
  return (
    <ul aria-label={t.common.loading} className="@container/tracklist flex flex-col gap-1">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-3 px-2 py-1.5 @[500px]/tracklist:px-3">
          <span className="hidden w-7 @[500px]/tracklist:block" />
          <span className="skeleton size-11 rounded-[10px]" />
          <span className="flex flex-1 flex-col gap-2">
            <span className="skeleton h-3.5 rounded-full" style={{ width: `${46 + ((i * 17) % 38)}%` }} />
            <span className="skeleton h-3 rounded-full" style={{ width: `${22 + ((i * 11) % 20)}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}
