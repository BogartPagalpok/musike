import { contextBridge, ipcRenderer } from "electron";

export type DesktopMediaAction = "play" | "pause" | "toggle" | "next" | "previous";

// The only bridge between the web app and the desktop shell.
contextBridge.exposeInMainWorld("musikeDesktop", {
  platform: process.platform,
  setTheme: (theme: string) => ipcRenderer.send("musike:theme", theme),
  setLanguage: (lang: string) => ipcRenderer.send("musike:lang", lang),
  retry: () => ipcRenderer.send("musike:retry"),
  setMediaState: (state: { title?: string; artist?: string; playing?: boolean }) =>
    ipcRenderer.send("musike:media-state", state),
  onMediaAction: (handler: (action: DesktopMediaAction) => void) => {
    const listener = (_event: unknown, action: DesktopMediaAction) => handler(action);
    ipcRenderer.on("musike:media-action", listener);
    return () => ipcRenderer.removeListener("musike:media-action", listener);
  },
});
