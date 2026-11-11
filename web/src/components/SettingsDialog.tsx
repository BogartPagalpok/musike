import {
  ArrowsClockwiseIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CheckIcon,
  DownloadSimpleIcon,
  DropIcon,
  GridFourIcon,
  HouseIcon,
  ListIcon,
  PaletteIcon,
  RowsIcon,
  SidebarSimpleIcon,
  SparkleIcon,
  TerminalWindowIcon,
  WaveformIcon,
  type Icon,
} from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MD, useMediaQuery } from "../hooks/useMediaQuery";
import { useT } from "../i18n";
import { CLASSIC_THEMES, DEFAULT_ACCENT, inkFor, PLAYFUL_THEMES, THEME_PALETTES, type ThemeMeta } from "../lib/accent";
import { capabilities, type Channel } from "../lib/api";
import { cn } from "../lib/format";
import { ACCENTS, useAppearance } from "../stores/appearance";
import { useSystem } from "../stores/system";
import { useUi } from "../stores/ui";
import { LogoMark } from "./Brand";
import { CustomColorPicker } from "./CustomizeSection";

type Page = "root" | "theme" | "accent" | "layout" | "engine";

const LAYOUTS = [
  { id: "default", title: "Classic", body: "Sidebar, catalog in the centre, Now Playing on the right" },
  { id: "center-lyrics", title: "Stage", body: "Browse in the sidebar, big player and lyrics in the centre" },
  { id: "cinema", title: "Cinema", body: "Widescreen video and lyrics on top, browse underneath" },
] as const;

/* ---------- Building blocks (iOS-style grouped lists) ---------- */

function Group({ title, footer, children, className }: { title?: string; footer?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className="flex flex-col gap-1.5">
      {title && <h3 className="px-4 text-[12px] font-medium tracking-wide text-fg-3 uppercase">{title}</h3>}
      <div className={cn("overflow-hidden rounded-[12px] bg-surface-2", className)}>{children}</div>
      {footer && <p className="px-4 text-[12px] leading-snug text-fg-3">{footer}</p>}
    </section>
  );
}

function IconTile({ icon: I, color }: { icon: Icon; color: string }) {
  return (
    <span className="grid size-[30px] shrink-0 place-items-center rounded-[8px] text-white" style={{ backgroundColor: color }}>
      <I size={18} weight="fill" />
    </span>
  );
}

/** One row. Hairline divider starts after the icon, like iOS. */
function Row({
  icon,
  color,
  label,
  sub,
  value,
  onClick,
  chevron,
  right,
  danger,
}: {
  icon?: Icon;
  color?: string;
  label: ReactNode;
  sub?: ReactNode;
  value?: ReactNode;
  onClick?: () => void;
  chevron?: boolean;
  right?: ReactNode;
  danger?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "group/row flex min-h-[50px] w-full items-center gap-3 pl-4 text-left",
        onClick && "transition-colors active:bg-surface-3 md:hover:bg-surface-3/60",
      )}
    >
      {icon && color && <IconTile icon={icon} color={color} />}
      <span className="flex min-h-[50px] min-w-0 flex-1 items-center gap-2 border-b border-line py-2.5 pr-4 group-last/row:border-b-0">
        <span className="min-w-0 flex-1">
          <span className={cn("block text-[15px] leading-tight", danger ? "text-danger" : "text-fg")}>{label}</span>
          {sub && <span className="mt-0.5 block text-[12.5px] leading-snug text-fg-3">{sub}</span>}
        </span>
        {value !== undefined && <span className="shrink-0 truncate text-[15px] text-fg-3">{value}</span>}
        {right}
        {chevron && <CaretRightIcon size={15} weight="bold" className="shrink-0 text-fg-3/70" />}
      </span>
    </Tag>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200",
        checked ? "bg-accent" : "bg-surface-4",
      )}
    >
      <span
        className={cn(
          "absolute top-[2px] left-[2px] size-[27px] rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.25)] transition-transform duration-200 ease-out-expo",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}

function ToggleRow({ icon, color, label, sub, checked, onChange }: { icon?: Icon; color?: string; label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <Row icon={icon} color={color} label={label} sub={sub} right={<Switch checked={checked} onChange={onChange} label={label} />} />;
}

/* ---------- Pages ---------- */

function ThemeTile({ meta, active, onPick, label }: { meta: ThemeMeta; active: boolean; onPick: () => void; label: string }) {
  const accent = useAppearance((s) => s.accent);
  const colors = meta.palette ?? THEME_PALETTES[meta.id];
  return (
    <button type="button" role="radio" aria-checked={active} onClick={onPick} className="flex flex-col items-center gap-1.5 active:scale-[0.97]">
      <span
        className={cn(
          "relative flex aspect-[4/5] w-full flex-col justify-between overflow-hidden rounded-[12px] p-2 ring-1 transition-shadow",
          active ? "ring-[2.5px] ring-accent" : "ring-line",
        )}
        style={{ backgroundColor: meta.bg }}
      >
        <span className="flex flex-col gap-1">
          <span className="h-1.5 w-2/3 rounded-full opacity-80" style={{ backgroundColor: meta.fg }} />
          <span className="h-1.5 w-1/2 rounded-full opacity-40" style={{ backgroundColor: meta.fg }} />
        </span>
        <span className="flex flex-col gap-1.5 rounded-[7px] p-1.5" style={{ backgroundColor: meta.surface2 }}>
          {meta.palette ? (
            <span className="flex h-2 overflow-hidden rounded-full">
              {colors.map((c) => (
                <span key={c} className="flex-1" style={{ backgroundColor: c }} />
              ))}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: accent }} />
              <span className="h-1 flex-1 rounded-full opacity-50" style={{ backgroundColor: meta.fg }} />
            </span>
          )}
        </span>
        {active && (
          <span className="absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full bg-accent text-accent-ink">
            <CheckIcon size={12} weight="bold" />
          </span>
        )}
      </span>
      <span className={cn("truncate text-[12.5px]", active ? "font-semibold text-fg" : "text-fg-2")}>{label}</span>
    </button>
  );
}

