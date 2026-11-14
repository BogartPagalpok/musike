import { config } from "./config.js";
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

export const DEFAULT_CLIENTS = ["VISIONOS", "ANDROID", "IOS"];
const REMOTE_CONFIG = "";

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
 * Keeps signature compatibility without pulling stale external GitHub client overrides that strip working clients.
 */
export async function fetchRemoteClients(_key: "clients" | "ios" = "clients"): Promise<string[] | null> {
  return null;
}

interface RawInnerTubeClientSpec {
  clientName: string;
  clientVersion: string;
  userAgent: string;
  clientId?: string;
  platform?: string;
  needsVisitorData?: boolean;
  androidSdkVersion?: number;
  deviceMake?: string;
  deviceModel?: string;
  osName?: string;
  osVersion?: string;
}

const RAW_CLIENT_SPECS: Record<string, RawInnerTubeClientSpec> = {
  VISIONOS: {
    clientName: "VISIONOS",
    clientVersion: "1.02",
    clientId: "101",
    platform: "DESKTOP",
    needsVisitorData: true,
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
  },
  ANDROID: {
    clientName: "ANDROID",
    clientVersion: "20.10.38",
    clientId: "3",
    androidSdkVersion: 34,
    osName: "Android",
    osVersion: "14",
    userAgent: "com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip",
  },
  IOS: {
    clientName: "IOS",
    clientVersion: "20.10.4",
    clientId: "5",
    deviceMake: "Apple",
    deviceModel: "iPhone16,2",
    osName: "iPhone",
    osVersion: "18.1.0.22B83",
    userAgent: "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X;)",
  },
};

const VISITOR_TTL_MS = 12 * 3600_000;
let cachedVisitorData = "";
let cachedVisitorAt = 0;

async function getVisitorData(lang?: Lang): Promise<string> {
  if (cachedVisitorData && Date.now() - cachedVisitorAt < VISITOR_TTL_MS) {
    return cachedVisitorData;
  }
  const spec = RAW_CLIENT_SPECS.VISIONOS!;
  const httpFetch = config.fetch ?? fetch;
  try {
    const res = await httpFetch("https://www.youtube.com/youtubei/v1/visitor_id?prettyPrint=false", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(spec.clientId ? { "X-YouTube-Client-Name": spec.clientId } : {}),
        "X-YouTube-Client-Version": spec.clientVersion,
        Origin: "https://www.youtube.com",
        "User-Agent": spec.userAgent,
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: spec.clientName,
            clientVersion: spec.clientVersion,
            ...(spec.platform ? { platform: spec.platform } : {}),
            hl: lang ?? config.lang ?? "en",
            gl: config.location ?? "US",
          },
        },
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const json = (await res.json()) as { responseContext?: { visitorData?: string } };
      const vd = json?.responseContext?.visitorData;
      if (vd) {
        cachedVisitorData = vd;
        cachedVisitorAt = Date.now();
        return vd;
      }
    }
  } catch {
    /* keep previously cached visitorData if available */
  }
  return cachedVisitorData;
}

interface RawInnerTubeFormat {
  itag?: number;
  url?: string;
  mimeType?: string;
  bitrate?: number;
  width?: number;
  height?: number;
  audioChannels?: number;
}

interface RawInnerTubePlayerResponse {
  playabilityStatus?: { status?: string; reason?: string };
  videoDetails?: { title?: string; lengthSeconds?: string };
  streamingData?: {
    formats?: RawInnerTubeFormat[];
    adaptiveFormats?: RawInnerTubeFormat[];
  };
}

