import { create } from "zustand";
import type { ThemeId } from "../lib/accent";
import { useAppearance } from "./appearance";
import { useUi } from "./ui";

export type PlayheadStyle =
  | "default"
  | "pixel"
  | "shinobi"
  | "akatsuki"
  | "grandline"
  | "kpop"
  | "arcade8bit"
  | "vinyl"
  | "cyberpunk";

export type PlayButtonStyle =
  | "default"
  | "shinobi"
  | "akatsuki"
  | "grandline"
  | "kpop"
  | "arcade8bit"
  | "vinyl"
  | "cyberpunk";

export type SceneStyle =
  | "none"
  | "shinobi"
  | "akatsuki"
  | "grandline"
  | "kpop"
  | "arcade8bit"
  | "vinyl"
  | "cyberpunk"
  | "custom";

export type SaleMode = "beta" | "live";
export type SkinCategory = "all" | "anime" | "trend" | "music";

export interface SkinPack {
  id: string;
  name: string;
  badge: string;
  category: Exclude<SkinCategory, "all">;
  tagline: string;
  highlights: readonly string[];
  free: boolean;
  pricePhp: number;
  priceUsd: number;
  playhead: PlayheadStyle;
  playButton: PlayButtonStyle;
  scene: SceneStyle;
  baseTheme: ThemeId;
  accent: string;
  secondaryAccent: string;
  previewGradient: string;
  unlockCode: string;
}

export const ALL_ACCESS_BUNDLE = {
  id: "all-access",
  title: "All-Access Pro Pass (All Themes + Custom Wallpaper)",
  pricePhp: 199,
  priceUsd: 4.99,
  unlockCode: "ILLUSIVE-VIP-ALL-2026",
  masterCode: "IANLESTER",
} as const;

