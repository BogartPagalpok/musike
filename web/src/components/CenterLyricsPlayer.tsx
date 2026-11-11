import { EqualizerIcon, MicrophoneStageIcon, RadioIcon } from "@phosphor-icons/react";
import { useT } from "../i18n";
import { cn } from "../lib/format";
import { useEqualizer } from "../player/equalizer";
import { selectCurrent, usePlayer, useStatusText } from "../player/player";
import { useUi } from "../stores/ui";
import { Artwork } from "./Artwork";
import { FavoriteButton, ModeSwitch, OfflineButton } from "./Controls";
import { LyricsView } from "./Lyrics";
import { QueueList } from "./Queue";
import { SLOT, VideoSlot } from "./Video";

export function CenterLyricsPlayer() {
  const t = useT();
  const track = usePlayer(selectCurrent);
  const showsVideo = usePlayer((s) => s.mediaKind === "video");
  const aspect = usePlayer((s) => s.videoAspect);
  const startRadio = usePlayer((s) => s.startRadio);
  const eqEnabled = useEqualizer((s) => s.enabled);
  const eqPreset = useEqualizer((s) => s.preset);
  const setEqualizerOpen = useUi((s) => s.setEqualizerOpen);
  const statusText = useStatusText();
  const status = usePlayer((s) => s.status);

  if (!track) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-fg-3">
        <MicrophoneStageIcon size={56} className="mb-3 text-accent-text opacity-40" />
        <h2 className="text-xl font-semibold text-fg">Stage & Karaoke Lyrics</h2>
        <p className="mt-1 max-w-sm text-sm text-fg-2">Play any track or music video to experience the full-screen centered player and synced lyrics.</p>
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
        className="pointer-events-none absolute -top-1/4 left-1/2 -z-10 h-[500px] w-[500px] -translate-x-1/2 scale-150 rounded-full object-cover opacity-20 blur-3xl"
      />

      <div className="scroll-area flex flex-1 flex-col overflow-y-auto px-4 py-6 md:px-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6">
          {/* Main Visual: HD Video or Large Artwork */}
          {showsVideo ? (
            <div className="w-full max-w-3xl overflow-hidden rounded-[20px] bg-black shadow-[0_20px_50px_rgba(0,0,0,0.5)] ring-1 ring-white/10">
              <VideoSlot
                priority={SLOT.panel}
                expandable
                className="aspect-video w-full"
                style={{ aspectRatio: Math.min(16 / 9, Math.max(9 / 16, aspect)) }}
              />
            </div>
          ) : (
            <div className="group relative aspect-square size-48 md:size-64 shrink-0 overflow-hidden rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.6)] ring-1 ring-white/10">
              <Artwork
                src={track.art}
                fallback={track.thumb}
                alt={t.nowPlaying.coverOf(track.title)}
                className="size-full object-cover"
              />
            </div>
          )}

          {/* Heading and controls */}
          <div className="flex w-full max-w-2xl flex-col items-center text-center">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-fg md:text-3xl">{track.title}</h1>
              <FavoriteButton track={track} size="md" />
              <OfflineButton track={track} size="md" />
            </div>
            <p className={cn("mt-1 text-sm md:text-base font-medium", status === "error" ? "text-danger" : "text-fg-2")}>
              {statusText ?? [track.artist, track.album].filter(Boolean).join(" · ")}
            </p>

            {/* Quick action buttons */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <ModeSwitch />
              <button
                type="button"
                onClick={() => void startRadio(track)}
                className="flex h-9 items-center gap-1.5 rounded-full bg-surface-2 px-4 text-xs font-semibold ring-1 ring-line transition-colors hover:bg-surface-3 hover:text-fg"
              >
                <RadioIcon size={16} />
                <span>{t.trackMenu.startRadio}</span>
              </button>
              <button
                type="button"
                onClick={() => setEqualizerOpen(true)}
                className={cn(
                  "flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold ring-1 transition-colors",
                  eqEnabled
                    ? "bg-accent-soft text-accent-text ring-accent/35"
                    : "bg-surface-2 text-fg-2 ring-line hover:bg-surface-3 hover:text-fg",
                )}
              >
                <EqualizerIcon size={16} weight={eqEnabled ? "fill" : "regular"} />
                <span>{eqEnabled ? t.equalizer.presetNames[eqPreset] : t.dialogs.shortcuts.equalizer}</span>
              </button>
            </div>
          </div>

          {/* Karaoke lyrics in the middle */}
          <div className="w-full max-w-3xl rounded-[20px] bg-surface-2/40 p-4 ring-1 ring-line/70 backdrop-blur-md">
            <div className="mb-2 flex items-center justify-center gap-2 text-xs font-semibold text-fg-3 uppercase tracking-wider">
              <MicrophoneStageIcon size={16} className="text-accent-text" />
              <span>Centered Karaoke Lyrics</span>
            </div>
            <LyricsView className="max-h-[380px]" />
          </div>

          {/* Up next queue below lyrics */}
          <div className="w-full max-w-3xl rounded-[20px] bg-surface-2/40 p-5 ring-1 ring-line/70">
            <h3 className="mb-3 text-sm font-semibold tracking-tight text-fg">Up Next & Queue</h3>
            <QueueList compact />
          </div>
        </div>
      </div>
    </div>
  );
}