async function fetchInnerTubePlayer(id: string, clientKey: string, lang?: Lang): Promise<RawInnerTubePlayerResponse | null> {
  const spec = RAW_CLIENT_SPECS[clientKey];
  if (!spec) return null;
  try {
    const httpFetch = config.fetch ?? fetch;
    const visitorData = spec.needsVisitorData ? await getVisitorData(lang) : "";
    const res = await httpFetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(spec.clientId ? { "X-YouTube-Client-Name": spec.clientId } : {}),
        "X-YouTube-Client-Version": spec.clientVersion,
        Origin: "https://www.youtube.com",
        "User-Agent": spec.userAgent,
      },
      body: JSON.stringify({
        videoId: id,
        context: {
          client: {
            clientName: spec.clientName,
            clientVersion: spec.clientVersion,
            ...(spec.platform ? { platform: spec.platform } : {}),
            ...(visitorData ? { visitorData } : {}),
            ...(spec.androidSdkVersion ? { androidSdkVersion: spec.androidSdkVersion } : {}),
            ...(spec.deviceMake ? { deviceMake: spec.deviceMake } : {}),
            ...(spec.deviceModel ? { deviceModel: spec.deviceModel } : {}),
            ...(spec.osName ? { osName: spec.osName } : {}),
            ...(spec.osVersion ? { osVersion: spec.osVersion } : {}),
            hl: lang ?? config.lang ?? "en",
            gl: config.location ?? "US",
          },
        },
        contentCheckOk: true,
        racyCheckOk: true,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return (await res.json()) as RawInnerTubePlayerResponse;
  } catch {
    return null;
  }
}

function expireMsOf(url: string): number {
  try {
    const expire = Number(new URL(url).searchParams.get("expire")) * 1000;
    return Number.isFinite(expire) && expire > 0 ? expire : Date.now() + 4 * 3600_000;
  } catch {
    return Date.now() + 4 * 3600_000;
  }
}

/** Tries each client in turn. Throws with YouTube's reason (or an empty message) when none of them has audio. */
export async function directAudio(id: string, clients: string[] = DEFAULT_CLIENTS, lang?: Lang): Promise<DirectAudio> {
  let reason = "";
  const ordered = clients.length ? clients : DEFAULT_CLIENTS;

  // VISIONOS serves full adaptive audio without a PO token; ANDROID/IOS adaptive formats cap at 1 MB without a PO token,
  // so only progressive muxed formats (e.g. itag 18) are safe from un-tokened ANDROID/IOS.
  for (const client of ordered) {
    const raw = await fetchInnerTubePlayer(id, client, lang);
    if (raw) {
      if (raw.playabilityStatus?.status && raw.playabilityStatus.status !== "OK") {
        reason = raw.playabilityStatus.reason || reason;
      } else {
        const allowAdaptive = client === "VISIONOS";
        const audioOnly = allowAdaptive
          ? (raw.streamingData?.adaptiveFormats ?? []).filter(
              (f) => typeof f.url === "string" && (f.mimeType?.startsWith("audio/") || f.audioChannels) && !f.width,
            )
          : [];
        const bestAudio = audioOnly.sort(
          (a, b) => Number(b.mimeType?.startsWith("audio/mp4")) - Number(a.mimeType?.startsWith("audio/mp4")) || (b.bitrate ?? 0) - (a.bitrate ?? 0),
        )[0];
        const muxed = (raw.streamingData?.formats ?? []).filter(
          (f) => typeof f.url === "string" && f.mimeType?.startsWith("video/mp4"),
        )[0];
        const picked = bestAudio ?? muxed;
        if (picked?.url) {
          return {
            url: picked.url,
            mime: picked.mimeType?.startsWith("audio/webm") ? "audio/webm" : "audio/mp4",
            title: raw.videoDetails?.title ?? "",
            duration: Number(raw.videoDetails?.lengthSeconds) || 0,
            expiresAt: expireMsOf(picked.url),
          };
        }
      }
    }
  }

  // Fallback path via youtubei.js
  for (const client of ordered) {
    try {
      const info: any = await withClient((yt) => yt.getBasicInfo(id, { client: client as never }), lang);
      const status = info.playability_status;
      if (status?.status && status.status !== "OK") {
        reason = text(status.reason) || reason;
        continue;
      }
      const allowAdaptive = client === "VISIONOS";
      const formats: any[] = allowAdaptive
        ? [...(info.streaming_data?.adaptive_formats ?? []), ...(info.streaming_data?.formats ?? [])].filter(
            (f) => f.has_audio && !f.has_video && typeof f.url === "string",
          )
        : [];
      let best = formats.sort(
        (a, b) => Number(b.mime_type?.startsWith("audio/mp4")) - Number(a.mime_type?.startsWith("audio/mp4")) || (b.bitrate ?? 0) - (a.bitrate ?? 0),
      )[0];
      if (!best) {
        const muxed = [...(info.streaming_data?.formats ?? []), ...(allowAdaptive ? (info.streaming_data?.adaptive_formats ?? []) : [])].filter(
          (f: any) => f.has_audio && typeof f.url === "string" && f.mime_type?.startsWith("video/mp4"),
        )[0];
        if (muxed) best = muxed;
      }
      if (!best) continue;
      return {
        url: best.url,
        mime: best.mime_type?.startsWith("audio/webm") ? "audio/webm" : "audio/mp4",
        title: info.basic_info?.title ?? "",
        duration: Number(info.basic_info?.duration) || 0,
        expiresAt: expireMsOf(best.url),
      };
    } catch (e) {
      reason = (e as Error).message || reason;
    }
  }
  throw new Error(reason);
}

export interface DirectVideo {
  /** Muxed MP4 (video+audio, capped at 1080p) for immediate fast playback. */
  sdUrl?: string;
  /** Adaptive 720p H.264 MP4 video-only for HD merging via FFmpeg. */
  hdVideoUrl?: string;
  /** Adaptive up to 1080p H.264 MP4 video-only for Full HD merging via FFmpeg. */
  fhdVideoUrl?: string;
  audioUrl?: string;
}

/** Resolves direct video stream URLs (max 1080p) on demand using ANDROID + IOS raw InnerTube, then VISIONOS fallback. */
export async function directVideo(id: string, lang?: Lang): Promise<DirectVideo> {
  const out: DirectVideo = {};

  for (const clientKey of ["ANDROID", "IOS"] as const) {
    const raw = await fetchInnerTubePlayer(id, clientKey);
    if (!raw || raw.playabilityStatus?.status !== "OK") continue;
    if (!out.sdUrl) {
      const muxed = (raw.streamingData?.formats ?? [])
        .filter((f) => typeof f.url === "string" && f.mimeType?.startsWith("video/mp4") && (f.height ?? 0) <= 1080)
        .sort((a, b) => (b.height ?? 0) - (a.height ?? 0))[0];
      if (muxed?.url) out.sdUrl = muxed.url;
    }
    const adaptive = raw.streamingData?.adaptiveFormats ?? [];
    const h264 = adaptive.filter(
      (f) =>
        typeof f.url === "string" &&
        f.mimeType?.startsWith("video/mp4") &&
        /avc1/i.test(f.mimeType) &&
        (f.height ?? 0) <= 1080,
    );
    if (!out.hdVideoUrl) {
      const hd = h264
        .filter((f) => (f.height ?? 0) <= 720)
        .sort((a, b) => (b.height ?? 0) - (a.height ?? 0) || (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];
      if (hd?.url) out.hdVideoUrl = hd.url;
    }
    if (!out.fhdVideoUrl) {
      const fhd = h264.sort((a, b) => (b.height ?? 0) - (a.height ?? 0) || (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];
      if (fhd?.url) out.fhdVideoUrl = fhd.url;
    }
    if (!out.audioUrl) {
      const audio = adaptive
        .filter((f) => typeof f.url === "string" && f.mimeType?.startsWith("audio/mp4"))
        .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];
      if (audio?.url) out.audioUrl = audio.url;
    }
    if (out.sdUrl && out.hdVideoUrl && out.fhdVideoUrl && out.audioUrl) break;
  }

  if (!out.sdUrl || !out.hdVideoUrl || !out.fhdVideoUrl) {
    try {
      const visionInfo: any = await withClient((yt) => yt.getBasicInfo(id, { client: "VISIONOS" as never }), lang);
      if (visionInfo.playability_status?.status === "OK") {
        const adaptive: any[] = visionInfo.streaming_data?.adaptive_formats ?? [];
        const h264 = adaptive.filter(
          (f) =>
            f.has_video &&
            !f.has_audio &&
            typeof f.url === "string" &&
            f.mime_type?.startsWith("video/mp4") &&
            /avc1/i.test(f.mime_type) &&
            (f.height ?? 0) <= 1080,
        );
        if (!out.hdVideoUrl) {
          const hd = h264
            .filter((f) => (f.height ?? 0) <= 720)
            .sort((a, b) => (b.height ?? 0) - (a.height ?? 0) || (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];
          if (hd) out.hdVideoUrl = hd.url;
        }
        if (!out.fhdVideoUrl) {
          const fhd = h264.sort((a, b) => (b.height ?? 0) - (a.height ?? 0) || (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];
          if (fhd) out.fhdVideoUrl = fhd.url;
        }
        if (!out.audioUrl) {
          const audio = adaptive
            .filter((f) => f.has_audio && !f.has_video && typeof f.url === "string")
            .sort((a, b) => Number(b.mime_type?.startsWith("audio/mp4")) - Number(a.mime_type?.startsWith("audio/mp4")) || (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];
          if (audio) out.audioUrl = audio.url;
        }
      }
    } catch {
      /* ignore */
    }
  }
  return out;
}
