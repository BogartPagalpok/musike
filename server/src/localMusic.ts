import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { open, readdir, realpath, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { tools } from "./tools.js";
import { LOCAL_TRACK_ID, type Track } from "./types.js";

const exec = promisify(execFile);

const MIN_DURATION_SEC = 165; // ~2m45s ("around 3-7 minutes")
const MAX_DURATION_SEC = 435; // ~7m15s
const MAX_DEPTH = 3;
const MAX_FILES_PER_SCAN = 1500;

const MIME_BY_EXT: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".m4b": "audio/mp4",
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".webm": "audio/webm",
  ".caf": "audio/x-caf",
  ".aif": "audio/aiff",
  ".aiff": "audio/aiff",
};

export interface ScannedLocalTrack {
  track: Track;
  size: number;
}

interface IndexedFile {
  file: string;
  mime: string;
}

const fileIndex = new Map<string, IndexedFile>();
let lastScanAt = 0;
let lastScanResult: { tracks: ScannedLocalTrack[]; scannedDirs: string[] } | null = null;
let scanInFlight: Promise<{ tracks: ScannedLocalTrack[]; scannedDirs: string[] }> | null = null;

export function hasExcludedRecName(value: string): boolean {
  return /rec/i.test(value);
}

export function cleanTrackTitle(fileName: string): { title: string; artist: string } {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim();
  const dash = base.indexOf(" - ");
  if (dash > 0 && dash < base.length - 3) {
    return {
      artist: base.slice(0, dash).trim() || "Local Device",
      title: base.slice(dash + 3).trim() || base,
    };
  }
  return { artist: "Local Device", title: base || "Unknown Track" };
}

function makeLocalId(realFile: string): string {
  const digest = createHash("sha1").update(realFile).digest("base64url").slice(0, 16);
  return `local:${digest}`;
}

function syncsafe(buf: Buffer, off: number): number {
  return (
    ((buf[off]! & 0x7f) << 21) |
    ((buf[off + 1]! & 0x7f) << 14) |
    ((buf[off + 2]! & 0x7f) << 7) |
    (buf[off + 3]! & 0x7f)
  );
}

function decodeId3Text(buf: Buffer): string {
  if (buf.length < 2) return "";
  const enc = buf[0];
  const payload = buf.subarray(1);
  let text = "";
  if (enc === 0) text = payload.toString("latin1");
  else if (enc === 1 || enc === 2) {
    const start = payload.length >= 2 && ((payload[0] === 0xff && payload[1] === 0xfe) || (payload[0] === 0xfe && payload[1] === 0xff)) ? 2 : 0;
    const isBE = enc === 2 || (payload[0] === 0xfe && payload[1] === 0xff);
    const slice = payload.subarray(start);
    if (isBE) {
      const swapped = Buffer.from(slice);
      for (let i = 0; i + 1 < swapped.length; i += 2) {
        const tmp = swapped[i]!;
        swapped[i] = swapped[i + 1]!;
        swapped[i + 1] = tmp;
      }
      text = swapped.toString("utf16le");
    } else {
      text = slice.toString("utf16le");
    }
  } else {
    text = payload.toString("utf8");
  }
  return text.replace(/\0+/g, "").trim();
}

function parseId3Tags(buf: Buffer): { title?: string; artist?: string; album?: string; audioOffset: number } {
  if (buf.length < 10 || buf.toString("ascii", 0, 3) !== "ID3") return { audioOffset: 0 };
  const ver = buf[3]!;
  const size = syncsafe(buf, 6);
  const end = Math.min(buf.length, 10 + size);
  let pos = 10;
  if ((buf[5]! & 0x40) !== 0 && pos + 4 <= end) {
    const ext = ver === 4 ? syncsafe(buf, pos) : buf.readUInt32BE(pos);
    pos += ver === 4 ? ext : ext + 4;
  }

  let title: string | undefined;
  let artist: string | undefined;
  let album: string | undefined;

  while (pos + (ver === 2 ? 6 : 10) <= end) {
    if (buf[pos] === 0) break;
    const frameId = buf.toString("ascii", pos, pos + (ver === 2 ? 3 : 4));
    const frameSize =
      ver === 2
        ? (buf[pos + 3]! << 16) | (buf[pos + 4]! << 8) | buf[pos + 5]!
        : ver === 4
          ? syncsafe(buf, pos + 4)
          : buf.readUInt32BE(pos + 4);
    pos += ver === 2 ? 6 : 10;
    if (frameSize <= 0 || pos + frameSize > end) break;
    const slice = buf.subarray(pos, pos + frameSize);
    if (frameId === "TIT2" || frameId === "TT2") title = decodeId3Text(slice) || title;
    else if (frameId === "TPE1" || frameId === "TP1") artist = decodeId3Text(slice) || artist;
    else if (frameId === "TALB" || frameId === "TAL") album = decodeId3Text(slice) || album;
    pos += frameSize;
  }

  return { title, artist, album, audioOffset: 10 + size };
}

