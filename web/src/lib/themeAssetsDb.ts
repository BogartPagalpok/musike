export type AnimeThemeKey = "shinobi" | "akatsuki" | "grandline";
export type AnimeAssetSlot = "mobileWallpaper" | "pcWallpaper" | "playheadIcon";

const DB_NAME = "illusive-theme-assets-v1";
const DB_VERSION = 1;
const STORE_NAME = "assets";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

const keyFor = (anime: AnimeThemeKey, slot: AnimeAssetSlot) => `${anime}:${slot}`;

export async function saveAnimeAssetBlob(anime: AnimeThemeKey, slot: AnimeAssetSlot, blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({ blob, mime: blob.type }, keyFor(anime, slot));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteAnimeAssetBlob(anime: AnimeThemeKey, slot: AnimeAssetSlot): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(keyFor(anime, slot));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAnimeAssetGroup(anime: AnimeThemeKey): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(keyFor(anime, "mobileWallpaper"));
    store.delete(keyFor(anime, "pcWallpaper"));
    store.delete(keyFor(anime, "playheadIcon"));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export interface LoadedAnimeCustomAssets {
  mobileWallpaper?: { url: string; isVideo: boolean };
  pcWallpaper?: { url: string; isVideo: boolean };
  playheadIcon?: string;
}

export async function loadAllAnimeAssetUrls(): Promise<Partial<Record<AnimeThemeKey, LoadedAnimeCustomAssets>>> {
  const out: Partial<Record<AnimeThemeKey, LoadedAnimeCustomAssets>> = {};
  try {
    const db = await openDb();
    const entries = await new Promise<Array<{ key: string; blob: Blob; mime: string }>>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const list: Array<{ key: string; blob: Blob; mime: string }> = [];
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = () => {
        const c = cursorReq.result;
        if (!c) return resolve(list);
        const val = c.value as { blob?: Blob; mime?: string } | undefined;
        if (typeof c.key === "string" && val?.blob instanceof Blob) {
          list.push({ key: c.key, blob: val.blob, mime: val.mime || val.blob.type });
        }
        c.continue();
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
    for (const entry of entries) {
      const [anime, slot] = entry.key.split(":") as [AnimeThemeKey, AnimeAssetSlot];
      if (!anime || !slot) continue;
      out[anime] ??= {};
      const url = URL.createObjectURL(entry.blob);
      if (slot === "playheadIcon") {
        out[anime]!.playheadIcon = url;
      } else {
        const isVideo = entry.mime.startsWith("video/");
        out[anime]![slot] = { url, isVideo };
      }
    }
  } catch {
    /* ignore IndexedDB errors */
  }
  return out;
}

