import {
  BooksIcon,
  BroadcastIcon,
  ClockCounterClockwiseIcon,
  DownloadSimpleIcon,
  GearSixIcon,
  HardDriveIcon,
  HeartIcon,
  HouseIcon,
  MagnifyingGlassIcon,
  MicrophoneStageIcon,
  PlusIcon,
  SidebarSimpleIcon,
  SwatchesIcon,
} from "./icons";
import { useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router";
import { useT } from "../i18n";
import { cn } from "../lib/format";
import { paths } from "../lib/routes";
import { selectCurrent, usePlayer } from "../player/player";
import { useAppearance } from "../stores/appearance";
import { useDeviceFiles } from "../stores/deviceFiles";
import { useLibrary } from "../stores/library";
import { useOffline } from "../stores/offline";
import { needsAttention, useSystem } from "../stores/system";
import { useThemeStore } from "../stores/themeStore";
import { useUi } from "../stores/ui";
import { useIsVideokeTrack } from "../stores/videoke";
import { Artwork } from "./Artwork";
import { Logo, LogoMark } from "./Brand";
import { NamePlaylistDialog } from "./Dialogs";
import { PanelBody } from "./NowPlaying";
import { SLOT } from "./Video";

const nav = [
  { to: paths.home, key: "home", Icon: HouseIcon, end: true },
  { to: paths.search, key: "search", Icon: MagnifyingGlassIcon, end: false },
  { to: paths.podcasts, key: "podcasts", Icon: BroadcastIcon, end: false },
  { to: paths.videoke, key: "videoke", Icon: MicrophoneStageIcon, end: false },
  { to: paths.library, key: "library", Icon: BooksIcon, end: false },
] as const;

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
        "relative flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-[13px] text-fg-2 transition-colors duration-150 hover:bg-surface-3 hover:text-fg",
        isExpanded ? "justify-start" : "justify-center px-0",
      )}
    >
      <GearSixIcon size={18} className="shrink-0" />
      {isExpanded && <span className="flex-1 truncate text-left font-medium">{t.nav.settings}</span>}
      {attention && (
        <>
          {!isExpanded && <span className="absolute top-2 right-[calc(50%-12px)] size-2 rounded-full bg-accent ring-2 ring-surface-1" />}
          {isExpanded && (
            <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-text">
              {updatable ? t.nav.updatePill : t.nav.checkPill}
            </span>
          )}
        </>
      )}
    </button>
  );
}

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
          "group flex items-center gap-2.5 rounded-md p-1.5 transition-colors duration-150",
          isExpanded ? "justify-start pr-2.5" : "justify-center",
          "hover:bg-surface-2",
          isActive && "bg-surface-3",
        )
      }
    >
      {({ isActive }) => (
        <>
          <span className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-md">
            {children}
          </span>
          {isExpanded && (
            <span className="min-w-0 flex-1 overflow-hidden">
              <span className={cn("block truncate text-[13px] leading-snug", isActive ? "text-fg font-semibold" : "text-fg-2 font-medium group-hover:text-fg")}>
                {label}
              </span>
              {sub && <span className="block truncate text-[11.5px] text-fg-3 leading-snug">{sub}</span>}
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
  const sceneStyle = useThemeStore((s) => s.sceneStyle);
  const setAppearance = useAppearance((s) => s.set);
  const playlists = useLibrary((s) => s.playlists);
  const favorites = useLibrary((s) => s.favorites);
  const offlineTracks = useOffline((s) => s.tracks);
  const deviceTracks = useDeviceFiles((s) => s.tracks);
  const createPlaylist = useLibrary((s) => s.createPlaylist);
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [resizing, setResizing] = useState(false);
  const isVideoke = useIsVideokeTrack();

  const isExpanded = !compactSidebar;
  const isStageLayout = layoutTemplate === "center-lyrics" && !!embeddedRoutes;
  const activeSidebarTab = isStageLayout ? (isVideoke && sidebarTab === "lyrics" ? "browse" : sidebarTab) : "browse";
  const effectiveWidth = isExpanded
    ? isStageLayout
      ? Math.max(sidebarWidth, 390)
      : Math.max(216, Math.min(sidebarWidth, 340))
    : 68;

  const toggleExpand = () => setAppearance({ compactSidebar: !compactSidebar });

  return (
    <aside
      style={{ width: `${effectiveWidth}px` }}
      className={cn(
        "island relative hidden shrink-0 md:flex @container/sidebar",
        !resizing && "transition-[width] duration-200 ease-out",
      )}
    >
      <div className="island-core flex w-full flex-col overflow-hidden">
        <div
          className={cn(
            "flex h-13 shrink-0 items-center px-3",
            isExpanded ? "justify-between" : "h-auto flex-col justify-center gap-1.5 py-2.5",
          )}
        >
          {isExpanded ? (
            <>
              <Logo className="min-w-0 truncate" />
              <button
                type="button"
                onClick={toggleExpand}
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
                className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-fg-2 transition-colors duration-150 hover:bg-surface-3 hover:text-fg"
              >
                <SidebarSimpleIcon size={16} weight="regular" />
              </button>
            </>
          ) : (
            <>
              <LogoMark className="size-6 text-fg" />
              <button
                type="button"
                onClick={toggleExpand}
                aria-label="Expand sidebar"
                title="Expand sidebar"
                className="grid size-8 cursor-pointer place-items-center rounded-md text-fg-2 transition-colors duration-150 hover:bg-surface-3 hover:text-fg"
              >
                <SidebarSimpleIcon size={16} weight="regular" />
              </button>
            </>
          )}
        </div>

        {/* Stage Layout Mode Only: Sidebar tab switcher */}
        {isExpanded && isStageLayout && track && (
          <div className="shrink-0 px-3 pt-1 pb-1.5">
            <div
              role="tablist"
              aria-label="Sidebar views"
              className={cn("grid gap-1 rounded-md bg-surface-2 p-1", isVideoke ? "grid-cols-2" : "grid-cols-3")}
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeSidebarTab === "browse"}
                onClick={() => setAppearance({ sidebarTab: "browse" })}
                className={cn(
                  "flex h-7 cursor-pointer items-center justify-center rounded-sm px-1 text-xs font-medium transition-colors duration-150 min-w-0 truncate",
                  activeSidebarTab === "browse" ? "bg-surface-4 text-fg font-semibold" : "text-fg-2 hover:text-fg",
                )}
              >
                <span className="truncate">{t.nav.library}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeSidebarTab === "playing"}
                onClick={() => setAppearance({ sidebarTab: "playing" })}
                className={cn(
                  "flex h-7 cursor-pointer items-center justify-center rounded-sm px-1 text-xs font-medium transition-colors duration-150 min-w-0 truncate",
                  activeSidebarTab === "playing" ? "bg-surface-4 text-fg font-semibold" : "text-fg-2 hover:text-fg",
                )}
              >
                <span className="truncate">{t.nowPlaying.tabPlaying}</span>
              </button>
              {!isVideoke && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeSidebarTab === "lyrics"}
                  onClick={() => setAppearance({ sidebarTab: "lyrics" })}
                  className={cn(
                    "flex h-7 cursor-pointer items-center justify-center rounded-sm px-1 text-xs font-medium transition-colors duration-150 min-w-0 truncate",
                    activeSidebarTab === "lyrics" ? "bg-surface-4 text-fg font-semibold" : "text-fg-2 hover:text-fg",
                  )}
                >
                  <span className="truncate">{t.nowPlaying.tabLyrics}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {isExpanded && isStageLayout && track && activeSidebarTab === "playing" && (
          <div className="scroll-area min-h-0 flex-1 overflow-y-auto px-2 pt-2">
            <PanelBody tab="playing" slot={SLOT.panel} />
          </div>
        )}

        {isExpanded && isStageLayout && track && activeSidebarTab === "lyrics" && (
          <div className="scroll-area flex min-h-0 flex-1 flex-col overflow-hidden px-2 pt-2">
            <PanelBody tab="lyrics" slot={SLOT.panel} />
          </div>
        )}

        {(!isExpanded || !isStageLayout || !track || activeSidebarTab === "browse") && (
          <>
            <nav aria-label={t.nav.main} className="flex shrink-0 flex-col gap-0.5 px-2 pt-1">
              {nav.map(({ to, key, Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  title={t.nav[key]}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-md transition-colors duration-150",
                      isExpanded ? "h-9 justify-start px-2.5 text-[13.5px]" : "h-9 justify-center px-0",
                      isActive ? "bg-surface-3 text-fg font-semibold" : "text-fg-2 font-medium hover:bg-surface-2 hover:text-fg",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={19} weight={isActive ? "fill" : "regular"} className={cn("shrink-0", isActive ? "text-fg" : "text-fg-2")} />
                      {isExpanded && <span className="min-w-0 flex-1 truncate">{t.nav[key]}</span>}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>

            {isExpanded && isStageLayout ? (
              <div className={cn("scroll-area mt-2 min-h-0 flex-1 overflow-y-auto border-t border-line", sceneStyle === "none" ? "bg-surface-1/40" : "bg-transparent")}>
                {embeddedRoutes}
              </div>
            ) : (
              <>
                <div className="mx-3 my-2.5 h-px bg-line shrink-0" />

                <div className={cn("flex shrink-0 items-center px-3 pb-1", isExpanded ? "justify-between" : "justify-center px-0")}>
                  {isExpanded && <span className="truncate text-[12px] font-medium text-fg-3">{t.nav.yourCollection}</span>}
                  <button
                    type="button"
                    onClick={() => setCreating(true)}
                    aria-label={t.nav.newPlaylist}
                    title={t.nav.newPlaylist}
                    className="grid size-7 cursor-pointer place-items-center rounded-md text-fg-3 transition-colors duration-150 hover:bg-surface-3 hover:text-fg"
                  >
                    <PlusIcon size={15} />
                  </button>
                </div>

                <div className="scroll-area flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
                  <RailLink to={paths.favorites} label={t.nav.favorites} sub={favorites.length > 0 ? t.common.tracks(favorites.length) : undefined} isExpanded={isExpanded}>
                    <span className="grid size-full place-items-center bg-accent-soft text-accent-text">
                      <HeartIcon size={17} weight="fill" />
                    </span>
                  </RailLink>
                  <RailLink to={paths.downloads} label={t.nav.downloads} sub={offlineTracks.length > 0 ? t.common.tracks(offlineTracks.length) : undefined} isExpanded={isExpanded}>
                    <span className="grid size-full place-items-center bg-surface-3 text-fg-2">
                      <DownloadSimpleIcon size={17} weight="bold" />
                    </span>
                  </RailLink>
                  <RailLink to={paths.device} label={t.nav.device} sub={deviceTracks.length > 0 ? t.common.tracks(deviceTracks.length) : undefined} isExpanded={isExpanded}>
                    <span className="grid size-full place-items-center bg-surface-3 text-fg-2">
                      <HardDriveIcon size={17} />
                    </span>
                  </RailLink>
                  <RailLink to={paths.history} label={t.nav.recentlyPlayed} isExpanded={isExpanded}>
                    <span className="grid size-full place-items-center bg-surface-3 text-fg-2">
                      <ClockCounterClockwiseIcon size={17} />
                    </span>
                  </RailLink>
                  <RailLink to={paths.themes} label={t.nav.themes} isExpanded={isExpanded}>
                    <span className="grid size-full place-items-center bg-surface-3 text-fg-2">
                      <SwatchesIcon size={17} />
                    </span>
                  </RailLink>
                  {sidebarPlaylists &&
                    playlists.map((p) => (
                      <RailLink key={p.id} to={paths.playlist(p.id)} label={p.name} sub={t.common.tracks(p.tracks.length)} isExpanded={isExpanded}>
                        <Artwork src={p.tracks[0]?.thumb} className="size-full" iconSize={16} />
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
          if (nextWidth < 180) {
            setAppearance({ compactSidebar: true });
          } else {
            setAppearance({
              compactSidebar: false,
              sidebarWidth: Math.max(216, Math.min(isStageLayout ? 620 : 340, nextWidth)),
            });
          }
        }}
        onPointerUp={() => setResizing(false)}
        onPointerCancel={() => setResizing(false)}
        className="group absolute top-3 -right-1.5 bottom-3 z-20 flex w-3 cursor-col-resize items-center justify-center select-none"
      >
        <span className="h-12 w-0.5 rounded-full bg-transparent transition-colors duration-150 group-hover:bg-fg/25 group-active:bg-fg/50" />
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
