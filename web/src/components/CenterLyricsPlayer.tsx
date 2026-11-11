import {
  ColumnsIcon,
  EqualizerIcon,
  FilmStripIcon,
  LayoutIcon,
  MicrophoneStageIcon,
  PlayIcon,
  RadioIcon,
  RowsIcon,
  SidebarSimpleIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import { useT } from "../i18n";
import { cn } from "../lib/format";
import { useEqualizer } from "../player/equalizer";
import { selectCurrent, usePlayer, useStatusText } from "../player/player";
import { useAppearance } from "../stores/appearance";
import { useLibrary } from "../stores/library";
import { useUi } from "../stores/ui";
import { Artwork } from "./Artwork";
import { FavoriteButton, ModeSwitch, OfflineButton, Scrubber, Transport } from "./Controls";
import { LyricsView } from "./Lyrics";
import { QueueList } from "./Queue";
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
  const appearance = useAppearance();
  const history = useLibrary((s) => s.history);
  const favorites = useLibrary((s) => s.favorites);
  const [stageMode, setStageMode] = useState<"split" | "stacked" | "karaoke">("split");

  const topToolbar = (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-1/70 px-4 py-2.5 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => appearance.set({ compactSidebar: !appearance.compactSidebar })}
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ring-1 transition-colors",
            !appearance.compactSidebar
              ? "bg-accent-soft text-accent-text ring-accent/40"
              : "bg-surface-2 text-fg-2 ring-line hover:text-fg",
          )}
          title={appearance.compactSidebar ? "Expand Home & Browse Sidebar" : "Collapse Home & Browse Sidebar"}
        >
          <SidebarSimpleIcon size={15} weight="bold" />
          <span>{appearance.compactSidebar ? "Open Home Sidebar" : "Home Sidebar Docked"}</span>
        </button>

        {mode === "stage" && (
          <div className="hidden items-center gap-1 rounded-full bg-surface-2 p-0.5 ring-1 ring-line sm:flex">
            <button
              type="button"
              onClick={() => setStageMode("split")}
              className={cn(
                "flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-medium transition-colors",
                stageMode === "split" ? "bg-surface-4 text-fg font-semibold" : "text-fg-2 hover:text-fg",
              )}
            >
              <ColumnsIcon size={13} />
              <span>Split Stage</span>
            </button>
            <button
              type="button"
              onClick={() => setStageMode("stacked")}
              className={cn(
                "flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-medium transition-colors",
                stageMode === "stacked" ? "bg-surface-4 text-fg font-semibold" : "text-fg-2 hover:text-fg",
              )}
            >
              <RowsIcon size={13} />
              <span>Stacked</span>
            </button>
            <button
              type="button"
              onClick={() => setStageMode("karaoke")}
              className={cn(
                "flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-medium transition-colors",
                stageMode === "karaoke" ? "bg-surface-4 text-fg font-semibold" : "text-fg-2 hover:text-fg",
              )}
            >
              <MicrophoneStageIcon size={13} />
              <span>Giant Karaoke</span>
            </button>
          </div>
        )}
      </div>

      {/* Workspace Layout Template Switcher */}
      <div className="flex items-center gap-1 rounded-full bg-surface-2 p-0.5 ring-1 ring-line">
        <button
          type="button"
          onClick={() => appearance.set({ layoutTemplate: "default" })}
          className={cn(
            "flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-medium transition-colors",
            appearance.layoutTemplate === "default" ? "bg-accent text-accent-ink font-semibold" : "text-fg-2 hover:text-fg",
          )}
        >
          <LayoutIcon size={13} weight="bold" />
          <span>Explorer</span>
        </button>
        <button
          type="button"
          onClick={() => appearance.set({ layoutTemplate: "center-lyrics", compactSidebar: false })}
          className={cn(
            "flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-medium transition-colors",
            appearance.layoutTemplate === "center-lyrics" ? "bg-accent text-accent-ink font-semibold" : "text-fg-2 hover:text-fg",
          )}
        >
          <MicrophoneStageIcon size={13} weight="bold" />
          <span>Stage & Lyrics</span>
        </button>
        <button
          type="button"
          onClick={() => appearance.set({ layoutTemplate: "cinema", compactSidebar: false })}
          className={cn(
            "flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-medium transition-colors",
            appearance.layoutTemplate === "cinema" ? "bg-accent text-accent-ink font-semibold" : "text-fg-2 hover:text-fg",
          )}
        >
          <FilmStripIcon size={13} weight="bold" />
          <span>Cinema</span>
        </button>
      </div>
    </div>
  );

  if (!track) {
    const starter = favorites.length ? favorites : history;
    return (
      <div className="flex h-full flex-col overflow-hidden">
        {topToolbar}
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
          <div className="mb-4 grid size-20 place-items-center rounded-3xl bg-accent-soft text-accent-text ring-1 ring-accent/30">
            <MicrophoneStageIcon size={44} weight="duotone" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-fg">Center Stage & Karaoke Studio</h2>
          <p className="mt-1.5 max-w-md text-sm text-fg-2">
            Pick any song from the expandable <strong>Home & Browse Sidebar</strong> on the left to launch the 720p HD Video Stage and full-screen centered karaoke lyrics here in the middle.
          </p>
          {starter.length > 0 && (
            <button
              type="button"
              onClick={() => playList(starter, 0)}
              className="mt-5 flex h-11 items-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-accent-ink shadow-lg transition-transform hover:scale-105 active:scale-95"
            >
              <PlayIcon size={18} weight="fill" />
              <span>Play Your Music Now</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* Background ambient lighting */}
      <img
        src={track.thumb}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -top-1/4 left-1/2 -z-10 h-[560px] w-[560px] -translate-x-1/2 scale-150 rounded-full object-cover opacity-20 blur-3xl"
      />

      {topToolbar}

      <div className="scroll-area flex flex-1 flex-col overflow-y-auto px-4 py-5 md:px-6">
        <div
          className={cn(
            "mx-auto flex w-full max-w-7xl flex-1 gap-6",
            mode === "cinema" || stageMode === "split"
              ? "flex-col xl:flex-row xl:items-stretch"
              : "flex-col items-center",
          )}
        >
          {/* Left / Top Deck: 720p HD Video or Giant Artwork + Integrated Studio Controls */}
          {stageMode !== "karaoke" && (
            <div
              className={cn(
                "flex flex-col justify-between gap-4 rounded-[22px] bg-surface-2/55 p-5 ring-1 ring-line backdrop-blur-md",
                mode === "cinema" || stageMode === "split" ? "xl:w-[48%] shrink-0" : "w-full max-w-3xl items-center",
              )}
            >
              <div className="flex w-full flex-1 flex-col items-center justify-center">
                {showsVideo ? (
                  <div className="w-full overflow-hidden rounded-[18px] bg-black shadow-[0_20px_50px_rgba(0,0,0,0.55)] ring-1 ring-white/15">
                    <VideoSlot
                      priority={SLOT.panel}
                      expandable
                      className="aspect-video w-full"
                      style={{ aspectRatio: Math.min(16 / 9, Math.max(9 / 16, aspect)) }}
                    />
                  </div>
                ) : (
                  <div className="group relative aspect-square size-56 md:size-72 shrink-0 overflow-hidden rounded-[24px] shadow-[0_24px_60px_rgba(0,0,0,0.6)] ring-1 ring-white/15">
                    <Artwork
                      src={track.art}
                      fallback={track.thumb}
                      alt={t.nowPlaying.coverOf(track.title)}
                      className="size-full object-cover"
                    />
                  </div>
                )}
              </div>

              {/* Track Info + Scrubber + Transport */}
              <div className="flex w-full flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h1 className="truncate text-xl font-bold tracking-tight text-fg md:text-2xl">{track.title}</h1>
                    <p className={cn("mt-0.5 truncate text-sm font-medium", status === "error" ? "text-danger" : "text-fg-2")}>
                      {statusText ?? [track.artist, track.album].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <OfflineButton track={track} size="md" />
                    <FavoriteButton track={track} size="md" />
                  </div>
                </div>

                <Scrubber />

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <Transport size="md" />
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
            </div>
          )}

          {/* Right / Center Giant Karaoke Lyrics Stage */}
          <div
            className={cn(
              "flex min-h-[360px] flex-1 flex-col rounded-[22px] bg-surface-2/50 p-5 ring-1 ring-line backdrop-blur-md",
              stageMode === "karaoke" ? "w-full max-w-4xl" : "w-full",
            )}
          >
            <div className="mb-3 flex items-center justify-between gap-2 border-b border-line pb-2.5">
              <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-accent-text uppercase">
                <MicrophoneStageIcon size={17} weight="fill" />
                <span>Live Karaoke Lyrics</span>
              </div>
              {stageMode === "karaoke" && (
                <div className="flex items-center gap-2">
                  <span className="truncate text-xs font-semibold text-fg">{track.title} — {track.artist}</span>
                  <ModeSwitch />
                </div>
              )}
            </div>
            <LyricsView className="min-h-[340px] flex-1" />
          </div>
        </div>

        {/* In stacked mode or when right panel is closed, show Up Next queue below */}
        {mode === "stage" && stageMode === "stacked" && (
          <div className="mx-auto mt-6 w-full max-w-4xl rounded-[20px] bg-surface-2/40 p-5 ring-1 ring-line">
            <h3 className="mb-3 text-sm font-semibold tracking-tight text-fg">Up Next & Queue</h3>
            <QueueList compact />
          </div>
        )}
      </div>
    </div>
  );
}
