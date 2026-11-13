import { BooksIcon, BroadcastIcon, HouseIcon, MagnifyingGlassIcon, SkipForwardIcon } from "@phosphor-icons/react";
import { useRef, type TouchEvent } from "react";
import { NavLink, useNavigate } from "react-router";
import { cn } from "../lib/format";
import { useT } from "../i18n";
import { NOW_PLAYING_HASH, paths } from "../lib/routes";
import { selectCurrent, usePlayer, useStatusText } from "../player/player";
import { Artwork } from "./Artwork";
import { PlayPauseIcon } from "./Controls";

const tabs = [
  { to: paths.home, key: "home", Icon: HouseIcon, end: true },
  { to: paths.podcasts, key: "podcasts", Icon: BroadcastIcon, end: false },
  { to: paths.search, key: "search", Icon: MagnifyingGlassIcon, end: false },
  { to: paths.library, key: "library", Icon: BooksIcon, end: false },
] as const;

export function TabBar() {
  const t = useT();
  return (
    <nav
      aria-label={t.nav.main}
      className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-line-strong bg-surface-1/92 backdrop-blur-2xl"
    >
      <ul className="mx-auto grid h-[54px] max-w-md grid-cols-4">
        {tabs.map(({ to, key, Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "relative flex h-full flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium transition-all active:scale-90",
                  isActive ? "font-semibold text-accent-text" : "text-fg-2",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={23} weight={isActive ? "fill" : "regular"} />
                  {t.nav[key]}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function MiniPlayer() {
  const track = usePlayer(selectCurrent);
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  const status = usePlayer((s) => s.status);
  const statusText = useStatusText();
  const toggle = usePlayer((s) => s.toggle);
  const next = usePlayer((s) => s.next);
  const prev = usePlayer((s) => s.prev);
  const t = useT();
  const navigate = useNavigate();
  const touch = useRef<{ x: number; y: number } | null>(null);
  const didSwipe = useRef(false);
  if (!track) return null;
  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    didSwipe.current = false;
    const pt = e.touches[0];
    if (pt) touch.current = { x: pt.clientX, y: pt.clientY };
  };

  const onTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    const start = touch.current;
    touch.current = null;
    const pt = e.changedTouches[0];
    if (!start || !pt) return;
    const dx = pt.clientX - start.x;
    const dy = pt.clientY - start.y;
    if (dy < -36 && Math.abs(dy) > Math.abs(dx)) {
      didSwipe.current = true;
      navigate({ hash: NOW_PLAYING_HASH });
    } else if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) {
      didSwipe.current = true;
      if (dx < 0) next();
      else prev();
    }
  };

  return (
    <div className="fixed inset-x-2 bottom-[calc(62px+env(safe-area-inset-bottom))] z-20">
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="relative flex h-14 items-center gap-3 overflow-hidden rounded-[14px] bg-surface-2/95 pr-1 pl-2 shadow-[0_8px_28px_rgb(0_0_0/0.38)] ring-1 ring-line-strong backdrop-blur-2xl"
      >
        <button
          type="button"
          onClick={() => {
            if (didSwipe.current) {
              didSwipe.current = false;
              return;
            }
            navigate({ hash: NOW_PLAYING_HASH });
          }}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-label={t.player.openNowPlaying(track.title)}
        >
          <Artwork src={track.thumb} className="size-10 rounded-[8px] shadow-sm" />
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-semibold tracking-tight">{track.title}</span>
            <span className={cn("block truncate text-[12px]", status === "error" ? "text-danger" : "text-fg-2")}>
              {statusText ?? track.artist}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={toggle}
          aria-label={status === "playing" ? t.common.pause : t.common.play}
          className="grid size-11 shrink-0 place-items-center rounded-full text-fg active:scale-90"
        >
          <PlayPauseIcon size={24} />
        </button>
        <button
          type="button"
          onClick={next}
          aria-label={t.player.next}
          className="grid size-11 shrink-0 place-items-center rounded-full text-fg active:scale-90"
        >
          <SkipForwardIcon size={22} weight="fill" />
        </button>
        <span className="absolute inset-x-0 bottom-0 h-[2.5px] bg-line">
          <span className="block h-full bg-accent" style={{ width: `${pct}%` }} />
        </span>
      </div>
    </div>
  );
}
