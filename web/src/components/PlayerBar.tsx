import { EqualizerIcon, KeyboardIcon, MicrophoneStageIcon, QueueIcon } from "./icons";
import { cn } from "../lib/format";
import { useT } from "../i18n";
import { useEqualizer } from "../player/equalizer";
import { selectCurrent, usePlayer, useStatusText } from "../player/player";
import { useAppearance } from "../stores/appearance";
import { useUi } from "../stores/ui";
import { useIsVideokeTrack } from "../stores/videoke";
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
  const panelOpen = useUi((s) => s.panelOpen);
  const drawerOpen = useUi((s) => s.drawerOpen);
  const panelTab = useUi((s) => s.panelTab);
  const togglePanel = useUi((s) => s.togglePanel);
  const layoutTemplate = useAppearance((s) => s.layoutTemplate);
  const sidebarTab = useAppearance((s) => s.sidebarTab);
  const compactSidebar = useAppearance((s) => s.compactSidebar);
  const setAppearance = useAppearance((s) => s.set);
  const isVideoke = useIsVideokeTrack();

  const isStageMode = layoutTemplate === "center-lyrics";
  const inspectorOpen = isStageMode ? !compactSidebar : (panelOpen || drawerOpen) && !!track;
  const activeTab = isStageMode ? sidebarTab : panelTab;

  const toggleInspector = (tab: "lyrics" | "playing") => {
    if (isStageMode) {
      if (compactSidebar) setAppearance({ compactSidebar: false, sidebarTab: tab });
      else if (sidebarTab === tab) setAppearance({ sidebarTab: "browse" });
      else setAppearance({ sidebarTab: tab });
      return;
    }
    if (useAppearance.getState().rightPanelCollapsed) {
      setAppearance({ rightPanelCollapsed: false });
      useUi.getState().openPanel(tab);
      return;
    }
    togglePanel(tab);
  };

  return (
    <footer aria-label="Player controls" className="app-playerbar relative z-[2] shrink-0 border-t border-line bg-bg">
      <div className="grid h-[90px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 px-4 py-1.5">
        <div className="flex min-w-0 items-center gap-3">
          {track ? (
            <>
              <button
                type="button"
                onClick={() => toggleInspector("playing")}
                aria-label={t.player.showNowPlaying}
                className="group relative shrink-0 cursor-pointer rounded-md transition-opacity duration-150 hover:opacity-90 active:scale-[0.97]"
              >
                <Artwork src={track.art} fallback={track.thumb} className="size-13 rounded-md object-cover" />
              </button>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium text-fg leading-snug">{track.title}</p>
                <p className={cn("truncate text-[12.5px] leading-snug", status === "error" ? "text-danger" : "text-fg-2")}>
                  {statusText ?? track.artist}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <FavoriteButton track={track} size="sm" />
                <OfflineButton track={track} size="sm" />
              </div>
            </>
          ) : (
            <p className="truncate pl-1 text-[13px] text-fg-3">{t.player.nothingPlaying}</p>
          )}
        </div>

        <div className="flex w-[min(46vw,600px)] flex-col items-center justify-center gap-1">
          <Transport />
          <Scrubber className="w-full" />
        </div>

        <div className="flex items-center justify-end gap-0.5">
          <ModeSwitch className="max-xl:hidden mr-1" />
          <IconButton
            label={t.player.equalizer}
            size="sm"
            active={equalizerOpen || eqEnabled}
            onClick={() => setEqualizerOpen(true)}
          >
            <EqualizerIcon size={18} weight={eqEnabled ? "fill" : "regular"} />
          </IconButton>
          {!isVideoke && (
            <IconButton
              label={t.nowPlaying.tabLyrics}
              size="sm"
              active={inspectorOpen && activeTab === "lyrics"}
              onClick={() => toggleInspector("lyrics")}
            >
              <MicrophoneStageIcon size={18} weight={inspectorOpen && activeTab === "lyrics" ? "fill" : "regular"} />
            </IconButton>
          )}
          <IconButton
            label={`${t.nowPlaying.tabPlaying} & ${t.player.queue}`}
            size="sm"
            active={inspectorOpen && activeTab === "playing"}
            onClick={() => toggleInspector("playing")}
          >
            <QueueIcon size={18} weight={inspectorOpen && activeTab === "playing" ? "bold" : "regular"} />
          </IconButton>
          <Volume className="max-lg:hidden" />
          <IconButton label={t.player.shortcuts} size="sm" onClick={() => setShortcutsOpen(true)} className="max-xl:hidden">
            <KeyboardIcon size={18} />
          </IconButton>
        </div>
      </div>
    </footer>
  );
}
