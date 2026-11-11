import { CheckIcon, EyedropperIcon, PaletteIcon, SparkleIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import { hsvToHex, inkFor, isHex, rgbToHsv, THEME_PALETTES, toRgb } from "../lib/accent";
import { cn } from "../lib/format";
import { ACCENTS, useAppearance } from "../stores/appearance";
import { useUi } from "../stores/ui";

interface EyeDropperApi {
  open: () => Promise<{ sRGBHex: string }>;
}

const hasEyeDropper = typeof window !== "undefined" && "EyeDropper" in window;

/** Ready-made accent swatches plus playful theme palettes and an interactive custom color picker studio. */
export function AccentPicker() {
  const t = useT();
  const theme = useUi((s) => s.theme);
  const accent = useAppearance((s) => s.accent);
  const set = useAppearance((s) => s.set);
  const isCustom = !ACCENTS.some((a) => a.color.toLowerCase() === accent.toLowerCase());
  const [pickerOpen, setPickerOpen] = useState(isCustom);
  const [hsv, setHsv] = useState<[number, number, number]>(() => rgbToHsv(toRgb(accent)));
  const [hexInput, setHexInput] = useState(accent.toUpperCase());
  const svBoxRef = useRef<HTMLDivElement>(null);
  const hueBoxRef = useRef<HTMLDivElement>(null);

  const playfulPalette = THEME_PALETTES[theme] ?? THEME_PALETTES.dark;

  useEffect(() => {
    setHexInput(accent.toUpperCase());
    const nextHsv = rgbToHsv(toRgb(accent));
    setHsv((prev) => {
      const h = nextHsv[1] === 0 || nextHsv[2] === 0 ? prev[0] : nextHsv[0];
      return [h, nextHsv[1], nextHsv[2]];
    });
  }, [accent]);

  const applyHsv = (h: number, s: number, v: number) => {
    const clamped: [number, number, number] = [
      Math.max(0, Math.min(360, Math.round(h))),
      Math.max(0, Math.min(1, s)),
      Math.max(0, Math.min(1, v)),
    ];
    setHsv(clamped);
    const hex = hsvToHex(clamped[0], clamped[1], clamped[2]);
    setHexInput(hex.toUpperCase());
    set({ accent: hex });
  };

  const handleSvPointer = (clientX: number, clientY: number) => {
    const rect = svBoxRef.current?.getBoundingClientRect();
    if (!rect) return;
    const s = (clientX - rect.left) / rect.width;
    const v = 1 - (clientY - rect.top) / rect.height;
    applyHsv(hsv[0], s, v);
  };

  const handleHuePointer = (clientX: number) => {
    const rect = hueBoxRef.current?.getBoundingClientRect();
    if (!rect) return;
    const h = ((clientX - rect.left) / rect.width) * 360;
    applyHsv(h, hsv[1] || 0.85, hsv[2] || 0.95);
  };

  const pickWithEyeDropper = async () => {
    try {
      const EyeDropperCtor = (window as unknown as { EyeDropper: new () => EyeDropperApi }).EyeDropper;
      const result = await new EyeDropperCtor().open();
      if (isHex(result.sRGBHex)) {
        set({ accent: result.sRGBHex.toLowerCase() });
      }
    } catch {
      /* user cancelled */
    }
  };

  const [h, s, v] = hsv;
  const pureHueHex = hsvToHex(h, 1, 1);

  return (
    <div className="flex flex-col gap-3 rounded-[16px] bg-surface-1 p-3.5 ring-1 ring-line">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-fg-2">{t.customize.accent}</span>
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          aria-expanded={pickerOpen}
          className={cn(
            "flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ring-1 transition-colors",
            pickerOpen || isCustom
              ? "bg-accent-soft text-accent-text ring-accent/40"
              : "bg-surface-2 text-fg-2 ring-line hover:text-fg",
          )}
        >
          <span
            className="size-3 rounded-full ring-1 ring-black/20"
            style={{ background: accent }}
          />
          <PaletteIcon size={14} weight="bold" />
          <span>{t.customize.customColor}</span>
        </button>
      </div>

      {/* 5-Color Playful Palette matching the active theme */}
      <div className="flex flex-col gap-1.5 rounded-[12px] bg-surface-2/60 p-2.5 ring-1 ring-line">
        <div className="flex items-center gap-1.5 text-xs font-medium text-fg-3">
          <SparkleIcon size={13} className="text-accent-text" />
          <span>Playful palette for {theme}</span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {playfulPalette.map((color) => {
            const on = accent.toLowerCase() === color.toLowerCase();
            return (
              <button
                key={color}
                type="button"
                onClick={() => set({ accent: color })}
                className={cn(
                  "group flex h-9 items-center justify-center rounded-lg transition-transform active:scale-95",
                  on && "ring-2 ring-fg ring-offset-2 ring-offset-surface-2",
                )}
                style={{ backgroundColor: color }}
                title={color}
              >
                {on && <CheckIcon size={16} weight="bold" style={{ color: inkFor(color) }} />}
              </button>
            );
          })}
        </div>
      </div>

      <div role="radiogroup" aria-label={t.customize.accent} className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {ACCENTS.map(({ id, color }) => {
          const on = accent.toLowerCase() === color.toLowerCase();
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={t.customize.colors[id]}
              title={t.customize.colors[id]}
              onClick={() => set({ accent: color })}
              className={cn(
                "group flex flex-col items-center gap-1 rounded-[12px] py-1.5 transition-colors hover:bg-surface-2",
                on && "bg-surface-2 ring-1 ring-line-strong",
              )}
            >
              <span
                className={cn(
                  "grid size-7 place-items-center rounded-full transition-transform group-active:scale-90",
                  on && "ring-2 ring-fg ring-offset-2 ring-offset-surface-2",
                )}
                style={{ background: color }}
              >
                {on && <CheckIcon size={14} weight="bold" style={{ color: inkFor(color) }} />}
              </span>
              <span className={cn("text-[11px] leading-tight", on ? "font-semibold text-fg" : "text-fg-3")}>
                {t.customize.colors[id]}
              </span>
            </button>
          );
        })}
      </div>

      {pickerOpen && (
        <div className="flex flex-col gap-3 rounded-[12px] bg-surface-2 p-3 ring-1 ring-line">
          {/* 2D Saturation / Brightness canvas */}
          <div
            ref={svBoxRef}
            role="slider"
            tabIndex={0}
            aria-label={t.customize.saturationBrightness}
            aria-valuenow={Math.round(s * 100)}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              handleSvPointer(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (e.buttons > 0) handleSvPointer(e.clientX, e.clientY);
            }}
            className="relative h-28 w-full cursor-crosshair touch-none overflow-hidden rounded-[10px] ring-1 ring-line-strong select-none"
            style={{
              backgroundColor: pureHueHex,
              backgroundImage:
                "linear-gradient(to top, #000000, transparent), linear-gradient(to right, #ffffff, transparent)",
            }}
          >
            <span
              className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_1px_4px_rgba(0,0,0,0.65)]"
              style={{
                left: `${s * 100}%`,
                top: `${(1 - v) * 100}%`,
                backgroundColor: accent,
              }}
            />
          </div>

          {/* Hue slider */}
          <div
            ref={hueBoxRef}
            role="slider"
            tabIndex={0}
            aria-label={t.customize.hue}
            aria-valuemin={0}
            aria-valuemax={360}
            aria-valuenow={h}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              handleHuePointer(e.clientX);
            }}
            onPointerMove={(e) => {
              if (e.buttons > 0) handleHuePointer(e.clientX);
            }}
            className="relative h-3.5 w-full cursor-pointer touch-none rounded-full ring-1 ring-line-strong select-none"
            style={{
              background:
                "linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)",
            }}
          >
            <span
              className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_1px_4px_rgba(0,0,0,0.65)]"
              style={{
                left: `${(h / 360) * 100}%`,
                backgroundColor: pureHueHex,
              }}
            />
          </div>

          {/* Hex input + Eyedropper */}
          <div className="flex items-center gap-2">
            <span
              className="grid size-8 shrink-0 place-items-center rounded-[8px] ring-1 ring-line-strong"
              style={{ backgroundColor: accent }}
            >
              <CheckIcon size={14} weight="bold" style={{ color: inkFor(accent) }} />
            </span>
            <label className="relative flex-1">
              <span className="sr-only">{t.customize.hexLabel}</span>
              <input
                type="text"
                value={hexInput}
                maxLength={7}
                spellCheck={false}
                onChange={(e) => {
                  const raw = e.target.value;
                  const normalized = raw.startsWith("#") ? raw : `#${raw}`;
                  setHexInput(normalized.toUpperCase());
                  if (isHex(normalized)) {
                    set({ accent: normalized.toLowerCase() });
                  }
                }}
                onBlur={() => setHexInput(accent.toUpperCase())}
                className="h-8 w-full rounded-[8px] bg-surface-1 px-2.5 font-mono text-xs font-medium text-fg ring-1 ring-line focus:ring-accent focus:outline-none"
              />
            </label>
            {hasEyeDropper && (
              <button
                type="button"
                onClick={() => void pickWithEyeDropper()}
                title={t.customize.eyedropper}
                aria-label={t.customize.eyedropper}
                className="grid size-8 shrink-0 place-items-center rounded-[8px] bg-surface-1 text-fg-2 ring-1 ring-line transition-colors hover:bg-surface-3 hover:text-fg"
              >
                <EyedropperIcon size={15} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SwitchRow({ label, body, checked, onChange }: { label: string; body?: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {body && <span className="block text-xs text-fg-2">{body}</span>}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden="true"
        className={cn(
          "relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200 peer-focus-visible:outline-2 peer-focus-visible:outline-accent",
          checked ? "bg-accent" : "bg-surface-4",
        )}
      >
        <span
          className={cn(
            "absolute top-1 left-1 size-4 rounded-full transition-transform duration-200 ease-out-expo",
            checked ? "translate-x-4 bg-accent-ink" : "bg-fg-2",
          )}
        />
      </span>
    </label>
  );
}

/** What the app shows: panels, sidebar, list columns and the Home sections. */
export function LayoutSection() {
  const t = useT();
  const a = useAppearance();
  const panelOpen = useUi((s) => s.panelOpen);
  const setPanelDocked = useUi((s) => s.setPanelDocked);

  const homeSections = [
    ["homeShortcuts", t.customize.homeShortcuts],
    ["homeRecent", t.nav.recentlyPlayed],
    ["homeFavorites", t.home.yourFavorites],
  ] as const;

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-fg-3">{t.customize.layout}</h3>
      
      {/* Overall Layout Template Selector */}
      <div className="flex flex-col gap-2 rounded-[16px] bg-surface-1 p-3.5 ring-1 ring-line">
        <span className="text-[13px] font-medium text-fg-2">Overall Layout Template</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => a.set({ layoutTemplate: "default" })}
            className={cn(
              "flex flex-col items-start gap-1 rounded-[12px] p-2.5 text-left ring-1 transition-colors",
              a.layoutTemplate === "default"
                ? "bg-accent-soft text-accent-text ring-accent/40"
                : "bg-surface-2 text-fg-2 ring-line hover:text-fg",
            )}
          >
            <span className="text-xs font-semibold">Standard Explorer</span>
            <span className="text-[11px] opacity-80">Catalog & charts in center, stage in side dock</span>
          </button>
          <button
            type="button"
            onClick={() => a.set({ layoutTemplate: "center-lyrics" })}
            className={cn(
              "flex flex-col items-start gap-1 rounded-[12px] p-2.5 text-left ring-1 transition-colors",
              a.layoutTemplate === "center-lyrics"
                ? "bg-accent-soft text-accent-text ring-accent/40"
                : "bg-surface-2 text-fg-2 ring-line hover:text-fg",
            )}
          >
            <span className="text-xs font-semibold">Stage & Lyrics Focus</span>
            <span className="text-[11px] opacity-80">Big player & karaoke lyrics in middle, home on side</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col divide-y divide-line rounded-[16px] bg-surface-1 ring-1 ring-line">
        <SwitchRow label={t.customize.panel} body={t.customize.panelBody} checked={panelOpen} onChange={setPanelDocked} />
        <SwitchRow label={t.customize.sidebarPlaylists} checked={a.sidebarPlaylists} onChange={(v) => a.set({ sidebarPlaylists: v })} />
        <SwitchRow
          label={t.customize.compactSidebar}
          body={t.customize.compactSidebarBody}
          checked={a.compactSidebar}
          onChange={(v) => a.set({ compactSidebar: v })}
        />
        <SwitchRow label={t.customize.albumColumn} checked={a.albumColumn} onChange={(v) => a.set({ albumColumn: v })} />
        <SwitchRow label={t.customize.texture} checked={a.texture} onChange={(v) => a.set({ texture: v })} />
      </div>

      <p className="pt-2 text-[13px] text-fg-2">{t.customize.home}</p>
      <div className="flex flex-wrap gap-2">
        {homeSections.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="checkbox"
            aria-checked={a[key]}
            onClick={() => a.set({ [key]: !a[key] })}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium ring-1 transition-colors",
              a[key] ? "bg-accent-soft text-accent-text ring-accent/40" : "text-fg-2 ring-line hover:text-fg",
            )}
          >
            {a[key] && <CheckIcon size={14} weight="bold" />}
            {label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => {
          a.reset();
          setPanelDocked(true);
        }}
        className="mt-1 self-start text-[13px] font-medium text-fg-2 underline-offset-2 hover:text-fg hover:underline"
      >
        {t.customize.reset}
      </button>
    </section>
  );
}
