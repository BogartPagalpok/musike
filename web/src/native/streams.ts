import { Capacitor } from "@capacitor/core";
import { DEFAULT_CLIENTS, directAudio, directVideo, type DirectAudio } from "../../../server/src/directAudio";
import { msg, tr } from "../../../server/src/i18n";
import { getLang } from "../i18n";
import { ApiError } from "../lib/apiTypes";
import { config } from "./shims/config";
import { nativeResolverAvailable, resolveNatively } from "./ytplayer";

/**
 * Resolves a track's audio on the phone, the job yt-dlp does on the server. On iOS the app's native side asks first
 * (ios/App/App/MusikeYouTube.swift); otherwise, and as iOS's fallback, the audio comes straight from YouTube's API
 * (server/src/directAudio.ts).
 */

const ios = Capacitor.getPlatform() === "ios";
const PLATFORM_CLIENTS = ios ? ["VISIONOS", "IOS", "ANDROID"] : DEFAULT_CLIENTS;
const CLIENTS_KEY = ios ? "musike:stream-clients-ios-v3" : "musike:stream-clients-v3";

const cache = new Map<string, DirectAudio>();
const inflight = new Map<string, Promise<DirectAudio>>();
const videoCache = new Map<string, { url: string; expiresAt: number }>();
const videoInflight = new Map<string, Promise<string>>();

let clients = PLATFORM_CLIENTS;
try {
  localStorage.removeItem("musike:stream-clients");
  localStorage.removeItem("musike:stream-clients-ios");
  localStorage.setItem(CLIENTS_KEY, JSON.stringify(PLATFORM_CLIENTS));
} catch {
  /* ignore */
}

/** iOS: the native resolver, or null to fall back to the in-app clients. */
async function resolveOnIos(id: string): Promise<DirectAudio | null> {
  if (!nativeResolverAvailable()) return null;
  try {
    const r = await resolveNatively(id, "en", config.location);
    if (r.error || !r.url) return null;
    const expire = Number(new URL(r.url).searchParams.get("expire")) * 1000;
    return {
      url: r.url,
      mime: r.mime || "audio/mp4",
      title: r.title,
      duration: r.duration,
      expiresAt: expire || Date.now() + 3 * 3600_000,
    };
  } catch {
    return null;
  }
}

async function resolve(id: string): Promise<DirectAudio> {
  const native = await resolveOnIos(id);
  if (native) {
    cache.set(id, native);
    return native;
  }
  try {
    const resolved = await directAudio(id, clients, getLang());
    cache.set(id, resolved);
    return resolved;
  } catch (e) {
    throw new ApiError(404, (e as Error).message || tr(getLang(), msg("noAudio")));
  }
}

/** A track's stream, from cache while its URL is still good for a minute or more. */
export function resolveAudio(id: string): Promise<DirectAudio> {
  const hit = cache.get(id);
  if (hit && hit.expiresAt - Date.now() > 60_000) return Promise.resolve(hit);
  let job = inflight.get(id);
  if (!job) {
    job = resolve(id).finally(() => inflight.delete(id));
    inflight.set(id, job);
  }
  return job;
}

/** Resolves a muxed MP4 video stream directly on mobile. */
export function resolveVideo(id: string): Promise<string> {
  const hit = videoCache.get(id);
  if (hit && hit.expiresAt - Date.now() > 60_000) return Promise.resolve(hit.url);
  let job = videoInflight.get(id);
  if (!job) {
    job = (async () => {
      const vid = await directVideo(id, getLang()).catch(() => ({ sdUrl: undefined }));
      if (vid.sdUrl) {
        const expire = Number(new URL(vid.sdUrl).searchParams.get("expire")) * 1000;
        videoCache.set(id, {
          url: vid.sdUrl,
          expiresAt: Number.isFinite(expire) && expire > 0 ? expire : Date.now() + 3 * 3600_000,
        });
        return vid.sdUrl;
      }
      const audio = await resolveAudio(id);
      return audio.url;
    })().finally(() => videoInflight.delete(id));
    videoInflight.set(id, job);
  }
  return job;
}

/** Forgets the stream behind a URL that stopped working, so the next try resolves a fresh one. */
export function forgetUrl(url: string) {
  for (const [id, r] of cache) if (r.url === url) cache.delete(id);
  for (const [id, r] of videoCache) if (r.url === url) videoCache.delete(id);
}