function ThemePage() {
  const t = useT();
  const theme = useUi((s) => s.theme);
  const setTheme = useUi((s) => s.setTheme);
  const setAppearance = useAppearance((s) => s.set);
  return (
    <>
      <Group title="Classic" className="p-3">
        <div role="radiogroup" className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {CLASSIC_THEMES.map((m) => (
            <ThemeTile key={m.id} meta={m} active={theme === m.id} onPick={() => setTheme(m.id)} label={t.settings.themes[m.id]} />
          ))}
        </div>
      </Group>
      <Group title="Playful" footer="Six-colour themes. Picking one also resets the accent to match." className="p-3">
        <div role="radiogroup" className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {PLAYFUL_THEMES.map((m) => (
            <ThemeTile
              key={m.id}
              meta={m}
              active={theme === m.id}
              onPick={() => {
                setTheme(m.id);
                setAppearance({ accent: DEFAULT_ACCENT });
              }}
              label={t.settings.themes[m.id]}
            />
          ))}
        </div>
      </Group>
    </>
  );
}

function Swatch({ color, on, onPick, label }: { color: string; on: boolean; onPick: () => void; label: string }) {
  return (
    <button type="button" role="radio" aria-checked={on} aria-label={label} title={label} onClick={onPick} className="flex flex-col items-center gap-1.5 active:scale-95">
      <span
        className={cn("grid size-11 place-items-center rounded-full transition-shadow", on && "ring-[2.5px] ring-fg ring-offset-[3px] ring-offset-surface-2")}
        style={{ backgroundColor: color }}
      >
        {on && <CheckIcon size={18} weight="bold" style={{ color: inkFor(color) }} />}
      </span>
      <span className={cn("max-w-full truncate text-[11.5px]", on ? "font-semibold text-fg" : "text-fg-3")}>{label}</span>
    </button>
  );
}

function AccentPage() {
  const t = useT();
  const theme = useUi((s) => s.theme);
  const accent = useAppearance((s) => s.accent).toLowerCase();
  const set = useAppearance((s) => s.set);
  const palette = THEME_PALETTES[theme] ?? THEME_PALETTES.dark;
  return (
    <>
      <Group title={`From the ${t.settings.themes[theme]} theme`} className="p-4">
        <div role="radiogroup" className="grid grid-cols-6 gap-2">
          {palette.map((c, i) => (
            <Swatch key={c} color={c} on={accent === c.toLowerCase()} onPick={() => set({ accent: c })} label={`${i + 1}`} />
          ))}
        </div>
      </Group>
      <Group title="Colours" className="p-4">
        <div role="radiogroup" className="grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-8">
          {ACCENTS.map(({ id, color }) => (
            <Swatch key={id} color={color} on={accent === color.toLowerCase()} onPick={() => set({ accent: color })} label={t.customize.colors[id]} />
          ))}
        </div>
      </Group>
      <Group title={t.customize.customColor}>
        <CustomColorPicker />
      </Group>
    </>
  );
}