const MPEG1_L3_BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const MPEG2_L3_BITRATES = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
const MPEG1_SR = [44100, 48000, 32000, 0];
const MPEG2_SR = [22050, 24000, 16000, 0];
const MPEG25_SR = [11025, 12000, 8000, 0];

function parseMp3Duration(buf: Buffer, audioOffset: number, totalSize: number): number {
  const start = Math.min(Math.max(0, audioOffset), buf.length);
  for (let i = start; i + 4 < buf.length; i++) {
    if (buf[i] !== 0xff || (buf[i + 1]! & 0xe0) !== 0xe0) continue;
    const verBits = (buf[i + 1]! >> 3) & 0x03;
    const layerBits = (buf[i + 1]! >> 1) & 0x03;
    const bitrateIdx = (buf[i + 2]! >> 4) & 0x0f;
    const srIdx = (buf[i + 2]! >> 2) & 0x03;
    const modeBits = (buf[i + 3]! >> 6) & 0x03;
    if (verBits === 1 || layerBits === 0 || bitrateIdx === 0 || bitrateIdx === 15 || srIdx === 3) continue;

    const isV1 = verBits === 3;
    const sr = isV1 ? MPEG1_SR[srIdx]! : verBits === 2 ? MPEG2_SR[srIdx]! : MPEG25_SR[srIdx]!;
    if (!sr) continue;

    const samplesPerFrame = layerBits === 3 ? 384 : isV1 || layerBits === 2 ? 1152 : 576;
    const sideInfo = isV1 ? (modeBits === 3 ? 17 : 32) : modeBits === 3 ? 9 : 17;
    const xingOff = i + 4 + sideInfo;
    if (xingOff + 12 <= buf.length) {
      const tag = buf.toString("ascii", xingOff, xingOff + 4);
      if (tag === "Xing" || tag === "Info") {
        const flags = buf.readUInt32BE(xingOff + 4);
        if ((flags & 0x01) !== 0) {
          const frames = buf.readUInt32BE(xingOff + 8);
          if (frames > 0) return Math.round((frames * samplesPerFrame) / sr);
        }
      }
    }
    if (i + 36 + 18 <= buf.length && buf.toString("ascii", i + 36, i + 40) === "VBRI") {
      const frames = buf.readUInt32BE(i + 36 + 14);
      if (frames > 0) return Math.round((frames * samplesPerFrame) / sr);
    }

    const kbps = isV1 ? MPEG1_L3_BITRATES[bitrateIdx]! : MPEG2_L3_BITRATES[bitrateIdx]!;
    if (kbps > 0 && totalSize > i) {
      return Math.round(((totalSize - i) * 8) / (kbps * 1000));
    }
  }
  return 0;
}

function parseFlacDuration(buf: Buffer): number {
  if (buf.length < 42 || buf.toString("ascii", 0, 4) !== "fLaC") return 0;
  // STREAMINFO starts at offset 8: bytes 10..17 hold sample rate (20b), channels (3b), bps (5b), total samples (36b)
  const sr = (buf[18]! << 12) | (buf[19]! << 4) | (buf[20]! >> 4);
  const totalSamples =
    (buf[21]! & 0x0f) * 4294967296 +
    ((buf[22]! << 24) >>> 0) +
    (buf[23]! << 16) +
    (buf[24]! << 8) +
    buf[25]!;
  return sr > 0 && totalSamples > 0 ? Math.round(totalSamples / sr) : 0;
}

function parseWavDuration(buf: Buffer): number {
  if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    return 0;
  }
  let pos = 12;
  let byteRate = 0;
  let dataSize = 0;
  while (pos + 8 <= buf.length) {
    const id = buf.toString("ascii", pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    if (id === "fmt " && pos + 24 <= buf.length) byteRate = buf.readUInt32LE(pos + 16);
    if (id === "data") dataSize = size;
    if (byteRate && dataSize) return Math.round(dataSize / byteRate);
    pos += 8 + size + (size & 1);
  }
  return byteRate && dataSize ? Math.round(dataSize / byteRate) : 0;
}

