import { App } from "@capacitor/app";
import { Capacitor, registerPlugin, SystemBars, SystemBarsStyle } from "@capacitor/core";
import { installTvMode } from "../tv/tvMode";

export interface NativeLocalTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  size?: number;
  url: string;
  fileName?: string;
}

/** MusikeDevicePlugin.java: what kind of device this is and local audio scanner. */
const Device = registerPlugin<{
  info(): Promise<{ tv: boolean }>;
  scanLocalMusic(): Promise<{ tracks?: NativeLocalTrack[] }>;
}>("MusikeDevice", {
  web: () => ({
    info: async () => ({ tv: false }),
    scanLocalMusic: async () => ({ tracks: [] }),
  }),
});

export async function scanAndroidLocalMusic(): Promise<NativeLocalTrack[]> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return [];
  try {
    const res = await Device.scanLocalMusic();
    return Array.isArray(res?.tracks) ? res.tracks : [];
  } catch {
    return [];
  }
}

// How the app fits into Android itself: Android TV, the Back button and the system bars.
if (Capacitor.isNativePlatform()) {
  // One APK for phones and TVs: on a TV, switch to the remote-friendly 10-foot UI (web/src/tv).
  void Device.info()
    .then(({ tv }) => {
      if (!tv) return;
      document.documentElement.dataset.tv = "1";
      installTvMode();
    })
    .catch(() => {});

  // Back closes what's on top (a dialog, a menu), then goes back through pages, then sends the app to the
  // background, where the music keeps playing.
  void App.addListener("backButton", () => {
    const overlay = [...document.querySelectorAll("[data-escape-closes]")].some((el) => el.getClientRects().length > 0);
    if (overlay) {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      return;
    }
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) window.history.back();
    else void App.minimizeApp();
  });

  // Status and navigation bar icons stay readable in both themes.
  const syncBars = () => {
    const light = document.documentElement.dataset.theme === "light";
    void SystemBars.setStyle({ style: light ? SystemBarsStyle.Light : SystemBarsStyle.Dark });
  };
  syncBars();
  new MutationObserver(syncBars).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}
