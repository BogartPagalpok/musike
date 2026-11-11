import type { Lang } from "./i18n.js";
import { text, withClient } from "./search.js";

/**
 * A track's audio asked straight from YouTube's API, without yt-dlp. The Android app plays it this way, and the
 * server falls back to it when yt-dlp fails (YouTube's bot check on some connections, an outdated yt-dlp).
 *
 * YouTube only serves the first megabyte of a stream to most clients unless the request carries a proof-of-origin
 * token. A few clients don't need one; VISIONOS (the Apple Vision Pro app) is the one yt-dlp itself relies on, and
 * its URLs need no deciphering either. When YouTube changes that, the list of clients can be updated remotely
 * (mobile/streaming.json in the repository) without shipping a new version.
 */

export const DEFAULT_CLIENTS = ["VISIONOS"];
const REMOTE_CONFIG = "https://raw.githubusercontent.com/Ernani1234/musike/main/mobile/streaming.json";

export interface DirectAudio {
  url: string;
  mime: string;
  title: string;
  duration: number;
  /** When the URL stops working (ms). */
  expiresAt: number;
}

export const validClients = (v: unknown): string[] | null =>
  Array.isArray(v) && v.length > 0 && v.every((c) => typeof c === "string" && /^[A-Z_]{2,30}$/.test(c)) ? (v as string[]) : null;

/**
 * The client list published in the repository, or null when it can't be read. `clients` is the list for the server
 * and Android; a platform can have its own (`ios`).
 */
export async function fetchRemoteClients(key: "clients" | "ios" = "clients"): Promise<string[] | null> {
  try {
    const res = await fetch(REMOTE_CONFIG, { signal: AbortSignal.timeout(6000) });
    return validClients(((await res.json()) as Record<string, unknown>)[key]);
  } catch {
    return null; // offline or no config: keep what we have
  }
}

/** Tries each client in turn. Throws with YouTube's reason (or an empty message) when none of them has audio. */
export async function directAudio(id: string, clients: string[], lang?: Lang): Promise<DirectAudio> {
  let reason = "";
  for (const client of clients) {
    try {
      const info: any = await withClient((yt) => yt.getBasicInfo(id, { client: client as never }), lang);
      const status = info.playability_status;
      if (status?.status && status.status !== "OK") {
        reason = text(status.reason) || reason;
        continue;
      }
      const formats: any[] = [...(info.streaming_data?.adaptive_formats ?? []), ...(info.streaming_data?.formats ?? [])].filter(
        (f) => f.has_audio && !f.has_video && typeof f.url === "string",
      );
      // AAC (m4a) first: it plays everywhere. Highest bitrate within the same kind.
      const best = formats.sort(
        (a, b) => Number(b.mime_type?.startsWith("audio/mp4")) - Number(a.mime_type?.startsWith("audio/mp4")) || (b.bitrate ?? 0) - (a.bitrate ?? 0),
      )[0];
      if (!best) continue;
      const expire = Number(new URL(best.url).searchParams.get("expire")) * 1000;
      return {
        url: best.url,
        mime: best.mime_type?.startsWith("audio/webm") ? "audio/webm" : "audio/mp4",
        title: info.basic_info?.title ?? "",
        duration: Number(info.basic_info?.duration) || 0,
        expiresAt: Number.isFinite(expire) && expire > 0 ? expire : Date.now() + 4 * 3600_000,
      };
    } catch (e) {
      reason = (e as Error).message || reason;
    }
  }
  throw new Error(reason);
}

export interface DirectVideo {
  /** Muxed 360p MP4 (video+audio) for immediate SD playback. */
  sdUrl?: string;
  /** Adaptive 720p H.264 MP4 video-only + AAC audio for HD merging via FFmpeg. */
  hdVideoUrl?: string;
  audioUrl?: string;
}

/** Resolves direct SD and HD video stream URLs on demand without touching audio resolution. */
export async function directVideo(id: string, lang?: Lang): Promise<DirectVideo> {
  const out: DirectVideo = {};
  try {
    const androidInfo: any = await withClient((yt) => yt.getBasicInfo(id, { client: "ANDROID" as never }), lang);
    if (androidInfo.playability_status?.status === "OK") {
      const muxed = (androidInfo.streaming_data?.formats ?? [])
        .filter((f: any) => f.has_video && f.has_audio && typeof f.url === "string" && f.mime_type?.startsWith("video/mp4"))
        .sort((a: any, b: any) => (b.height ?? 0) - (a.height ?? 0))[0];
      if (muxed) out.sdUrl = muxed.url;
    }
  } catch {
    /* ignore */
  }
  try {
    const visionInfo: any = await withClient((yt) => yt.getBasicInfo(id, { client: "VISIONOS" as never }), lang);
    if (visionInfo.playability_status?.status === "OK") {
      const adaptive: any[] = visionInfo.streaming_data?.adaptive_formats ?? [];
      const hd = adaptive
        .filter(
          (f) =>
            f.has_video &&
            !f.has_audio &&
            typeof f.url === "string" &&
            f.mime_type?.startsWith("video/mp4") &&
            /avc1/i.test(f.mime_type) &&
            (f.height ?? 0) <= 720,
        )
        .sort((a, b) => (b.height ?? 0) - (a.height ?? 0) || (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];
      const audio = adaptive
        .filter((f) => f.has_audio && !f.has_video && typeof f.url === "string")
        .sort((a, b) => Number(b.mime_type?.startsWith("audio/mp4")) - Number(a.mime_type?.startsWith("audio/mp4")) || (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];
      if (hd) out.hdVideoUrl = hd.url;
      if (audio) out.audioUrl = audio.url;
    }
  } catch {
    /* ignore */
  }
  return out;
}
