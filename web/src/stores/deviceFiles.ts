import { Capacitor } from "@capacitor/core";
import { create } from "zustand";
import { getT } from "../i18n";
import { api, systemMedia } from "../lib/api";
import type { Track } from "../lib/types";
import { scanAndroidLocalMusic, type NativeLocalTrack } from "../native/android";
import { useLibrary } from "./library";
import { toast } from "./ui";

const DB_NAME = "illusive-device-files-v1";
const DB_VERSION = 1;
const META_STORE = "meta";
const BLOB_STORE = "blobs";

export const LOCAL_TRACK_PREFIX = "local:";
const MIN_LOCAL_DURATION_SEC = 165; // ~3 min (with tolerance from 2:45)
const MAX_LOCAL_DURATION_SEC = 435; // ~7 min (with tolerance up to 7:15)
const LOCAL_PLAYLIST_NAME = "Local Music";

const AUDIO_EXT_RE = /\.(mp3|m4a|m4b|aac|flac|wav|ogg|opus|webm|mp4|caf|aiff?)$/i;

export function isEligibleLocalTrack(fileName: string, title: string, durationSec: number): boolean {
  if (!Number.isFinite(durationSec) || durationSec < MIN_LOCAL_DURATION_SEC || durationSec > MAX_LOCAL_DURATION_SEC) {
    return false;
  }
  if (/rec/i.test(fileName) || /rec/i.test(title)) return false;
  return true;
}

export interface DeviceFileRecord {
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
const streamUrlCache = new Map<string, string>();
let syncPlaylistChain: Promise<void> = Promise.resolve();

function scanIosLocalMusic(): Promise<NativeLocalTrack[]> {
  const bridge = (
    globalThis as { webkit?: { messageHandlers?: { musikeAudio?: { postMessage: (msg: unknown) => void } } } }
  ).webkit?.messageHandlers?.musikeAudio;
  if (!bridge) return Promise.resolve([]);
  return new Promise((resolve) => {
    const host = globalThis as { __musikeIosLocalMusic?: (tracks: NativeLocalTrack[]) => void };
    const timer = setTimeout(() => {
      if (host.__musikeIosLocalMusic === onResult) delete host.__musikeIosLocalMusic;
      resolve([]);
    }, 6000);
    const onResult = (tracks: NativeLocalTrack[]) => {
      clearTimeout(timer);
      if (host.__musikeIosLocalMusic === onResult) delete host.__musikeIosLocalMusic;
      resolve(Array.isArray(tracks) ? tracks : []);
    };
    host.__musikeIosLocalMusic = onResult;
    try {
      bridge.postMessage({ cmd: "scanLocal" });
    } catch {
      clearTimeout(timer);
      if (host.__musikeIosLocalMusic === onResult) delete host.__musikeIosLocalMusic;
      resolve([]);
    }
  });
}

async function waitForLibraryReady(): Promise<void> {
  const lib = useLibrary.getState();
  if (lib.status === "ready") return;
  if (lib.status === "idle" || lib.status === "error") {
    await lib.load();
    return;
  }
  await new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      unsub();
      clearTimeout(timer);
      resolve();
    };
    const unsub = useLibrary.subscribe((st) => {
      if (st.status !== "loading") done();
    });
    const timer = setTimeout(done, 5000);
    if (useLibrary.getState().status !== "loading") done();
  });
}

