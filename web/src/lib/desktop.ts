import { isTheme, type ThemeId } from "./accent";

export type DesktopMediaAction = "play" | "pause" | "toggle" | "next" | "previous";

/** Bridge exposed by the Electron preload script when Illusive Sounds runs as the desktop app. */
interface DesktopBridge {
  platform: string;
  setTheme: (theme: ThemeId) => void;
  /** Missing in desktop builds older than 1.2. */
  setLanguage?: (lang: string) => void;
  setMediaState?: (state: { title?: string; artist?: string; playing?: boolean }) => void;
  onMediaAction?: (handler: (action: DesktopMediaAction) => void) => () => void;
}

export const desktop = (window as Window & { musikeDesktop?: DesktopBridge }).musikeDesktop;

if (desktop) {
  document.documentElement.dataset.desktop = "true";
  const initialTheme = document.documentElement.dataset.theme;
  // Match the native window buttons to the theme picked before this script ran.
  desktop.setTheme(isTheme(initialTheme) ? initialTheme : "dark");
}
