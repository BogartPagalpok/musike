import { useEffect } from "react";
import { useNavigate } from "react-router";
import { capabilities } from "../lib/api";
import { paths } from "../lib/routes";
import { handleExternalMediaAction, selectCurrent, usePlayer } from "../player/player";
import { useLibrary } from "../stores/library";
import { useUi } from "../stores/ui";
import { isTvMode } from "../tv/tvMode";

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

/** Desktop keyboard shortcuts. Listed in the "?" dialog. */
export function useShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Hardware media keys work globally even when typing in search/inputs
      if (e.key === "MediaPlayPause" || e.key === "AudioPlay" || e.key === "AudioPause" || e.code === "MediaPlayPause") {
        e.preventDefault();
        handleExternalMediaAction("toggle");
        return;
      }
      if (e.key === "MediaTrackNext" || e.key === "MediaNextTrack" || e.key === "AudioNext" || e.code === "MediaTrackNext") {
        e.preventDefault();
        handleExternalMediaAction("next");
        return;
      }
      if (e.key === "MediaTrackPrevious" || e.key === "MediaPreviousTrack" || e.key === "AudioPrev" || e.code === "MediaTrackPrevious") {
        e.preventDefault();
        handleExternalMediaAction("previous");
        return;
      }
      if (e.key === "MediaStop" || e.code === "MediaStop") {
        e.preventDefault();
        handleExternalMediaAction("pause");
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      if (useUi.getState().menu || useUi.getState().addToPlaylist) return;
      // On Android TV the arrow keys belong to focus navigation, not to volume/seek.
      if (isTvMode() && /^(ArrowUp|ArrowDown|ArrowLeft|ArrowRight| )$/.test(e.key)) return;
      const p = usePlayer.getState();
      const ui = useUi.getState();
      const current = selectCurrent(p);
      const handled = () => e.preventDefault();

      switch (e.key) {
        case " ":
          // Let focused buttons handle their own Space.
          if (e.target instanceof HTMLButtonElement || (e.target as HTMLElement)?.getAttribute?.("role") === "slider") return;
          handled();
          p.toggle();
          break;
        case "ArrowRight":
          handled();
          if (e.shiftKey) p.next();
          else p.seek(p.position + 5);
          break;
        case "ArrowLeft":
          handled();
          if (e.shiftKey) p.prev();
          else p.seek(p.position - 5);
          break;
        case "ArrowUp":
          handled();
          p.setVolume(p.volume + 0.05);
          break;
        case "ArrowDown":
          handled();
          p.setVolume(p.volume - 0.05);
          break;
        case "m":
        case "M":
          p.toggleMute();
          break;
        case "l":
        case "L":
          if (current) void useLibrary.getState().toggleFavorite(current);
          break;
        case "s":
        case "S":
          p.toggleShuffle();
          break;
        case "r":
        case "R":
          p.cycleRepeat();
          break;
        case "v":
        case "V":
          if (capabilities.video) p.setPreferVideo(!p.preferVideo);
          break;
        case "f":
        case "F":
          if (capabilities.video && p.mediaKind === "video") ui.setTheater(!ui.theater);
          break;
        case "e":
        case "E":
          ui.setEqualizerOpen(!ui.equalizerOpen);
          break;
        case "q":
        case "Q":
          ui.togglePanel("playing");
          break;
        case "/":
          handled();
          navigate(paths.search);
          requestAnimationFrame(() => document.getElementById("search-input")?.focus());
          break;
        case "?":
          ui.setShortcutsOpen(true);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);
}