function LayoutPage() {
  const a = useAppearance();
  return (
    <Group title="Workspace" footer="Applies to the desktop and tablet layout.">
      {LAYOUTS.map((l) => {
        const on = a.layoutTemplate === l.id;
        return (
          <Row
            key={l.id}
            onClick={() => a.set({ layoutTemplate: l.id, ...(l.id !== "default" ? { compactSidebar: false } : {}) })}
            label={l.title}
            sub={l.body}
            right={
              <span className="flex items-center gap-3">
                <LayoutGlyph id={l.id} active={on} />
                <CheckIcon size={18} weight="bold" className={cn("text-accent-text", !on && "invisible")} />
              </span>
            }
          />
        );
      })}
    </Group>
  );
}

function LayoutGlyph({ id, active }: { id: (typeof LAYOUTS)[number]["id"]; active: boolean }) {
  const hi = active ? "bg-accent" : "bg-fg-3/60";
  const lo = "bg-fg-3/25";
  return (
    <span className="flex h-8 w-12 gap-[3px] rounded-[5px] bg-surface-3 p-[3px]">
      {id === "default" && (
        <>
          <span className={cn("w-2 rounded-[2px]", lo)} />
          <span className={cn("flex-1 rounded-[2px]", hi)} />
          <span className={cn("w-2.5 rounded-[2px]", lo)} />
        </>
      )}
      {id === "center-lyrics" && (
        <>
          <span className={cn("w-3.5 rounded-[2px]", lo)} />
          <span className={cn("flex-1 rounded-[2px]", hi)} />
        </>
      )}
      {id === "cinema" && (
        <span className="flex flex-1 flex-col gap-[3px]">
          <span className={cn("flex-[1.4] rounded-[2px]", hi)} />
          <span className={cn("flex-1 rounded-[2px]", lo)} />
        </span>
      )}
    </span>
  );
}

function EnginePage() {
  const t = useT();
  const { info, status, update } = useSystem();
  const [channel, setChannel] = useState<Channel>("stable");
  const logBox = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (info) setChannel(info.ytdlp.channel);
  }, [info?.ytdlp.channel]);

  const job = info?.job;
  const running = job?.status === "running";
  useEffect(() => {
    logBox.current?.scrollTo({ top: logBox.current.scrollHeight });
  }, [job?.log.length]);

  const y = info?.ytdlp;
  const missing = !!info && !y?.path;
  const switching = !!y?.version && channel !== y.channel;
  const target = y?.latest[channel];

  let action: string;
  if (running) action = job?.kind === "install" ? t.settings.installing : t.settings.updating;
  else if (missing) action = t.settings.install;
  else if (switching) action = channel === "nightly" ? t.settings.toNightly : t.settings.toStable;
  else if (y?.updateAvailable && target) action = t.settings.updateTo(target);
  else action = t.settings.check;

  return (
    <>
      <Group footer={t.settings.engineBody}>
        <Row
          label="yt-dlp"
          value={
            status === "loading" && !info
              ? t.settings.checking
              : missing
                ? t.settings.chipMissing
                : `${y?.version ?? t.settings.noVersion}`
          }
        />
        {info && <Row label="Deno" sub={info.deno ? t.settings.denoRole : undefined} value={info.deno ? t.settings.chipOk : t.settings.chipMissing} />}
      </Group>

      {!missing && (
        <Group title={t.settings.channel} footer={channel === "nightly" ? t.settings.nightlyBody : t.settings.stableBody}>
          {(["stable", "nightly"] as const).map((c) => (
            <Row
              key={c}
              onClick={() => setChannel(c)}
              label={c === "stable" ? t.settings.stableOption : t.settings.nightlyOption}
              value={y?.latest[c] ?? undefined}
              right={<CheckIcon size={18} weight="bold" className={cn("text-accent-text", channel !== c && "invisible")} />}
            />
          ))}
        </Group>
      )}

      <button
        type="button"
        disabled={running || !info || (missing && !info.canInstall)}
        onClick={() => void update(channel)}
        className="flex h-[50px] items-center justify-center gap-2 rounded-[12px] bg-accent text-[15px] font-semibold text-accent-ink transition-transform active:scale-[0.98] disabled:opacity-50"
      >
        {running ? (
          <ArrowsClockwiseIcon size={19} weight="bold" className="animate-spin" />
        ) : missing ? (
          <DownloadSimpleIcon size={19} weight="bold" />
        ) : (
          <ArrowsClockwiseIcon size={19} weight="bold" />
        )}
        {action}
      </button>
      {missing && info && !info.canInstall && <p className="px-4 text-[13px] text-danger">{t.settings.noWinget}</p>}

      {job && (job.status === "running" || Date.now() - (job.finishedAt ?? 0) < 5 * 60_000) && (
        <Group title={job.status === "running" ? t.settings.updating : job.message}>
          <pre
            ref={logBox}
            aria-live="polite"
            className="scroll-area max-h-44 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-fg-2"
          >
            {job.log.length ? job.log.join("\n") : t.settings.starting}
          </pre>
        </Group>
      )}
    </>
  );
}

