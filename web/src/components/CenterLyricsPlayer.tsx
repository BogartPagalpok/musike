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
import { useThemeStore, WORLD_BADGE_BY_SCENE } from "../stores/themeStore";
import { useUi } from "../stores/ui";
import { Artwork } from "./Artwork";
import { FavoriteButton, ModeSwitch, OfflineButton } from "./Controls";
import { LyricsView } from "./Lyrics";
import { WorldStageFrame } from "./ThemeSceneBackdrop";
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
  const sceneStyle = useThemeStore((s) => s.sceneStyle);
  const worldBadge = WORLD_BADGE_BY_SCENE[sceneStyle];
  const hasWorldScene = sceneStyle !== "none";

  if (!track) {
    const starter = favorites.length ? favorites : history;
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center overflow-hidden p-6 text-center">
        <div className="mb-3 grid size-16 place-items-center rounded-3xl bg-accent-soft text-accent-text ring-1 ring-accent/30">
          <MicrophoneStageIcon size={36} weight="duotone" />
        </div>
        {worldBadge && (
          <span className="mb-2 rounded-full border border-accent/40 bg-accent-soft px-3 py-0.5 font-mono text-[11px] font-bold tracking-widest text-accent-text">
            {worldBadge}
          </span>
        )}
        <h2 className="text-xl font-bold tracking-tight text-fg">Center Stage &amp; Karaoke Studio</h2>
        <p className="mt-1 max-w-md text-sm text-fg-2">
          Select any song from the sidebar to launch the 1080p HD video stage and auto-centered karaoke lyrics here.
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
    <div className="@container/stage relative flex h-full min-h-0 w-full flex-col overflow-hidden px-4 py-4 @[620px]/stage:px-8 @[620px]/stage:py-6">
      {/* Apple Music atmospheric album-art mesh backdrop (softened when a custom world scene is active) */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <img
          src={track.art || track.thumb}
          alt=""
          aria-hidden="true"
          className={cn(
            "absolute top-1/2 left-1/3 h-[65%] w-[65%] -translate-x-1/2 -translate-y-1/2 scale-150 rounded-full object-cover blur-[100px]",
            hasWorldScene ? "opacity-8" : "opacity-28",
          )}
        />
        <img
          src={track.thumb}
          alt=""
          aria-hidden="true"
          className={cn(
            "absolute right-1/4 bottom-1/4 h-[55%] w-[55%] scale-150 rounded-full object-cover blur-[110px]",
            hasWorldScene ? "opacity-6" : "opacity-20",
          )}
        />
      </div>

      <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-5 overflow-hidden @[620px]/stage:flex-row @[620px]/stage:items-center @[620px]/stage:gap-8">
        {/* Left Stage: Floating 1080p HD Video / Artwork + Apple Music Track Header */}
        <div
          className={cn(
            "flex shrink-0 flex-col justify-center gap-4 overflow-hidden",
            mode === "cinema" ? "@[620px]/stage:w-[50%]" : "@[620px]/stage:w-[46%] @[960px]/stage:w-[45%]",
          )}
        >
          <div className="flex min-h-0 w-full items-center justify-center py-4">
            {showsVideo ? (
              <WorldStageFrame scene={sceneStyle} playing={status === "playing"} className="w-full">
                <div className="w-full overflow-hidden rounded-[inherit] bg-black shadow-[0_24px_60px_rgba(0,0,0,0.55)] ring-1 ring-white/12">
                  <VideoSlot
                    priority={SLOT.center}
                    expandable
                    className="mx-auto aspect-video max-h-[44dvh] w-full"
                    style={{ aspectRatio: Math.min(16 / 9, Math.max(9 / 16, aspect)) }}
                  />
                </div>
              </WorldStageFrame>
            ) : (
              <WorldStageFrame scene={sceneStyle} playing={status === "playing"} className="aspect-square max-h-[38dvh] w-auto">
                <div className="relative aspect-square max-h-[38dvh] w-full overflow-hidden rounded-[inherit] shadow-[0_24px_60px_rgba(0,0,0,0.55)] ring-1 ring-white/12">
                  <Artwork
                    src={track.art}
                    fallback={track.thumb}
                    alt={t.nowPlaying.coverOf(track.title)}
                    className="size-full object-cover"
                  />
                </div>
              </WorldStageFrame>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-3 px-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-xl font-bold tracking-tight text-fg md:text-2xl">{track.title}</h1>
                <p className={cn("mt-0.5 truncate text-sm font-medium", status === "error" ? "text-danger" : "text-fg-2")}>
                  {statusText ?? [track.artist, track.album].filter(Boolean).join(" — ")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <OfflineButton track={track} size="md" />
                <FavoriteButton track={track} size="md" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ModeSwitch />
              <button
                type="button"
                onClick={() => void startRadio(track)}
                className="flex h-8 items-center gap-1.5 rounded-full bg-surface-3/80 px-3.5 text-xs font-medium text-fg-2 backdrop-blur-md transition-colors hover:bg-surface-4 hover:text-fg"
              >
                <RadioIcon size={14} />
                <span>{t.trackMenu.startRadio}</span>
              </button>
              <button
                type="button"
                onClick={() => setEqualizerOpen(true)}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium ring-1 backdrop-blur-md transition-colors",
                  eqEnabled
                    ? "bg-accent-soft text-accent-text ring-accent/35"
                    : "bg-surface-3/80 text-fg-2 ring-line hover:bg-surface-4 hover:text-fg",
                )}
              >
                <EqualizerIcon size={14} weight={eqEnabled ? "fill" : "regular"} />
                <span>{eqEnabled ? t.equalizer.presetNames[eqPreset] : t.dialogs.shortcuts.equalizer}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Stage: Seamless Apple Music Live Lyrics with top/bottom gradient fade */}
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
          <LyricsView className="h-full min-h-0 flex-1" />
        </div>
      </div>
    </div>
  );
}