async function runSyncLocalMusicPlaylist(tracks: Track[]): Promise<void> {
  const eligible = tracks.filter((tr) => isEligibleLocalTrack("", tr.title, tr.duration));
  try {
    await waitForLibraryReady();
    const libState = useLibrary.getState();
    const existing = libState.playlists.find((p) => p.name.trim().toLowerCase() === LOCAL_PLAYLIST_NAME.toLowerCase());
    if (!existing) {
      if (!eligible.length) return;
      const created = await api.createPlaylist(LOCAL_PLAYLIST_NAME, eligible.slice(0, 500));
      useLibrary.setState((s) => ({
        playlists: [created, ...s.playlists.filter((p) => p.id !== created.id)],
      }));
      return;
    }

    const wantedIds = new Set(eligible.map((t) => t.id));
    let latest = existing;

    for (const current of existing.tracks) {
      const keep = isLocalTrack(current.id)
        ? wantedIds.has(current.id) && isEligibleLocalTrack("", current.title, current.duration)
        : !/rec/i.test(current.title);
      if (!keep) {
        latest = await api.removeFromPlaylist(existing.id, current.id);
      }
    }

    const haveIds = new Set(latest.tracks.map((t) => t.id));
    const missing = eligible.filter((t) => !haveIds.has(t.id));
    if (missing.length) {
      latest = await api.addToPlaylist(existing.id, missing.slice(0, 500));
    }

    if (latest !== existing) {
      useLibrary.setState((s) => ({
        playlists: s.playlists.map((p) => (p.id === latest.id ? latest : p)),
      }));
    }
  } catch {
    // Playlist sync failure should never interrupt device playback or UI loading.
  }
}

export function syncLocalMusicPlaylist(tracks: Track[]): Promise<void> {
  const snapshot = tracks.slice();
  syncPlaylistChain = syncPlaylistChain.then(() => runSyncLocalMusicPlaylist(snapshot)).catch(() => {});
  return syncPlaylistChain;
}

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

