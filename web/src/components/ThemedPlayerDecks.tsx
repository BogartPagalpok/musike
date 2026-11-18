import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { useNavigate } from "react-router";
import { cn, formatTime as formatDuration } from "../lib/format";
import { paths } from "../lib/routes";
import type { Track } from "../lib/types";
import { readEqSpectrum, useEqualizer } from "../player/equalizer";
import { usePlayer } from "../player/player";
import { type SceneStyle } from "../stores/themeStore";
import { toast, useUi } from "../stores/ui";
import { Artwork } from "./Artwork";
import { FavoriteButton } from "./Controls";
import {
  DotsThreeIcon,
  EqualizerIcon,
  HouseIcon,
  ListBulletsIcon,
  MagnifyingGlassIcon,
  MicrophoneStageIcon,
  MusicNotesIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  QueueIcon,
  RepeatIcon,
  RepeatOnceIcon,
  ShuffleIcon,
  SkipBackIcon,
  SkipForwardIcon,
  VideoCameraIcon,
} from "./icons";
import { fetchLyricsFor, type LyricsData } from "./Lyrics";
import { SLOT, VideoSlot } from "./Video";

interface DeckProps {
  scene: SceneStyle;
  track: Track;
  slot?: number;
  compact?: boolean;
  onOpenLyrics?: () => void;
  onOpenQueue?: () => void;
}

export function isBespokeDeckScene(scene: SceneStyle): boolean {
  return scene === "cassette" || scene === "mirrorflame" || scene === "sandtopo";
}

export function ThemedPlayerDeck(props: DeckProps) {
  if (props.scene === "cassette") return <CassetteDeck {...props} />;
  if (props.scene === "mirrorflame") return <MirrorFlameDeck {...props} />;
  if (props.scene === "sandtopo") return <SandTopoDeck {...props} />;
  return null;
}

/** Smooth pointer-capture scrub helper for custom deck progress bars (supports both click & drag without sheet scroll). */
function useDeckScrubber(duration: number, seek: (sec: number) => void) {
  const [scrubSec, setScrubSec] = useState<number | null>(null);

  const bind = {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
      const calc = (clientX: number) => {
        const rect = el.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(1, rect.width)));
        return ratio * Math.max(1, duration);
      };
      setScrubSec(calc(e.clientX));

      const onMove = (ev: globalThis.PointerEvent) => {
        setScrubSec(calc(ev.clientX));
      };
      const onUp = (ev: globalThis.PointerEvent) => {
        const target = calc(ev.clientX);
        setScrubSec(null);
        seek(target);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
  };

  return { scrubSec, bind };
}

function openTrackMenuAt(e: MouseEvent<HTMLElement>, track: Track) {
  e.stopPropagation();
  const r = e.currentTarget.getBoundingClientRect();
  useUi.getState().openMenu({
    track,
    x: Math.max(12, Math.min(window.innerWidth - 220, r.right - 180)),
    y: Math.min(window.innerHeight - 260, r.bottom + 6),
  });
}

function smartNext(track: Track) {
  const s = usePlayer.getState();
  if (s.index < s.queue.length - 1 || (s.repeat === "all" && s.queue.length > 1)) {
    s.next();
  } else {
    void s.startRadio(track);
  }
}

/* ================================================================================================
 * 1. BAINIL RETRO CASSETTE RECORDER DECK (Matches Image 1)
 * ============================================================================================== */

function PhillipsScrew({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-5 place-items-center rounded-full border border-[#5e6268] bg-gradient-to-b from-[#c8c4b7] to-[#9b978a] shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),0_1px_2px_rgba(0,0,0,0.35)]",
        className,
      )}
    >
      <svg viewBox="0 0 12 12" className="size-3 text-[#4d5157]">
        <path d="M3 6h6M6 3v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function TapeReel({ spinning, fillRatio }: { spinning: boolean; fillRatio: number }) {
  const tapeRadius = 12 + Math.round(fillRatio * 10);
  return (
    <div className="relative grid size-14 place-items-center">
      <div
        className="rounded-full bg-[#24211e] transition-[width,height] duration-300"
        style={{ width: `${tapeRadius * 2}px`, height: `${tapeRadius * 2}px` }}
      />
      <svg
        viewBox="0 0 48 48"
        className={cn(
          "absolute size-11 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]",
          spinning && "animate-[spin_3.2s_linear_infinite]",
        )}
      >
        <circle cx="24" cy="24" r="19" fill="#dcdad3" stroke="#53565c" strokeWidth="2.5" />
        <circle cx="24" cy="24" r="13" fill="#2c2f35" />
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <rect
            key={deg}
            x="22.4"
            y="8"
            width="3.2"
            height="6.2"
            rx="1"
            fill="#efede6"
            transform={`rotate(${deg} 24 24)`}
          />
        ))}
        <circle cx="24" cy="24" r="5.5" fill="#d4d2ca" />
      </svg>
    </div>
  );
}