function RootPage({ go }: { go: (p: Page) => void }) {
  const t = useT();
  const isMd = useMediaQuery(MD);
  const a = useAppearance();
  const theme = useUi((s) => s.theme);
  const panelOpen = useUi((s) => s.panelOpen);
  const setPanelDocked = useUi((s) => s.setPanelDocked);
  const info = useSystem((s) => s.info);
  const y = info?.ytdlp;
  const engineValue = !info ? "…" : !y?.path ? t.settings.chipMissing : y.updateAvailable ? t.settings.chipUpdate : y.version ?? "";

  return (
    <>
      {/* App card */}
      <div className="flex items-center gap-3.5 rounded-[12px] bg-surface-2 p-4">
        <span className="grid size-14 place-items-center rounded-[14px] bg-accent text-accent-ink">
          <LogoMark className="size-8" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-semibold tracking-tight">Illusive Sounds</p>
          <p className="text-[13px] text-fg-3">
            v{__APP_VERSION__} · {t.settings.developer} Ian Lester Eclevia
          </p>
        </div>
      </div>

      <Group title={t.settings.appearance}>
        <Row icon={PaletteIcon} color="#5e5ce6" label={t.settings.theme} value={t.settings.themes[theme]} chevron onClick={() => go("theme")} />
        <Row
          icon={DropIcon}
          color="#ff375f"
          label={t.customize.accent}
          right={<span className="size-5 rounded-full ring-1 ring-line" style={{ backgroundColor: a.accent }} />}
          chevron
          onClick={() => go("accent")}
        />
        <ToggleRow icon={SparkleIcon} color="#8e8e93" label={t.customize.texture} checked={a.texture} onChange={(v) => a.set({ texture: v })} />
      </Group>

      {isMd && (
        <Group title={t.customize.layout}>
          <Row
            icon={GridFourIcon}
            color="#0a84ff"
            label="Workspace"
            value={LAYOUTS.find((l) => l.id === a.layoutTemplate)?.title}
            chevron
            onClick={() => go("layout")}
          />
          <ToggleRow icon={WaveformIcon} color="#30d158" label={t.customize.panel} checked={panelOpen} onChange={setPanelDocked} />
          <ToggleRow icon={ListIcon} color="#ff9f0a" label={t.customize.sidebarPlaylists} checked={a.sidebarPlaylists} onChange={(v) => a.set({ sidebarPlaylists: v })} />
          <ToggleRow icon={SidebarSimpleIcon} color="#64d2ff" label={t.customize.compactSidebar} checked={a.compactSidebar} onChange={(v) => a.set({ compactSidebar: v })} />
          <ToggleRow icon={RowsIcon} color="#bf5af2" label={t.customize.albumColumn} checked={a.albumColumn} onChange={(v) => a.set({ albumColumn: v })} />
        </Group>
      )}

      <Group title={t.customize.home}>
        <ToggleRow icon={HouseIcon} color="#ff9f0a" label={t.customize.homeShortcuts} checked={a.homeShortcuts} onChange={(v) => a.set({ homeShortcuts: v })} />
        <ToggleRow label={t.nav.recentlyPlayed} checked={a.homeRecent} onChange={(v) => a.set({ homeRecent: v })} />
        <ToggleRow label={t.home.yourFavorites} checked={a.homeFavorites} onChange={(v) => a.set({ homeFavorites: v })} />
      </Group>

      {capabilities.engineSettings && (
        <Group title={t.settings.engine}>
          <Row
            icon={TerminalWindowIcon}
            color="#3a3a3c"
            label="yt-dlp"
            value={engineValue}
            right={y?.updateAvailable || (info && !y?.path) ? <span className="size-2 rounded-full bg-accent" /> : undefined}
            chevron
            onClick={() => go("engine")}
          />
        </Group>
      )}

      <Group>
        <Row
          label={<span className="block text-center">{t.customize.reset}</span>}
          danger
          onClick={() => {
            a.reset();
            setPanelDocked(true);
          }}
        />
      </Group>
    </>
  );
}

