import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, rename, rm, stat, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureComponent } from "./bootstrap.js";
import { config } from "./config.js";
import { DEFAULT_CLIENTS, directAudio, directVideo, fetchRemoteClients } from "./directAudio.js";
import { tools } from "./tools.js";
import { msg } from "./i18n.js";
import { HttpError } from "./types.js";

export interface StreamFormat {
  formatId: string;
  url: string;
  headers: Record<string, string>;
  mime: string;
}

export interface Resolved {
  id: string;
  title: string;
  duration: number;
  audio: StreamFormat;
  video?: StreamFormat;
  hdVideoUrl?: string;
  expiresAt: number;
}

interface RawFormat {
  format_id: string;
  url?: string;
  ext: string;
  acodec?: string;
  vcodec?: string;
  height?: number;
  abr?: number;
  protocol?: string;
  http_headers?: Record<string, string>;
}

const RESOLVE_TIMEOUT_MS = 45_000;
const DOWNLOAD_TIMEOUT_MS = 10 * 60_000;

let maintenance: Promise<unknown> | null = null;

/** While yt-dlp is being updated or installed, new runs wait instead of racing the executable swap. */
export function holdDuring<T>(job: Promise<T>): Promise<T> {
  const p = job.finally(() => {
    if (maintenance === p) maintenance = null;
  });
  maintenance = p;
  return p;
}

async function run(args: string[], timeoutMs: number): Promise<string> {
  if (maintenance) await maintenance.catch(() => {});
  const { ytdlp, env } = tools();
  if (!ytdlp) {
    throw new HttpError(503, msg("ytdlpMissing"), "tool_missing");
  }
  return new Promise((resolve, reject) => {
    const child = spawn(ytdlp, [...config.ytdlpExtraArgs, ...args], { windowsHide: true, env });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new HttpError(504, msg("ytdlpTimeout")));
    }, timeoutMs);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new HttpError(503, msg("ytdlpCantRun", { error: err.message }), "tool_missing"));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) return resolve(stdout);
      reject(toHttpError(stderr));
    });
  });
}

// Failures that usually mean YouTube changed and yt-dlp needs an update.
const OUTDATED = /nsig|signature|n challenge|JavaScript runtime|Unable to extract|Failed to extract|player response|Requested format is not available|HTTP Error 403/i;

function toHttpError(stderr: string): HttpError {
  const line = stderr.split("\n").find((l) => l.includes("ERROR")) ?? stderr.trim().split("\n").pop() ?? "";
  if (/confirm you.re not a bot|Sign in to confirm/i.test(line)) {
    return new HttpError(503, msg("botCheck"), "bot_check");
  }
  if (/Video unavailable|video is unavailable|Private video|removed/i.test(line)) {
    return new HttpError(404, msg("videoUnavailable"));
  }
  if (/age-restricted|inappropriate|confirm your age/i.test(line)) {
    return new HttpError(403, msg("ageRestricted"));
  }
  // yt-dlp's own words stay as they are (English); only the advice around them is translated.
  const detail = line.replace(/^ERROR:\s*/, "").slice(0, 240);
  if (!detail) return new HttpError(502, msg("ytdlpFailed"), "maybe_outdated");
  if (OUTDATED.test(stderr)) return new HttpError(502, msg("ytdlpOutdated", { detail }), "maybe_outdated");
  return new HttpError(502, detail, "maybe_outdated");
}

/** Forget resolved stream URLs, e.g. after updating yt-dlp so the next play uses the new version. */
export function clearResolved() {
  resolvedAt.clear();
}

const isAudioOnly = (f: RawFormat) => !!f.url && f.vcodec === "none" && !!f.acodec && f.acodec !== "none";
const isMuxed = (f: RawFormat) => !!f.url && !!f.vcodec && f.vcodec !== "none" && !!f.acodec && f.acodec !== "none";
const isHttps = (f: RawFormat) => !f.protocol || f.protocol === "https";

function toStream(f: RawFormat, kind: "audio" | "video"): StreamFormat {
  const mime = kind === "audio" ? (f.ext === "webm" ? "audio/webm" : "audio/mp4") : "video/mp4";
  return { formatId: f.format_id, url: f.url!, headers: f.http_headers ?? {}, mime };
}

function pickAudio(formats: RawFormat[]): RawFormat | undefined {
  const audio = formats.filter((f) => isAudioOnly(f) && isHttps(f));
  // AAC in MP4 plays everywhere, including iOS Safari. Opus/WebM is the fallback.
  return (
    audio.find((f) => f.format_id === "140") ??
    audio.filter((f) => f.ext === "m4a").sort((a, b) => (b.abr ?? 0) - (a.abr ?? 0))[0] ??
    audio.sort((a, b) => (b.abr ?? 0) - (a.abr ?? 0))[0]
  );
}

function pickVideo(formats: RawFormat[]): RawFormat | undefined {
  const muxed = formats.filter((f) => isMuxed(f) && isHttps(f) && f.ext === "mp4");
  return muxed.find((f) => f.format_id === "18") ?? muxed.sort((a, b) => (b.height ?? 0) - (a.height ?? 0))[0];
}

