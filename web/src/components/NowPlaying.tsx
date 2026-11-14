import {
  CaretDownIcon,
  DotsThreeIcon,
  EqualizerIcon,
  ListBulletsIcon,
  MagnifyingGlassIcon,
  MicrophoneStageIcon,
  QueueIcon,
  RadioIcon,
  SidebarSimpleIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
  XIcon,
} from "@phosphor-icons/react";
import { AnimatePresence, motion, useDragControls, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "../i18n";
import { capabilities } from "../lib/api";
import { cn } from "../lib/format";
import type { Track } from "../lib/types";
import { useEqualizer } from "../player/equalizer";
import { selectCurrent, usePlayer, useStatusText } from "../player/player";
import { useAppearance } from "../stores/appearance";
import { useThemeStore } from "../stores/themeStore";
import { useUi, type PanelTab } from "../stores/ui";
import { Artwork } from "./Artwork";
import { FavoriteButton, ModeSwitch, OfflineButton, Scrubber, Transport } from "./Controls";
import { IconButton } from "./IconButton";
import { LyricsView } from "./Lyrics";
import { QueueList } from "./Queue";
import { ThemeSceneBackdrop, WorldStageFrame } from "./ThemeSceneBackdrop";
import { SLOT, VideoSlot } from "./Video";

/** Artwork or the live video, with a soft ambient glow from the cover behind it. */
function Stage({ track, slot, className }: { track: Track; slot: number; className?: string }) {
  const t = useT();
  const showsVideo = usePlayer((s) => s.mediaKind === "video");
  const status = usePlayer((s) => s.status);
  const aspect = usePlayer((s) => s.videoAspect);
  const sceneStyle = useThemeStore((s) => s.sceneStyle);
  // In Video mode on a song: say we're looking for its clip, or that it has none.
  const note = usePlayer((s) =>
    s.preferVideo ? (s.videoNote ?? (s.statusText === "findingClip" ? s.statusText : null)) : null,
  );
  if (showsVideo) {
    const portrait = aspect < 1;
    return (
      <div className="flex w-full justify-center">
        <VideoSlot
          priority={slot}
          expandable
          className={cn("rounded-[16px]", portrait ? "h-[min(52dvh,560px)]" : "aspect-video w-full")}
          style={{ aspectRatio: Math.min(16 / 9, Math.max(9 / 16, aspect)) }}
        />
      </div>
    );
  }
  return (
    <div className={cn("relative mx-auto aspect-square w-full", className)}>
      {sceneStyle === "none" && (
        <img
          src={track.thumb}
          alt=""
          aria-hidden="true"
          className="absolute inset-[8%] h-[84%] w-[84%] scale-110 rounded-full object-cover opacity-50 blur-3xl"
        />
      )}
      <WorldStageFrame scene={sceneStyle} playing={status === "playing"} compact className="size-full">
        <Artwork
          src={track.art}
          fallback={track.thumb}
          alt={t.nowPlaying.coverOf(track.title)}
          iconSize={48}
          className="relative size-full rounded-[inherit] shadow-[0_24px_60px_rgb(0_0_0/0.45)]"
        />
      </WorldStageFrame>
      {note && (
        <span className="absolute inset-x-3 bottom-3 z-20 flex items-center justify-center gap-2 rounded-full bg-black/65 px-3 py-2 text-center text-[13px] font-medium text-white backdrop-blur-md">
          {note === "findingClip" ? (
            <MagnifyingGlassIcon size={16} className="shrink-0" />
          ) : (
            <VideoCameraSlashIcon size={16} className="shrink-0" />
          )}{" "}
          {note === "findingClip" ? t.player.status.findingClip : t.player.noClip}
        </span>
      )}
    </div>
  );
}

function TrackHeading({ track, large = false }: { track: Track; large?: boolean }) {
  const statusText = useStatusText();
  const status = usePlayer((s) => s.status);
  return (
    <div className="flex items-center gap-1.5">
      <div className="min-w-0 flex-1">
        <h2 className={cn("truncate font-semibold tracking-tight", large ? "text-[22px] leading-tight" : "text-lg")}>{track.title}</h2>
        <p className={cn("truncate", large ? "text-base" : "text-sm", status === "error" ? "text-danger" : "text-fg-2")}>
          {statusText ?? [track.artist, track.album].filter(Boolean).join(" · ")}
        </p>
      </div>
      <OfflineButton track={track} size={large ? "lg" : "md"} />
      <FavoriteButton track={track} size={large ? "lg" : "md"} />
    </div>
  );
}

export function PanelBody({ tab, slot }: { tab: PanelTab; slot: number }) {
  const track = usePlayer(selectCurrent);
  const showsVideo = usePlayer((s) => s.mediaKind === "video");
  const startRadio = usePlayer((s) => s.startRadio);
  const eqEnabled = useEqualizer((s) => s.enabled);
  const eqPreset = useEqualizer((s) => s.preset);
  const setEqualizerOpen = useUi((s) => s.setEqualizerOpen);
  const openPanel = useUi((s) => s.openPanel);
  const layoutTemplate = useAppearance((s) => s.layoutTemplate);
  const centerHasStage = layoutTemplate === "center-lyrics" || layoutTemplate === "cinema";
  const t = useT();

  if (!track) {
    return <p className="px-2 py-16 text-center text-sm text-fg-2">{t.nowPlaying.playSomething}</p>;
  }
  if (tab === "lyrics") {
    return (
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden px-1 pb-2">
        {showsVideo && !centerHasStage && <Stage track={track} slot={slot} />}
        <LyricsView className="h-full min-h-0 flex-1" />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3.5 px-1 pb-4">
      {!centerHasStage && (
        <>
          <Stage track={track} slot={slot} />
          <TrackHeading track={track} />
          <ModeSwitch />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void startRadio(track)}
              className="flex h-9 items-center justify-center gap-1.5 rounded-full bg-surface-3 px-3 text-xs font-medium transition-colors hover:bg-surface-4 active:scale-[0.98]"
            >
              <RadioIcon size={16} className="shrink-0" />
              <span className="truncate">{t.trackMenu.startRadio}</span>
            </button>
            <button
              type="button"
              onClick={() => setEqualizerOpen(true)}
              className={cn(
                "flex h-9 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors active:scale-[0.98]",
                eqEnabled ? "bg-accent-soft text-accent-text" : "bg-surface-3 text-fg-2 hover:bg-surface-4 hover:text-fg",
              )}
            >
              <EqualizerIcon size={16} weight={eqEnabled ? "fill" : "regular"} className="shrink-0" />
              <span className="truncate">{eqEnabled ? t.equalizer.presetNames[eqPreset] : t.dialogs.shortcuts.equalizer}</span>
            </button>
          </div>
          <div className="overflow-hidden">
            <div className="flex items-center justify-between px-1 pt-2 pb-1">
              <span className="text-[13px] font-semibold text-fg">{t.nowPlaying.tabLyrics}</span>
              <button
                type="button"
                onClick={() => openPanel("lyrics")}
                className="text-[11px] font-medium text-fg-3 transition-colors hover:text-fg"
              >
                {t.nowPlaying.showLyrics}
              </button>
            </div>
            <LyricsView compact className="h-[190px]" />
          </div>
        </>
      )}
      <div className="-mx-1">
        <QueueList />
      </div>
    </div>
  );
}

function PanelTabs({ tab, onTab }: { tab: PanelTab; onTab: (t: PanelTab) => void }) {
  const t = useT();
  return (
    <div role="tablist" className="flex items-center rounded-[10px] bg-fg/[0.07] p-1">
      {(
        [
          ["playing", `${t.nowPlaying.tabPlaying} & ${t.player.queue}`],
          ["lyrics", t.nowPlaying.tabLyrics],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          role="tab"
          type="button"
          aria-selected={tab === id}
          onClick={() => onTab(id)}
          className={cn(
            "h-7 rounded-[7px] px-3 text-xs font-medium transition-colors",
            tab === id ? "bg-surface-4 text-fg shadow-2xs" : "text-fg-2 hover:text-fg",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Docked right column (≥1280px), adjustable via drag handle and expand/collapse buttons. */
export function SidePanel() {
  const tab = useUi((s) => s.panelTab);
  const openPanel = useUi((s) => s.openPanel);
  const rightPanelWidth = useAppearance((s) => s.rightPanelWidth);
  const rightPanelCollapsed = useAppearance((s) => s.rightPanelCollapsed);
  const setAppearance = useAppearance((s) => s.set);
  const [resizing, setResizing] = useState(false);
  const t = useT();

  const effectiveWidth = rightPanelCollapsed ? 68 : rightPanelWidth;
  const toggleCollapse = () => setAppearance({ rightPanelCollapsed: !rightPanelCollapsed });

  return (
    <aside
      style={{ width: `${effectiveWidth}px` }}
      className={cn(
        "island relative hidden shrink-0 xl:flex",
        !resizing && "transition-[width] duration-250 ease-out-expo",
      )}
      aria-label={t.nowPlaying.panel}
    >
      {/* Interactive Drag-to-Resize Handle on Left Edge of Right Sidebar */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Drag to resize right sidebar"
        title="Drag to resize right sidebar (double-click to collapse/expand)"
        onDoubleClick={toggleCollapse}
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          setResizing(true);
        }}
        onPointerMove={(e) => {
          if (!resizing) return;
          const nextWidth = window.innerWidth - e.clientX - 8;
          if (nextWidth < 140) {
            setAppearance({ rightPanelCollapsed: true });
          } else {
            setAppearance({
              rightPanelCollapsed: false,
              rightPanelWidth: Math.max(240, Math.min(560, nextWidth)),
            });
          }
        }}
        onPointerUp={() => setResizing(false)}
        onPointerCancel={() => setResizing(false)}
        className="group absolute top-3 bottom-3 -left-1.5 z-20 flex w-3 cursor-col-resize items-center justify-center select-none"
      >
        <span className="h-12 w-1 rounded-full bg-transparent transition-colors group-hover:bg-accent/60 group-active:bg-accent" />
      </div>

      <div className="island-core flex w-full flex-col overflow-hidden">
        {rightPanelCollapsed ? (
          <div className="flex h-full flex-col items-center gap-2 py-2.5">
            <button
              type="button"
              onClick={toggleCollapse}
              title="Expand right sidebar"
              aria-label="Expand right sidebar"
              className="grid size-8 place-items-center rounded-lg text-fg-2 transition-colors hover:bg-surface-3 hover:text-fg"
            >
              <SidebarSimpleIcon size={17} mirrored weight="regular" />
            </button>
            <div className="my-1 h-px w-7 bg-line" />
            <button
              type="button"
              onClick={() => {
                setAppearance({ rightPanelCollapsed: false });
                openPanel("playing");
              }}
              title={`${t.nowPlaying.tabPlaying} & ${t.player.queue}`}
              className={cn(
                "grid size-9 place-items-center rounded-[10px] transition-colors",
                tab === "playing" ? "bg-surface-3 text-accent-text" : "text-fg-2 hover:bg-surface-3/60 hover:text-fg",
              )}
            >
              <ListBulletsIcon size={19} weight={tab === "playing" ? "bold" : "regular"} />
            </button>
            <button
              type="button"
              onClick={() => {
                setAppearance({ rightPanelCollapsed: false });
                openPanel("lyrics");
              }}
              title={t.nowPlaying.tabLyrics}
              className={cn(
                "grid size-9 place-items-center rounded-[10px] transition-colors",
                tab === "lyrics" ? "bg-surface-3 text-accent-text" : "text-fg-2 hover:bg-surface-3/60 hover:text-fg",
              )}
            >
              <MicrophoneStageIcon size={19} weight={tab === "lyrics" ? "fill" : "regular"} />
            </button>
          </div>
        ) : (
          <>
            <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-line/60 px-3">
              <PanelTabs tab={tab} onTab={openPanel} />
              <button
                type="button"
                onClick={toggleCollapse}
                title="Collapse right sidebar"
                aria-label="Collapse right sidebar"
                className="grid size-8 shrink-0 place-items-center rounded-lg text-fg-2 transition-colors hover:bg-surface-3 hover:text-fg"
              >
                <SidebarSimpleIcon size={17} mirrored weight="regular" />
              </button>
            </div>
            <div className={cn("scroll-area min-h-0 flex-1 px-2 pt-2", tab === "lyrics" ? "flex flex-col overflow-hidden" : "overflow-y-auto")}>
              <PanelBody tab={tab} slot={SLOT.panel} />
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

/** Same content as an overlay drawer for tablets and small laptops (768-1279px). */
export function PanelDrawer() {
  const open = useUi((s) => s.drawerOpen);
  const tab = useUi((s) => s.panelTab);
  const openPanel = useUi((s) => s.openPanel);
  const close = useUi((s) => s.closePanel);
  const reduce = useReducedMotion();
  const t = useT();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40 hidden md:block xl:hidden">
          <motion.div className="absolute inset-0 bg-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />
          <motion.aside
            aria-label={t.nowPlaying.panel}
            data-escape-closes
            initial={reduce ? { opacity: 0 } : { x: "105%" }}
            animate={{ x: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { x: "105%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            className="island drawer-top absolute right-2 bottom-2 flex w-[380px] max-w-[calc(100vw-16px)]"
          >
            <div className="island-core flex w-full flex-col overflow-hidden">
              <div className="flex h-16 items-center justify-between px-3">
                <PanelTabs tab={tab} onTab={openPanel} />
                <IconButton label={t.common.close} size="sm" onClick={close}>
                  <XIcon size={18} />
                </IconButton>
              </div>
              <div className="scroll-area flex-1 overflow-y-auto px-2">
                <PanelBody tab={tab} slot={SLOT.panel} />
              </div>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

type SheetView = "player" | "lyrics" | "queue";

/** Small artwork (or the live video) + title row used at the top of the Lyrics and Queue views. */
function SheetMiniHeader({
  track,
  showsVideo,
  onVideoClick,
}: {
  track: Track;
  showsVideo: boolean;
  onVideoClick?: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-3 py-2">
      {showsVideo ? (
        <button
          type="button"
          onClick={onVideoClick}
          title="Switch to video player"
          className="w-28 shrink-0 overflow-hidden rounded-[8px] bg-black shadow-lg transition-transform active:scale-95"
        >
          <VideoSlot priority={SLOT.sheet} className="aspect-video w-full" />
        </button>
      ) : (
        <Artwork src={track.thumb} className="size-14 shrink-0 rounded-[8px] shadow-lg" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold tracking-tight text-fg">{track.title}</p>
        <p className="truncate text-[13px] text-fg-2">{track.artist}</p>
      </div>
      <FavoriteButton track={track} />
    </div>
  );
}

/** Full-screen Now Playing for phones (Apple Music style). Player stays fixed; lyrics and queue are separate views. */
export function NowPlayingSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const track = usePlayer(selectCurrent);
  const showsVideo = usePlayer((s) => s.mediaKind === "video");
  const aspect = usePlayer((s) => s.videoAspect);
  const preferVideo = usePlayer((s) => s.preferVideo);
  const setPreferVideo = usePlayer((s) => s.setPreferVideo);
  const status = usePlayer((s) => s.status);
  const statusText = useStatusText();
  const reduce = useReducedMotion();
  const drag = useDragControls();
  const [view, setView] = useState<SheetView>("player");
  const eqEnabled = useEqualizer((s) => s.enabled);
  const setEqualizerOpen = useUi((s) => s.setEqualizerOpen);
  const sceneStyle = useThemeStore((s) => s.sceneStyle);
  const t = useT();

  const toggleView = (v: SheetView) => setView((cur) => (cur === v ? "player" : v));

  return createPortal(
    <AnimatePresence onExitComplete={() => setView("player")}>
      {open && track && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={t.nowPlaying.title}
          initial={reduce ? { opacity: 0 } : { y: "100%" }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { y: "100%" }}
          transition={{ type: "spring", stiffness: 380, damping: 36 }}
          drag="y"
          dragListener={false}
          dragControls={drag}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.9 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 120 || info.velocity.y > 700) onClose();
          }}
          className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-bg md:hidden"
        >
          {/* Full-bleed world scene or Apple Music album blur */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            {sceneStyle !== "none" ? (
              <>
                <ThemeSceneBackdrop contained />
                <div className="absolute inset-0 bg-black/35" />
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-b from-transparent to-black/65" />
              </>
            ) : (
              <>
                <img src={track.thumb} alt="" className="absolute inset-0 size-full scale-150 object-cover opacity-70 blur-[70px] saturate-150" />
                <div className="absolute inset-0 bg-bg/55" />
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-b from-transparent to-bg/70" />
              </>
            )}
          </div>

          <div className="overlay-top relative flex min-h-0 flex-1 flex-col px-6 pb-[calc(12px+env(safe-area-inset-bottom))]">
            {/* Grabber: drag down to close */}
            <div className="flex h-12 shrink-0 touch-none items-center justify-between" onPointerDown={(e) => drag.start(e)}>
              <button
                type="button"
                onClick={onClose}
                aria-label={t.common.close}
                className="-ml-2 grid size-10 place-items-center rounded-full text-fg/80 active:bg-fg/10"
              >
                <CaretDownIcon size={22} weight="bold" />
              </button>
              <span className="h-1.5 w-10 rounded-full bg-fg/30" />
              <button
                type="button"
                onClick={() => setEqualizerOpen(true)}
                aria-label={t.player.equalizer}
                className={cn(
                  "-mr-2 grid size-10 place-items-center rounded-full active:bg-fg/10",
                  eqEnabled ? "text-accent-text" : "text-fg/80",
                )}
              >
                <EqualizerIcon size={21} weight={eqEnabled ? "fill" : "regular"} />
              </button>
            </div>

            {/* Middle: fixed artwork, or the lyrics / queue view. Never scrolls the player itself. */}
            {view === "player" ? (
              <div className="relative min-h-0 flex-1 [container-type:size]" onPointerDown={!showsVideo ? (e) => drag.start(e) : undefined}>
                <div className={cn("absolute inset-0 flex items-center justify-center", !showsVideo && "touch-none")}>
                  {showsVideo ? (
                    <WorldStageFrame scene={sceneStyle} playing={status === "playing"} className="w-full">
                      <div className="w-full overflow-hidden rounded-[inherit] bg-black shadow-[0_20px_50px_rgb(0_0_0/0.5)]">
                        <VideoSlot
                          priority={SLOT.sheet}
                          expandable
                          className="mx-auto max-h-[100cqh] w-full"
                          style={{ aspectRatio: Math.min(16 / 9, Math.max(9 / 16, aspect)) }}
                        />
                      </div>
                    </WorldStageFrame>
                  ) : (
                    <WorldStageFrame
                      scene={sceneStyle}
                      playing={status === "playing"}
                      className={cn(
                        "size-[min(86cqw,86cqh)] transition-transform duration-500 ease-out-expo",
                        status === "playing" ? "scale-100" : "scale-[0.88]",
                      )}
                    >
                      <Artwork
                        src={track.art}
                        fallback={track.thumb}
                        alt={t.nowPlaying.coverOf(track.title)}
                        iconSize={56}
                        className="size-full overflow-hidden rounded-[inherit] shadow-[0_24px_60px_rgb(0_0_0/0.5)]"
                      />
                    </WorldStageFrame>
                  )}
                </div>
              </div>
            ) : view === "lyrics" ? (
              <div className="flex min-h-0 flex-1 flex-col">
                {showsVideo ? (
                  <div className="shrink-0 pb-2">
                    <button
                      type="button"
                      onClick={() => setView("player")}
                      title="Switch to full video player"
                      className="group relative block w-full overflow-hidden rounded-2xl bg-black shadow-xl transition-transform active:scale-[0.98]"
                    >
                      <VideoSlot
                        priority={SLOT.sheet}
                        expandable
                        className="mx-auto max-h-[30dvh] w-full"
                        style={{ aspectRatio: Math.min(16 / 9, Math.max(9 / 16, aspect)) }}
                      />
                    </button>
                    <div className="mt-2 flex items-center gap-2 px-1">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold tracking-tight text-fg">{track.title}</p>
                        <p className="truncate text-[13px] text-fg-2">{track.artist}</p>
                      </div>
                      <FavoriteButton track={track} />
                    </div>
                  </div>
                ) : (
                  <SheetMiniHeader track={track} showsVideo={false} onVideoClick={() => setView("player")} />
                )}
                <LyricsView className="-mx-4 min-h-0 flex-1" />
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <SheetMiniHeader track={track} showsVideo={showsVideo} onVideoClick={() => setView("player")} />
                <div className="scroll-area -mx-4 min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pt-2">
                  <QueueList compact />
                </div>
              </div>
            )}

            {/* Bottom controls are always in the same place */}
            <div className="flex shrink-0 flex-col gap-3 pt-5">
              {view === "player" && (
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-[21px] leading-tight font-bold tracking-tight text-fg">{track.title}</h2>
                    <p className={cn("truncate text-[17px]", status === "error" ? "text-danger" : "text-fg-2")}>
                      {statusText ?? track.artist}
                    </p>
                  </div>
                  <OfflineButton track={track} />
                  <FavoriteButton track={track} />
                  <IconButton
                    label={t.trackList.moreFor(track.title)}
                    onClick={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      useUi.getState().openMenu({ track, x: r.right, y: r.bottom + 6 });
                    }}
                  >
                    <DotsThreeIcon size={22} weight="bold" />
                  </IconButton>
                </div>
              )}
              <Scrubber touch />
              <Transport big />
              <div className="flex items-center justify-around pt-1 text-fg/70">
                <button
                  type="button"
                  onClick={() => toggleView("lyrics")}
                  aria-pressed={view === "lyrics"}
                  aria-label={view === "lyrics" ? t.nowPlaying.backToPlayer : t.nowPlaying.showLyrics}
                  className={cn(
                    "grid size-11 place-items-center rounded-full transition-colors active:scale-95",
                    view === "lyrics" ? "bg-fg/15 text-fg" : "active:bg-fg/10",
                  )}
                >
                  <MicrophoneStageIcon size={22} weight={view === "lyrics" ? "fill" : "regular"} />
                </button>
                {capabilities.video && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = !preferVideo;
                      setPreferVideo(next);
                      if (next) setView("player");
                    }}
                    aria-pressed={preferVideo}
                    aria-label={t.player.video}
                    className={cn(
                      "grid size-11 place-items-center rounded-full transition-colors active:scale-95",
                      preferVideo ? "bg-fg/15 text-fg" : "active:bg-fg/10",
                    )}
                  >
                    <VideoCameraIcon size={22} weight={preferVideo ? "fill" : "regular"} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => toggleView("queue")}
                  aria-pressed={view === "queue"}
                  aria-label={t.player.queue}
                  className={cn(
                    "grid size-11 place-items-center rounded-full transition-colors active:scale-95",
                    view === "queue" ? "bg-fg/15 text-fg" : "active:bg-fg/10",
                  )}
                >
                  <QueueIcon size={22} weight={view === "queue" ? "bold" : "regular"} />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
