import { create } from "zustand";
import { getT } from "../i18n";
import type { Track } from "../lib/types";
import { toast } from "./ui";

const DB_NAME = "illusive-device-files-v1";
const DB_VERSION = 1;
const META_STORE = "meta";
const BLOB_STORE = "blobs";

export const LOCAL_TRACK_PREFIX = "local:";

const AUDIO_EXT_RE = /\.(mp3|m4a|m4b|aac|flac|wav|ogg|opus|webm|mp4|caf|aiff?)$/i;

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
      const records = await readAllMeta();
      records.sort((a, b) => b.addedAt - a.addedAt);
      const sizes: Record<string, number> = {};
      for (const r of records) sizes[r.id] = r.size;
      set({ tracks: records.map(hydrateRecord), sizes, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  importFiles: async (input) => {
    const list = Array.from(input).filter(isSupportedAudioFile);
    if (!list.length) return 0;
    set({ importing: true });
    let imported = 0;

    try {
      for (const file of list) {
        const id = stableIdForFile(file);
        const [tags, duration] = await Promise.all([parseId3v2(file).catch((): ParsedTags => ({})), probeDuration(file)]);
        const fallback = parseFilenameMetadata(file.name);
        const track: Track = {
          id,
          title: tags.title || fallback.title,
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
      if (imported > 0) toast(getT().device.importedCount(imported));
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
    set({ tracks: prevTracks.filter((x) => x.id !== id), sizes: nextSizes });

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
    set({ tracks: [], sizes: {} });
    await clearDeviceDb();
  },
}));

/** Returns an object blob: URL for an imported local music file, or null if not found. */
export async function getDeviceFileBlobUrl(id: string): Promise<string | null> {
  if (!isLocalTrack(id)) return null;
  const cached = blobUrlCache.get(id);
  if (cached) return cached;
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