export const SKIN_PACKS: readonly SkinPack[] = [
  {
    id: "pixel-original",
    name: "Google Pixel Wave",
    badge: "Default Free",
    category: "music",
    tagline: "Signature animated squiggly Material You scrubber and Volt play disc.",
    highlights: ["Squiggly wave scrubber", "Clean Volt disc play button", "Distraction-free surface"],
    free: true,
    pricePhp: 0,
    priceUsd: 0,
    playhead: "pixel",
    playButton: "default",
    scene: "none",
    baseTheme: "dark",
    accent: "#c3ec52",
    secondaryAccent: "#34d399",
    previewGradient: "linear-gradient(135deg, #12151c 0%, #1c2419 60%, #27371e 100%)",
    unlockCode: "",
  },
  {
    id: "classic-minimal",
    name: "Studio Minimal",
    badge: "Free",
    category: "music",
    tagline: "Crisp obsidian flat rail scrubber for zero visual clutter on pure OLED.",
    highlights: ["Precision straight scrubber", "Solid high-contrast play disc", "Deep obsidian contrast"],
    free: true,
    pricePhp: 0,
    priceUsd: 0,
    playhead: "default",
    playButton: "default",
    scene: "none",
    baseTheme: "oled",
    accent: "#34d399",
    secondaryAccent: "#22d3ee",
    previewGradient: "linear-gradient(135deg, #060709 0%, #0d1614 60%, #11241f 100%)",
    unlockCode: "",
  },
  {
    id: "naruto-shinobi",
    name: "Shinobi: Rasengan & Kunai",
    badge: "Anime Drop",
    category: "anime",
    tagline: "Channel Nine-Tails chakra with a flying Kunai playhead, spinning Rasengan disc, and Konoha leaf embers.",
    highlights: ["Kunai & Rasengan orb scrubber", "Spinning Uzumaki Chakra play disc", "Hidden Leaf ember scene"],
    free: false,
    pricePhp: 79,
    priceUsd: 1.99,
    playhead: "shinobi",
    playButton: "shinobi",
    scene: "shinobi",
    baseTheme: "sunset",
    accent: "#f97316",
    secondaryAccent: "#38bdf8",
    previewGradient: "linear-gradient(135deg, #1b0e08 0%, #3a190a 55%, #12283a 100%)",
    unlockCode: "ILLUSIVE-SHINOBI-7X9K",
  },
  {
    id: "akatsuki-cloud",
    name: "Akatsuki: Red Cloud & Sharingan",
    badge: "Best Seller",
    category: "anime",
    tagline: "Crimson 3-Tomoe Sharingan play button, scarlet slash playhead, and floating Akatsuki red-cloud night sky.",
    highlights: ["Spinning 3-Tomoe Sharingan button", "Crimson Uchiha chakra slash bar", "Drifting red clouds backdrop"],
    free: false,
    pricePhp: 79,
    priceUsd: 1.99,
    playhead: "akatsuki",
    playButton: "akatsuki",
    scene: "akatsuki",
    baseTheme: "oled",
    accent: "#ef4444",
    secondaryAccent: "#dc2626",
    previewGradient: "linear-gradient(135deg, #090507 0%, #2b090d 55%, #120406 100%)",
    unlockCode: "ILLUSIVE-AKATSUKI-9R2M",
  },
  {
    id: "onepiece-grandline",
    name: "One Piece: Gear 5 & Grand Line",
    badge: "Anime Drop",
    category: "anime",
    tagline: "Sail the Grand Line with a Straw Hat crest playhead, Sun God compass play button, and billowing clouds.",
    highlights: ["Straw Hat & Haki spark playhead", "Pirate Compass / Sun God play disc", "Grand Line ocean & cloud scene"],
    free: false,
    pricePhp: 79,
    priceUsd: 1.99,
    playhead: "grandline",
    playButton: "grandline",
    scene: "grandline",
    baseTheme: "midnight",
    accent: "#fbbf24",
    secondaryAccent: "#38bdf8",
    previewGradient: "linear-gradient(135deg, #071324 0%, #102a49 55%, #3a2a0b 100%)",
    unlockCode: "ILLUSIVE-GRANDLINE-5G1P",
  },
  {
    id: "y2k-idol",
    name: "Y2K Cyber Idol & Chrome Heart",
    badge: "Teen Trend",
    category: "trend",
    tagline: "Iridescent K-pop concert aesthetic with holographic chrome heart playhead and iridescent star play disc.",
    highlights: ["Chrome Heart & sparkle playhead", "Holographic Y2K gloss play button", "Iridescent aura & starlight sky"],
    free: false,
    pricePhp: 59,
    priceUsd: 1.49,
    playhead: "kpop",
    playButton: "kpop",
    scene: "kpop",
    baseTheme: "rose",
    accent: "#f472b6",
    secondaryAccent: "#67e8f9",
    previewGradient: "linear-gradient(135deg, #1b0c1b 0%, #3a1233 55%, #162e42 100%)",
    unlockCode: "ILLUSIVE-Y2KIDOL-3K8V",
  },
  {
    id: "retro-8bit",
    name: "8-Bit Arcade Pixel Runner",
    badge: "Teen Trend",
    category: "trend",
    tagline: "Stepped chiptune HP progress bar, bouncing pixel cat playhead, chunky arcade button, and CRT scanlines.",
    highlights: ["Bouncing pixel cat sprite thumb", "8-bit bevelled coin play button", "Pixel starfield & CRT scanlines"],
    free: false,
    pricePhp: 59,
    priceUsd: 1.49,
    playhead: "arcade8bit",
    playButton: "arcade8bit",
    scene: "arcade8bit",
    baseTheme: "arcade",
    accent: "#facc15",
    secondaryAccent: "#4ade80",
    previewGradient: "linear-gradient(135deg, #0b0d1f 0%, #1d153b 55%, #24210c 100%)",
    unlockCode: "ILLUSIVE-8BIT-8P4C",
  },
  {
    id: "vinyl-audiophile",
    name: "Hi-Fi Vinyl & Warm Tube Studio",
    badge: "Music Lover",
    category: "music",
    tagline: "Spinning grooved vinyl play button, stylus cartridge playhead, and warm late-night tube-amp ambiance.",
    highlights: ["Record stylus & VU pulse bar", "Spinning grooved vinyl play button", "Warm analog turntable studio scene"],
    free: false,
    pricePhp: 59,
    priceUsd: 1.49,
    playhead: "vinyl",
    playButton: "vinyl",
    scene: "vinyl",
    baseTheme: "sunset",
    accent: "#f59e0b",
    secondaryAccent: "#fbbf24",
    previewGradient: "linear-gradient(135deg, #17100b 0%, #2e1d10 55%, #1b1410 100%)",
    unlockCode: "ILLUSIVE-VINYL-6V3L",
  },
  {
    id: "cyberpunk-neon",
    name: "Night City Edgerunner",
    badge: "Trend",
    category: "trend",
    tagline: "High-voltage cyber laser playhead, chamfered mecha core play button, and neon perspective grid.",
    highlights: ["Sawtooth neon laser playhead", "Chamfered HUD hex-core play button", "Cyber horizon grid backdrop"],
    free: false,
    pricePhp: 59,
    priceUsd: 1.49,
    playhead: "cyberpunk",
    playButton: "cyberpunk",
    scene: "cyberpunk",
    baseTheme: "synthwave",
    accent: "#22d3ee",
    secondaryAccent: "#f43f5e",
    previewGradient: "linear-gradient(135deg, #07131d 0%, #141738 55%, #300f29 100%)",
    unlockCode: "ILLUSIVE-CYBER-2N9X",
  },
];

