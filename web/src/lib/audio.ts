/**
 * The audio element the player drives.
 *
 * On iOS it is not an `<audio>` at all: the web view's media stack gets cut off by YouTube a few hundred kilobytes
 * into a track (the element pauses, silently, around fifteen seconds), so the app plays natively through the
 * `musikeAudio` handler (ios/App/App/MusikeAudio.swift). This class keeps the slice of the HTMLMediaElement API the
 * player uses — src, play, pause, currentTime, duration, volume, buffered and the events — backed by that player.
 *
 * Everywhere else it is the plain `<audio>` the app has always used.
 */

interface Bridge {
  postMessage(message: unknown): void;
}

interface NativePayload {
  position?: number;
  duration?: number;
  buffered?: number;
  message?: string;
}

const nativeBridge = (globalThis as { webkit?: { messageHandlers?: { musikeAudio?: Bridge } } }).webkit?.messageHandlers
  ?.musikeAudio;

class Buffered {
  constructor(private to: number) {}
  get length() {
    return this.to > 0 ? 1 : 0;
  }
  end(_index: number) {
    return this.to;
  }
}

class NativeAudio extends EventTarget {
  // The player sets these; the native side only needs to know about them.
  private _volume = 1;
  private _muted = false;
  private _src = "";
  private _position = 0;
  private _duration = NaN;
  private _paused = true;
  private _ended = false;
  private _bufferedEnd = 0;
  /** Set while a seek is in flight: the native player keeps reporting the old position until it lands. */
  private _seekTarget: number | null = null;
  /** Local blob:/data: URLs cannot be opened by Swift's AVURLAsset outside WKWebView, so route them to a real <audio>. */
  private localAudio = new Audio();
  private usingLocal = false;

  readyState = 0;
  networkState = 0;
  playbackRate = 1;
  error: { code: number; message: string } | null = null;
  preload = "auto";

  constructor(private bridge: Bridge) {
    super();
    this.localAudio.preload = "auto";
    this.localAudio.addEventListener("loadedmetadata", () => {
      if (!this.usingLocal) return;
      this._duration = this.localAudio.duration;
      this.readyState = 4;
      this.dispatchEvent(new Event("loadedmetadata"));
      this.dispatchEvent(new Event("durationchange"));
    });
    this.localAudio.addEventListener("durationchange", () => {
      if (!this.usingLocal) return;
      this._duration = this.localAudio.duration;
      this.dispatchEvent(new Event("durationchange"));
    });
    this.localAudio.addEventListener("timeupdate", () => {
      if (!this.usingLocal) return;
      this._position = this.localAudio.currentTime;
      this.dispatchEvent(new Event("timeupdate"));
    });
    this.localAudio.addEventListener("progress", () => {
      if (!this.usingLocal) return;
      if (this.localAudio.buffered.length) {
        this._bufferedEnd = this.localAudio.buffered.end(this.localAudio.buffered.length - 1);
      }
      this.dispatchEvent(new Event("progress"));
    });
    this.localAudio.addEventListener("seeked", () => {
      if (!this.usingLocal) return;
      this._seekTarget = null;
      this._position = this.localAudio.currentTime;
      this.dispatchEvent(new Event("seeked"));
    });
    this.localAudio.addEventListener("playing", () => {
      if (!this.usingLocal) return;
      this._paused = false;
      this.readyState = 4;
      this.dispatchEvent(new Event("playing"));
    });
    this.localAudio.addEventListener("pause", () => {
      if (!this.usingLocal || this._paused || this.localAudio.ended || !this.localAudio.getAttribute("src")) return;
      this._paused = true;
      this.dispatchEvent(new Event("pause"));
    });
    this.localAudio.addEventListener("ended", () => {
      if (!this.usingLocal) return;
      this._ended = true;
      this._paused = true;
      this.dispatchEvent(new Event("ended"));
    });
    this.localAudio.addEventListener("error", () => {
      if (!this.usingLocal || !this.localAudio.getAttribute("src")) return;
      this.error = { code: 4, message: "Could not play local audio file" };
      this.dispatchEvent(new Event("error"));
    });

    const host = globalThis as {
      __musikeAudioEvent?: (event: string, data: NativePayload) => void;
      __musikeAudioEl?: NativeAudio;
    };
    host.__musikeAudioEvent = (event, data) => !this.usingLocal && this.fromNative(event, data ?? {});
    // Handy when something needs to poke the player from the console.
    host.__musikeAudioEl = this;
  }

  get src() {
    return this._src;
  }

  set src(value: string) {
    this._src = value;
    this._ended = false;
    this._position = 0;
    this._duration = NaN;
    this.error = null;
    this.readyState = 0;
    this._bufferedEnd = 0;
    const isLocal = value.startsWith("blob:") || value.startsWith("data:");
    if (isLocal) {
      if (!this.usingLocal) this.bridge.postMessage({ cmd: "pause" });
      this.usingLocal = true;
      this.localAudio.volume = this._volume;
      this.localAudio.muted = this._muted;
      this.localAudio.src = value;
      return;
    }
    if (this.usingLocal) {
      this.localAudio.pause();
      this.localAudio.removeAttribute("src");
      this.localAudio.load();
    }
    this.usingLocal = false;
    if (value) this.bridge.postMessage({ cmd: "load", url: value });
  }

