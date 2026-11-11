import { create } from "zustand";
import { getT } from "../i18n";
import { streamSource } from "../lib/api";
import type { Track } from "../lib/types";
import { toast } from "./ui";

const DB_NAME = "illusive-offline-v1";
const DB_VERSION = 1;
const META_STORE = "meta";
const BLOB_STORE = "blobs";

interface OfflineMetaRecord {
  id: string;
  track: Track;
  addedAt: number;
  size: number;
  mime: string;
  thumbBlob?: Blob;
}

let dbPromise: Promise<IDBDatabase> | null = null;
const blobUrlCache = new Map<string, string>();
const thumbUrlCache = new Map<string, string>();

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function readAllMeta(): Promise<OfflineMetaRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, "readonly");
    const req = tx.objectStore(META_STORE).getAll();
    req.onsuccess = () => resolve((req.result as OfflineMetaRecord[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

async function writeOfflineRecord(meta: OfflineMetaRecord, audioBlob: Blob): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([META_STORE, BLOB_STORE], "readwrite");
    tx.objectStore(META_STORE).put(meta);
    tx.objectStore(BLOB_STORE).put(audioBlob, meta.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteOfflineRecord(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([META_STORE, BLOB_STORE], "readwrite");
    tx.objectStore(META_STORE).delete(id);
    tx.objectStore(BLOB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function readAudioBlob(id: string): Promise<Blob | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, "readonly");
    const req = tx.objectStore(BLOB_STORE).get(id);
    req.onsuccess = () => resolve((req.result as Blob) ?? null);
    req.onerror = () => reject(req.error);
  });
}

const CHUNK_BYTES = 2 * 1024 * 1024;

async function fetchDirectChunked(url: string): Promise<Blob> {
  const first = await fetch(url, { headers: { Range: `bytes=0-${CHUNK_BYTES - 1}` } });
  if (!first.ok) throw new Error(`HTTP ${first.status}`);
  const mime = first.headers.get("content-type") || "audio/mp4";
  const firstBuf = await first.arrayBuffer();
  const cr = first.headers.get("content-range");
  const total = cr ? Number(cr.split("/")[1]) : firstBuf.byteLength;
  if (!total || total <= firstBuf.byteLength) {
    return new Blob([firstBuf], { type: mime });
  }
  const ranges: [number, number][] = [];
  for (let start = CHUNK_BYTES; start < total; start += CHUNK_BYTES) {
    ranges.push([start, Math.min(total - 1, start + CHUNK_BYTES - 1)]);
  }
  const parts = new Array<ArrayBuffer>(ranges.length);
  let nextIdx = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (nextIdx < ranges.length) {
        const i = nextIdx++;
        const [start, end] = ranges[i]!;
        const r = await fetch(url, { headers: { Range: `bytes=${start}-${end}` } });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        parts[i] = await r.arrayBuffer();
      }
    }),
  );
  return new Blob([firstBuf, ...parts], { type: mime });
}

function hydrateTrack(meta: OfflineMetaRecord): Track {
  if (meta.thumbBlob) {
    let thumbUrl = thumbUrlCache.get(meta.id);
    if (!thumbUrl) {
      thumbUrl = URL.createObjectURL(meta.thumbBlob);
      thumbUrlCache.set(meta.id, thumbUrl);
    }
    return { ...meta.track, thumb: thumbUrl, art: thumbUrl };
  }
  return meta.track;
}

export interface OfflineState {
  tracks: Track[];
  downloading: Record<string, boolean>;
  loaded: boolean;
  load: () => Promise<void>;
  isOffline: (id: string) => boolean;
  isDownloading: (id: string) => boolean;
  downloadOffline: (track: Track) => Promise<void>;
  removeOffline: (id: string) => Promise<void>;
  toggleOffline: (track: Track) => Promise<void>;
}

export const useOffline = create<OfflineState>((set, get) => ({
  tracks: [],
  downloading: {},
  loaded: false,

  load: async () => {
    try {
      const records = await readAllMeta();
      records.sort((a, b) => b.addedAt - a.addedAt);
      set({ tracks: records.map(hydrateTrack), loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  isOffline: (id) => get().tracks.some((t) => t.id === id),

  isDownloading: (id) => Boolean(get().downloading[id]),

  downloadOffline: async (track) => {
    if (get().downloading[track.id] || get().isOffline(track.id)) return;
    const t = getT();
    set((s) => ({ downloading: { ...s.downloading, [track.id]: true } }));
    toast(t.trackMenu.downloading(track.title));

    try {
      const src = streamSource(track.id, "audio", "sd");
      let audioBlob: Blob;
      if (typeof src === "string") {
        const res = await fetch(`/api/download/${encodeURIComponent(track.id)}?kind=audio`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        audioBlob = await res.blob();
      } else {
        const directUrl = await src;
        audioBlob = await fetchDirectChunked(directUrl);
      }

      let thumbBlob: Blob | undefined;
      try {
        const thumbRes = await fetch(track.art || track.thumb);
        if (thumbRes.ok) thumbBlob = await thumbRes.blob();
      } catch {
        /* artwork optional */
      }

      const record: OfflineMetaRecord = {
        id: track.id,
        track,
        addedAt: Date.now(),
        size: audioBlob.size,
        mime: audioBlob.type || "audio/mp4",
        thumbBlob,
      };

      await writeOfflineRecord(record, audioBlob);
      const cachedUrl = URL.createObjectURL(audioBlob);
      blobUrlCache.set(track.id, cachedUrl);

      const hydrated = hydrateTrack(record);
      set((s) => {
        const nextDownloading = { ...s.downloading };
        delete nextDownloading[track.id];
        return {
          downloading: nextDownloading,
          tracks: [hydrated, ...s.tracks.filter((x) => x.id !== track.id)],
        };
      });
      toast(t.trackMenu.savedOffline(track.title));
    } catch (e) {
      set((s) => {
        const nextDownloading = { ...s.downloading };
        delete nextDownloading[track.id];
        return { downloading: nextDownloading };
      });
      toast((e as Error).message || t.player.streamFailed, "error");
    }
  },

  removeOffline: async (id) => {
    const existing = get().tracks.find((x) => x.id === id);
    const prev = get().tracks;
    set({ tracks: prev.filter((x) => x.id !== id) });
    const oldBlobUrl = blobUrlCache.get(id);
    if (oldBlobUrl) {
      URL.revokeObjectURL(oldBlobUrl);
      blobUrlCache.delete(id);
    }
    const oldThumbUrl = thumbUrlCache.get(id);
    if (oldThumbUrl) {
      URL.revokeObjectURL(oldThumbUrl);
      thumbUrlCache.delete(id);
    }
    try {
      await deleteOfflineRecord(id);
      if (existing) toast(getT().trackMenu.removedOffline(existing.title));
    } catch (e) {
      set({ tracks: prev });
      toast((e as Error).message, "error");
    }
  },

  toggleOffline: async (track) => {
    if (get().isOffline(track.id)) {
      await get().removeOffline(track.id);
    } else {
      await get().downloadOffline(track);
    }
  },
}));

/** Returns a local blob: URL if the track is saved in Offline Downloads, or null otherwise. */
export async function getOfflineBlobUrl(id: string): Promise<string | null> {
  const cached = blobUrlCache.get(id);
  if (cached) return cached;
  if (!useOffline.getState().isOffline(id)) return null;
  try {
    const blob = await readAudioBlob(id);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    blobUrlCache.set(id, url);
    return url;
  } catch {
    return null;
  }
}

