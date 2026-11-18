import {
  ArrowsOutIcon,
  EqualizerIcon,
  MicrophoneStageIcon,
  PlayIcon,
  RadioIcon,
  SkipForwardIcon,
} from "./icons";
import { useMemo } from "react";
import { useLocation } from "react-router";
import { useT } from "../i18n";
import { cn } from "../lib/format";
import { paths } from "../lib/routes";
import { useEqualizer } from "../player/equalizer";
import { selectCurrent, usePlayer, useStatusText } from "../player/player";
import { useLibrary } from "../stores/library";
import { useThemeStore } from "../stores/themeStore";
import { useUi } from "../stores/ui";
import { songbookCode, useIsVideokeTrack, useVideoke } from "../stores/videoke";
import { Artwork } from "./Artwork";
import { FavoriteButton, ModeSwitch, OfflineButton } from "./Controls";
import { LyricsView } from "./Lyrics";
import { WorldStageFrame } from "./ThemeSceneBackdrop";
import { SLOT, VideoSlot } from "./Video";

export function CenterLyricsPlayer({ mode = "stage" }: { mode?: "stage" | "cinema" }) {
  const t = useT();
  const location = useLocation();
  const track = usePlayer(selectCurrent);
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const showsVideo = usePlayer((s) => s.mediaKind === "video");
  const aspect = usePlayer((s) => s.videoAspect);
  const startRadio = usePlayer((s) => s.startRadio);
  const playList = usePlayer((s) => s.playList);
  const jumpTo = usePlayer((s) => s.jumpTo);
  const setPreferVideo = usePlayer((s) => s.setPreferVideo);
  const eqEnabled = useEqualizer((s) => s.enabled);
  const eqPreset = useEqualizer((s) => s.preset);
  const setEqualizerOpen = useUi((s) => s.setEqualizerOpen);
  const setTheater = useUi((s) => s.setTheater);
  const statusText = useStatusText();
  const status = usePlayer((s) => s.status);
  const history = useLibrary((s) => s.history);
  const favorites = useLibrary((s) => s.favorites);
  const sceneStyle = useThemeStore((s) => s.sceneStyle);
  const hasWorldScene = sceneStyle !== "none";

  const isVideokeTrack = useIsVideokeTrack();
  const videokeIds = useVideoke((v) => v.ids);
  const micOn = useVideoke((v) => v.micOn);
  const startMic = useVideoke((v) => v.startMic);
  const stopMic = useVideoke((v) => v.stopMic);
  const showScore = useVideoke((v) => v.showScore);
  const isVideoke = isVideokeTrack || location.pathname === paths.videoke;

  const reservedNext = useMemo(() => {
    for (let i = index + 1; i < queue.length; i++) {
      if (videokeIds.has(queue[i].id)) {
        return { track: queue[i], queueIndex: i, count: queue.slice(index + 1).filter((x) => videokeIds.has(x.id)).length };
      }
    }
    return null;
  }, [queue, index, videokeIds]);

  if (!track) {
    if (isVideoke) {
      return (
        <div className="flex h-full min-h-0 flex-col items-center justify-center overflow-hidden p-6 text-center">
          <span className="grid size-16 place-items-center rounded-3xl bg-accent-soft text-accent-text shadow-lg ring-1 ring-accent/30">
            <MicrophoneStageIcon size={32} weight="fill" />
          </span>
          <h2 className="mt-4 text-xl font-extrabold tracking-tight text-fg">Videoke Stage Ready</h2>
          <p className="mt-1.5 max-w-md text-sm leading-relaxed text-fg-2">
            Pick or search any song in the Songbook on the left and tap <strong>Sing Now</strong> to light up the screen.
          </p>
          <button
            type="button"
            onClick={() => (micOn ? stopMic() : void startMic())}
            className={cn(
              "mt-5 flex h-10 items-center gap-2 rounded-lg px-5 text-xs font-bold transition-[filter,transform] duration-150 hover:brightness-105 active:scale-95",
              micOn
                ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/40"
                : "bg-accent text-accent-ink",
            )}
          >
            <MicrophoneStageIcon size={16} weight="fill" />
            <span>{micOn ? "Live Mic Ready (Click to Mute)" : "Enable Live Mic Before Singing"}</span>
          </button>
        </div>
      );
    }

    const starter = favorites.length ? favorites : history;
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center overflow-hidden p-6 text-center">
        <h2 className="text-lg font-semibold tracking-tight text-fg">Nothing playing</h2>
        <p className="mt-1 max-w-sm text-sm text-fg-2">
          Choose a track from your library or search to start listening.
        </p>
        {starter.length > 0 && (
          <button
            type="button"
            onClick={() => playList(starter, 0)}
            className="mt-4 flex h-10 items-center gap-2 rounded-lg bg-accent px-5 text-xs font-semibold text-accent-ink transition-[filter,transform] duration-150 hover:brightness-105 active:scale-95"
          >
            <PlayIcon size={15} weight="fill" />
            <span>Play Music</span>
          </button>
        )}
      </div>
    );
  }

  const code = songbookCode(track.id);

  return (
    <div className="@container/stage relative flex h-full min-h-0 w-full flex-col overflow-hidden px-4 py-3 @[620px]/stage:px-7 @[620px]/stage:py-5">
      {/* Atmospheric album-art mesh backdrop */}
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
        <div
          className={cn(
            "flex shrink-0 flex-col justify-center gap-2.5 overflow-hidden",
            isVideoke
              ? "mx-auto h-full w-full max-w-5xl flex-1 justify-between"
              : mode === "cinema"
                ? "@[620px]/stage:w-[50%]"
                : "@[620px]/stage:w-[46%] @[960px]/stage:w-[45%]",
          )}
        >
          {/* Arcade TV Top Marquee in Videoke Mode */}
          {isVideoke && (
            <div className="flex shrink-0 items-center justify-between gap-3 rounded-lg border border-white/12 bg-black/80 px-3.5 py-1.5 text-xs">
              <div className="flex min-w-0 items-center gap-2">
                <span className={cn("size-2 shrink-0 rounded-full", status === "playing" ? "animate-pulse bg-emerald-400" : "bg-fg-3")} />
                <span className="font-mono text-[11px] font-extrabold tracking-wider text-accent-text">
                  SONG #{code}
                </span>
                <span className="hidden truncate text-white/75 sm:inline">· {track.title}</span>
              </div>
              {reservedNext ? (
                <button
                  type="button"
                  onClick={() => jumpTo(reservedNext.queueIndex)}
                  className="flex min-w-0 max-w-[52%] items-center gap-1.5 rounded-md bg-zinc-800 px-2.5 py-0.5 text-[11px] font-semibold text-white transition-colors duration-150 hover:bg-zinc-700"
                  title="Skip to next reserved song"
                >
                  <span className="shrink-0 text-accent-text">NEXT ({reservedNext.count}):</span>
                  <span className="truncate">{reservedNext.track.title}</span>
                  <SkipForwardIcon size={11} weight="fill" className="shrink-0" />
                </button>
              ) : (
                <span className="shrink-0 text-[11px] text-white/50">No song reserved next</span>
              )}
            </div>
          )}

          {/* Main Video / Artwork Stage */}
          <div className={cn("flex min-h-0 w-full items-center justify-center", isVideoke ? "flex-1 py-0.5" : "py-4")}>
            {isVideoke ? (
              <WorldStageFrame scene={sceneStyle} playing={status === "playing"} className="w-full">
                <div className="flex w-full flex-col overflow-hidden rounded-[inherit] bg-black shadow-[0_24px_60px_rgba(0,0,0,0.65)] ring-1 ring-white/15">
                  {showsVideo ? (
                    <VideoSlot
                      priority={SLOT.center}
                      expandable
                      className="mx-auto aspect-video max-h-[50dvh] w-full bg-black"
                      style={{ aspectRatio: Math.min(16 / 9, Math.max(9 / 16, aspect)) }}
                    />
                  ) : (
                    <div className="relative flex aspect-video max-h-[46dvh] w-full flex-col items-center justify-center overflow-hidden bg-black/85 text-center">
                      <Artwork src={track.art} fallback={track.thumb} className="absolute inset-0 size-full object-cover opacity-35 blur-sm" />
                      <div className="relative z-10 flex flex-col items-center gap-2.5 px-4">
                        <span className="rounded-full bg-black/85 px-3.5 py-1 text-xs font-medium text-white">
                          {statusText ?? "Videoke video paused or in audio mode"}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPreferVideo(true)}
                          className="rounded-lg bg-accent px-4 py-1.5 text-xs font-bold text-accent-ink transition-[filter,transform] duration-150 hover:brightness-105 active:scale-95"
                        >
                          Switch to Karaoke Video Screen
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </WorldStageFrame>
            ) : showsVideo ? (
              <WorldStageFrame scene={sceneStyle} playing={status === "playing"} className="w-full">
                <div className="w-full overflow-hidden rounded-[inherit] bg-black shadow-[0_24px_60px_rgba(0,0,0,0.6)] ring-1 ring-white/12">
                  <VideoSlot
                    priority={SLOT.center}
                    expandable
                    className="mx-auto aspect-video max-h-[44dvh] w-full bg-black"
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

          {/* Track Footer & Stage Action Bar */}
          <div className="flex shrink-0 flex-col gap-2 px-1">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h1 className={cn("truncate font-bold tracking-tight text-fg", isVideoke ? "text-lg md:text-xl" : "text-xl md:text-2xl")}>
                  {track.title}
                </h1>
                <p className={cn("truncate text-xs font-medium md:text-sm", status === "error" ? "text-danger" : "text-fg-2")}>
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
              {isVideoke ? (
                <>
                  <button
                    type="button"
                    onClick={() => (micOn ? stopMic() : void startMic())}
                    className={cn(
                      "flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium ring-1 transition-colors duration-150",
                      micOn
                        ? "bg-accent-soft font-semibold text-accent-text ring-accent/35"
                        : "bg-surface-3 text-fg-2 ring-line hover:bg-surface-4 hover:text-fg",
                    )}
                  >
                    <MicrophoneStageIcon size={14} weight={micOn ? "fill" : "regular"} />
                    <span>{micOn ? "Mic On" : "Mic Off"}</span>
                  </button>
                  {showsVideo && (
                    <button
                      type="button"
                      onClick={() => setTheater(true)}
                      className="flex h-8 items-center gap-1.5 rounded-lg bg-surface-3 px-3.5 text-xs font-medium text-fg-2 transition-colors duration-150 hover:bg-surface-4 hover:text-fg"
                    >
                      <ArrowsOutIcon size={14} />
                      <span>{t.videoke.fullscreen}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => showScore(track)}
                    className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-bold text-accent-ink transition-[filter,transform] duration-150 hover:brightness-105 active:scale-95"
                  >
                    <MicrophoneStageIcon size={14} weight="fill" />
                    <span>{t.videoke.finishAndScore}</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => void startRadio(track)}
                  className="flex h-8 items-center gap-1.5 rounded-lg bg-surface-3 px-3.5 text-xs font-medium text-fg-2 transition-colors duration-150 hover:bg-surface-4 hover:text-fg"
                >
                  <RadioIcon size={14} />
                  <span>{t.trackMenu.startRadio}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setEqualizerOpen(true)}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-xs font-medium ring-1 transition-colors duration-150",
                  eqEnabled
                    ? "bg-accent-soft text-accent-text ring-accent/35"
                    : "bg-surface-3 text-fg-2 ring-line hover:bg-surface-4 hover:text-fg",
                )}
              >
                <EqualizerIcon size={14} weight={eqEnabled ? "fill" : "regular"} />
                <span>{eqEnabled ? t.equalizer.presetNames[eqPreset] : t.dialogs.shortcuts.equalizer}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Stage: Synced Lyrics (Hidden in Videoke Mode because the karaoke video IS the lyrics) */}
        {!isVideoke && (
          <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
            <LyricsView className="h-full min-h-0 flex-1" />
          </div>
        )}
      </div>
    </div>
  );
}
