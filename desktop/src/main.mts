import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain, Menu, screen, shell } from "electron";
import type { RunningServer } from "../../server/src/app.js";
import { backupLibraryOnUpdate } from "./backup.js";

// No top-level await in this file: Electron only fires "ready" after the entry module finishes
// evaluating, so awaiting it at the top level would hang forever.

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = 4280; // fixed so the web origin (and its saved settings) stays the same between launches
const isMac = process.platform === "darwin";

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

// Everything the user owns lives in their profile, so updates and reinstalls keep it.
const userData = app.getPath("userData");
process.env.MUSIKE_DATA_DIR = path.join(userData, "data");
process.env.MUSIKE_CACHE_DIR = path.join(userData, "cache");
process.env.MUSIKE_BIN_DIR = path.join(userData, "bin");
process.env.MUSIKE_WEB_DIST = app.isPackaged ? path.join(process.resourcesPath, "web") : path.resolve(here, "..", "..", "web", "dist");

// A copy of the library from before each update, in userData/backups (the installer makes one too).
backupLibraryOnUpdate(userData, app.getVersion());

// The server reads its config when first imported, so load it only after the env above is set.
const loadServer = async () => ({
  ...(await import("../../server/src/app.js")),
  ...(await import("../../server/src/bootstrap.js")),
  ...(await import("../../server/src/tools.js")),
  ...(await import("../../server/src/i18n.js")),
  HttpError: (await import("../../server/src/types.js")).HttpError,
});

const THEME: Record<string, { color: string; symbolColor: string }> = {
  dark: { color: "#0B0C0F", symbolColor: "#ECEEF2" },
  light: { color: "#E9EBEF", symbolColor: "#12141A" },
  oled: { color: "#000000", symbolColor: "#F2F4F8" },
  midnight: { color: "#070B14", symbolColor: "#E8EEF9" },
  rose: { color: "#130A12", symbolColor: "#F5E9F3" },
  forest: { color: "#07110D", symbolColor: "#E7F3ED" },
  sunset: { color: "#140D0A", symbolColor: "#F6ECE6" },
  nord: { color: "#1E222A", symbolColor: "#ECEFF4" },
  cream: { color: "#F2ECE1", symbolColor: "#1F1B16" },
  synthwave: { color: "#0d061a", symbolColor: "#fdf2ff" },
  candy: { color: "#fff0f6", symbolColor: "#2d0a31" },
  arcade: { color: "#090d1e", symbolColor: "#f8fafc" },
  tropical: { color: "#061a17", symbolColor: "#f0fdfa" },
  aurora: { color: "#07131f", symbolColor: "#ecfeff" },
  holi: { color: "#160924", symbolColor: "#fff8f0" },
};

interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  maximized?: boolean;
}

const stateFile = path.join(userData, "window.json");

// The language picked in the web app, kept here so the splash screen (shown before the web app loads) uses it too.
type Lang = "en" | "pt-BR";
const settingsFile = path.join(userData, "settings.json");
const isLang = (v: unknown): v is Lang => v === "en" || v === "pt-BR";

function readLang(): Lang {
  try {
    const { lang } = JSON.parse(readFileSync(settingsFile, "utf8")) as { lang?: unknown };
    if (isLang(lang)) return lang;
  } catch {
    // first launch
  }
  return "en";
}

let lang = readLang();

function readWindowState(): WindowState {
  try {
    const s = JSON.parse(readFileSync(stateFile, "utf8")) as WindowState;
    // Ignore a position that is no longer on any screen (monitor unplugged).
    const onScreen = screen
      .getAllDisplays()
      .some(({ workArea: a }) => s.x !== undefined && s.y !== undefined && s.x >= a.x - 50 && s.y >= a.y - 50 && s.x < a.x + a.width && s.y < a.y + a.height);
    return onScreen ? s : { width: s.width, height: s.height, maximized: s.maximized };
  } catch {
    return { width: 1280, height: 820 };
  }
}

function saveWindowState(win: BrowserWindow) {
  try {
    writeFileSync(stateFile, JSON.stringify({ ...win.getNormalBounds(), maximized: win.isMaximized() }));
  } catch {
    /* not critical */
  }
}

function createSplash(): BrowserWindow {
  const splash = new BrowserWindow({
    width: 420,
    height: 300,
    frame: false,
    resizable: false,
    center: true,
    show: false,
    icon: path.join(here, "icon.png"),
    backgroundColor: THEME.dark!.color,
    webPreferences: { preload: path.join(here, "preload.cjs"), sandbox: true, contextIsolation: true },
  });
  void splash.loadFile(path.join(here, "splash.html"), { query: { lang } });
  splash.once("ready-to-show", () => splash.show());
  return splash;
}

function createMainWindow(url: string): BrowserWindow {
  const state = readWindowState();
  const win = new BrowserWindow({
    ...state,
    minWidth: 380,
    minHeight: 560,
    show: false,
    title: "Illusive Sounds",
    icon: path.join(here, "icon.png"),
    backgroundColor: THEME.dark!.color,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(here, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      spellcheck: false,
      autoplayPolicy: "no-user-gesture-required",
    },
  });

  win.once("ready-to-show", () => {
    if (state.maximized) win.maximize();
    win.show();
  });
  win.on("close", () => saveWindowState(win));

  // Links to YouTube etc. open in the user's browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:\/\//.test(target)) void shell.openExternal(target);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, target) => {
    if (!target.startsWith(url)) {
      event.preventDefault();
      if (/^https?:\/\//.test(target)) void shell.openExternal(target);
    }
  });

  void win.loadURL(url);
  return win;
}