async function parseMp4Duration(filePath: string, totalSize: number): Promise<number> {
  const fh = await open(filePath, "r");
  const hdr = Buffer.allocUnsafe(16);
  try {
    let pos = 0;
    while (pos + 8 <= totalSize) {
      const { bytesRead } = await fh.read(hdr, 0, 16, pos);
      if (bytesRead < 8) break;
      let size = hdr.readUInt32BE(0);
      const type = hdr.toString("ascii", 4, 8);
      let headerSize = 8;
      if (size === 1 && bytesRead >= 16) {
        size = Number(hdr.readBigUInt64BE(8));
        headerSize = 16;
      } else if (size === 0) {
        size = totalSize - pos;
      }
      if (size < headerSize || pos + size > totalSize) break;
      if (type === "moov") {
        const moovLen = Math.min(size, 512 * 1024);
        const moov = Buffer.allocUnsafe(moovLen);
        await fh.read(moov, 0, moovLen, pos);
        let inner = headerSize;
        while (inner + 8 <= moovLen) {
          const iSize = moov.readUInt32BE(inner);
          const iType = moov.toString("ascii", inner + 4, inner + 8);
          if (iSize < 8) break;
          if (iType === "mvhd" && inner + 28 <= moovLen) {
            const ver = moov[inner + 8]!;
            if (ver === 0) {
              const timescale = moov.readUInt32BE(inner + 20);
              const dur = moov.readUInt32BE(inner + 24);
              if (timescale > 0) return Math.round(dur / timescale);
            } else if (ver === 1 && inner + 36 <= moovLen) {
              const timescale = moov.readUInt32BE(inner + 28);
              const dur = Number(moov.readBigUInt64BE(inner + 32));
              if (timescale > 0) return Math.round(dur / timescale);
            }
          }
          inner += iSize;
        }
        break;
      }
      pos += size;
    }
  } finally {
    await fh.close();
  }
  return 0;
}

async function parseOggDuration(filePath: string, totalSize: number, head: Buffer): Promise<number> {
  if (head.length < 36 || head.toString("ascii", 0, 4) !== "OggS") return 0;
  let sr = 0;
  const vorbisIdx = head.indexOf("vorbis", 0, "ascii");
  if (vorbisIdx >= 0 && vorbisIdx + 16 <= head.length) sr = head.readUInt32LE(vorbisIdx + 11);
  else if (head.includes("OpusHead", 0, "ascii")) sr = 48000;
  if (!sr) return 0;

  const tailLen = Math.min(totalSize, 65536);
  const fh = await open(filePath, "r");
  try {
    const tail = Buffer.allocUnsafe(tailLen);
    await fh.read(tail, 0, tailLen, totalSize - tailLen);
    for (let i = tail.length - 14; i >= 0; i--) {
      if (tail[i] === 0x4f && tail[i + 1] === 0x67 && tail[i + 2] === 0x67 && tail[i + 3] === 0x53) {
        const granule = tail.readBigUInt64LE(i + 6);
        if (granule > 0n) return Math.round(Number(granule) / sr);
      }
    }
  } finally {
    await fh.close();
  }
  return 0;
}

async function probeDurationWithFfprobe(filePath: string): Promise<number> {
  const ffmpegPath = tools().ffmpeg;
  const candidates = ffmpegPath
    ? [path.join(path.dirname(ffmpegPath), process.platform === "win32" ? "ffprobe.exe" : "ffprobe"), "ffprobe"]
    : ["ffprobe"];
  for (const bin of candidates) {
    try {
      const { stdout } = await exec(
        bin,
        ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath],
        { timeout: 3000 },
      );
      const val = Number.parseFloat(stdout.trim());
      if (Number.isFinite(val) && val > 0) return Math.round(val);
    } catch {
      // Try next candidate
    }
  }
  return 0;
}