async function readAllMeta(): Promise<DeviceFileRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, "readonly");
    const req = tx.objectStore(META_STORE).getAll();
    req.onsuccess = () => resolve((req.result as DeviceFileRecord[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

async function writeDeviceRecord(meta: DeviceFileRecord, audioBlob: Blob): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([META_STORE, BLOB_STORE], "readwrite");
    tx.objectStore(META_STORE).put(meta);
    tx.objectStore(BLOB_STORE).put(audioBlob, meta.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteDeviceRecord(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([META_STORE, BLOB_STORE], "readwrite");
    tx.objectStore(META_STORE).delete(id);
    tx.objectStore(BLOB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function clearDeviceDb(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([META_STORE, BLOB_STORE], "readwrite");
    tx.objectStore(META_STORE).clear();
    tx.objectStore(BLOB_STORE).clear();
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

function stableIdForFile(file: File): string {
  const key = `${file.name}:${file.size}:${file.lastModified}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    const ch = key.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= (ch << 5) | i;
    h2 = Math.imul(h2, 0x01000193);
  }
  return `${LOCAL_TRACK_PREFIX}${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}`;
}

export function isLocalTrack(id: string | undefined | null): boolean {
  return !!id && id.startsWith(LOCAL_TRACK_PREFIX);
}

export function isSupportedAudioFile(file: File): boolean {
  if (file.type.startsWith("audio/")) return true;
  if (file.type === "video/mp4" || file.type === "video/webm") return AUDIO_EXT_RE.test(file.name);
  return AUDIO_EXT_RE.test(file.name);
}

function decodeId3Text(bytes: Uint8Array): string {
  if (bytes.length < 2) return "";
  const encoding = bytes[0]!;
  const payload = bytes.subarray(1);
  try {
    let text = "";
    if (encoding === 0) {
      text = new TextDecoder("latin1").decode(payload);
    } else if (encoding === 1) {
      if (payload.length >= 2 && payload[0] === 0xfe && payload[1] === 0xff) {
        text = new TextDecoder("utf-16be").decode(payload.subarray(2));
      } else if (payload.length >= 2 && payload[0] === 0xff && payload[1] === 0xfe) {
        text = new TextDecoder("utf-16le").decode(payload.subarray(2));
      } else {
        text = new TextDecoder("utf-16le").decode(payload);
      }
    } else if (encoding === 2) {
      text = new TextDecoder("utf-16be").decode(payload);
    } else {
      text = new TextDecoder("utf-8").decode(payload);
    }
    return text.replace(/\0+$/g, "").trim();
  } catch {
    return "";
  }
}

interface ParsedTags {
  title?: string;
  artist?: string;
  album?: string;
  thumbBlob?: Blob;
}

async function parseId3v2(file: File): Promise<ParsedTags> {
  const slice = await file.slice(0, 262_144).arrayBuffer();
  const buf = new Uint8Array(slice);
  if (buf.length < 10 || buf[0] !== 0x49 || buf[1] !== 0x44 || buf[2] !== 0x33) return {};

  const major = buf[3]!;
  if (major < 3 || major > 4) return {};

  const flags = buf[5]!;
  const totalSize =
    ((buf[6]! & 0x7f) << 21) | ((buf[7]! & 0x7f) << 14) | ((buf[8]! & 0x7f) << 7) | (buf[9]! & 0x7f);
  const limit = Math.min(buf.length, 10 + totalSize);
  let offset = 10;

  if ((flags & 0x40) !== 0 && offset + 4 <= limit) {
    const extSize =
      major === 4
        ? ((buf[offset]! & 0x7f) << 21) |
          ((buf[offset + 1]! & 0x7f) << 14) |
          ((buf[offset + 2]! & 0x7f) << 7) |
          (buf[offset + 3]! & 0x7f)
        : ((buf[offset]! << 24) | (buf[offset + 1]! << 16) | (buf[offset + 2]! << 8) | buf[offset + 3]!) + 4;
    offset += extSize;
  }

  const out: ParsedTags = {};
  while (offset + 10 <= limit) {
    const idBytes = buf.subarray(offset, offset + 4);
    if (idBytes[0] === 0) break;
    const frameId = String.fromCharCode(idBytes[0]!, idBytes[1]!, idBytes[2]!, idBytes[3]!);
    const frameSize =
      major === 4
        ? ((buf[offset + 4]! & 0x7f) << 21) |
          ((buf[offset + 5]! & 0x7f) << 14) |
          ((buf[offset + 6]! & 0x7f) << 7) |
          (buf[offset + 7]! & 0x7f)
        : (buf[offset + 4]! << 24) | (buf[offset + 5]! << 16) | (buf[offset + 6]! << 8) | buf[offset + 7]!;

    offset += 10;
    if (frameSize <= 0 || offset + frameSize > buf.length) break;

    const frame = buf.subarray(offset, offset + frameSize);
    offset += frameSize;

    if (frameId === "TIT2" && !out.title) out.title = decodeId3Text(frame);
    else if (frameId === "TPE1" && !out.artist) out.artist = decodeId3Text(frame);
    else if (frameId === "TALB" && !out.album) out.album = decodeId3Text(frame);
    else if (frameId === "APIC" && !out.thumbBlob && frame.length > 8) {
      const enc = frame[0]!;
      let pos = 1;
      while (pos < frame.length && frame[pos] !== 0) pos++;
      const mime = String.fromCharCode(...frame.subarray(1, pos)) || "image/jpeg";
      pos += 2; // null + picture type
      if (enc === 1 || enc === 2) {
        while (pos + 1 < frame.length && !(frame[pos] === 0 && frame[pos + 1] === 0)) pos += 2;
        pos += 2;
      } else {
        while (pos < frame.length && frame[pos] !== 0) pos++;
        pos += 1;
      }
      if (pos < frame.length) {
        out.thumbBlob = new Blob([frame.subarray(pos)], { type: mime });
      }
    }
  }
  return out;
}

function parseFilenameMetadata(name: string): { title: string; artist: string } {
  const base = name.replace(/\.[^.]+$/, "").replace(/_/g, " ").trim();
  const dashIdx = base.indexOf(" - ");
  if (dashIdx > 0 && dashIdx < base.length - 3) {
    return {
      artist: base.slice(0, dashIdx).trim() || "Local File",
      title: base.slice(dashIdx + 3).trim() || base,
    };
  }
  return { title: base || "Audio Track", artist: "Local File" };
}

function probeDuration(file: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const probe = new Audio();
    let settled = false;
    const done = (dur: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      probe.removeAttribute("src");
      probe.load();
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(dur) && dur > 0 ? Math.round(dur) : 0);
    };
    const timer = setTimeout(() => done(0), 2500);
    probe.preload = "metadata";
    probe.addEventListener("loadedmetadata", () => done(probe.duration));
    probe.addEventListener("error", () => done(0));
    probe.src = url;
  });
}

function hydrateRecord(record: DeviceFileRecord): Track {
  if (record.thumbBlob) {
    let thumbUrl = thumbUrlCache.get(record.id);
    if (!thumbUrl) {
      thumbUrl = URL.createObjectURL(record.thumbBlob);
      thumbUrlCache.set(record.id, thumbUrl);
    }
    return { ...record.track, thumb: thumbUrl, art: thumbUrl };
  }
  return record.track;
}

export interface DeviceFilesState {
  tracks: Track[];
  sizes: Record<string, number>;
  importing: boolean;
  loaded: boolean;
  load: () => Promise<void>;
  importFiles: (files: FileList | File[]) => Promise<number>;
  removeFile: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

export const useDeviceFiles = create<DeviceFilesState>((set, get) => ({
  tracks: [],
  sizes: {},
  importing: false,
  loaded: false,

  load: async () => {
    try {
      const recordsPromise = readAllMeta().catch((): DeviceFileRecord[] => []);
      const scanPromise = (async (): Promise<{ tracks: Track[]; sizes: Record<string, number> }> => {
        if (!Capacitor.isNativePlatform() && !systemMedia) {
          try {
            const res = await fetch("/api/local-music");
            if (!res.ok) return { tracks: [], sizes: {} };
            const body = (await res.json()) as { tracks?: Track[]; sizes?: Record<string, number> };
            const tracks = Array.isArray(body.tracks)
              ? body.tracks.filter((tr) => isEligibleLocalTrack("", tr.title, tr.duration))
              : [];
            for (const tr of tracks) {
              streamUrlCache.set(tr.id, `/api/local-music/${encodeURIComponent(tr.id)}/stream`);
            }
            return { tracks, sizes: body.sizes ?? {} };
          } catch {
            return { tracks: [], sizes: {} };
          }
        }

        const nativeList =
          Capacitor.getPlatform() === "android"
            ? await scanAndroidLocalMusic()
            : Capacitor.getPlatform() === "ios"
              ? await scanIosLocalMusic()
              : [];
        const tracks: Track[] = [];
        const sizes: Record<string, number> = {};
        for (const item of nativeList) {
          if (!isEligibleLocalTrack(item.fileName ?? "", item.title, item.duration)) continue;
          streamUrlCache.set(item.id, item.url);
          if (item.size) sizes[item.id] = item.size;
          tracks.push({
            id: item.id,
            title: item.title,
            artist: item.artist,
            album: item.album,
            duration: item.duration,
            thumb: (item as unknown as { thumb?: string }).thumb ?? "",
            art: (item as unknown as { art?: string }).art ?? "",
            kind: "song",
          });
        }
        return { tracks, sizes };
      })();

      const [records, scanned] = await Promise.all([recordsPromise, scanPromise]);
      records.sort((a, b) => b.addedAt - a.addedAt);

      const sizes: Record<string, number> = { ...scanned.sizes };
      const merged: Track[] = [...scanned.tracks];
      const seenIds = new Set(merged.map((t) => t.id));
      const seenSignatures = new Set(merged.map((t) => `${t.title.toLowerCase()}|${t.artist.toLowerCase()}|${t.duration}`));

      for (const r of records) {
        if (!isEligibleLocalTrack("", r.track.title, r.track.duration)) continue;
        sizes[r.id] = r.size;
        const sig = `${r.track.title.toLowerCase()}|${r.track.artist.toLowerCase()}|${r.track.duration}`;
        if (seenIds.has(r.id) || seenSignatures.has(sig)) continue;
        seenIds.add(r.id);
        seenSignatures.add(sig);
        merged.push(hydrateRecord(r));
      }

      set({ tracks: merged, sizes, loaded: true });
      void syncLocalMusicPlaylist(merged);
    } catch {
      set({ loaded: true });
    }
  },

  importFiles: async (input) => {
    const list = Array.from(input).filter(isSupportedAudioFile);
    if (!list.length) return 0;
    set({ importing: true });
    let imported = 0;
    let skipped = 0;

    try {
      for (const file of list) {
        if (/rec/i.test(file.name)) {
          skipped++;
          continue;
        }
        const id = stableIdForFile(file);
        const [tags, duration] = await Promise.all([parseId3v2(file).catch((): ParsedTags => ({})), probeDuration(file)]);
        const fallback = parseFilenameMetadata(file.name);
        const title = tags.title || fallback.title;
        if (!isEligibleLocalTrack(file.name, title, duration)) {
          skipped++;
          continue;
        }
        const track: Track = {
          id,
          title,
          artist: tags.artist || fallback.artist,
          album: tags.album,
          duration,
          thumb: "",
          art: "",
          kind: "song",
        };
        const record: DeviceFileRecord = {
          id,
          track,
          addedAt: Date.now(),
          size: file.size,
          mime: file.type || "audio/mpeg",
          thumbBlob: tags.thumbBlob,
        };
        await writeDeviceRecord(record, file);
        const oldUrl = blobUrlCache.get(id);
        if (oldUrl) URL.revokeObjectURL(oldUrl);
        blobUrlCache.set(id, URL.createObjectURL(file));

        const hydrated = hydrateRecord(record);
        set((s) => ({
          tracks: [hydrated, ...s.tracks.filter((x) => x.id !== id)],
          sizes: { ...s.sizes, [id]: file.size },
        }));
        imported++;
      }
      if (imported > 0) {
        toast(getT().device.importedCount(imported));
        void syncLocalMusicPlaylist(get().tracks);
      } else if (skipped > 0) {
        toast("Skipped files outside 3–7 min or containing 'rec' in filename");
      }
    } catch (e) {
      toast((e as Error).message || "Failed to import audio files", "error");
    } finally {
      set({ importing: false });
    }
    return imported;
  },

  removeFile: async (id) => {
    const prevTracks = get().tracks;
    const prevSizes = get().sizes;
    const nextSizes = { ...prevSizes };
    delete nextSizes[id];
    const nextTracks = prevTracks.filter((x) => x.id !== id);
    set({ tracks: nextTracks, sizes: nextSizes });
    streamUrlCache.delete(id);

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
      await deleteDeviceRecord(id);
      void syncLocalMusicPlaylist(nextTracks);
    } catch (e) {
      set({ tracks: prevTracks, sizes: prevSizes });
      toast((e as Error).message, "error");
    }
  },

  clearAll: async () => {
    for (const url of blobUrlCache.values()) URL.revokeObjectURL(url);
    blobUrlCache.clear();
    for (const url of thumbUrlCache.values()) URL.revokeObjectURL(url);
    thumbUrlCache.clear();
    streamUrlCache.clear();
    set({ tracks: [], sizes: {} });
    await clearDeviceDb();
    void syncLocalMusicPlaylist([]);
  },
}));

/** Returns a playable URL (native stream, server stream, or IndexedDB blob:) for a local music track. */
export async function getDeviceFileBlobUrl(id: string): Promise<string | null> {
  if (!isLocalTrack(id)) return null;
  const cachedStream = streamUrlCache.get(id);
  if (cachedStream) return cachedStream;
  const cached = blobUrlCache.get(id);
  if (cached) return cached;
  try {
    const blob = await readAudioBlob(id);
    if (blob) {
      const url = URL.createObjectURL(blob);
      blobUrlCache.set(id, url);
      return url;
    }
  } catch {
    // Fall through to native/server resolution below.
  }
  if (!useDeviceFiles.getState().loaded) {
    await useDeviceFiles.getState().load();
    const afterLoad = streamUrlCache.get(id) ?? blobUrlCache.get(id);
    if (afterLoad) return afterLoad;
  }
  if (!Capacitor.isNativePlatform() && !systemMedia && !id.startsWith("local:android-") && !id.startsWith("local:ios-")) {
    return `/api/local-music/${encodeURIComponent(id)}/stream`;
  }
  return null;
}

