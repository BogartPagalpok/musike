import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { FastifyReply, FastifyRequest } from "fastify";
import { msg } from "./i18n.js";
import { HttpError } from "./types.js";
import { invalidate, resolveStreams, resolveVideoStream, resolveWithYtdlp, type StreamFormat } from "./ytdlp.js";

const PASS_HEADERS = ["content-length", "content-range", "accept-ranges", "last-modified"];
/**
 * Cap open-ended Range requests to 2 MB chunks so each upstream googlevideo fetch finishes in ~100ms
 * at full speed instead of sitting idle under browser playback backpressure and getting reset mid-song.
 */
const CHUNK_BYTES = 2 * 1024 * 1024;

function boundedRange(rawRange: string | undefined): string {
  if (!rawRange) return `bytes=0-${CHUNK_BYTES - 1}`;
  const m = /^bytes=(\d+)-(\d*)$/.exec(rawRange.trim());
  if (!m) return rawRange;
  const start = Number(m[1]);
  const endStr = m[2];
  if (endStr) {
    const end = Number(endStr);
    if (end - start + 1 > CHUNK_BYTES) return `bytes=${start}-${start + CHUNK_BYTES - 1}`;
    return rawRange;
  }
  return `bytes=${start}-${start + CHUNK_BYTES - 1}`;
}

/**
 * Proxies a googlevideo stream, forwarding bounded Range chunks so the browser can seek natively
 * and upstream connections never stall or drop mid-song.
 */
export async function proxyStream(req: FastifyRequest, reply: FastifyReply, id: string, kind: "audio" | "video") {
  const pick = async (fresh: boolean): Promise<StreamFormat> => {
    if (fresh) invalidate(id);
    const resolved = await resolveStreams(id);
    const fmt = kind === "audio" ? resolved.audio : (resolved.video ?? (await resolveVideoStream(id)));
    if (!fmt) throw new HttpError(404, msg("noSdVideo"));
    return fmt;
  };

  const controller = new AbortController();
  reply.raw.on("close", () => {
    if (!reply.raw.writableFinished) controller.abort();
  });

  const request = async (fmt: StreamFormat) => {
    const headers: Record<string, string> = { ...fmt.headers };
    headers.Range = boundedRange(typeof req.headers.range === "string" ? req.headers.range : undefined);
    return fetch(fmt.url, { headers, signal: controller.signal });
  };

  let fmt = await pick(false);
  let upstream = await request(fmt);
  // Expired or rejected URL: resolve again once, falling back to yt-dlp if direct audio was refused.
  if (upstream.status === 403 || upstream.status === 410) {
    await upstream.body?.cancel();
    fmt = await pick(true);
    upstream = await request(fmt);
    if ((upstream.status === 403 || upstream.status === 410) && kind === "audio") {
      await upstream.body?.cancel();
      const ytdlpResolved = await resolveWithYtdlp(id).catch(() => null);
      if (ytdlpResolved?.audio) {
        fmt = { ...ytdlpResolved.audio, headers: {} };
        upstream = await request(fmt);
      }
    }
  }
  if (!upstream.ok || !upstream.body) {
    throw new HttpError(502, msg("streamRefused", { status: upstream.status }), "maybe_outdated");
  }

  // Buffer the bounded chunk at full network speed so googlevideo never times out waiting for playback backpressure.
  const buf = Buffer.from(await upstream.arrayBuffer());

  reply.code(upstream.status);
  reply.header("content-type", fmt.mime);
  reply.header("cache-control", "no-store");
  for (const h of PASS_HEADERS) {
    if (h === "content-length") continue;
    const v = upstream.headers.get(h);
    if (v) reply.header(h, v);
  }
  reply.header("content-length", buf.byteLength);
  if (!upstream.headers.get("accept-ranges")) reply.header("accept-ranges", "bytes");

  return reply.send(buf);
}

