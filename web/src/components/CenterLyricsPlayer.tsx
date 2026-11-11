import {
  EqualizerIcon,
  MicrophoneStageIcon,
  PlayIcon,
  RadioIcon,
} from "@phosphor-icons/react";
import { useT } from "../i18n";
import { cn } from "../lib/format";
import { useEqualizer } from "../player/equalizer";
import { selectCurrent, usePlayer, useStatusText } from "../player/player";
import { useLibrary } from "../stores/library";
import { useUi } from "../stores/ui";
import { Artwork } from "./Artwork";
import { FavoriteButton, ModeSwitch, OfflineButton } from "./Controls";
import { LyricsView } from "./Lyrics";
import { SLOT, VideoSlot } from "./Video";

export function CenterLyricsPlayer({ mode = "stage" }: { mode?: "stage" | "cinema" }) {
  const t = useT();
  const track = usePlayer(selectCurrent);
  const showsVideo = usePlayer((s) => s.mediaKind === "video");
  const aspect = usePlayer((s) => s.videoAspect);
  const startRadio = usePlayer((s) => s.startRadio);
  const playList = usePlayer((s) => s.playList);
  const eqEnabled = useEqualizer((s) => s.enabled);
  const eqPreset = useEqualizer((s) => s.preset);
  const setEqualizerOpen = useUi((s) => s.setEqualizerOpen);
  const statusText = useStatusText();
  const status = usePlayer((s) => s.status);
  const history = useLibrary((s) => s.history);
  const favorites = useLibrary((s) => s.favorites);

  if (!track) {
    const starter = favorites.length ? favorites : history;
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center overflow-hidden p-6 text-center">
        <div className="mb-3 grid size-16 place-items-center rounded-3xl bg-accent-soft text-accent-text ring-1 ring-accent/30">
          <MicrophoneStageIcon size={36} weight="duotone" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-fg">Center Stage & Karaoke Studio</h2>
        <p className="mt-1 max-w-md text-sm text-fg-2">
          Select any song from the sidebar to launch the 720p HD video stage and auto-centered karaoke lyrics here.
        </p>
        {starter.length > 0 && (
          <button
            type="button"
            onClick={() => playList(starter, 0)}
            className="mt-4 flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-xs font-semibold text-accent-ink shadow-md transition-transform hover:scale-105 active:scale-95"
          >
            <PlayIcon size={16} weight="fill" />
            <span>Play Your Music</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden p-3 md:p-4">
      {/* Ambient background glow */}
      <img
        src={track.thumb}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 scale-150 rounded-full object-cover opacity-20 blur-3xl"
      />

      <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-3 overflow-hidden lg:flex-row lg:items-stretch lg:gap-4">
        {/* Left Stage Card: Compact 720p HD Video / Artwork + Track Info + Quick Actions (Always 100% on-screen) */}
        <div
          className={cn(
            "flex shrink-0 flex-col justify-center gap-3 overflow-hidden rounded-[18px] bg-surface-2/55 p-3.5 ring-1 ring-line backdrop-blur-md",
            mode === "cinema" ? "lg:w-[48%]" : "lg:w-[44%] xl:w-[42%]",
          )}
        >
          <div className="flex min-h-0 w-full items-center justify-center overflow-hidden">
            {showsVideo ? (
              <div className="w-full overflow-hidden rounded-[14px] bg-black shadow-[0_14px_36px_rgba(0,0,0,0.45)] ring-1 ring-white/15">
                <VideoSlot
                  priority={SLOT.center}
                  expandable
                  className="mx-auto aspect-video max-h-[34dvh] w-full"
                  style={{ aspectRatio: Math.min(16 / 9, Math.max(9 / 16, aspect)) }}
                />
              </div>
            ) : (
              <div className="relative aspect-square max-h-[30dvh] w-auto overflow-hidden rounded-[18px] shadow-[0_16px_40px_rgba(0,0,0,0.5)] ring-1 ring-white/15">
                <Artwork
                  src={track.art}
                  fallback={track.thumb}
                  alt={t.nowPlaying.coverOf(track.title)}
                  className="size-full object-cover"
                />
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-lg font-bold tracking-tight text-fg md:text-xl">{track.title}</h1>
                <p className={cn("truncate text-xs font-medium md:text-sm", status === "error" ? "text-danger" : "text-fg-2")}>
                  {statusText ?? [track.artist, track.album].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <OfflineButton track={track} size="md" />
                <FavoriteButton track={track} size="md" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <ModeSwitch />
              <button
                type="button"
                onClick={() => void startRadio(track)}
                className="flex h-8 items-center gap-1.5 rounded-full bg-surface-3 px-3 text-xs font-semibold ring-1 ring-line transition-colors hover:bg-surface-4 hover:text-fg"
              >
                <RadioIcon size={15} />
                <span>{t.trackMenu.startRadio}</span>
              </button>
              <button
                type="button"
                onClick={() => setEqualizerOpen(true)}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ring-1 transition-colors",
                  eqEnabled
                    ? "bg-accent-soft text-accent-text ring-accent/35"
                    : "bg-surface-3 text-fg-2 ring-line hover:bg-surface-4 hover:text-fg",
                )}
              >
                <EqualizerIcon size={15} weight={eqEnabled ? "fill" : "regular"} />
                <span>{eqEnabled ? t.equalizer.presetNames[eqPreset] : t.dialogs.shortcuts.equalizer}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Karaoke Stage: Strictly bounded height so LyricsView auto-scrolls the active line to the exact center */}
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-[18px] bg-surface-2/50 ring-1 ring-line backdrop-blur-md">
          <div className="flex shrink-0 items-center justify-between border-b border-line/60 px-4 py-2.5">
            <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-accent-text uppercase">
              <MicrophoneStageIcon size={16} weight="fill" />
              <span>Centered Karaoke Lyrics</span>
            </div>
            <span className="truncate text-xs font-medium text-fg-3">Auto-centered active line</span>
          </div>
          <LyricsView className="h-full min-h-0 flex-1" />
        </div>
      </div>
    </div>
  );
}