function CassetteDeck({ track, slot = SLOT.sheet, compact, onOpenLyrics, onOpenQueue }: DeckProps) {
  const status = usePlayer((s) => s.status);
  const showsVideo = usePlayer((s) => s.mediaKind === "video");
  const preferVideo = usePlayer((s) => s.preferVideo);
  const setPreferVideo = usePlayer((s) => s.setPreferVideo);
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration) || track.duration || 1;
  const shuffle = usePlayer((s) => s.shuffle);
  const toggleShuffle = usePlayer((s) => s.toggleShuffle);
  const toggle = usePlayer((s) => s.toggle);
  const pause = usePlayer((s) => s.pause);
  const seek = usePlayer((s) => s.seek);
  const prev = usePlayer((s) => s.prev);
  const openAddToPlaylist = useUi((s) => s.openAddToPlaylist);

  const isPlaying = status === "playing";
  const pct = Math.min(1, Math.max(0, position / Math.max(1, duration)));
  const counterDigits = String(Math.floor(position) % 1000).padStart(3, "0");

  return (
    <div
      className={cn(
        "relative mx-auto flex w-full max-w-[420px] flex-col justify-between overflow-hidden rounded-[24px] border-2 border-[#4d5158]/45 px-4 py-4 text-[#3b3e44] select-none",
        compact ? "gap-3" : "h-full max-h-[690px] gap-3.5",
      )}
      style={{
        background: "linear-gradient(180deg, #e2ddd0 0%, #d6d0be 52%, #cbc5b2 100%)",
        boxShadow: "inset 0 2px 1px rgba(255,255,255,0.65), 0 18px 42px rgba(28,26,20,0.32)",
      }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
        <div className="flex h-4 w-36 items-center justify-center rounded-b-2xl bg-[#555b62] shadow-inner">
          <span className="h-[2px] w-7 rounded-full bg-[#b8bcc2]" />
        </div>
      </div>
      <PhillipsScrew className="absolute top-2.5 left-2.5" />
      <PhillipsScrew className="absolute top-2.5 right-2.5" />
      <PhillipsScrew className="absolute bottom-2.5 left-2.5" />
      <PhillipsScrew className="absolute bottom-2.5 right-2.5" />

      {/* Perforated Circular Speaker Grille Matrix */}
      <div className="mx-auto mt-3 flex w-full max-w-[310px] flex-col items-center gap-[6px] py-1">
        {Array.from({ length: compact ? 6 : 9 }).map((_, row) => {
          const inset = row === 0 || row === (compact ? 5 : 8);
          const cols = inset ? 15 : 17;
          return (
            <div key={row} className="flex items-center justify-center gap-[8px]">
              {Array.from({ length: cols }).map((__, col) => (
                <span
                  key={col}
                  className="size-[6px] rounded-full bg-[#3a3832] shadow-[0_1px_0_rgba(255,255,255,0.65)]"
                />
              ))}
            </div>
          );
        })}
      </div>

      {/* RANDOM Mechanical Slide Switch + Quick Action Strip */}
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={toggleShuffle}
          aria-pressed={shuffle}
          className="group flex cursor-pointer flex-col items-start gap-1"
        >
          <span className="flex h-5 w-12 items-center rounded-[4px] border border-[#22252a] bg-[#141619] p-0.5 shadow-[inset_0_2px_3px_rgba(0,0,0,0.85)]">
            <span
              className={cn(
                "h-3.5 w-5 rounded-[2px] bg-gradient-to-b from-[#8f949c] to-[#5e636b] shadow transition-transform duration-150",
                shuffle ? "translate-x-5 ring-1 ring-amber-300/70" : "translate-x-0",
              )}
            />
          </span>
          <span className="text-[10px] font-extrabold tracking-wider text-[#5b5e63]">
            RANDOM {shuffle ? "ON" : "OFF"}
          </span>
        </button>

        <div className="flex items-center gap-1">
          <FavoriteButton track={track} size="sm" />
          <button
            type="button"
            onClick={() => openAddToPlaylist([track])}
            aria-label="Add to playlist"
            title="Add to playlist"
            className="grid size-7 cursor-pointer place-items-center rounded-md border border-[#4a4e55]/40 bg-[#cbc5b2] text-[#35383e] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] active:translate-y-px"
          >
            <PlusIcon size={13} weight="bold" />
          </button>
          {onOpenLyrics && (
            <button
              type="button"
              onClick={onOpenLyrics}
              className="cursor-pointer rounded-md border border-[#4a4e55]/40 bg-[#cbc5b2] px-2 py-1 text-[10px] font-extrabold tracking-wider text-[#35383e] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] active:translate-y-px"
            >
              LYRICS
            </button>
          )}
          {onOpenQueue && (
            <button
              type="button"
              onClick={onOpenQueue}
              className="cursor-pointer rounded-md border border-[#4a4e55]/40 bg-[#484d54] px-2 py-1 text-[10px] font-extrabold tracking-wider text-white shadow active:translate-y-px"
            >
              QUEUE
            </button>
          )}
          <button
            type="button"
            onClick={(e) => openTrackMenuAt(e, track)}
            aria-label="More track options"
            title="More options"
            className="grid size-7 cursor-pointer place-items-center rounded-md border border-[#4a4e55]/40 bg-[#cbc5b2] text-[#35383e] active:translate-y-px"
          >
            <DotsThreeIcon size={15} weight="bold" />
          </button>
        </div>
      </div>

      {/* Recessed Cassette Door & Live Tape Window */}
      <div className="relative rounded-[14px] border-[2.5px] border-[#1f2125] bg-gradient-to-b from-[#dad5c5] to-[#cbc5b2] p-3 shadow-[inset_0_2px_4px_rgba(255,255,255,0.6),0_4px_12px_rgba(0,0,0,0.22)]">
        {/* Right-edge MAIN / VIDEO hardware tab from Image 1 */}
        <button
          type="button"
          onClick={() => setPreferVideo(!preferVideo)}
          title={preferVideo ? "Switch to Cassette Tape View" : "Switch to Music Video"}
          className="absolute top-1/2 -right-3 z-20 -translate-y-1/2 cursor-pointer rounded-l-md border border-[#32363d] bg-[#4c5158] px-1.5 py-2.5 text-[9px] font-extrabold tracking-widest text-white shadow [writing-mode:vertical-rl]"
        >
          {preferVideo ? "TAPE" : "VIDEO"}
        </button>

        {showsVideo ? (
          <div className="overflow-hidden rounded-[10px] border-2 border-[#3b3f45] bg-black">
            <VideoSlot priority={slot} expandable className="aspect-video w-full" />
          </div>
        ) : (
          <div
            className="relative overflow-hidden rounded-[10px] border-[3px] border-[#484c52] bg-[#f8f7f3] px-3 py-3 shadow-inner"
            style={{
              clipPath: "polygon(6% 0%, 94% 0%, 100% 14%, 100% 100%, 0% 100%, 0% 14%)",
            }}
          >
            <Artwork
              src={track.art}
              fallback={track.thumb}
              className="pointer-events-none absolute inset-0 size-full object-cover opacity-18 grayscale contrast-125"
            />
            <div className="relative z-10 flex flex-col items-center gap-2.5">
              <div className="w-full rounded-[5px] bg-[#1e2024]/88 px-2.5 py-1 text-center shadow">
                <p className="truncate text-xs font-bold tracking-tight text-white">
                  {track.artist} — {track.title}
                </p>
              </div>

              <div className="flex w-full items-center justify-around rounded-full border border-[#8f9298] bg-gradient-to-b from-[#d4d3ce] to-[#b5b4ae] px-2 py-1 shadow-inner">
                <TapeReel spinning={isPlaying} fillRatio={1 - pct * 0.75} />

                <div className="flex flex-col items-center">
                  <div className="relative h-7 w-16 overflow-hidden rounded-[3px] border border-[#3a3d42] bg-[#15171a]">
                    <div
                      className="absolute inset-y-0 right-0 bg-gradient-to-l from-[#3c342e] to-[#231f1c]"
                      style={{ width: `${Math.round((1 - pct) * 75 + 15)}%` }}
                    />
                  </div>
                  <div className="mt-0.5 flex w-16 justify-between font-mono text-[8.5px] font-bold text-[#3b3e44]">
                    <span>100</span>
                    <span>50</span>
                    <span>0</span>
                  </div>
                </div>

                <TapeReel spinning={isPlaying} fillRatio={0.25 + pct * 0.75} />
              </div>

              <div className="flex w-full items-center gap-2.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => seek(0)}
                  title="Reset tape counter to 000"
                  className="flex cursor-pointer items-center gap-0.5 rounded-[4px] border-2 border-[#45494f] bg-[#16181c] px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-widest text-white shadow-inner"
                >
                  {counterDigits.split("").map((d, idx) => (
                    <span key={idx} className="inline-block w-3 bg-[#22262c] text-center">
                      {d}
                    </span>
                  ))}
                </button>
                <input
                  type="range"
                  min={0}
                  max={Math.max(1, Math.floor(duration))}
                  value={Math.min(Math.floor(duration), Math.floor(position))}
                  onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => seek(Number(e.target.value))}
                  aria-label="Tape position"
                  className="h-2 min-w-0 flex-1 cursor-pointer touch-none accent-[#3b3f46]"
                />
                <span className="font-mono text-[10px] font-bold text-[#44484f] tabular-nums">
                  {formatDuration(position)}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[#66696e]">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 6 C 8 11, 16 11, 20 6" strokeLinecap="round" />
            <path d="M4 18 C 8 13, 16 13, 20 18" strokeLinecap="round" />
          </svg>
          <span className="text-sm font-medium tracking-tight">bainil</span>
        </div>
      </div>

      {/* 5 Chunky Mechanical Piano-Key Transport Buttons */}
      <div className="pb-1">
        <div className="mb-1.5 grid grid-cols-5 text-center text-[10px] font-bold tracking-wider text-[#5b5e64]">
          <span>STOP</span>
          <span>PLAY</span>
          <span>PAUSE</span>
          <span>REW</span>
          <span>FF</span>
        </div>
        <div className="grid grid-cols-5 gap-1 rounded-[10px] bg-[#111316] p-1.5 shadow-[inset_0_3px_6px_rgba(0,0,0,0.9)]">
          {[
            {
              id: "stop",
              label: "Stop",
              active: !isPlaying && position === 0,
              onClick: () => {
                pause();
                seek(0);
              },
              icon: <span className="block size-3.5 rounded-[2px] bg-[#36393f]" />,
            },
            {
              id: "play",
              label: isPlaying ? "Pause" : "Play",
              active: isPlaying,
              onClick: () => toggle(),
              icon: <PlayIcon size={16} weight="fill" className="translate-x-[1px] text-[#34373d]" />,
            },
            {
              id: "pause",
              label: isPlaying ? "Pause" : "Resume",
              active: !isPlaying && position > 0,
              onClick: () => toggle(),
              icon: <PauseIcon size={15} weight="fill" className="text-[#34373d]" />,
            },
            {
              id: "rew",
              label: "Previous or Rewind",
              active: false,
              onClick: prev,
              icon: <SkipBackIcon size={16} weight="fill" className="text-[#34373d]" />,
            },
            {
              id: "ff",
              label: "Next Track",
              active: false,
              onClick: () => smartNext(track),
              icon: <SkipForwardIcon size={16} weight="fill" className="text-[#34373d]" />,
            },
          ].map((btn) => (
            <button
              key={btn.id}
              type="button"
              aria-label={btn.label}
              onClick={btn.onClick}
              className={cn(
                "flex h-16 cursor-pointer flex-col items-center justify-between rounded-[6px] border border-[#2b2e34] py-3 transition-transform duration-150 active:translate-y-1",
                btn.active
                  ? "translate-y-1 bg-gradient-to-b from-[#555960] to-[#3f434a] shadow-[inset_0_3px_6px_rgba(0,0,0,0.55)]"
                  : "bg-gradient-to-b from-[#787c84] via-[#676b73] to-[#4f535a] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_4px_rgba(0,0,0,0.6)]",
              )}
            >
              <span className="grid flex-1 place-items-center">{btn.icon}</span>
              <span className="flex items-center gap-[3px]">
                {[0, 1, 2, 3, 4].map((dot) => (
                  <span key={dot} className="size-[3px] rounded-full bg-[#35383f] shadow-[0_1px_0_rgba(255,255,255,0.25)]" />
                ))}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================================================================================================
 * 2. MIRROR FLAME DARK ROTARY STUDIO CONSOLE (Matches Image 2)
 * ============================================================================================== */

type FlameMode = "vocal" | "lyric" | "bass" | "smooth";

function MirrorFlameDeck({ track, slot = SLOT.sheet, compact, onOpenLyrics, onOpenQueue }: DeckProps) {
  const navigate = useNavigate();
  const status = usePlayer((s) => s.status);
  const showsVideo = usePlayer((s) => s.mediaKind === "video");
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration) || track.duration || 1;
  const volume = usePlayer((s) => s.volume);
  const setVolume = usePlayer((s) => s.setVolume);
  const shuffle = usePlayer((s) => s.shuffle);
  const toggleShuffle = usePlayer((s) => s.toggleShuffle);
  const toggle = usePlayer((s) => s.toggle);
  const pause = usePlayer((s) => s.pause);
  const seek = usePlayer((s) => s.seek);
  const prev = usePlayer((s) => s.prev);

  const eqEnabled = useEqualizer((s) => s.enabled);
  const bassBoost = useEqualizer((s) => s.bassBoost);
  const clarity = useEqualizer((s) => s.clarity);
  const setBassBoost = useEqualizer((s) => s.setBassBoost);
  const setClarity = useEqualizer((s) => s.setClarity);
  const setPreset = useEqualizer((s) => s.setPreset);
  const setEqualizerOpen = useUi((s) => s.setEqualizerOpen);

  const [mode, setMode] = useState<FlameMode>("lyric");
  const [lyrics, setLyrics] = useState<LyricsData | "none" | null>(null);
  const [bars, setBars] = useState<number[]>(() =>
    Array.from({ length: 29 }, (_, i) => 0.22 + Math.sin(i * 0.45) * 0.14),
  );
  const knobRef = useRef<HTMLDivElement>(null);
  const { scrubSec, bind: scrubBind } = useDeckScrubber(duration, seek);

  const isPlaying = status === "playing";
  const shownPos = scrubSec ?? position;
  const pct = Math.min(100, Math.max(0, (shownPos / Math.max(1, duration)) * 100));

  useEffect(() => {
    let cancelled = false;
    void fetchLyricsFor(track).then((res) => {
      if (!cancelled) setLyrics(res);
    });
    return () => {
      cancelled = true;
    };
  }, [track.id]);

  useEffect(() => {
    if (!isPlaying) return;
    const buf = new Uint8Array(64);
    let raf = 0;
    let tick = 0;
    const step = () => {
      raf = requestAnimationFrame(step);
      if (tick++ % 3 !== 0) return;
      const hasLive = readEqSpectrum(buf);
      const nextBars = Array.from({ length: 29 }, (_, i) => {
        if (hasLive) {
          const v = buf[Math.min(buf.length - 1, i + 2)] / 255;
          if (v > 0.03) return Math.max(0.14, Math.min(1, v * 1.15));
        }
        const t = performance.now() / 220;
        const env = 1 - Math.abs(i - 14) / 16;
        return Math.max(0.14, Math.min(1, (0.35 + 0.45 * Math.abs(Math.sin(t + i * 0.55))) * env + 0.12));
      });
      setBars(nextBars);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  const activeLyric = useMemo(() => {
    if (!lyrics || lyrics === "none") return `${track.title} · ${track.artist}`;
    if (lyrics.synced.length > 0) {
      let line = lyrics.synced[0]?.text ?? track.title;
      for (const l of lyrics.synced) {
        if (l.time <= position + 0.25) line = l.text || line;
        else break;
      }
      return line;
    }
    return lyrics.plain.find(Boolean) ?? `${track.title} · ${track.artist}`;
  }, [lyrics, position, track.title, track.artist]);

  const lyricWords = activeLyric.trim().split(/\s+/);
  const splitAt = Math.max(1, Math.ceil(lyricWords.length * 0.48));
  const litHalf = lyricWords.slice(0, splitAt).join(" ");
  const dimHalf = lyricWords.slice(splitAt).join(" ");

  const selectMode = (m: FlameMode) => {
    setMode(m);
    if (m === "vocal") {
      setPreset("vocal");
      toast("Vocal clarity EQ enabled");
    } else if (m === "bass") {
      setPreset("bassBoost");
      toast("Bass Boost EQ enabled");
    } else if (m === "smooth") {
      setPreset("acoustic");
      toast("Smooth Acoustic EQ enabled");
    } else if (m === "lyric") {
      onOpenLyrics?.();
    }
  };

  const handleKnobPointer = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const el = knobRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    const updateVol = (clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const deg = (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI;
      const shifted = (deg + 225 + 360) % 360;
      const clamped = Math.max(0, Math.min(270, shifted > 315 ? 0 : shifted));
      setVolume(clamped / 270);
    };
    updateVol(e.clientX, e.clientY);
    const onMove = (ev: globalThis.PointerEvent) => updateVol(ev.clientX, ev.clientY);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const r = 64;
  const circ = 2 * Math.PI * r;
  const arcLen = circ * 0.75;
  const filledArc = arcLen * volume;
  const knobDeg = -135 + volume * 270;

  return (
    <div
      className={cn(
        "relative mx-auto flex w-full max-w-[420px] flex-col justify-between overflow-hidden rounded-[24px] border border-white/10 px-4 py-4 text-white select-none",
        compact ? "gap-3" : "h-full max-h-[690px] gap-3.5",
      )}
      style={{
        background:
          "radial-gradient(circle at 35% 38%, rgba(255,115,0,0.12), transparent 52%), radial-gradient(circle at 75% 44%, rgba(184,255,44,0.1), transparent 50%), linear-gradient(180deg, #202227 0%, #15171b 60%, #101215 100%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12), 0 22px 48px rgba(0,0,0,0.75)",
      }}
    >
      {/* Top Studio Header Bar (Search + Favorite + Queue/Menu matching Image 2) */}
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => navigate(paths.search)}
          aria-label="Search music"
          title="Search"
          className="grid size-8 cursor-pointer place-items-center rounded-full text-white/75 transition-colors duration-150 hover:bg-[#252830] hover:text-white"
        >
          <MagnifyingGlassIcon size={17} />
        </button>
        <div className="flex items-center gap-1">
          <FavoriteButton track={track} size="sm" />
          {onOpenQueue && (
            <button
              type="button"
              onClick={onOpenQueue}
              aria-label="Open queue"
              title="Queue"
              className="grid size-8 cursor-pointer place-items-center rounded-full text-white/75 transition-colors duration-150 hover:bg-[#252830] hover:text-white"
            >
              <QueueIcon size={17} />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => openTrackMenuAt(e, track)}
            aria-label="More options"
            title="Track options"
            className="grid size-8 cursor-pointer place-items-center rounded-full text-white/75 transition-colors duration-150 hover:bg-[#252830] hover:text-white"
          >
            <ListBulletsIcon size={18} />
          </button>
        </div>
      </div>

      {/* Top 4-Pill Mode Selector Bar (VOCAL · LYRIC · BASS · SMOOTH) */}
      <div className="grid grid-cols-4 gap-1.5 rounded-full border border-white/12 bg-[#111317] p-1.5 shadow-[inset_0_2px_6px_rgba(0,0,0,0.85)]">
        {(
          [
            ["vocal", "VOCAL"],
            ["lyric", "LYRIC"],
            ["bass", "BASS"],
            ["smooth", "SMOOTH"],
          ] as const
        ).map(([id, label]) => {
          const active = mode === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => selectMode(id)}
              className={cn(
                "h-7 cursor-pointer rounded-full text-[10.5px] font-extrabold tracking-wider transition-colors duration-150",
                active
                  ? "bg-gradient-to-b from-[#ff9824] to-[#ff5e00] text-[#1a0d00] shadow-[0_0_14px_rgba(255,122,0,0.65)]"
                  : "border border-white/8 bg-[#25282f] text-white/75 hover:text-white",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* High-Contrast Studio Title + Artist */}
      <div className="px-2 text-center">
        <h2 className={cn("truncate font-bold tracking-tight text-[#fff7ed]", compact ? "text-lg" : "text-xl")}>
          {track.title}
        </h2>
        <p className="mt-0.5 truncate text-xs font-medium text-[#ff9f43]">{track.artist}</p>
      </div>

      {/* Rotary Neon Volume Dial + Dual 20dB / 10dB Glowing Vertical Faders */}
      {showsVideo ? (
        <div className="overflow-hidden rounded-2xl border border-white/15 bg-black shadow-xl">
          <VideoSlot priority={slot} expandable className="aspect-video w-full" />
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 px-1 py-1">
          <div
            ref={knobRef}
            onPointerDown={handleKnobPointer}
            role="slider"
            aria-label="Master volume knob"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(volume * 100)}
            tabIndex={0}
            className="relative grid size-[162px] shrink-0 cursor-grab touch-none place-items-center active:cursor-grabbing"
          >
            <svg viewBox="0 0 160 160" className="pointer-events-none absolute inset-0 size-full">
              <defs>
                <linearGradient id="flameDialGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ff5e00" />
                  <stop offset="55%" stopColor="#ffc400" />
                  <stop offset="100%" stopColor="#b8ff2c" />
                </linearGradient>
              </defs>
              <circle
                cx="80"
                cy="80"
                r={r}
                fill="none"
                stroke="#0c0d10"
                strokeWidth="10"
                strokeDasharray={`${arcLen} ${circ}`}
                strokeLinecap="round"
                transform="rotate(135 80 80)"
              />
              <circle
                cx="80"
                cy="80"
                r={r}
                fill="none"
                stroke="url(#flameDialGrad)"
                strokeWidth="7"
                strokeDasharray={`${filledArc} ${circ}`}
                strokeLinecap="round"
                transform="rotate(135 80 80)"
                style={{ filter: "drop-shadow(0 0 7px rgba(255, 166, 0, 0.7))" }}
              />
            </svg>

            <div
              className="relative grid size-[104px] place-items-center rounded-full border border-white/15 bg-gradient-to-b from-[#454952] to-[#23262c] shadow-[0_12px_24px_rgba(0,0,0,0.75),inset_0_1px_1px_rgba(255,255,255,0.25)]"
              style={{ transform: `rotate(${knobDeg}deg)` }}
            >
              <span className="absolute top-3 size-3 rounded-full bg-[#1a1c20] shadow-[inset_0_1px_2px_rgba(0,0,0,0.9)]" />
            </div>
            <span className="pointer-events-none absolute bottom-0.5 font-mono text-[10px] font-bold text-white/60 tabular-nums">
              VOL {Math.round(volume * 100)}%
            </span>
          </div>

          <div className="flex flex-1 items-center justify-around gap-3 pr-1">
            {[
              {
                label: "20 dB",
                sub: "BASS",
                val: bassBoost,
                setVal: setBassBoost,
                color: "#ff7a00",
                glow: "rgba(255,122,0,0.75)",
              },
              {
                label: "10 dB",
                sub: "AIR",
                val: clarity,
                setVal: setClarity,
                color: "#a8ff2e",
                glow: "rgba(168,255,46,0.75)",
              },
            ].map((fader) => {
              const fPct = Math.min(100, Math.max(0, (fader.val / 12) * 100));
              return (
                <div key={fader.label} className="flex flex-col items-center gap-1">
                  <span className="font-mono text-[10px] font-bold text-white/75">{fader.label}</span>
                  <div
                    role="slider"
                    aria-label={`${fader.sub} fader`}
                    aria-valuemin={0}
                    aria-valuemax={12}
                    aria-valuenow={fader.val}
                    tabIndex={0}
                    className="relative flex h-34 w-8 cursor-pointer touch-none justify-center"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const el = e.currentTarget;
                      el.setPointerCapture(e.pointerId);
                      const calc = (cy: number) => {
                        const rect = el.getBoundingClientRect();
                        const ratio = 1 - Math.min(1, Math.max(0, (cy - rect.top) / Math.max(1, rect.height)));
                        fader.setVal(Math.round(ratio * 24) / 2);
                      };
                      calc(e.clientY);
                      const move = (ev: globalThis.PointerEvent) => calc(ev.clientY);
                      const up = () => {
                        window.removeEventListener("pointermove", move);
                        window.removeEventListener("pointerup", up);
                        window.removeEventListener("pointercancel", up);
                      };
                      window.addEventListener("pointermove", move);
                      window.addEventListener("pointerup", up);
                      window.addEventListener("pointercancel", up);
                    }}
                  >
                    <div className="pointer-events-none absolute inset-y-1 right-0 flex flex-col justify-between">
                      {Array.from({ length: 8 }).map((_, idx) => (
                        <span key={idx} className="h-px w-1.5 bg-zinc-600" />
                      ))}
                    </div>
                    <div className="relative h-full w-1.5 overflow-hidden rounded-full bg-[#090a0d] shadow-inner">
                      <div
                        className="absolute inset-x-0 bottom-0 rounded-full"
                        style={{
                          height: `${fPct}%`,
                          backgroundColor: fader.color,
                          boxShadow: `0 0 10px ${fader.glow}`,
                        }}
                      />
                    </div>
                    <div
                      className="pointer-events-none absolute left-1/2 flex h-4 w-6 -translate-x-1/2 flex-col items-center justify-center gap-[2px] rounded-[4px] border border-white/20 bg-gradient-to-b from-[#555963] to-[#2a2d34] shadow-[0_3px_8px_rgba(0,0,0,0.8)]"
                      style={{ bottom: `calc(${fPct}% - 8px)` }}
                    >
                      <span className="h-px w-3.5 bg-zinc-400" />
                      <span className="h-px w-3.5 bg-black/60" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Synced Lyric Capsule */}
      <button
        type="button"
        onClick={() => onOpenLyrics?.()}
        className="w-full cursor-pointer rounded-[14px] border border-white/12 bg-[#111317]/92 px-3.5 py-2.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_6px_18px_rgba(0,0,0,0.45)] transition-colors duration-150 hover:border-orange-400/45"
      >
        <p className="truncate text-[13px] font-bold">
          <span className="text-[#ffad29]">{litHalf}</span>
          {dimHalf ? <span className="text-white/50"> {dimHalf}</span> : null}
        </p>
      </button>

      {/* Orange-to-Lime Vertical Bar Waveform Visualizer */}
      <div className="flex h-7 items-center justify-center gap-[3.5px] px-3" aria-hidden="true">
        {bars.map((v, i) => {
          const ratio = i / (bars.length - 1);
          const color = ratio < 0.45 ? "#ff7a00" : ratio < 0.72 ? "#ffd000" : "#b8ff2c";
          return (
            <span
              key={i}
              className="w-[3px] rounded-full transition-[height] duration-150"
              style={{
                height: `${Math.max(4, Math.round(v * 26))}px`,
                backgroundColor: color,
                boxShadow: isPlaying ? `0 0 6px ${color}66` : undefined,
              }}
            />
          );
        })}
      </div>

      {/* Studio Transport Row: Equalizer · Prev · Play/Pause · Stop · Next · Shuffle */}
      <div className="flex items-center justify-center gap-2.5">
        <button
          type="button"
          onClick={() => setEqualizerOpen(true)}
          aria-label="Studio Equalizer"
          title="Studio Equalizer"
          className={cn(
            "grid size-10 cursor-pointer place-items-center rounded-full border bg-gradient-to-b from-[#252830] to-[#14161b] shadow-[0_6px_14px_rgba(0,0,0,0.65)] active:scale-95",
            eqEnabled ? "border-[#ff8800]/70 text-[#ff8800]" : "border-white/12 text-white/75 hover:text-white",
          )}
        >
          <EqualizerIcon size={16} weight={eqEnabled ? "fill" : "regular"} />
        </button>

        <button
          type="button"
          onClick={prev}
          aria-label="Previous"
          title="Previous"
          className="grid size-10 cursor-pointer place-items-center rounded-full border border-white/12 bg-gradient-to-b from-[#252830] to-[#14161b] text-white/80 shadow-[0_6px_14px_rgba(0,0,0,0.65)] hover:text-white active:scale-95"
        >
          <SkipBackIcon size={15} weight="fill" />
        </button>

        <button
          type="button"
          onClick={toggle}
          aria-label={isPlaying ? "Pause" : "Play"}
          title={isPlaying ? "Pause" : "Play"}
          className="grid size-13 cursor-pointer place-items-center rounded-full border-2 border-[#ff8800] bg-gradient-to-b from-[#2a2d36] to-[#15171c] text-[#ff8800] shadow-[0_0_18px_rgba(255,136,0,0.42)] active:scale-95"
        >
          {isPlaying ? (
            <PauseIcon size={20} weight="fill" />
          ) : (
            <PlayIcon size={20} weight="fill" className="translate-x-[1.5px]" />
          )}
        </button>

        <button
          type="button"
          onClick={() => smartNext(track)}
          aria-label="Next"
          title="Next"
          className="grid size-10 cursor-pointer place-items-center rounded-full border border-white/12 bg-gradient-to-b from-[#252830] to-[#14161b] text-white/80 shadow-[0_6px_14px_rgba(0,0,0,0.65)] hover:text-white active:scale-95"
        >
          <SkipForwardIcon size={15} weight="fill" />
        </button>

        <button
          type="button"
          onClick={() => {
            pause();
            seek(0);
          }}
          aria-label="Stop and rewind"
          title="Stop"
          className="grid size-10 cursor-pointer place-items-center rounded-full border border-white/12 bg-gradient-to-b from-[#252830] to-[#14161b] text-white/75 shadow-[0_6px_14px_rgba(0,0,0,0.65)] hover:text-white active:scale-95"
        >
          <span className="size-3 rounded-[2px] border border-current" />
        </button>

        <button
          type="button"
          onClick={toggleShuffle}
          aria-label={shuffle ? "Disable shuffle" : "Enable shuffle"}
          title={shuffle ? "Shuffle On" : "Shuffle Off"}
          className={cn(
            "grid size-10 cursor-pointer place-items-center rounded-full border bg-gradient-to-b from-[#252830] to-[#14161b] shadow-[0_6px_14px_rgba(0,0,0,0.65)] active:scale-95",
            shuffle ? "border-[#b8ff2c]/70 text-[#b8ff2c]" : "border-white/12 text-white/75 hover:text-white",
          )}
        >
          <ShuffleIcon size={16} />
        </button>
      </div>

      {/* Glowing Lime-Green Drag-Scrubbable Progress Bar */}
      <div className="flex items-center gap-2.5 px-1 pt-0.5">
        <span className="w-9 font-mono text-[11px] font-semibold text-white/75 tabular-nums">{formatDuration(shownPos)}</span>
        <div
          role="slider"
          aria-label="Track progress"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(shownPos)}
          tabIndex={0}
          className="relative flex h-6 flex-1 cursor-pointer touch-none items-center"
          {...scrubBind}
        >
          <div className="h-1.5 w-full rounded-full bg-[#090a0d] shadow-inner">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#8be81b] to-[#c9ff3b]"
              style={{
                width: `${pct}%`,
                boxShadow: "0 0 10px rgba(184, 255, 44, 0.8)",
              }}
            />
          </div>
          <span
            className="pointer-events-none absolute grid size-4 -translate-x-1/2 place-items-center rounded-full border-2 border-[#5b626e] bg-[#20232a] shadow-[0_0_10px_rgba(184,255,44,0.85)]"
            style={{ left: `${pct}%` }}
          >
            <span className="size-1.5 rounded-full bg-[#c9ff3b]" />
          </span>
        </div>
        <span className="w-9 text-right font-mono text-[11px] font-semibold text-white/75 tabular-nums">
          {formatDuration(Math.max(0, duration - shownPos))}
        </span>
      </div>
    </div>
  );
}

/* ================================================================================================
 * 3. DESERT TOPO WARM SAND NEUMORPHIC CARD (Matches Image 3)
 * ============================================================================================== */

function SandTopoDeck({ track, slot = SLOT.sheet, compact, onOpenLyrics, onOpenQueue }: DeckProps) {
  const navigate = useNavigate();
  const status = usePlayer((s) => s.status);
  const showsVideo = usePlayer((s) => s.mediaKind === "video");
  const preferVideo = usePlayer((s) => s.preferVideo);
  const setPreferVideo = usePlayer((s) => s.setPreferVideo);
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration) || track.duration || 1;
  const repeat = usePlayer((s) => s.repeat);
  const shuffle = usePlayer((s) => s.shuffle);
  const toggleShuffle = usePlayer((s) => s.toggleShuffle);
  const toggle = usePlayer((s) => s.toggle);
  const prev = usePlayer((s) => s.prev);
  const seek = usePlayer((s) => s.seek);
  const cycleRepeat = usePlayer((s) => s.cycleRepeat);
  const setEqualizerOpen = useUi((s) => s.setEqualizerOpen);
  const openAddToPlaylist = useUi((s) => s.openAddToPlaylist);
  const { scrubSec, bind: scrubBind } = useDeckScrubber(duration, seek);

  const isPlaying = status === "playing";
  const shownPos = scrubSec ?? position;
  const pct = Math.min(100, Math.max(0, (shownPos / Math.max(1, duration)) * 100));
  const RepeatGlyph = repeat === "one" ? RepeatOnceIcon : RepeatIcon;

  return (
    <div className={cn("relative mx-auto flex w-full max-w-[400px] flex-col gap-3 select-none", !compact && "my-auto")}>
      {/* Main Raised Warm-Sand Neumorphic Card */}
      <div
        className="relative flex flex-col items-center rounded-[32px] px-6 py-5 text-[#5a4b31]"
        style={{
          background: "linear-gradient(160deg, #e5d5b5 0%, #dac7a1 100%)",
          boxShadow:
            "-10px -10px 28px rgba(255, 248, 229, 0.62), 14px 18px 34px rgba(96, 76, 42, 0.28), inset 0 1px 1px rgba(255, 250, 238, 0.7)",
        }}
      >
        {/* Interactive Octagonal Audio/Video & Equalizer Badges on Top-Right */}
        <div className="absolute -top-3 right-3 flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => setPreferVideo(!preferVideo)}
            aria-label={preferVideo ? "Switch to Audio Artwork" : "Switch to Music Video"}
            title={preferVideo ? "Switch to Audio Artwork" : "Switch to Music Video"}
            className="grid size-13 cursor-pointer place-items-center text-[#5c4d33] transition-transform duration-150 active:scale-95"
            style={{
              clipPath: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
              background: preferVideo
                ? "linear-gradient(145deg, #d7c39b, #c5ad80)"
                : "linear-gradient(145deg, #e8d9ba, #d2be96)",
              boxShadow: "0 8px 18px rgba(90, 72, 40, 0.28)",
            }}
          >
            {preferVideo ? <VideoCameraIcon size={21} weight="fill" /> : <MusicNotesIcon size={22} weight="fill" />}
          </button>
          <button
            type="button"
            onClick={() => setEqualizerOpen(true)}
            aria-label="Equalizer"
            title="Equalizer"
            className="grid size-10 cursor-pointer place-items-center text-[#5c4d33] transition-transform duration-150 active:scale-95"
            style={{
              clipPath: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
              background: "linear-gradient(145deg, #e8d9ba, #d2be96)",
            }}
          >
            <EqualizerIcon size={16} weight="fill" />
          </button>
        </div>

        {/* Top Header Row */}
        <div className="mb-3 flex w-full items-center justify-between pr-12">
          <button
            type="button"
            onClick={(e) => {
              if (onOpenQueue) onOpenQueue();
              else openTrackMenuAt(e, track);
            }}
            aria-label="Open queue"
            title="Scroll to Queue"
            className="grid size-9 cursor-pointer place-items-center rounded-full text-[#6b5b3e] transition-colors duration-150 hover:bg-black/6 active:scale-95"
          >
            <ListBulletsIcon size={20} weight="bold" />
          </button>
          <span className="text-[15px] font-bold tracking-tight text-[#6b5b3e]">Play Music</span>
          <span className="w-5" />
        </div>

        {/* Teardrop / Leaf-Cutout Cover Art Frame */}
        {showsVideo ? (
          <div className="my-1 w-full overflow-hidden rounded-2xl border-4 border-[#cfb98e] bg-black shadow-lg">
            <VideoSlot priority={slot} expandable className="aspect-video w-full" />
          </div>
        ) : (
          <div
            className={cn(
              "my-1 p-2.5 transition-transform duration-200",
              compact ? "size-40" : "size-48",
            )}
            style={{
              borderRadius: "50% 10px 50% 50%",
              background: "linear-gradient(145deg, #cfb98f, #e5d5b6)",
              boxShadow: "inset 4px 4px 10px rgba(96,77,45,0.22), inset -4px -4px 10px rgba(255,248,230,0.6)",
            }}
          >
            <Artwork
              src={track.art}
              fallback={track.thumb}
              className="size-full object-cover shadow-md"
              style={{ borderRadius: "50% 6px 50% 50%" }}
            />
          </div>
        )}

        {/* Centered Song Title & Artist */}
        <div className="mt-3 w-full px-2 text-center">
          <h2 className={cn("truncate font-extrabold tracking-tight text-[#53442b]", compact ? "text-lg" : "text-xl")}>
            {track.title}
          </h2>
          <p className="mt-0.5 truncate text-sm font-medium text-[#756344]">{track.artist}</p>
        </div>

        {/* Heart + Add-to-Playlist / Track Menu Row */}
        <div className="mt-2 flex w-full items-center justify-between px-1 text-[#6b5b3e]">
          <FavoriteButton track={track} size="sm" />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => openAddToPlaylist([track])}
              aria-label="Add to playlist"
              title="Add to playlist"
              className="grid size-8 cursor-pointer place-items-center rounded-full text-[#6b5b3e] transition-colors duration-150 hover:bg-black/6 active:scale-95"
            >
              <PlusIcon size={18} weight="bold" />
            </button>
            <button
              type="button"
              onClick={(e) => openTrackMenuAt(e, track)}
              aria-label="More track options"
              title="More options"
              className="grid size-8 cursor-pointer place-items-center rounded-full text-[#6b5b3e] transition-colors duration-150 hover:bg-black/6 active:scale-95"
            >
              <DotsThreeIcon size={18} weight="bold" />
            </button>
          </div>
        </div>

        {/* Tactile Thick Sand-Neumorphic Drag-Scrubbable Progress Bar */}
        <div className="mt-1 w-full">
          <div
            role="slider"
            aria-label="Track progress"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(shownPos)}
            tabIndex={0}
            className="relative flex h-6 w-full cursor-pointer touch-none items-center"
            {...scrubBind}
          >
            <div
              className="h-3 w-full overflow-hidden rounded-full"
              style={{
                background: "#e7d8ba",
                boxShadow: "inset 2px 2px 5px rgba(96,77,45,0.25), 0 2px 4px rgba(255,248,230,0.65)",
              }}
            >
              <div
                className="h-full rounded-full bg-[#776546]"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span
              className="pointer-events-none absolute size-6 -translate-x-1/2 rounded-full border-[2.5px] border-[#6b5b3e] bg-[#dfd0b1] shadow-[0_3px_8px_rgba(82,66,38,0.3)]"
              style={{ left: `${pct}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between font-mono text-[11px] font-semibold text-[#6b5b3e] tabular-nums">
            <span>{formatDuration(shownPos).replace(":", ".")}</span>
            <span>{formatDuration(duration).replace(":", ".")}</span>
          </div>
        </div>

        {/* 3 Embossed Soft-Neumorphic Circular Transport Buttons (Optically Centered Play Triangle!) */}
        <div className="mt-3 flex items-center justify-center gap-6">
          <button
            type="button"
            onClick={prev}
            aria-label="Previous"
            className="grid size-12 cursor-pointer place-items-center rounded-full border border-[#6b5b3e]/45 text-[#6b5b3e] transition-transform duration-150 active:scale-95"
            style={{
              background: "linear-gradient(145deg, #e7d8b9, #d1be97)",
              boxShadow: "-4px -4px 10px rgba(255,248,230,0.65), 5px 6px 12px rgba(92,74,42,0.26)",
            }}
          >
            <SkipBackIcon size={18} weight="fill" />
          </button>

          <button
            type="button"
            onClick={toggle}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="grid size-16 cursor-pointer place-items-center rounded-full p-2 text-[#5c4d33] transition-transform duration-150 active:scale-95"
            style={{
              background: "linear-gradient(145deg, #e7d8b9, #cfb98f)",
              boxShadow: "-6px -6px 14px rgba(255,248,230,0.7), 7px 9px 16px rgba(92,74,42,0.3)",
            }}
          >
            <span className="grid size-full place-items-center rounded-full border-2 border-[#6b5b3e]">
              {isPlaying ? (
                <PauseIcon size={22} weight="fill" />
              ) : (
                <PlayIcon size={22} weight="fill" className="translate-x-[1.5px]" />
              )}
            </span>
          </button>

          <button
            type="button"
            onClick={() => smartNext(track)}
            aria-label="Next"
            className="grid size-12 cursor-pointer place-items-center rounded-full border border-[#6b5b3e]/45 text-[#6b5b3e] transition-transform duration-150 active:scale-95"
            style={{
              background: "linear-gradient(145deg, #e7d8b9, #d1be97)",
              boxShadow: "-4px -4px 10px rgba(255,248,230,0.65), 5px 6px 12px rgba(92,74,42,0.26)",
            }}
          >
            <SkipForwardIcon size={18} weight="fill" />
          </button>
        </div>
      </div>

      {/* Floating Bottom Neumorphic Pill Dock (Repeat · Shuffle · Home · Lyrics · Queue — ALL Functional!) */}
      <div
        className="flex h-12 items-center justify-around rounded-full px-4 text-[#6b5b3e]"
        style={{
          background: "linear-gradient(160deg, #e4d4b4 0%, #d7c39d 100%)",
          boxShadow: "-6px -6px 16px rgba(255,248,230,0.55), 8px 10px 22px rgba(92,74,42,0.24)",
        }}
      >
        <button
          type="button"
          onClick={cycleRepeat}
          aria-label={`Repeat: ${repeat}`}
          title={`Repeat: ${repeat}`}
          className={cn(
            "grid size-9 cursor-pointer place-items-center rounded-full transition-colors duration-150 active:scale-95",
            repeat !== "off" ? "bg-[#6b5b3e]/18 text-[#463820]" : "hover:bg-black/5",
          )}
        >
          <RepeatGlyph size={18} weight={repeat !== "off" ? "bold" : "regular"} />
        </button>

        <button
          type="button"
          onClick={toggleShuffle}
          aria-label={shuffle ? "Shuffle On" : "Shuffle Off"}
          title={shuffle ? "Shuffle On" : "Shuffle Off"}
          className={cn(
            "grid size-9 cursor-pointer place-items-center rounded-full transition-colors duration-150 active:scale-95",
            shuffle ? "bg-[#6b5b3e]/18 text-[#463820]" : "hover:bg-black/5",
          )}
        >
          <ShuffleIcon size={18} weight={shuffle ? "bold" : "regular"} />
        </button>

        <button
          type="button"
          onClick={() => navigate(paths.home)}
          aria-label="Go to Home"
          title="Home"
          className="grid size-9 cursor-pointer place-items-center rounded-full transition-colors duration-150 hover:bg-black/5 active:scale-95"
        >
          <HouseIcon size={18} weight="fill" />
        </button>

        {onOpenLyrics && (
          <button
            type="button"
            onClick={onOpenLyrics}
            aria-label="Show synced lyrics"
            title="Lyrics"
            className="grid size-9 cursor-pointer place-items-center rounded-full transition-colors duration-150 hover:bg-black/5 active:scale-95"
          >
            <MicrophoneStageIcon size={18} />
          </button>
        )}

        <button
          type="button"
          onClick={(e) => {
            if (onOpenQueue) onOpenQueue();
            else openTrackMenuAt(e, track);
          }}
          aria-label="Open queue"
          title="Queue"
          className="grid size-9 cursor-pointer place-items-center rounded-full transition-colors duration-150 hover:bg-black/5 active:scale-95"
        >
          <QueueIcon size={18} />
        </button>
      </div>
    </div>
  );
}
