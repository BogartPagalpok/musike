import { EqualizerIcon, KeyboardIcon, MicrophoneStageIcon, QueueIcon } from "@phosphor-icons/react";
import { cn } from "../lib/format";
import { useT } from "../i18n";
import { useEqualizer } from "../player/equalizer";
import { selectCurrent, usePlayer, useStatusText } from "../player/player";
import { useAppearance } from "../stores/appearance";
import { useUi } from "../stores/ui";
import { Artwork } from "./Artwork";
import { FavoriteButton, ModeSwitch, OfflineButton, Scrubber, Transport, Volume } from "./Controls";
import { IconButton } from "./IconButton";

/** Desktop and tablet player: a flat bar under the content (Spotify-style, no box). */
export function PlayerBar() {
  const track = usePlayer(selectCurrent);
  const statusText = useStatusText();
  const t = useT();
  const status = usePlayer((s) => s.status);
  const eqEnabled = useEqualizer((s) => s.enabled);
  const equalizerOpen = useUi((s) => s.equalizerOpen);
  const setEqualizerOpen = useUi((s) => s.setEqualizerOpen);
  const setShortcutsOpen = useUi((s) => s.setShortcutsOpen);
  const sidebarTab = useAppearance((s) => s.sidebarTab);
  const compactSidebar = useAppearance((s) => s.compactSidebar);
  const setAppearance = useAppearance((s) => s.set);

  const toggleSidebarTab = (tab: "lyrics" | "playing") => {
    if (compactSidebar) {
      setAppearance({ compactSidebar: false, sidebarTab: tab });
    } else if (sidebarTab === tab) {
      setAppearance({ sidebarTab: "browse" });
    } else {
      setAppearance({ sidebarTab: tab });
    }
  };

  return (
    <div className="shrink-0 border-t border-line/40 bg-bg/95 backdrop-blur-xl">
      <div className="grid h-[100px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-5 px-4 py-2">
        <div className="flex min-w-0 items-center gap-3.5">
          {track ? (
            <>
              <button
                type="button"
                onClick={() => toggleSidebarTab("playing")}
                aria-label={t.player.showNowPlaying}
                className="group relative shrink-0 rounded-[10px] transition-transform active:scale-[0.96]"
              >
                <Artwork src={track.thumb} className="size-16 rounded-[10px] shadow-md" />
              </button>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold tracking-tight">{track.title}</p>
                <p className={cn("truncate text-[13px] mt-0.5", status === "error" ? "text-danger" : "text-fg-2")}>
                  {statusText ?? track.artist}
                </p>
              </div>
              <FavoriteButton track={track} size="sm" />
              <OfflineButton track={track} size="sm" />
            </>
          ) : (
            <p className="truncate pl-1 text-sm text-fg-3">{t.player.nothingPlaying}</p>
          )}
        </div>

        <div className="flex w-[min(48vw,640px)] flex-col items-center gap-2">
          <Transport />
          <Scrubber className="w-full" />
        </div>

        <div className="flex items-center justify-end gap-1">
          <ModeSwitch className="max-xl:hidden" />
          <IconButton
            label={t.player.equalizer}
            size="sm"
            active={equalizerOpen || eqEnabled}
            onClick={() => setEqualizerOpen(true)}
          >
            <EqualizerIcon size={18} weight={eqEnabled ? "fill" : "regular"} />
          </IconButton>
          <IconButton
            label={t.nowPlaying.tabLyrics}
            size="sm"
            active={!compactSidebar && sidebarTab === "lyrics"}
            onClick={() => toggleSidebarTab("lyrics")}
          >
            <MicrophoneStageIcon size={18} weight={!compactSidebar && sidebarTab === "lyrics" ? "fill" : "regular"} />
          </IconButton>
          <IconButton
            label={`${t.nowPlaying.tabPlaying} & ${t.player.queue}`}
            size="sm"
            active={!compactSidebar && sidebarTab === "playing"}
            onClick={() => toggleSidebarTab("playing")}
          >
            <QueueIcon size={18} weight={!compactSidebar && sidebarTab === "playing" ? "bold" : "regular"} />
          </IconButton>
          <Volume className="max-lg:hidden" />
          <IconButton label={t.player.shortcuts} size="sm" onClick={() => setShortcutsOpen(true)} className="max-xl:hidden">
            <KeyboardIcon size={18} />
          </IconButton>
        </div>
      </div>
    </div>
  );
}