function expiryOf(url: string): number {
  const expire = Number(new URL(url).searchParams.get("expire"));
  const fallback = Date.now() + 4 * 3600_000;
  // Refresh 10 minutes before googlevideo URLs expire.
  return Number.isFinite(expire) && expire > 0 ? expire * 1000 - 10 * 60_000 : fallback;
}

const cache = new Map<string, Promise<Resolved>>();
const resolvedAt = new Map<string, Resolved>();

// When yt-dlp fails, the clients to ask YouTube directly (see directAudio.ts), refreshed from the repository.
// Read lazily: directAudio.ts and this module import each other through search.ts.
let directClients: string[] | null = null;
let directClientsAt = 0;

async function clientsForDirect(): Promise<string[]> {
  if (Date.now() - directClientsAt > 6 * 3600_000) {
    directClientsAt = Date.now();
    directClients = (await fetchRemoteClients()) ?? directClients;
  }
  return directClients ?? DEFAULT_CLIENTS;
}

/**
 * Primary fast path for audio: asks YouTube's VISIONOS Innertube client directly (~250ms, no PO token required,
 * no yt-dlp subprocess overhead or User-Agent mismatch).
 */
export async function resolveDirectOnly(id: string): Promise<Resolved> {
  const direct = await directAudio(id, await clientsForDirect());
  return {
    id,
    title: direct.title,
    duration: direct.duration,
    audio: { formatId: "direct", url: direct.url, headers: {}, mime: direct.mime },
    expiresAt: direct.expiresAt - 10 * 60_000,
  };
}

/** Fallback audio/video resolver via yt-dlp when direct Innertube resolution is unavailable for a track. */
export async function resolveWithYtdlp(id: string): Promise<Resolved> {
  const stdout = await run(["-J", "--no-playlist", "--no-warnings", `https://www.youtube.com/watch?v=${id}`], RESOLVE_TIMEOUT_MS);
  const info = JSON.parse(stdout) as { title: string; duration?: number; formats: RawFormat[] };
  const audio = pickAudio(info.formats);
  if (!audio) throw new HttpError(404, msg("noAudio"));
  const video = pickVideo(info.formats);
  return {
    id,
    title: info.title,
    duration: info.duration ?? 0,
    audio: toStream(audio, "audio"),
    video: video ? toStream(video, "video") : undefined,
    expiresAt: expiryOf(audio.url!),
  };
}

export async function resolveVideoStream(id: string): Promise<StreamFormat | undefined> {
  const resolved = await resolveStreams(id);
  if (resolved.video) return resolved.video;
  const vid = await directVideo(id).catch(() => ({ sdUrl: undefined, hdVideoUrl: undefined }));
  if (vid.hdVideoUrl) resolved.hdVideoUrl = vid.hdVideoUrl;
  if (vid.sdUrl) {
    resolved.video = { formatId: "direct-video", url: vid.sdUrl, headers: {}, mime: "video/mp4" };
    return resolved.video;
  }
  const ytdlpResolved = await resolveWithYtdlp(id).catch(() => null);
  if (ytdlpResolved?.video) {
    resolved.video = ytdlpResolved.video;
  }
  return resolved.video;
}

export function resolveStreams(id: string): Promise<Resolved> {
  const done = resolvedAt.get(id);
  if (done && done.expiresAt > Date.now()) return Promise.resolve(done);
  const inflight = cache.get(id);
  if (inflight) return inflight;

  const job = resolveDirectOnly(id)
    .catch(() => resolveWithYtdlp(id))
    .then((resolved) => {
      resolvedAt.set(id, resolved);
      return resolved;
    })
    .finally(() => cache.delete(id));

  cache.set(id, job);
  return job;
}

export function invalidate(id: string) {
  resolvedAt.delete(id);
}

const downloads = new Map<string, Promise<string>>();

/** Keeps the video cache under `config.cacheMaxBytes`, evicting least recently played files first. */
export async function pruneCache(): Promise<void> {
  if (!existsSync(config.cacheDir)) return;
  const names = (await readdir(config.cacheDir)).filter((n) => n.endsWith(".720.mp4"));
  const files = await Promise.all(
    names.map(async (n) => {
      const p = path.join(config.cacheDir, n);
      const s = await stat(p);
      return { p, size: s.size, used: s.mtimeMs };
    }),
  );
  let total = files.reduce((sum, f) => sum + f.size, 0);
  for (const f of files.sort((a, b) => a.used - b.used)) {
    if (total <= config.cacheMaxBytes) break;
    await rm(f.p, { force: true });
    total -= f.size;
  }
}

const FAST_CHUNK_BYTES = 2 * 1024 * 1024;

/**
 * Downloads a googlevideo stream using parallel 2 MB Range requests so YouTube does not throttle
 * the connection to 1x realtime playback speed.
 */
