import { useEffect, useLayoutEffect, useRef } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, useNavigationType } from "react-router";
import { DataDialog } from "./components/BackupSection";
import { OpeningSplash } from "./components/Brand";
import { AddToPlaylistDialog, ShortcutsDialog } from "./components/Dialogs";
import { EqualizerDialog } from "./components/EqualizerDialog";
import { MiniPlayer, TabBar } from "./components/MobileChrome";
import { NowPlayingSheet, PanelDrawer } from "./components/NowPlaying";
import { CenterLyricsPlayer } from "./components/CenterLyricsPlayer";
import { PlayerBar } from "./components/PlayerBar";
import { Rail } from "./components/Rail";
import { SettingsDialog } from "./components/SettingsDialog";
import { ThemeSceneBackdrop } from "./components/ThemeSceneBackdrop";
import { Toasts } from "./components/Toasts";
import { TrackMenu } from "./components/TrackMenu";
import { PipVideoSlot, Theater } from "./components/Video";
import { MD, useMediaQuery } from "./hooks/useMediaQuery";
import { useShortcuts } from "./hooks/useShortcuts";
import { getT } from "./i18n";
import { capabilities } from "./lib/api";
import { cn } from "./lib/format";
import { legacyRedirect, NOW_PLAYING_HASH, paths } from "./lib/routes";
import { usePlayer } from "./player/player";
import { useAppearance } from "./stores/appearance";
import { useLibrary } from "./stores/library";
import { useDeviceFiles } from "./stores/deviceFiles";
import { useOffline } from "./stores/offline";
import { openSettings, useSystem } from "./stores/system";
import { toast } from "./stores/ui";
import Album from "./views/Album";
import Artist from "./views/Artist";
import BatchSearch from "./views/BatchSearch";
import Collection from "./views/Collection";
import Device from "./views/Device";
import Genre from "./views/Genre";
import Home from "./views/Home";
import Library from "./views/Library";
import Podcasts from "./views/Podcasts";
import Search from "./views/Search";
import ThemeStore from "./views/ThemeStore";

const SHEET_HASH = `#${NOW_PLAYING_HASH}`;

