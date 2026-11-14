import {
  ArrowsClockwiseIcon,
  FolderOpenIcon,
  HardDriveIcon,
  MagnifyingGlassIcon,
  MusicNotesPlusIcon,
  PlayIcon,
  ShuffleIcon,
  TrashIcon,
  XIcon,
} from "../components/icons";
import { useMemo, useRef, useState, type DragEvent } from "react";
import { EmptyState, PageHeader } from "../components/Page";
import { TrackList } from "../components/TrackList";
import { useT } from "../i18n";
import { cn, shuffled } from "../lib/format";
import { usePlayer } from "../player/player";
import { useDeviceFiles } from "../stores/deviceFiles";

export default function Device() {
  const t = useT();
  const tracks = useDeviceFiles((s) => s.tracks);
  const sizes = useDeviceFiles((s) => s.sizes);
  const importing = useDeviceFiles((s) => s.importing);
  const load = useDeviceFiles((s) => s.load);
  const importFiles = useDeviceFiles((s) => s.importFiles);
  const clearAll = useDeviceFiles((s) => s.clearAll);
  const playList = usePlayer((s) => s.playList);

  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState("");
  const [dragging, setDragging] = useState(false);
  const [scanning, setScanning] = useState(false);

  const rescan = async () => {
    if (scanning) return;
    setScanning(true);
    try {
      await load();
    } finally {
      setScanning(false);
    }
  };

  const totalBytes = useMemo(
    () => tracks.reduce((sum, tr) => sum + (sizes[tr.id] ?? 0), 0),
    [tracks, sizes],
  );
  const sizeMb = (totalBytes / (1024 * 1024)).toFixed(totalBytes > 10 * 1024 * 1024 ? 0 : 1);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return tracks;
    return tracks.filter(
      (tr) =>
        tr.title.toLowerCase().includes(q) ||
        tr.artist.toLowerCase().includes(q) ||
        (tr.album?.toLowerCase().includes(q) ?? false),
    );
  }, [tracks, filter]);

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) void importFiles(e.dataTransfer.files);
  };

  const canPickFolder =
    typeof document !== "undefined" &&
    "webkitdirectory" in document.createElement("input") &&
    !/iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  return (
    <div
      className="@container/device min-h-full pb-8"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <input
        ref={fileInput}
        type="file"
        accept="audio/*,.mp3,.m4a,.m4b,.aac,.flac,.wav,.ogg,.opus,.webm,.mp4,.caf,.aif,.aiff"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void importFiles(e.target.files);
          e.currentTarget.value = "";
        }}
      />
      {canPickFolder && (
        <input
          ref={folderInput}
          type="file"
          multiple
          // @ts-expect-error non-standard folder selection attribute supported by Chromium/Electron/Safari desktop
          webkitdirectory=""
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void importFiles(e.target.files);
            e.currentTarget.value = "";
          }}
        />
      )}

      <PageHeader
        title={t.nav.device}
        actions={
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={importing || scanning}
              onClick={() => void rescan()}
              title="Scan local music (3–7 min, excluding rec)"
              aria-label="Scan local music"
              className="flex h-9 items-center gap-1.5 rounded-full bg-surface-3 px-3 text-xs font-medium text-fg transition-colors hover:bg-surface-4 active:scale-[0.97] disabled:opacity-50"
            >
              <ArrowsClockwiseIcon size={16} className={scanning ? "animate-spin" : ""} />
              <span className="hidden @[520px]/device:inline">Scan</span>
            </button>
            {canPickFolder && (
              <button
                type="button"
                disabled={importing}
                onClick={() => folderInput.current?.click()}
                className="flex h-9 items-center gap-1.5 rounded-full bg-surface-3 px-3 text-xs font-medium text-fg transition-colors hover:bg-surface-4 active:scale-[0.97] disabled:opacity-50"
              >
                <FolderOpenIcon size={16} />
                <span className="hidden @[440px]/device:inline">{t.device.addFolder}</span>
              </button>
            )}
            <button
              type="button"
              disabled={importing}
              onClick={() => fileInput.current?.click()}
              className="flex h-9 items-center gap-1.5 rounded-full bg-accent pr-3.5 pl-3 text-xs font-semibold text-accent-ink transition-transform active:scale-[0.97] disabled:opacity-50"
            >
              <MusicNotesPlusIcon size={16} weight="bold" />
              <span>{t.device.addFiles}</span>
            </button>
          </div>
        }
      />

      {dragging && (
        <div className="mx-4 mt-3 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-accent bg-accent-soft px-4 py-6 text-sm font-medium text-accent-text @[680px]/device:mx-6">
          <MusicNotesPlusIcon size={20} weight="bold" />
          <span>Drop audio files to add them to Device Music</span>
        </div>
      )}

      {importing && (
        <div className="mx-4 mt-3 flex items-center gap-2.5 rounded-xl bg-surface-2 px-4 py-2.5 text-xs font-medium text-fg-2 ring-1 ring-line @[680px]/device:mx-6">
          <span className="size-3.5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span>{t.device.importing}</span>
        </div>
      )}

      {tracks.length === 0 ? (
        <EmptyState
          icon={<HardDriveIcon size={28} />}
          title={t.device.emptyTitle}
          body={t.device.emptyBody}
          action={
            <div className="mt-2 flex flex-wrap justify-center gap-2.5">
              <button
                type="button"
                disabled={importing}
                onClick={() => fileInput.current?.click()}
                className="flex h-11 items-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-accent-ink shadow-sm transition-transform active:scale-[0.97] disabled:opacity-50"
              >
                <MusicNotesPlusIcon size={18} weight="bold" />
                <span>{t.device.addFiles}</span>
              </button>
              {canPickFolder && (
                <button
                  type="button"
                  disabled={importing}
                  onClick={() => folderInput.current?.click()}
                  className="flex h-11 items-center gap-2 rounded-full bg-surface-3 px-5 text-sm font-medium text-fg ring-1 ring-line transition-colors hover:bg-surface-4 active:scale-[0.97] disabled:opacity-50"
                >
                  <FolderOpenIcon size={18} />
                  <span>{t.device.addFolder}</span>
                </button>
              )}
            </div>
          }
        />
      ) : (
        <div className="flex flex-col gap-4 pt-3">
          {/* Summary & Quick Controls */}
          <div className="mx-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-2 p-4 ring-1 ring-line @[680px]/device:mx-6">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-[12px] bg-accent-soft text-accent-text">
                <HardDriveIcon size={24} weight="bold" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[16px] font-semibold tracking-tight text-fg">{t.device.title}</p>
                <p className="truncate text-[12.5px] text-fg-2">{t.device.subtitle(tracks.length, sizeMb)}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => playList(tracks, 0)}
                className="flex h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-xs font-semibold text-accent-ink transition-transform active:scale-[0.97]"
              >
                <PlayIcon size={14} weight="fill" />
                <span>{t.common.playAll}</span>
              </button>
              <button
                type="button"
                onClick={() => playList(shuffled(tracks), 0)}
                className="flex h-9 items-center gap-1.5 rounded-full bg-surface-3 px-3.5 text-xs font-medium text-fg ring-1 ring-line transition-colors hover:bg-surface-4 active:scale-[0.97]"
              >
                <ShuffleIcon size={15} />
                <span>{t.collection.shuffle}</span>
              </button>
              <button
                type="button"
                onClick={() => void clearAll()}
                title={t.device.clearAll}
                aria-label={t.device.clearAll}
                className="grid size-9 place-items-center rounded-full bg-surface-3 text-fg-2 ring-1 ring-line transition-colors hover:text-danger active:scale-[0.97]"
              >
                <TrashIcon size={16} />
              </button>
            </div>
          </div>

          {tracks.length > 5 && (
            <div className="px-4 @[680px]/device:px-6">
              <div className="relative">
                <MagnifyingGlassIcon size={17} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-fg-2" />
                <input
                  type="search"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder={t.device.filterPlaceholder}
                  className={cn(
                    "h-10 w-full rounded-full border border-line-strong bg-surface-2 pr-9 pl-10 text-sm text-fg placeholder:text-fg-3 focus:border-accent focus:outline-none",
                    "[&::-webkit-search-cancel-button]:hidden",
                  )}
                />
                {filter && (
                  <button
                    type="button"
                    onClick={() => setFilter("")}
                    aria-label={t.search.clear}
                    className="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-full text-fg-2 hover:bg-surface-3 hover:text-fg"
                  >
                    <XIcon size={15} />
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="px-2 @[680px]/device:px-3">
            <TrackList tracks={filtered} context={filtered} header={false} />
          </div>
        </div>
      )}
    </div>
  );
}