export const PLAYHEAD_META: readonly { id: PlayheadStyle; label: string; desc: string }[] = [
  { id: "pixel", label: "Pixel Wave", desc: "Google Material You animated squiggly bar" },
  { id: "default", label: "Classic Flat", desc: "Minimal straight progress track" },
  { id: "shinobi", label: "Kunai & Rasengan", desc: "Chakra wave with spinning Rasengan & Kunai" },
  { id: "akatsuki", label: "Sharingan Slash", desc: "Crimson bar with 3-Tomoe Sharingan thumb" },
  { id: "grandline", label: "Straw Hat", desc: "Grand Line ocean wave & Straw Hat crest" },
  { id: "kpop", label: "Chrome Heart", desc: "Y2K holographic wave with chrome heart" },
  { id: "arcade8bit", label: "8-Bit Cat Runner", desc: "Stepped pixel HP bar with pixel cat sprite" },
  { id: "vinyl", label: "Vinyl Stylus", desc: "Warm amber VU pulse with turntable cartridge" },
  { id: "cyberpunk", label: "Laser Hex", desc: "Electric cyber wave with hex core thumb" },
];

export const PLAY_BUTTON_META: readonly { id: PlayButtonStyle; label: string; desc: string }[] = [
  { id: "default", label: "Classic Disc", desc: "Solid accent circular play button" },
  { id: "shinobi", label: "Rasengan Seal", desc: "Spinning blue/orange chakra spiral disc" },
  { id: "akatsuki", label: "Sharingan Eye", desc: "Crimson 3-tomoe Sharingan iris disc" },
  { id: "grandline", label: "Pirate Compass", desc: "Golden Gear 5 / Straw Hat compass disc" },
  { id: "kpop", label: "Y2K Chrome", desc: "Iridescent pink-cyan glossy star disc" },
  { id: "arcade8bit", label: "8-Bit Coin", desc: "Chunky pixel-bevelled retro button" },
  { id: "vinyl", label: "Spinning Vinyl", desc: "Grooved LP record that spins when playing" },
  { id: "cyberpunk", label: "Cyber Core", desc: "Chamfered mecha HUD hex reactor" },
];