let mainWindow: BrowserWindow | null = null;
let server: RunningServer | null = null;
let mediaState: { title: string; artist: string; playing: boolean } = {
  title: "",
  artist: "",
  playing: false,
};

function dispatchMediaAction(action: "play" | "pause" | "toggle" | "next" | "previous") {
  mainWindow?.webContents.send("musike:media-action", action);
}

function rebuildPlaybackMenus() {
  const hasTrack = Boolean(mediaState.title);
  const nowPlayingLabel = hasTrack
    ? `${mediaState.title}${mediaState.artist ? ` — ${mediaState.artist}` : ""}`
    : "Illusive Sounds";
  const playPauseItem: Electron.MenuItemConstructorOptions = {
    label: mediaState.playing ? "Pause" : "Play",
    enabled: hasTrack,
    click: () => dispatchMediaAction(mediaState.playing ? "pause" : "play"),
  };
  const nextItem: Electron.MenuItemConstructorOptions = {
    label: "Next Track",
    enabled: hasTrack,
    click: () => dispatchMediaAction("next"),
  };
  const prevItem: Electron.MenuItemConstructorOptions = {
    label: "Previous Track",
    enabled: hasTrack,
    click: () => dispatchMediaAction("previous"),
  };

  if (isMac) {
    app.dock?.setMenu(
      Menu.buildFromTemplate([
        { label: nowPlayingLabel, enabled: false },
        { type: "separator" },
        playPauseItem,
        nextItem,
        prevItem,
      ]),
    );
  }

  Menu.setApplicationMenu(
    isMac
      ? Menu.buildFromTemplate([
          { role: "appMenu" },
          { role: "editMenu" },
          {
            label: "Playback",
            submenu: [
              { label: nowPlayingLabel, enabled: false },
              { type: "separator" },
              playPauseItem,
              nextItem,
              prevItem,
            ],
          },
          { role: "windowMenu" },
        ])
      : null,
  );
}

async function launch() {
  const s = await loadServer();
  await s.refreshTools();
  const currentTools = s.tools();
  const needsDownload = !currentTools.ytdlp || !currentTools.deno;

  if (!needsDownload) {
    try {
      server ??= await s.startServer({ port: PORT, host: "127.0.0.1", portFallback: true });
      s.ensureComponent("ffmpeg").catch(() => {});
      mainWindow = createMainWindow(`http://127.0.0.1:${server.port}`);
      return;
    } catch {
      // Fall through to error splash if startup unexpectedly fails.
    }
  }

  const splash = createSplash();
  // Show progress while yt-dlp and Deno download on the first launch.
  const report = setInterval(() => {
    splash.webContents.executeJavaScript(`window.update(${JSON.stringify(s.downloads(lang))})`).catch(() => {});
  }, 250);

  try {
    await s.refreshTools();
    await s.ensureEssentials();
    server ??= await s.startServer({ port: PORT, host: "127.0.0.1", portFallback: true });
    // FFmpeg is only needed for HD and some videos: fetch it in the background.
    s.ensureComponent("ffmpeg").catch(() => {});
  } catch (err) {
    clearInterval(report);
    const message = JSON.stringify(err instanceof s.HttpError ? s.tr(lang, err.text) : (err as Error).message);
    await splash.webContents.executeJavaScript(`window.fail(${message})`).catch(() => {});
    return;
  }

  clearInterval(report);
  mainWindow = createMainWindow(`http://127.0.0.1:${server.port}/?nosplash=1`);
  mainWindow.once("ready-to-show", () => splash.destroy());
}

ipcMain.on("musike:theme", (event, theme: string) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const colors = THEME[theme] ?? THEME.dark!;
  win?.setBackgroundColor(colors.color);
});

ipcMain.on("musike:lang", (_event, next: unknown) => {
  if (!isLang(next) || next === lang) return;
  lang = next;
  try {
    writeFileSync(settingsFile, JSON.stringify({ lang }));
  } catch {
    /* not critical: the splash falls back to English */
  }
});

ipcMain.on("musike:media-state", (_event, next: unknown) => {
  const payload = (next ?? {}) as { title?: unknown; artist?: unknown; playing?: unknown };
  mediaState = {
    title: typeof payload.title === "string" ? payload.title.slice(0, 120) : "",
    artist: typeof payload.artist === "string" ? payload.artist.slice(0, 120) : "",
    playing: Boolean(payload.playing),
  };
  rebuildPlaybackMenus();
});

ipcMain.on("musike:retry", (event) => {
  const failed = BrowserWindow.fromWebContents(event.sender);
  // Open the new splash before closing the old one, or "window-all-closed" would quit the app.
  void launch();
  failed?.destroy();
});

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => void server?.close());

void app.whenReady().then(() => {
  // macOS needs an app menu: without the Edit menu, Cmd+C/V/A don't reach text fields, and Cmd+Q has no home.
  rebuildPlaybackMenus();
  return launch();
});
