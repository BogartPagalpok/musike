import {
  BooksIcon,
  BroadcastIcon,
  ClockCounterClockwiseIcon,
  DownloadSimpleIcon,
  GearSixIcon,
  HeartIcon,
  HouseIcon,
  MagnifyingGlassIcon,
  MicrophoneStageIcon,
  PlusIcon,
  QueueIcon,
  SidebarSimpleIcon,
} from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
import { useT } from "../i18n";
import { cn } from "../lib/format";
import { paths } from "../lib/routes";
import { selectCurrent, usePlayer } from "../player/player";
import { useAppearance } from "../stores/appearance";
import { useLibrary } from "../stores/library";
import { useOffline } from "../stores/offline";
import { needsAttention, useSystem } from "../stores/system";
import { useUi } from "../stores/ui";
import { Artwork } from "./Artwork";
import { Logo, LogoMark } from "./Brand";
import { NamePlaylistDialog } from "./Dialogs";
import { PanelBody } from "./NowPlaying";
import { SLOT } from "./Video";

const nav = [
  { to: paths.home, key: "home", Icon: HouseIcon, end: true },
  { to: paths.podcasts, key: "podcasts", Icon: BroadcastIcon, end: false },
  { to: paths.search, key: "search", Icon: MagnifyingGlassIcon, end: false },
  { to: paths.library, key: "library", Icon: BooksIcon, end: false },
] as const;

/** Settings entry. Shows a dot (and on the expanded rail, an "Update" pill) when yt-dlp needs attention. */
function SettingsButton({ isExpanded }: { isExpanded: boolean }) {
  const t = useT();
  const info = useSystem((s) => s.info);
  const setOpen = useUi((s) => s.setSettingsOpen);
  const attention = needsAttention(info);
  const updatable = !!info?.ytdlp.updateAvailable || !info?.ytdlp.path;
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={attention ? t.nav.settingsAttention : t.nav.settings}
      title={t.nav.settings}
      className={cn(
        "relative flex h-10 w-full items-center gap-2.5 rounded-full px-3 text-sm text-fg-2 transition-colors hover:bg-surface-3 hover:text-fg",
        isExpanded ? "justify-start" : "justify-center px-0",
      )}
    >
      <GearSixIcon size={19} className="shrink-0" />
      {isExpanded && <span className="flex-1 truncate text-left text-sm font-medium">{t.nav.settings}</span>}
      {attention && (
        <>
          {!isExpanded && <span className="absolute top-2 right-[calc(50%-14px)] size-2 rounded-full bg-accent ring-2 ring-surface-2" />}
          {isExpanded && (
            <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-text">
              {updatable ? t.nav.updatePill : t.nav.checkPill}
            </span>
          )}
        </>
      )}
    </button>
  );
}