export const SCENE_META: readonly { id: SceneStyle; label: string; desc: string }[] = [
  { id: "none", label: "None (Clean)", desc: "Pure theme surface with optional grain" },
  { id: "shinobi", label: "Konoha Embers", desc: "Leaf village silhouettes & chakra embers" },
  { id: "akatsuki", label: "Akatsuki Sky", desc: "Iconic drifting crimson clouds" },
  { id: "grandline", label: "Grand Line Sea", desc: "Drifting Gear 5 clouds & compass rose" },
  { id: "kpop", label: "Y2K Aura", desc: "Iridescent concert glow & chrome stars" },
  { id: "arcade8bit", label: "8-Bit CRT", desc: "Pixel starfield & subtle scanlines" },
  { id: "vinyl", label: "Vinyl Lounge", desc: "Warm turntable silhouette & tube glow" },
  { id: "cyberpunk", label: "Night City Grid", desc: "Neon perspective grid & HUD corners" },
  { id: "custom", label: "Custom Wallpaper", desc: "Your uploaded image or animated GIF" },
];

export interface SellerPaymentInfo {
  gcashNumber: string;
  mayaNumber: string;
  checkoutUrl: string;
  sellerNote: string;
}

const DEFAULT_PAYMENT_INFO: SellerPaymentInfo = {
  gcashNumber: "09XX-XXX-XXXX (Set via Creator Mode)",
  mayaNumber: "09XX-XXX-XXXX (Set via Creator Mode)",
  checkoutUrl: "https://ko-fi.com/illusivesounds",
  sellerNote: "Send payment, screenshot receipt to the creator, and enter your unlock key below.",
};

interface StoredThemeState {
  saleMode: SaleMode;
  activePackId: string;
  playheadStyle: PlayheadStyle;
  playButtonStyle: PlayButtonStyle;
  sceneStyle: SceneStyle;
  customBgDataUrl: string | null;
  sceneIntensity: number;
  unlockedIds: string[];
  creatorUnlocked: boolean;
  paymentInfo: SellerPaymentInfo;
}

const STORAGE_KEY = "musike:theme-store-v1";

const DEFAULT_STATE: StoredThemeState = {
  saleMode: "beta",
  activePackId: "pixel-original",
  playheadStyle: "pixel",
  playButtonStyle: "default",
  sceneStyle: "none",
  customBgDataUrl: null,
  sceneIntensity: 0.72,
  unlockedIds: [],
  creatorUnlocked: false,
  paymentInfo: DEFAULT_PAYMENT_INFO,
};

function syncSceneAttribute(sceneStyle: SceneStyle) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.scene = sceneStyle;
}

const VALID_PLAYHEADS = new Set<string>(PLAYHEAD_META.map((p) => p.id));
const VALID_PLAY_BUTTONS = new Set<string>(PLAY_BUTTON_META.map((p) => p.id));
const VALID_SCENES = new Set<string>(SCENE_META.map((p) => p.id));

function readStoredState(): StoredThemeState {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, unknown>;
    const out: StoredThemeState = {
      ...DEFAULT_STATE,
      paymentInfo: { ...DEFAULT_PAYMENT_INFO },
    };
    if (raw.saleMode === "beta" || raw.saleMode === "live") out.saleMode = raw.saleMode;
    if (typeof raw.activePackId === "string" && raw.activePackId) out.activePackId = raw.activePackId;
    if (typeof raw.playheadStyle === "string" && VALID_PLAYHEADS.has(raw.playheadStyle)) {
      out.playheadStyle = raw.playheadStyle as PlayheadStyle;
    }
    if (typeof raw.playButtonStyle === "string" && VALID_PLAY_BUTTONS.has(raw.playButtonStyle)) {
      out.playButtonStyle = raw.playButtonStyle as PlayButtonStyle;
    }
    if (typeof raw.sceneStyle === "string" && VALID_SCENES.has(raw.sceneStyle)) {
      out.sceneStyle = raw.sceneStyle as SceneStyle;
    }
    if (typeof raw.customBgDataUrl === "string" && raw.customBgDataUrl.startsWith("data:image/")) {
      out.customBgDataUrl = raw.customBgDataUrl;
    }
    if (typeof raw.sceneIntensity === "number" && raw.sceneIntensity >= 0.2 && raw.sceneIntensity <= 1) {
      out.sceneIntensity = raw.sceneIntensity;
    }
    if (Array.isArray(raw.unlockedIds)) {
      out.unlockedIds = raw.unlockedIds.filter((x): x is string => typeof x === "string");
    }
    if (raw.creatorUnlocked === true) out.creatorUnlocked = true;
    if (raw.paymentInfo && typeof raw.paymentInfo === "object") {
      const pi = raw.paymentInfo as Record<string, unknown>;
      if (typeof pi.gcashNumber === "string") out.paymentInfo.gcashNumber = pi.gcashNumber;
      if (typeof pi.mayaNumber === "string") out.paymentInfo.mayaNumber = pi.mayaNumber;
      if (typeof pi.checkoutUrl === "string") out.paymentInfo.checkoutUrl = pi.checkoutUrl;
      if (typeof pi.sellerNote === "string") out.paymentInfo.sellerNote = pi.sellerNote;
    }
    syncSceneAttribute(out.sceneStyle);
    return out;
  } catch {
    syncSceneAttribute("none");
    return DEFAULT_STATE;
  }
}