async function fastDownloadBuffer(url: string, headers: Record<string, string>, signal: AbortSignal): Promise<Buffer> {
  const first = await fetch(url, {
    headers: { ...headers, Range: `bytes=0-${CHUNK_BYTES - 1}` },
    signal,
  });
  if (!first.ok) throw new HttpError(first.status === 403 ? 403 : 502, msg("streamRefused", { status: first.status }));
  const firstBuf = Buffer.from(await first.arrayBuffer());
  const cr = first.headers.get("content-range");
  const total = cr ? Number(cr.split("/")[1]) : firstBuf.byteLength;
  if (!total || total <= firstBuf.byteLength) return firstBuf;

  const ranges: [number, number][] = [];
  for (let start = CHUNK_BYTES; start < total; start += CHUNK_BYTES) {
    ranges.push([start, Math.min(total - 1, start + CHUNK_BYTES - 1)]);
  }

  const parts = new Array<Buffer>(ranges.length);
  let nextIdx = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (nextIdx < ranges.length) {
        const i = nextIdx++;
        const [start, end] = ranges[i]!;
        const res = await fetch(url, {
          headers: { ...headers, Range: `bytes=${start}-${end}` },
          signal,
        });
        if (!res.ok) throw new HttpError(502, msg("streamRefused", { status: res.status }));
        parts[i] = Buffer.from(await res.arrayBuffer());
      }
    }),
  );

  return Buffer.concat([firstBuf, ...parts]);
}

/** Downloads the full audio or video track with a Content-Disposition attachment filename. */
export async function downloadStream(
  req: FastifyRequest,
  reply: FastifyReply,
  id: string,
  title: string,
  artist: string,
  kind: "audio" | "video",
) {
  const resolved = await resolveStreams(id);
  const fmt = kind === "video" ? ((await resolveVideoStream(id)) ?? resolved.audio) : resolved.audio;
  const ext = fmt.mime === "video/mp4" ? "mp4" : fmt.mime === "audio/webm" ? "webm" : "m4a";
  const rawName = [artist.trim(), (title || resolved.title || id).trim()].filter(Boolean).join(" - ");
  const safeAscii = rawName.replace(/[\\/:*?"<>|]+/g, "_").replace(/[^\x20-\x7E]/g, "").trim() || id;
  const utf8Name = encodeURIComponent(`${rawName.replace(/[\\/:*?"<>|]+/g, "_")}.${ext}`);

  const controller = new AbortController();
  reply.raw.on("close", () => {
    if (!reply.raw.writableFinished) controller.abort();
  });

  let buf: Buffer;
  try {
    buf = await fastDownloadBuffer(fmt.url, fmt.headers, controller.signal);
  } catch {
    invalidate(id);
    const fresh = await resolveStreams(id);
    const freshFmt = kind === "video" ? ((await resolveVideoStream(id)) ?? fresh.audio) : fresh.audio;
    buf = await fastDownloadBuffer(freshFmt.url, freshFmt.headers, controller.signal);
  }

  reply.code(200);
  reply.header("content-type", fmt.mime);
  reply.header("cache-control", "no-store");
  reply.header("content-disposition", `attachment; filename="${safeAscii}.${ext}"; filename*=UTF-8''${utf8Name}`);
  reply.header("content-length", buf.byteLength);
  return reply.send(buf);
}

/** Serves a local file with byte-range support (used for cached HD video). */
export async function serveFile(req: FastifyRequest, reply: FastifyReply, file: string, mime: string) {
  const { size } = await stat(file);
  const range = typeof req.headers.range === "string" ? /bytes=(\d*)-(\d*)/.exec(req.headers.range) : null;

  reply.header("content-type", mime);
  reply.header("accept-ranges", "bytes");
  reply.header("cache-control", "no-store");

  if (!range) {
    reply.header("content-length", size);
    return reply.send(createReadStream(file));
  }

  let start = range[1] ? Number(range[1]) : NaN;
  let end = range[2] ? Number(range[2]) : size - 1;
  if (Number.isNaN(start)) {
    // suffix range: bytes=-N
    start = Math.max(0, size - end);
    end = size - 1;
  }
  end = Math.min(end, size - 1);
  if (start > end || start >= size) {
    reply.code(416).header("content-range", `bytes */${size}`);
    return reply.send();
  }

  reply.code(206);
  reply.header("content-range", `bytes ${start}-${end}/${size}`);
  reply.header("content-length", end - start + 1);
  return reply.send(createReadStream(file, { start, end }));
}