async function fastDownloadUrl(url: string, destPath: string): Promise<void> {
  const first = await fetch(url, {
    headers: { Range: `bytes=0-${FAST_CHUNK_BYTES - 1}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!first.ok) throw new HttpError(502, msg("streamRefused", { status: first.status }));
  const firstBuf = Buffer.from(await first.arrayBuffer());
  const cr = first.headers.get("content-range");
  const total = cr ? Number(cr.split("/")[1]) : firstBuf.byteLength;
  if (!total || total <= firstBuf.byteLength) {
    await writeFile(destPath, firstBuf);
    return;
  }

  const ranges: [number, number][] = [];
  for (let start = FAST_CHUNK_BYTES; start < total; start += FAST_CHUNK_BYTES) {
    ranges.push([start, Math.min(total - 1, start + FAST_CHUNK_BYTES - 1)]);
  }

  const parts = new Array<Buffer>(ranges.length);
  let nextIdx = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (nextIdx < ranges.length) {
        const i = nextIdx++;
        const [start, end] = ranges[i]!;
        const res = await fetch(url, {
          headers: { Range: `bytes=${start}-${end}` },
          signal: AbortSignal.timeout(30_000),
        });
        if (!res.ok) throw new HttpError(502, msg("streamRefused", { status: res.status }));
        parts[i] = Buffer.from(await res.arrayBuffer());
      }
    }),
  );

  await writeFile(destPath, Buffer.concat([firstBuf, ...parts]));
}

async function mergeDirectHd(id: string, tmp: string): Promise<void> {
  const { ffmpeg, env } = tools();
  if (!ffmpeg) throw new HttpError(503, msg("ytdlpMissing"), "tool_missing");
  const resolved = await resolveStreams(id);
  const vid = resolved.hdVideoUrl ? { hdVideoUrl: resolved.hdVideoUrl, audioUrl: resolved.audio.url } : await directVideo(id);
  const videoUrl = vid.hdVideoUrl;
  const audioUrl = vid.audioUrl ?? resolved.audio.url;
  if (!videoUrl || !audioUrl) throw new HttpError(404, msg("noSdVideo"));

  const vTmp = `${tmp}.v.mp4`;
  const aTmp = `${tmp}.a.m4a`;
  try {
    await Promise.all([fastDownloadUrl(videoUrl, vTmp), fastDownloadUrl(audioUrl, aTmp)]);
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        ffmpeg,
        ["-y", "-loglevel", "error", "-i", vTmp, "-i", aTmp, "-c", "copy", "-movflags", "+faststart", tmp],
        { windowsHide: true, env },
      );
      let stderr = "";
      const timer = setTimeout(() => {
        child.kill();
        reject(new HttpError(504, msg("ytdlpTimeout")));
      }, DOWNLOAD_TIMEOUT_MS);
      child.stderr.on("data", (d) => (stderr += d));
      child.on("error", (err) => {
        clearTimeout(timer);
        reject(new HttpError(503, err.message, "tool_missing"));
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) return resolve();
        reject(new HttpError(502, stderr.trim().slice(0, 240) || msg("ytdlpFailed")));
      });
    });
  } finally {
    await Promise.all([rm(vTmp, { force: true }), rm(aTmp, { force: true })]);
  }
}

/** Downloads and merges a 720p H.264 + AAC MP4 into the cache, for HD video playback with seeking. */
export function downloadHd(id: string): Promise<string> {
  const file = path.join(config.cacheDir, `${id}.720.mp4`);
  if (existsSync(file)) {
    // Mark as recently used for cache eviction.
    const now = new Date();
    utimes(file, now, now).catch(() => {});
    return Promise.resolve(file);
  }
  const inflight = downloads.get(id);
  if (inflight) return inflight;

  const tmp = path.join(config.cacheDir, `${id}.720.part.mp4`);
  // Merging video + audio needs FFmpeg; the desktop app fetches it on first use if it isn't there yet.
  const job = (tools().ffmpeg || !config.binDir ? Promise.resolve() : ensureComponent("ffmpeg"))
    .then(() => mkdir(config.cacheDir, { recursive: true }))
    .then(() =>
      mergeDirectHd(id, tmp).catch((err) => {
        if (!tools().ytdlp) throw err;
        return run(
          [
            "--no-playlist",
            "--no-warnings",
            "--no-part",
            "-N",
            "4",
            "-f",
            "bv*[height<=720][vcodec^=avc1]+ba[ext=m4a]/b[ext=mp4][height<=720]/bv*[height<=720]+ba",
            "--merge-output-format",
            "mp4",
            "-o",
            tmp,
            `https://www.youtube.com/watch?v=${id}`,
          ],
          DOWNLOAD_TIMEOUT_MS,
        );
      }),
    )
    .then(async () => {
      await rename(tmp, file);
      pruneCache().catch(() => {});
      return file;
    })
    .catch(async (err) => {
      await rm(tmp, { force: true });
      throw err;
    })
    .finally(() => downloads.delete(id));

  downloads.set(id, job);
  return job;
}

export async function ytdlpSearch(query: string, limit = 20) {
  const stdout = await run(["-J", "--flat-playlist", "--no-warnings", `ytsearch${limit}:${query}`], RESOLVE_TIMEOUT_MS);
  const data = JSON.parse(stdout) as {
    entries: { id: string; title: string; duration?: number; channel?: string; uploader?: string }[];
  };
  return data.entries ?? [];
}