/** Shared tile: square icon/art with an active accent ring, robust text truncation. */
function RailLink({
  to,
  label,
  sub,
  end,
  isExpanded,
  children,
}: {
  to: string;
  label: string;
  sub?: string;
  end?: boolean;
  isExpanded: boolean;
  children: ReactNode;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      title={label}
      className={({ isActive }) =>
        cn(
          "group flex items-center gap-3 rounded-[9px] p-1.5 transition-colors duration-150",
          isExpanded ? "justify-start pr-3" : "justify-center",
          "hover:bg-surface-3",
          isActive && isExpanded && "bg-surface-3",
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              "relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-[7px] transition-transform duration-150 group-active:scale-95",
            )}
          >
            {children}
          </span>
          {isExpanded && (
            <span className="min-w-0 flex-1 overflow-hidden">
              <span className={cn("block truncate text-[13.5px] font-medium leading-tight", isActive ? "text-fg font-semibold" : "text-fg-2 group-hover:text-fg")}>
                {label}
              </span>
              {sub && <span className="mt-0.5 block truncate text-[11.5px] text-fg-3 leading-tight">{sub}</span>}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export function Rail({ embeddedRoutes }: { embeddedRoutes?: ReactNode }) {
  const t = useT();
  const track = usePlayer(selectCurrent);
  const sidebarPlaylists = useAppearance((s) => s.sidebarPlaylists);
  const compactSidebar = useAppearance((s) => s.compactSidebar);
  const sidebarWidth = useAppearance((s) => s.sidebarWidth);
  const sidebarTab = useAppearance((s) => s.sidebarTab ?? "browse");
  const layoutTemplate = useAppearance((s) => s.layoutTemplate);
  const setAppearance = useAppearance((s) => s.set);
  const playlists = useLibrary((s) => s.playlists);
  const favorites = useLibrary((s) => s.favorites);
  const offlineTracks = useOffline((s) => s.tracks);
  const createPlaylist = useLibrary((s) => s.createPlaylist);
  const navigate = useNavigate();
  const location = useLocation();
  const [creating, setCreating] = useState(false);
  const [resizing, setResizing] = useState(false);

  const isLibraryActive = location.pathname === paths.library;
  const isExpanded = !compactSidebar;
  const isStageLayout = layoutTemplate === "center-lyrics" && !!embeddedRoutes;
  const effectiveWidth = isExpanded
    ? isStageLayout
      ? Math.max(sidebarWidth, 390)
      : Math.max(sidebarWidth, 280)
    : 74;

  const toggleExpand = () => setAppearance({ compactSidebar: !compactSidebar });

  return (
    <aside
      style={{ width: `${effectiveWidth}px` }}
      className={cn(
        "island relative hidden shrink-0 md:flex @container/sidebar",
        !resizing && "transition-[width] duration-250 ease-out-expo",
      )}
    >
      <div className="island-core flex w-full flex-col overflow-hidden">
        {/* Header with Brand + Stage Toggle + Sidebar Collapse */}
        <div
          className={cn(
            "flex h-14 shrink-0 items-center border-b border-line/60 px-3",
            isExpanded ? "justify-between" : "h-auto flex-col justify-center gap-1.5 py-2.5",
          )}
        >
          {isExpanded ? (
            <>
              <Logo className="min-w-0 truncate" />
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setAppearance({
                      layoutTemplate: layoutTemplate === "center-lyrics" ? "default" : "center-lyrics",
                      compactSidebar: false,
                    })
                  }
                  title={
                    layoutTemplate === "center-lyrics"
                      ? "Switch to Classic Explorer Layout"
                      : "Switch to Stage & Lyrics Layout (Home in Sidebar)"
                  }
                  className={cn(
                    "grid size-8 place-items-center rounded-lg transition-colors",
                    layoutTemplate === "center-lyrics"
                      ? "bg-surface-4 text-accent-text"
                      : "text-fg-2 hover:bg-surface-3 hover:text-fg",
                  )}
                >
                  <MicrophoneStageIcon size={17} weight={layoutTemplate === "center-lyrics" ? "fill" : "regular"} />
                </button>
                <button
                  type="button"
                  onClick={toggleExpand}
                  aria-label="Collapse sidebar"
                  title="Collapse sidebar"
                  className="grid size-8 place-items-center rounded-lg text-fg-2 transition-colors hover:bg-surface-3 hover:text-fg"
                >
                  <SidebarSimpleIcon size={17} weight="regular" />
                </button>
              </div>
            </>
          ) : (
            <>
              <LogoMark className="size-7 text-accent-text" />
              <button
                type="button"
                onClick={toggleExpand}
                aria-label="Expand sidebar"
                title="Expand sidebar"
                className="mt-0.5 grid size-8 place-items-center rounded-lg text-fg-2 transition-colors hover:bg-surface-3 hover:text-fg"
              >
                <SidebarSimpleIcon size={17} weight="regular" />
              </button>
            </>
          )}
        </div>

        {/* Unified Toolbar Tab Switcher (When Expanded & Track Active) */}
        {isExpanded && track && (
          <div className="shrink-0 px-3 pt-2 pb-1.5">
            <div role="tablist" aria-label="Sidebar views" className="grid grid-cols-3 gap-1 rounded-[10px] bg-fg/[0.06] p-1">
              <button
                type="button"
                role="tab"
                aria-selected={sidebarTab === "browse"}
                onClick={() => setAppearance({ sidebarTab: "browse" })}
                className={cn(
                  "flex h-7 items-center justify-center gap-1.5 rounded-[7px] px-1 text-xs font-medium transition-colors min-w-0 truncate",
                  sidebarTab === "browse" ? "bg-surface-4 text-fg shadow-2xs font-semibold" : "text-fg-2 hover:text-fg",
                )}
              >
                <BooksIcon size={14} className="shrink-0" />
                <span className="truncate">{t.nav.library}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={sidebarTab === "playing"}
                onClick={() => setAppearance({ sidebarTab: "playing" })}
                className={cn(
                  "flex h-7 items-center justify-center gap-1.5 rounded-[7px] px-1 text-xs font-medium transition-colors min-w-0 truncate",
                  sidebarTab === "playing" ? "bg-surface-4 text-fg shadow-2xs font-semibold" : "text-fg-2 hover:text-fg",
                )}
              >
                <QueueIcon size={14} className="shrink-0" />
                <span className="truncate">{t.nowPlaying.tabPlaying}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={sidebarTab === "lyrics"}
                onClick={() => setAppearance({ sidebarTab: "lyrics" })}
                className={cn(
                  "flex h-7 items-center justify-center gap-1.5 rounded-[7px] px-1 text-xs font-medium transition-colors min-w-0 truncate",
                  sidebarTab === "lyrics" ? "bg-surface-4 text-fg shadow-2xs font-semibold" : "text-fg-2 hover:text-fg",
                )}
              >
                <MicrophoneStageIcon size={14} className="shrink-0" />
                <span className="truncate">{t.nowPlaying.tabLyrics}</span>
              </button>
            </div>
          </div>
        )}

        {/* View Mode 1: Now Playing & Interactive Queue */}
        {isExpanded && track && sidebarTab === "playing" && (
          <div className="scroll-area min-h-0 flex-1 overflow-y-auto px-2 pt-2">
            <PanelBody tab="playing" slot={SLOT.panel} />
          </div>
        )}

        {/* View Mode 2: Real-time Synced Karaoke Lyrics */}
        {isExpanded && track && sidebarTab === "lyrics" && (
          <div className="scroll-area flex min-h-0 flex-1 flex-col overflow-hidden px-2 pt-2">
            <PanelBody tab="lyrics" slot={SLOT.panel} />
          </div>
        )}

        {/* View Mode 3: Navigation, Library & Collection (Default) */}
        {(!isExpanded || !track || sidebarTab === "browse") && (
          <>
            {/* Top Navigation Links */}
            {isExpanded && isStageLayout ? (
              <div className="shrink-0 px-3 pt-2 pb-1.5">
                <nav
                  aria-label={t.nav.main}
                  className="grid grid-cols-4 gap-1 rounded-[10px] bg-fg/[0.07] p-1"
                >
                  {nav.map(({ to, key, Icon, end }) => (
                    <NavLink
                      key={to}
                      to={to}
                      end={end}
                      title={t.nav[key]}
                      className={({ isActive }) =>
                        cn(
                          "flex h-7 items-center justify-center gap-1.5 rounded-[7px] px-1 text-xs font-medium transition-colors min-w-0 truncate",
                          isActive
                            ? "bg-surface-4 text-fg shadow-2xs font-semibold"
                            : "text-fg-2 hover:text-fg",
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon size={14} weight={isActive ? "fill" : "regular"} className="shrink-0" />
                          <span className="truncate">{t.nav[key]}</span>
                        </>
                      )}
                    </NavLink>
                  ))}
                </nav>
              </div>
            ) : (
              <nav aria-label={t.nav.main} className="flex shrink-0 flex-col gap-0.5 px-2 pt-2">
                {nav.map(({ to, key, Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    title={t.nav[key]}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2.5 rounded-[9px] transition-colors duration-150",
                        isExpanded ? "h-9 justify-start px-3 text-[13.5px]" : "h-10 justify-center px-0",
                        isActive ? "bg-surface-3 text-fg font-semibold" : "text-fg-2 hover:bg-surface-3/60 hover:text-fg",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon size={19} weight={isActive ? "fill" : "regular"} className={cn("shrink-0", isActive && "text-accent-text")} />
                        {isExpanded && <span className="min-w-0 flex-1 truncate">{t.nav[key]}</span>}
                      </>
                    )}
                  </NavLink>
                ))}
              </nav>
            )}

            {/* In Collapsed Icon Rail Mode: Quick Now Playing & Lyrics buttons if track active */}
            {!isExpanded && track && (
              <>
                <div className="mx-3 my-1.5 h-px bg-line shrink-0" />
                <div className="flex flex-col gap-1 px-2">
                  <button
                    type="button"
                    onClick={() => setAppearance({ compactSidebar: false, sidebarTab: "playing" })}
                    title={`${t.nowPlaying.tabPlaying} & ${t.player.queue}`}
                    className="grid size-10 place-items-center rounded-[8px] text-fg-2 transition-colors hover:bg-surface-3 hover:text-accent-text"
                  >
                    <QueueIcon size={19} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setAppearance({ compactSidebar: false, sidebarTab: "lyrics" })}
                    title={t.nowPlaying.tabLyrics}
                    className="grid size-10 place-items-center rounded-[8px] text-fg-2 transition-colors hover:bg-surface-3 hover:text-accent-text"
                  >
                    <MicrophoneStageIcon size={19} />
                  </button>
                </div>
              </>
            )}

            {/* Stage Layout Mode: Combined Library & Playlists when on Library tab, or embedded page */}
            {isExpanded && isStageLayout ? (
              <div className="scroll-area min-h-0 flex-1 overflow-y-auto border-t border-line/60 bg-surface-1/40">
                {isLibraryActive ? (
                  <div className="flex flex-col gap-0.5 p-2 pb-4">
                    <div className="flex items-center justify-between px-2 pt-1 pb-2">
                      <span className="text-xs font-semibold text-fg-3 uppercase tracking-wider">{t.nav.yourCollection}</span>
                      <button
                        type="button"
                        onClick={() => setCreating(true)}
                        className="flex h-7 items-center gap-1.5 rounded-full bg-accent px-3 text-xs font-semibold text-accent-ink transition-transform hover:scale-105 active:scale-95"
                      >
                        <PlusIcon size={14} weight="bold" />
                        <span>New</span>
                      </button>
                    </div>
                    <RailLink to={paths.favorites} label={t.nav.favorites} sub={t.common.tracks(favorites.length)} isExpanded={true}>
                      <span className="grid size-full place-items-center bg-accent-soft text-accent-text">
                        <HeartIcon size={20} weight="fill" />
                      </span>
                    </RailLink>
                    <RailLink to={paths.downloads} label={t.nav.downloads} sub={t.common.tracks(offlineTracks.length)} isExpanded={true}>
                      <span className="grid size-full place-items-center bg-surface-3 text-accent-text">
                        <DownloadSimpleIcon size={20} weight="bold" />
                      </span>
                    </RailLink>
                    <RailLink to={paths.history} label={t.nav.recentlyPlayed} sub={t.nav.history} isExpanded={true}>
                      <span className="grid size-full place-items-center bg-surface-3 text-fg-2">
                        <ClockCounterClockwiseIcon size={20} />
                      </span>
                    </RailLink>
                    {playlists.map((p) => (
                      <RailLink key={p.id} to={paths.playlist(p.id)} label={p.name} sub={t.common.tracks(p.tracks.length)} isExpanded={true}>
                        <Artwork src={p.tracks[0]?.thumb} className="size-full" iconSize={18} />
                      </RailLink>
                    ))}
                    {playlists.length === 0 && (
                      <p className="px-3 pt-3 text-xs text-fg-3 leading-relaxed">
                        {t.library.noPlaylists}
                      </p>
                    )}
                  </div>
                ) : (
                  embeddedRoutes
                )}
              </div>
            ) : (
              <>
                <div className="mx-3 my-2 h-px bg-line shrink-0" />

                <div className={cn("flex shrink-0 items-center px-3 pb-1", isExpanded ? "justify-between" : "justify-center px-0")}>
                  {isExpanded && <span className="truncate text-xs font-semibold text-fg-3 uppercase tracking-wider">{t.nav.yourCollection}</span>}
                  <button
                    type="button"
                    onClick={() => setCreating(true)}
                    aria-label={t.nav.newPlaylist}
                    title={t.nav.newPlaylist}
                    className="grid size-8 place-items-center rounded-full text-fg-2 transition-colors hover:bg-surface-3 hover:text-fg"
                  >
                    <PlusIcon size={17} />
                  </button>
                </div>

                <div className="scroll-area flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
                  <RailLink to={paths.favorites} label={t.nav.favorites} sub={t.common.tracks(favorites.length)} isExpanded={isExpanded}>
                    <span className="grid size-full place-items-center bg-accent-soft text-accent-text">
                      <HeartIcon size={19} weight="fill" />
                    </span>
                  </RailLink>
                  <RailLink to={paths.downloads} label={t.nav.downloads} sub={t.common.tracks(offlineTracks.length)} isExpanded={isExpanded}>
                    <span className="grid size-full place-items-center bg-surface-3 text-accent-text">
                      <DownloadSimpleIcon size={19} weight="bold" />
                    </span>
                  </RailLink>
                  <RailLink to={paths.history} label={t.nav.recentlyPlayed} sub={t.nav.history} isExpanded={isExpanded}>
                    <span className="grid size-full place-items-center bg-surface-3 text-fg-2">
                      <ClockCounterClockwiseIcon size={19} />
                    </span>
                  </RailLink>
                  {sidebarPlaylists &&
                    playlists.map((p) => (
                      <RailLink key={p.id} to={paths.playlist(p.id)} label={p.name} sub={t.common.tracks(p.tracks.length)} isExpanded={isExpanded}>
                        <Artwork src={p.tracks[0]?.thumb} className="size-full" iconSize={18} />
                      </RailLink>
                    ))}
                </div>
              </>
            )}
          </>
        )}

        <div className="flex shrink-0 border-t border-line p-2">
          <SettingsButton isExpanded={isExpanded} />
        </div>
      </div>

      {/* Interactive Drag-to-Resize Handle on Right Edge of Sidebar (Clamps safely to prevent cramming) */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Drag to resize sidebar"
        title="Drag to resize sidebar (double-click to toggle collapse)"
        onDoubleClick={toggleExpand}
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          setResizing(true);
        }}
        onPointerMove={(e) => {
          if (!resizing) return;
          const nextWidth = e.clientX - 8;
          if (nextWidth < 200) {
            setAppearance({ compactSidebar: true });
          } else {
            setAppearance({
              compactSidebar: false,
              sidebarWidth: Math.max(280, Math.min(560, nextWidth)),
            });
          }
        }}
        onPointerUp={() => setResizing(false)}
        onPointerCancel={() => setResizing(false)}
        className="group absolute top-3 -right-1.5 bottom-3 z-20 flex w-3 cursor-col-resize items-center justify-center select-none"
      >
        <span className="h-12 w-1 rounded-full bg-transparent transition-colors group-hover:bg-accent/60 group-active:bg-accent" />
      </div>

      <NamePlaylistDialog
        open={creating}
        title={t.nav.newPlaylist}
        action={t.library.create}
        onClose={() => setCreating(false)}
        onSubmit={async (name) => {
          const p = await createPlaylist(name);
          setCreating(false);
          if (p) navigate(paths.playlist(p.id));
        }}
      />
    </aside>
  );
}