function persistState(state: StoredThemeState) {
  syncSceneAttribute(state.sceneStyle);
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        saleMode: state.saleMode,
        activePackId: state.activePackId,
        playheadStyle: state.playheadStyle,
        playButtonStyle: state.playButtonStyle,
        sceneStyle: state.sceneStyle,
        customBgDataUrl: state.customBgDataUrl,
        sceneIntensity: state.sceneIntensity,
        unlockedIds: state.unlockedIds,
        creatorUnlocked: state.creatorUnlocked,
        paymentInfo: state.paymentInfo,
      }),
    );
  } catch {
    /* ignore quota errors cleanly; customBgDataUrl may be too large on some devices */
  }
}

export function isPackOwned(pack: Pick<SkinPack, "id" | "free">, unlockedIds: readonly string[]): boolean {
  return pack.free || unlockedIds.includes(ALL_ACCESS_BUNDLE.id) || unlockedIds.includes(pack.id);
}

export function canUsePack(pack: Pick<SkinPack, "id" | "free">, unlockedIds: readonly string[], saleMode: SaleMode): boolean {
  return saleMode === "beta" || isPackOwned(pack, unlockedIds);
}

interface ThemeStoreState extends StoredThemeState {
  setSaleMode: (mode: SaleMode) => void;
  setPlayheadStyle: (style: PlayheadStyle) => void;
  setPlayButtonStyle: (style: PlayButtonStyle) => void;
  setSceneStyle: (style: SceneStyle) => void;
  setSceneIntensity: (intensity: number) => void;
  setCustomBgDataUrl: (url: string | null) => void;
  setPaymentInfo: (patch: Partial<SellerPaymentInfo>) => void;
  applyPack: (packId: string) => boolean;
  redeemCode: (rawCode: string) => { ok: boolean; label: string; scope: "pack" | "all" | "creator" | "invalid" };
  resetCustomizations: () => void;
}

const initial = readStoredState();