  get currentTime() {
    return this.usingLocal ? this.localAudio.currentTime : this._position;
  }

  set currentTime(value: number) {
    this._position = value;
    if (this.usingLocal) {
      this.localAudio.currentTime = value;
      return;
    }
    this._seekTarget = value;
    this.bridge.postMessage({ cmd: "seek", to: value });
  }

  get duration() {
    return this.usingLocal ? this.localAudio.duration : this._duration;
  }

  get paused() {
    return this.usingLocal ? this.localAudio.paused : this._paused;
  }

  get ended() {
    return this.usingLocal ? this.localAudio.ended : this._ended;
  }

  get volume() {
    return this._volume;
  }

  set volume(value: number) {
    this._volume = value;
    this.localAudio.volume = value;
    this.bridge.postMessage({ cmd: "volume", value });
  }

  get muted() {
    return this._muted;
  }

  set muted(value: boolean) {
    this._muted = value;
    this.localAudio.muted = value;
    this.bridge.postMessage({ cmd: "muted", value });
  }

  get buffered() {
    return this.usingLocal ? this.localAudio.buffered : new Buffered(this._bufferedEnd);
  }

  getAttribute(name: string) {
    return name === "src" ? this._src : null;
  }

  setAttribute(name: string, value: string) {
    if (name === "src") this.src = value;
  }

  removeAttribute(name: string) {
    if (name !== "src") return;
    this._src = "";
    this._position = 0;
    if (this.usingLocal) {
      this.localAudio.pause();
      this.localAudio.removeAttribute("src");
      this.localAudio.load();
      this.usingLocal = false;
    } else {
      this.bridge.postMessage({ cmd: "pause" });
    }
  }

  load() {
    if (!this._src) return;
    if (this.usingLocal) this.localAudio.load();
    else this.bridge.postMessage({ cmd: "load", url: this._src });
  }

  play() {
    this._paused = false;
    if (this.usingLocal) return this.localAudio.play();
    this.bridge.postMessage({ cmd: "play" });
    return Promise.resolve();
  }

  pause() {
    this._paused = true;
    if (this.usingLocal) {
      this.localAudio.pause();
    } else {
      this.bridge.postMessage({ cmd: "pause" });
    }
    this.dispatchEvent(new Event("pause"));
  }

  private fromNative(event: string, data: NativePayload) {
    switch (event) {
      case "ready":
        this._duration = data.duration ?? NaN;
        this.readyState = 4;
        this.dispatchEvent(new Event("loadedmetadata"));
        this.dispatchEvent(new Event("durationchange"));
        break;
      case "time": {
        const position = data.position ?? this._position;
        if (data.duration && Number.isFinite(data.duration)) this._duration = data.duration;
        // Right after a seek the player reports no loaded ranges; keep the bar at least up to the playhead.
        const loaded = data.buffered ?? 0;
        if (loaded > 0) this._bufferedEnd = Math.max(loaded, position);
        // Ignore positions from before a pending seek; otherwise the player snaps back to where it was.
        if (this._seekTarget !== null && Math.abs(position - this._seekTarget) > 1.5) {
          this.dispatchEvent(new Event("progress"));
          break;
        }
        this._seekTarget = null;
        this._position = position;
        this._bufferedEnd = Math.max(this._bufferedEnd, position);
        this.dispatchEvent(new Event("timeupdate"));
        this.dispatchEvent(new Event("progress"));
        break;
      }
      case "seeked":
        this._seekTarget = null;
        this._position = data.position ?? this._position;
        this._bufferedEnd = Math.max(this._bufferedEnd, this._position);
        this.dispatchEvent(new Event("seeked"));
        this.dispatchEvent(new Event("timeupdate"));
        this.dispatchEvent(new Event("progress"));
        break;
      case "playing":
        this._paused = false;
        this.readyState = 4;
        this.dispatchEvent(new Event("playing"));
        break;
      case "ended":
        this._ended = true;
        this._paused = true;
        this.dispatchEvent(new Event("ended"));
        break;
      case "error":
        this.error = { code: 4, message: data.message ?? "Playback failed" };
        this.dispatchEvent(new Event("error"));
        break;
      default:
        break;
    }
  }
}

const host = globalThis as {
  __musikeSingletonAudio?: HTMLAudioElement;
};

/** The audio element for this platform: native on iOS, a real `<audio>` everywhere else. */
export function createAudio(): HTMLAudioElement {
  if (!nativeBridge) {
    if (host.__musikeSingletonAudio) {
      host.__musikeSingletonAudio.pause();
      host.__musikeSingletonAudio.removeAttribute("src");
      host.__musikeSingletonAudio.load();
    }
    const audio = new Audio();
    audio.preload = "auto";
    host.__musikeSingletonAudio = audio;
    return audio;
  }
  return new NativeAudio(nativeBridge) as unknown as HTMLAudioElement;
}