async function inspectAudioFile(filePath: string, ext: string, fileSize: number): Promise<ScannedLocalTrack | null> {
  const headLen = Math.min(fileSize, 131072);
  if (headLen < 64) return null;
  const fh = await open(filePath, "r");
  const head = Buffer.allocUnsafe(headLen);
  try {
    await fh.read(head, 0, headLen, 0);
  } finally {
    await fh.close();
  }

  const tags = ext === ".mp3" ? parseId3Tags(head) : { audioOffset: 0 };
  const fallback = cleanTrackTitle(path.basename(filePath));
  const title = tags.title || fallback.title;
  const artist = tags.artist || fallback.artist;
  const album = tags.album;

  if (hasExcludedRecName(path.basename(filePath)) || hasExcludedRecName(title)) return null;

  let duration = 0;
  if (ext === ".mp3") duration = parseMp3Duration(head, tags.audioOffset, fileSize);
  else if (ext === ".flac") duration = parseFlacDuration(head);
  else if (ext === ".wav") duration = parseWavDuration(head);
  else if (ext === ".m4a" || ext === ".m4b") duration = await parseMp4Duration(filePath, fileSize);
  else if (ext === ".ogg" || ext === ".opus") duration = await parseOggDuration(filePath, fileSize, head);

  if (duration === 0 && (ext === ".m4a" || ext === ".m4b")) {
    // Some MP4 files place `moov` at EOF; check `ffprobe` if available.
    duration = await probeDurationWithFfprobe(filePath);
  } else if (duration === 0) {
    duration = await probeDurationWithFfprobe(filePath);
  }

  if (duration < MIN_DURATION_SEC || duration > MAX_DURATION_SEC) return null;

  const real = await realpath(filePath).catch(() => path.resolve(filePath));
  const id = makeLocalId(real);
  fileIndex.set(id, { file: real, mime: MIME_BY_EXT[ext] ?? "audio/mpeg" });

  return {
    size: fileSize,
    track: {
      id,
      title,
      artist,
      album,
      duration,
      thumb: "",
      art: "",
      kind: "song",
    },
  };
}

function defaultScanDirs(): string[] {
  const home = os.homedir();
  const candidates = [path.join(home, "Music"), path.join(home, "Downloads"), path.join(home, "Desktop")];
  return candidates.filter((dir) => existsSync(dir));
}

async function walkDirectory(
  dir: string,
  depth: number,
  seenDirs: Set<string>,
  seenFiles: Set<string>,
  collected: Array<{ path: string; ext: string; size: number }>,
) {
  if (depth > MAX_DEPTH || collected.length >= MAX_FILES_PER_SCAN) return;
  const realDir = await realpath(dir).catch(() => path.resolve(dir));
  if (seenDirs.has(realDir)) return;
  seenDirs.add(realDir);

  let entries;
  try {
    entries = await readdir(realDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (collected.length >= MAX_FILES_PER_SCAN) break;
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const full = path.join(realDir, entry.name);
    if (entry.isDirectory()) {
      await walkDirectory(full, depth + 1, seenDirs, seenFiles, collected);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (!MIME_BY_EXT[ext]) continue;
      if (hasExcludedRecName(entry.name)) continue;
      const st = await stat(full).catch(() => null);
      if (!st || st.size < 4096) continue;
      const key = `${st.size}:${entry.name}`;
      if (seenFiles.has(full) || seenFiles.has(key)) continue;
      seenFiles.add(full);
      seenFiles.add(key);
      collected.push({ path: full, ext, size: st.size });
    }
  }
}

export async function scanLocalMusic(force = false): Promise<{ tracks: ScannedLocalTrack[]; scannedDirs: string[] }> {
  if (!force && lastScanResult && Date.now() - lastScanAt < 25_000) {
    return lastScanResult;
  }
  if (scanInFlight) return scanInFlight;

  scanInFlight = (async () => {
    const dirs = defaultScanDirs();
    const seenDirs = new Set<string>();
    const seenFiles = new Set<string>();
    const candidates: Array<{ path: string; ext: string; size: number }> = [];

    for (const dir of dirs) {
      await walkDirectory(dir, 0, seenDirs, seenFiles, candidates);
    }

    const tracks: ScannedLocalTrack[] = [];
    for (const item of candidates) {
      const parsed = await inspectAudioFile(item.path, item.ext, item.size).catch(() => null);
      if (parsed) tracks.push(parsed);
    }

    tracks.sort((a, b) => a.track.title.localeCompare(b.track.title));
    lastScanResult = { tracks, scannedDirs: dirs };
    lastScanAt = Date.now();
    return lastScanResult;
  })().finally(() => {
    scanInFlight = null;
  });

  return scanInFlight;
}

export async function resolveLocalTrackFile(id: string): Promise<IndexedFile | null> {
  if (!LOCAL_TRACK_ID.test(id)) return null;
  const cached = fileIndex.get(id);
  if (cached && existsSync(cached.file)) return cached;
  await scanLocalMusic(true);
  const refreshed = fileIndex.get(id);
  return refreshed && existsSync(refreshed.file) ? refreshed : null;
}