export const useThemeStore = create<ThemeStoreState>((set, get) => ({
  ...initial,

  setSaleMode: (saleMode) =>
    set((s) => {
      const next: StoredThemeState = { ...s, saleMode };
      // If switching to live sale mode while currently using a locked premium pack, fall back to the free Pixel pack.
      if (saleMode === "live") {
        const activePack = SKIN_PACKS.find((p) => p.id === s.activePackId);
        if (activePack && !isPackOwned(activePack, s.unlockedIds)) {
          const fallback = SKIN_PACKS[0]!;
          next.activePackId = fallback.id;
          next.playheadStyle = fallback.playhead;
          next.playButtonStyle = fallback.playButton;
          next.sceneStyle = fallback.scene;
          useUi.getState().setTheme(fallback.baseTheme);
          useAppearance.getState().set({ accent: fallback.accent });
        }
      }
      persistState(next);
      return next;
    }),

  setPlayheadStyle: (playheadStyle) =>
    set((s) => {
      const next: StoredThemeState = { ...s, activePackId: "custom-mix", playheadStyle };
      persistState(next);
      return next;
    }),

  setPlayButtonStyle: (playButtonStyle) =>
    set((s) => {
      const next: StoredThemeState = { ...s, activePackId: "custom-mix", playButtonStyle };
      persistState(next);
      return next;
    }),

  setSceneStyle: (sceneStyle) =>
    set((s) => {
      const next: StoredThemeState = { ...s, activePackId: "custom-mix", sceneStyle };
      persistState(next);
      return next;
    }),

  setSceneIntensity: (sceneIntensity) =>
    set((s) => {
      const clamped = Math.min(1, Math.max(0.2, sceneIntensity));
      const next: StoredThemeState = { ...s, sceneIntensity: clamped };
      persistState(next);
      return next;
    }),

  setCustomBgDataUrl: (customBgDataUrl) =>
    set((s) => {
      const next: StoredThemeState = {
        ...s,
        customBgDataUrl,
        sceneStyle: customBgDataUrl ? "custom" : s.sceneStyle === "custom" ? "none" : s.sceneStyle,
      };
      persistState(next);
      return next;
    }),

  setPaymentInfo: (patch) =>
    set((s) => {
      const next: StoredThemeState = { ...s, paymentInfo: { ...s.paymentInfo, ...patch } };
      persistState(next);
      return next;
    }),

  applyPack: (packId) => {
    const pack = SKIN_PACKS.find((p) => p.id === packId);
    if (!pack) return false;
    const s = get();
    if (!canUsePack(pack, s.unlockedIds, s.saleMode)) return false;

    useUi.getState().setTheme(pack.baseTheme);
    useAppearance.getState().set({ accent: pack.accent });

    const next: StoredThemeState = {
      ...s,
      activePackId: pack.id,
      playheadStyle: pack.playhead,
      playButtonStyle: pack.playButton,
      sceneStyle: pack.scene,
    };
    persistState(next);
    set(next);
    return true;
  },

  redeemCode: (rawCode) => {
    const code = rawCode.trim().toUpperCase();
    if (!code) return { ok: false, label: "Enter a license key.", scope: "invalid" };

    const s = get();
    if (code === ALL_ACCESS_BUNDLE.masterCode) {
      const next: StoredThemeState = {
        ...s,
        creatorUnlocked: true,
        unlockedIds: Array.from(new Set([...s.unlockedIds, ALL_ACCESS_BUNDLE.id])),
      };
      persistState(next);
      set(next);
      return { ok: true, label: "Creator Master Key activated — all themes & Seller Tools unlocked.", scope: "creator" };
    }

    if (code === ALL_ACCESS_BUNDLE.unlockCode) {
      const next: StoredThemeState = {
        ...s,
        unlockedIds: Array.from(new Set([...s.unlockedIds, ALL_ACCESS_BUNDLE.id])),
      };
      persistState(next);
      set(next);
      return { ok: true, label: "All-Access Pro Pass unlocked!", scope: "all" };
    }

    const match = SKIN_PACKS.find((p) => p.unlockCode && p.unlockCode.toUpperCase() === code);
    if (match) {
      const next: StoredThemeState = {
        ...s,
        unlockedIds: Array.from(new Set([...s.unlockedIds, match.id])),
      };
      persistState(next);
      set(next);
      get().applyPack(match.id);
      return { ok: true, label: `${match.name} unlocked and applied!`, scope: "pack" };
    }

    return { ok: false, label: "Invalid unlock key. Check spelling and try again.", scope: "invalid" };
  },

  resetCustomizations: () => {
    const fallback = SKIN_PACKS[0]!;
    useUi.getState().setTheme(fallback.baseTheme);
    useAppearance.getState().set({ accent: fallback.accent });
    set((s) => {
      const next: StoredThemeState = {
        ...s,
        activePackId: fallback.id,
        playheadStyle: fallback.playhead,
        playButtonStyle: fallback.playButton,
        sceneStyle: fallback.scene,
      };
      persistState(next);
      return next;
    });
  },
}));

