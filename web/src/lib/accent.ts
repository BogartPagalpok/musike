/**
 * Builds the accent colour variables for any colour the user picks and defines all app themes.
 * The pick fills buttons as-is; the text versions are lightened (dark themes) or darkened (light themes)
 * until they read well on the theme's surfaces (WCAG AA, 4.5:1).
 */

type Rgb = [number, number, number];

export type ThemeId = "dark" | "light" | "oled" | "midnight" | "rose" | "forest" | "sunset" | "nord" | "cream";

export interface ThemeMeta {
  id: ThemeId;
  scheme: "dark" | "light";
  bg: string;
  surface1: string;
  surface2: string;
  fg: string;
  surfaceRgb: Rgb;
}

export const THEMES: readonly ThemeMeta[] = [
  { id: "dark", scheme: "dark", bg: "#0b0c0f", surface1: "#121318", surface2: "#181a20", fg: "#eceef2", surfaceRgb: [0x18, 0x1a, 0x20] },
  { id: "light", scheme: "light", bg: "#e9ebef", surface1: "#ffffff", surface2: "#f2f3f6", fg: "#12141a", surfaceRgb: [0xf2, 0xf3, 0xf6] },
  { id: "oled", scheme: "dark", bg: "#000000", surface1: "#08090c", surface2: "#101217", fg: "#f2f4f8", surfaceRgb: [0x10, 0x12, 0x17] },
  { id: "midnight", scheme: "dark", bg: "#070b14", surface1: "#0d1322", surface2: "#131b2e", fg: "#e8eef9", surfaceRgb: [0x13, 0x1b, 0x2e] },
  { id: "rose", scheme: "dark", bg: "#130a12", surface1: "#1c101b", surface2: "#261624", fg: "#f5e9f3", surfaceRgb: [0x26, 0x16, 0x24] },
  { id: "forest", scheme: "dark", bg: "#07110d", surface1: "#0d1b15", surface2: "#13261e", fg: "#e7f3ed", surfaceRgb: [0x13, 0x26, 0x1e] },
  { id: "sunset", scheme: "dark", bg: "#140d0a", surface1: "#1e1410", surface2: "#281b16", fg: "#f6ece6", surfaceRgb: [0x28, 0x1b, 0x16] },
  { id: "nord", scheme: "dark", bg: "#1e222a", surface1: "#242933", surface2: "#2e3440", fg: "#eceff4", surfaceRgb: [0x2e, 0x34, 0x40] },
  { id: "cream", scheme: "light", bg: "#f2ece1", surface1: "#fbf8f3", surface2: "#efe9de", fg: "#1f1b16", surfaceRgb: [0xef, 0xe9, 0xde] },
] as const;

export const isTheme = (v: unknown): v is ThemeId =>
  typeof v === "string" && THEMES.some((t) => t.id === v);

export const getThemeMeta = (id: string): ThemeMeta =>
  THEMES.find((t) => t.id === id) ?? THEMES[0]!;

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];

export const DEFAULT_ACCENT = "#c3ec52";

export const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);

export const toRgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
export const toHex = (c: Rgb) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;

/** Convert RGB (0-255) to HSV (h: 0-360, s: 0-1, v: 0-1). */
export function rgbToHsv([r, g, b]: Rgb): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
    else if (max === gn) h = ((bn - rn) / d + 2) * 60;
    else h = ((rn - gn) / d + 4) * 60;
  }
  const s = max === 0 ? 0 : d / max;
  return [Math.round(h), s, max];
}

/** Convert HSV (h: 0-360, s: 0-1, v: 0-1) to Hex (#rrggbb). */
export function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return toHex([(r + m) * 255, (g + m) * 255, (b + m) * 255]);
}

function luminance([r, g, b]: Rgb): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

const contrast = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [0, 1, 2].map((i) => a[i]! + (b[i]! - a[i]!) * t) as Rgb;

/** Moves `color` toward `target` just enough to reach `ratio` against `surface`. */
function readable(color: Rgb, target: Rgb, surface: Rgb, ratio = 4.5): Rgb {
  for (let t = 0; t <= 1; t += 0.04) {
    const c = mix(color, target, t);
    if (contrast(c, surface) >= ratio) return c;
  }
  return target;
}

/** Black or white, whichever reads better on `hex` (the check mark on a swatch, text on accent buttons). */
export function inkFor(hex: string): string {
  const base = toRgb(hex);
  return contrast(base, BLACK) >= contrast(base, WHITE) ? "#0b0c0f" : "#ffffff";
}

/** CSS that overrides the theme's accent variables across all themes. Selectors outrank styles.css whatever the load order. */
export function accentCss(hex: string): string {
  const base = toRgb(hex);
  const ink = inkFor(hex);
  const rgb = (c: Rgb) => c.map(Math.round).join(" ");

  return THEMES.map((theme) => {
    const isLight = theme.scheme === "light";
    const text = readable(base, isLight ? BLACK : WHITE, theme.surfaceRgb);
    const softRgb = isLight ? rgb(text) : rgb(base);
    const softAlpha = isLight ? 0.12 : 0.13;
    const selector =
      theme.id === "dark"
        ? `html:root,html[data-theme="dark"]`
        : `html[data-theme="${theme.id}"]`;
    return `${selector}{--accent:${hex};--accent-ink:${ink};--accent-text:${toHex(text)};--accent-soft:rgb(${softRgb} / ${softAlpha})}`;
  }).join("");
}