/* ---------- Shell ---------- */

export function SettingsDialog() {
  const open = useUi((s) => s.settingsOpen);
  const setOpen = useUi((s) => s.setSettingsOpen);
  const load = useSystem((s) => s.load);
  const isMd = useMediaQuery(MD);
  const reduce = useReducedMotion();
  const t = useT();
  const [stack, setStack] = useState<Page[]>(["root"]);
  const page = stack[stack.length - 1]!;
  const [dir, setDir] = useState(1);

  const close = () => setOpen(false);
  const go = (p: Page) => {
    setDir(1);
    setStack((s) => [...s, p]);
  };
  const back = () => {
    setDir(-1);
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  };

  useEffect(() => {
    if (open) void load();
    else setStack(["root"]);
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (stack.length > 1) back();
      else close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, stack.length]);

  const titles: Record<Page, string> = {
    root: t.settings.title,
    theme: t.settings.theme,
    accent: t.customize.accent,
    layout: t.customize.layout,
    engine: t.settings.engine,
  };

  const sheetFrom = reduce ? { opacity: 0 } : isMd ? { opacity: 0, scale: 0.97 } : { y: "100%" };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
          <motion.div className="absolute inset-0 bg-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t.settings.title}
            data-escape-closes
            initial={sheetFrom}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={sheetFrom}
            transition={{ type: "spring", stiffness: 420, damping: 40 }}
            drag={isMd ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            dragListener={false}
            className={cn(
              "relative flex w-full flex-col overflow-hidden bg-bg shadow-[0_30px_80px_rgb(0_0_0/0.5)]",
              "h-[calc(100dvh-max(env(safe-area-inset-top),12px)-12px)] rounded-t-[16px]",
              "md:h-[min(760px,88dvh)] md:max-w-[620px] md:rounded-[18px] md:ring-1 md:ring-line",
            )}
          >
            {/* Nav bar */}
            <header className="relative flex h-14 shrink-0 items-center justify-between border-b border-line/70 bg-bg/90 px-2 backdrop-blur-xl">
              {!isMd && <span className="absolute top-1.5 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-fg-3/40" />}
              <div className="flex w-28 items-center">
                {stack.length > 1 && (
                  <button
                    type="button"
                    onClick={back}
                    className="flex h-10 items-center gap-0.5 rounded-lg pr-2 pl-1 text-[16px] text-accent-text active:opacity-60"
                  >
                    <CaretLeftIcon size={20} weight="bold" />
                    {titles[stack[stack.length - 2]!]}
                  </button>
                )}
              </div>
              <h2 className="truncate text-[16px] font-semibold tracking-tight">{titles[page]}</h2>
              <div className="flex w-28 justify-end">
                <button type="button" onClick={close} className="h-10 rounded-lg px-3 text-[16px] font-semibold text-accent-text active:opacity-60">
                  Done
                </button>
              </div>
            </header>

            {/* Pages slide horizontally */}
            <div className="relative min-h-0 flex-1 overflow-hidden">
              <AnimatePresence initial={false} custom={dir} mode="popLayout">
                <motion.div
                  key={page}
                  custom={dir}
                  initial={reduce ? { opacity: 0 } : { x: `${dir * 100}%` }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={reduce ? { opacity: 0 } : { x: `${dir * -30}%`, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 42 }}
                  className="scroll-area absolute inset-0 overflow-y-auto overscroll-contain"
                >
                  <div className="flex flex-col gap-7 px-4 pt-5 pb-[calc(32px+env(safe-area-inset-bottom))]">
                    {page === "root" && <RootPage go={go} />}
                    {page === "theme" && <ThemePage />}
                    {page === "accent" && <AccentPage />}
                    {page === "layout" && <LayoutPage />}
                    {page === "engine" && <EnginePage />}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