export default function App() {
  const location = useLocation();
  const legacy = legacyRedirect(location.pathname, location.search, location.hash);
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const isMd = useMediaQuery(MD);
  const hasTrack = usePlayer((s) => s.queue.length > 0);
  const loadLibrary = useLibrary((s) => s.load);
  const loadDeviceFiles = useDeviceFiles((s) => s.load);
  const loadOffline = useOffline((s) => s.load);
  const loadSystem = useSystem((s) => s.load);
  const layoutTemplate = useAppearance((s) => s.layoutTemplate);
  const main = useRef<HTMLElement>(null);

  useShortcuts();

  useEffect(() => {
    void loadLibrary();
    void loadOffline();
    void loadDeviceFiles();
  }, [loadLibrary, loadOffline, loadDeviceFiles]);

  // Check yt-dlp shortly after start and say so once if something needs doing (not on Android: no yt-dlp there).
  useEffect(() => {
    if (!capabilities.engineSettings) return;
    const t = setTimeout(async () => {
      await loadSystem();
      const info = useSystem.getState().info;
      if (!info) return;
      const t = getT();
      if (!info.ytdlp.path) {
        toast(t.toasts.ytdlpMissing, "error", { label: t.common.install, run: openSettings });
        return;
      }
      const latest = info.ytdlp.latest[info.ytdlp.channel];
      if (info.ytdlp.updateAvailable && latest) {
        try {
          if (sessionStorage.getItem("musike:update-notice") === latest) return;
          sessionStorage.setItem("musike:update-notice", latest);
        } catch {
          /* private mode */
        }
        toast(t.toasts.ytdlpUpdate(latest), "info", { label: t.common.update, run: openSettings });
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [loadSystem]);

  // Where each history entry was scrolled to, so Back returns to the same spot (say, deep in a genre's artists).
  const scrollMemo = useRef(new Map<string, number>());
  const entryKey = useRef(location.key);
  useEffect(() => {
    const el = main.current;
    if (!el) return;
    const onScroll = () => scrollMemo.current.set(entryKey.current, el.scrollTop);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // New page, back to the top; Back and Forward return to where it was (the sheet hash is not a page change).
  // A layout effect, so the scroll the old page's removal causes is already filed under the new entry.
  useLayoutEffect(() => {
    entryKey.current = location.key;
    const saved = navigationType === "POP" ? scrollMemo.current.get(location.key) : undefined;
    main.current?.scrollTo({ top: 0 });
    // Pages that keep their data (genre, artist) render in full right away, so one frame is enough.
    if (saved) requestAnimationFrame(() => main.current?.scrollTo({ top: saved }));
  }, [location.pathname]);

  const sheetOpen = !isMd && location.hash === SHEET_HASH;
  const closeSheet = () => {
    // Pop the history entry the sheet pushed, so Back and the close button behave the same.
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate({ hash: "" }, { replace: true });
  };

  const appRoutes = legacy ? (
    <Navigate to={legacy} replace />
  ) : (
    <Routes>
      <Route path={paths.home} element={<Home />} />
      <Route path={paths.podcasts} element={<Podcasts />} />
      <Route path={paths.search} element={<Search />} />
      <Route path={paths.searchList} element={<BatchSearch />} />
      <Route path="/search/genre/:id" element={<Genre />} />
      <Route path="/search/artist/:id" element={<Artist />} />
      <Route path="/search/album/:id" element={<Album />} />
      <Route path={paths.library} element={<Library />} />
      <Route path={paths.device} element={<Device />} />
      <Route path={paths.themes} element={<ThemeStore />} />
      <Route path={paths.favorites} element={<Collection kind="favorites" />} />
      <Route path={paths.downloads} element={<Collection kind="downloads" />} />
      <Route path={paths.history} element={<Collection kind="history" />} />
      <Route path="/playlist/:id" element={<Collection kind="playlist" />} />
      <Route path="*" element={<Home />} />
    </Routes>
  );

  return (
    <div className="grain app-shell relative flex h-dvh flex-col bg-bg md:p-2 md:pb-0">
      <ThemeSceneBackdrop />
      <OpeningSplash />
      <div className="relative z-[2] flex min-h-0 flex-1 md:gap-2">
        <Rail embeddedRoutes={layoutTemplate === "center-lyrics" && isMd ? appRoutes : undefined} />
        <main
          ref={main}
          className={cn(
            "scroll-area app-main relative min-h-0 min-w-0 flex-1 md:rounded-[12px] md:bg-surface-1",
            (layoutTemplate === "center-lyrics" || layoutTemplate === "cinema") && isMd
              ? "flex flex-col overflow-hidden"
              : "overflow-y-auto",
            hasTrack ? "pb-[calc(152px+env(safe-area-inset-bottom))]" : "pb-[calc(88px+env(safe-area-inset-bottom))]",
            "md:pb-0",
          )}
        >
          {layoutTemplate === "center-lyrics" && isMd ? (
            <CenterLyricsPlayer mode="stage" />
          ) : layoutTemplate === "cinema" && isMd ? (
            <div className="flex h-full flex-col divide-y divide-line overflow-hidden">
              <div className="min-h-0 flex-[1.2] overflow-hidden">
                <CenterLyricsPlayer mode="cinema" />
              </div>
              <div className="scroll-area min-h-0 flex-1 overflow-y-auto bg-surface-1/80">
                {appRoutes}
              </div>
            </div>
          ) : (
            appRoutes
          )}
        </main>
      </div>

      {isMd ? (
        <PlayerBar />
      ) : (
        <>
          <MiniPlayer />
          <TabBar />
        </>
      )}

      <PanelDrawer />
      <NowPlayingSheet open={sheetOpen} onClose={closeSheet} />
      {capabilities.video && (
        <>
          <PipVideoSlot />
          <Theater />
        </>
      )}
      <TrackMenu />
      <AddToPlaylistDialog />
      <ShortcutsDialog />
      <EqualizerDialog />
      <SettingsDialog />
      <DataDialog />
      <Toasts />
    </div>
  );
}
