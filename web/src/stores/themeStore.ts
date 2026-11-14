import { create } from "zustand";
import type { ThemeId } from "../lib/accent";
import {
  clearAnimeAssetGroup,
  loadAllAnimeAssetUrls,
  saveAnimeAssetBlob,
  type AnimeAssetSlot,
  type AnimeThemeKey,
  type LoadedAnimeCustomAssets,
} from "../lib/themeAssetsDb";
import { useAppearance } from "./appearance";
import { useUi } from "./ui";

export type PlayheadStyle = "default" | "pixel" | "shinobi" | "akatsuki" | "grandline";
export type PlayButtonStyle = "default" | "shinobi" | "akatsuki" | "grandline";
export type SceneStyle = "none" | "shinobi" | "akatsuki" | "grandline" | "custom";

export type SaleMode = "beta" | "live";
export type SkinCategory = "all" | "anime" | "music";

export interface SkinPack {
  id: string;
  name: string;
  badge: string;
  worldLabel: string;
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

export const ANIME_THEME_ASSETS_DEFAULT: Record<AnimeThemeKey, Required<LoadedAnimeCustomAssets>> = {
  shinobi: {
    mobileWallpaper: { url: "/themes/naruto-mobile.mp4", isVideo: true },
    pcWallpaper: { url: "/themes/naruto-pc.mp4", isVideo: true },
    playheadIcon: "/themes/naruto-shuriken.png",
  },
  akatsuki: {
    mobileWallpaper: { url: "/themes/itachi-mobile.mp4", isVideo: true },
    pcWallpaper: { url: "/themes/itachi-pc.mp4", isVideo: true },
    playheadIcon: "/themes/itachi-sharingan.png",
  },
  grandline: {
    mobileWallpaper: { url: "/themes/luffy-mobile.mp4", isVideo: true },
    pcWallpaper: { url: "/themes/luffy-pc.mp4", isVideo: true },
    playheadIcon: "/themes/luffy-strawhat.png",
  },
};

export const ALL_ACCESS_BUNDLE = {
  id: "all-access",
  title: "All-Access Pro Pass (All Anime Themes + Custom Uploads)",
  pricePhp: 199,
  priceUsd: 4.99,
  unlockCode: "ILLUSIVE-VIP-ALL-2026",
  masterCode: "IANLESTER",
} as const;

export const SKIN_PACKS: readonly SkinPack[] = [
  {
    id: "classic-minimal",
    name: "Studio Minimal",
    badge: "Default Free",
    worldLabel: "STUDIO · OLED",
    category: "music",
    tagline: "Clean obsidian flat scrubber and distraction-free focus.",
    highlights: ["Precision straight scrubber", "Solid high-contrast play disc", "Deep obsidian contrast"],
    free: true,
    pricePhp: 0,
    priceUsd: 0,
    playhead: "default",
    playButton: "default",
    scene: "none",
    baseTheme: "dark",
    accent: "#34d399",
    secondaryAccent: "#22d3ee",
    previewGradient: "linear-gradient(135deg, #090b0f 0%, #10161d 60%, #13221f 100%)",
    unlockCode: "",
  },
  {
    id: "pixel-original",
    name: "Google Pixel Wave",
    badge: "Free",
    worldLabel: "PIXEL · MATERIAL",
    category: "music",
    tagline: "Animated squiggly Material You scrubber and Volt play disc.",
    highlights: ["Squiggly wave scrubber", "Clean Volt disc play button", "Material You style"],
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
    id: "naruto-shinobi",
    name: "Naruto: Hidden Leaf Moon",
    badge: "Naruto World",
    worldLabel: "木ノ葉 · SHINOBI",
    category: "anime",
    tagline: "Moonlit Konoha live wallpaper, golden chakra scrubber & spinning Shuriken playhead.",
    highlights: ["Live Mobile & PC wallpaper", "Moonlight gold UI palette", "Animated Shuriken playhead"],
    free: false,
    pricePhp: 79,
    priceUsd: 1.99,
    playhead: "shinobi",
    playButton: "shinobi",
    scene: "shinobi",
    baseTheme: "midnight",
    accent: "#facc15",
    secondaryAccent: "#eab308",
    previewGradient: "linear-gradient(145deg, #0b0d14 0%, #171c2b 58%, #362c0b 100%)",
    unlockCode: "ILLUSIVE-SHINOBI-7X9K",
  },
  {
    id: "akatsuki-cloud",
    name: "Itachi: Tsukuyomi Blood Moon",
    badge: "Naruto World",
    worldLabel: "月読 · UCHIHA",
    category: "anime",
    tagline: "Blood Moon silhouette live wallpaper, crimson wave scrubber & Mangekyō Sharingan playhead.",
    highlights: ["Live Mobile & PC wallpaper", "Crimson Blood Moon UI palette", "Animated Sharingan playhead"],
    free: false,
    pricePhp: 79,
    priceUsd: 1.99,
    playhead: "akatsuki",
    playButton: "akatsuki",
    scene: "akatsuki",
    baseTheme: "oled",
    accent: "#ef4444",
    secondaryAccent: "#dc2626",
    previewGradient: "linear-gradient(150deg, #070203 0%, #2a060c 58%, #120407 100%)",
    unlockCode: "ILLUSIVE-AKATSUKI-9R2M",
  },
  {
    id: "onepiece-grandline",
    name: "Luffy: Gear 5 Nika Moon",
    badge: "One Piece",
    worldLabel: "GEAR 5 · NIKA",
    category: "anime",
    tagline: "Gear 5 moonlight live wallpaper, Nika violet pulse scrubber & Straw Hat playhead.",
    highlights: ["Live Mobile & PC wallpaper", "Gear 5 violet moon UI palette", "Animated Straw Hat playhead"],
    free: false,
    pricePhp: 79,
    priceUsd: 1.99,
    playhead: "grandline",
    playButton: "grandline",
    scene: "grandline",
    baseTheme: "midnight",
    accent: "#c084fc",
    secondaryAccent: "#a855f7",
    previewGradient: "linear-gradient(145deg, #090612 0%, #1c1138 58%, #2f1a4d 100%)",
    unlockCode: "ILLUSIVE-GRANDLINE-5G1P",
  },
];

export const PLAYHEAD_META: readonly { id: PlayheadStyle; label: string; desc: string }[] = [
  { id: "default", label: "Studio Flat", desc: "Clean minimal straight progress track" },
  { id: "pixel", label: "Pixel Wave", desc: "Google Material You animated squiggly bar" },
  { id: "shinobi", label: "Shuriken Chakra", desc: "Golden zig-zag wave with riding Shuriken" },
  { id: "akatsuki", label: "Tsukuyomi Pulse", desc: "Crimson crest wave with Mangekyō Sharingan" },
  { id: "grandline", label: "Gear 5 Bounce", desc: "Nika moonlight wave with Straw Hat rider" },
];

export const PLAY_BUTTON_META: readonly { id: PlayButtonStyle; label: string; desc: string }[] = [
  { id: "default", label: "Studio Disc", desc: "Solid accent circular play button" },
  { id: "shinobi", label: "Hidden Leaf Seal", desc: "Moonlight gold chakra spiral disc" },
  { id: "akatsuki", label: "Mangekyō Disc", desc: "Crimson Tsukuyomi Sharingan iris disc" },
  { id: "grandline", label: "Nika Moonlight", desc: "Gear 5 violet moonlight ring disc" },
];

export const SCENE_META: readonly { id: SceneStyle; label: string; desc: string }[] = [
  { id: "none", label: "Clean Studio", desc: "Pure dark surface with album glow" },
  { id: "shinobi", label: "Naruto Moon", desc: "Live Naruto Konoha rooftop moonlight video" },
  { id: "akatsuki", label: "Itachi Blood Moon", desc: "Live Itachi Tsukuyomi crimson moon video" },
  { id: "grandline", label: "Luffy Gear 5", desc: "Live Gear 5 Nika moonlight video" },
  { id: "custom", label: "Custom Photo", desc: "Your uploaded image or animated GIF" },
];

export const WORLD_BADGE_BY_SCENE: Record<SceneStyle, string | null> = {
  none: null,
  shinobi: "木ノ葉 · SHINOBI",
  akatsuki: "月読 · UCHIHA",
  grandline: "GEAR 5 · NIKA",
  custom: "CUSTOM · WORLD",
};

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
  activePackId: "classic-minimal",
  playheadStyle: "default",
  playButtonStyle: "default",
  sceneStyle: "none",
  customBgDataUrl: null,
  sceneIntensity: 0.95,
  unlockedIds: [],
  creatorUnlocked: false,
  paymentInfo: DEFAULT_PAYMENT_INFO,
};

function syncSceneAttribute(sceneStyle: SceneStyle) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.scene = sceneStyle;
}

const VALID_PACK_IDS = new Set<string>(SKIN_PACKS.map((p) => p.id).concat("custom-mix"));
const VALID_PLAYHEADS = new Set<string>(PLAYHEAD_META.map((p) => p.id));
const VALID_PLAY_BUTTONS = new Set<string>(PLAY_BUTTON_META.map((p) => p.id));
const VALID_SCENES = new Set<string>(SCENE_META.map((p) => p.id));
const CLEANUP_AI_THEMES_MIGRATION_KEY = "musike:theme-clean-anime-v3";

function readStoredState(): StoredThemeState {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, unknown>;
    const out: StoredThemeState = {
      ...DEFAULT_STATE,
      paymentInfo: { ...DEFAULT_PAYMENT_INFO },
    };
    if (raw.saleMode === "beta" || raw.saleMode === "live") out.saleMode = raw.saleMode;
    if (typeof raw.activePackId === "string" && VALID_PACK_IDS.has(raw.activePackId)) {
      out.activePackId = raw.activePackId;
    }
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
      out.sceneIntensity = raw.sceneIntensity === 0.72 ? 0.95 : raw.sceneIntensity;
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

    // One-time v1.5.7 migration: reset removed AI themes or default pixel wave to clean Studio Minimal
    if (localStorage.getItem(CLEANUP_AI_THEMES_MIGRATION_KEY) !== "1") {
      localStorage.setItem(CLEANUP_AI_THEMES_MIGRATION_KEY, "1");
      if (
        !VALID_PLAYHEADS.has(String(raw.playheadStyle)) ||
        !VALID_SCENES.has(String(raw.sceneStyle)) ||
        out.activePackId === "pixel-original"
      ) {
        out.activePackId = DEFAULT_STATE.activePackId;
        out.playheadStyle = DEFAULT_STATE.playheadStyle;
        out.playButtonStyle = DEFAULT_STATE.playButtonStyle;
        out.sceneStyle = DEFAULT_STATE.sceneStyle;
      }
      persistState(out);
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
    /* ignore quota errors */
  }
}

export function isPackOwned(pack: Pick<SkinPack, "id" | "free">, unlockedIds: readonly string[]): boolean {
  return pack.free || unlockedIds.includes(ALL_ACCESS_BUNDLE.id) || unlockedIds.includes(pack.id);
}

export function canUsePack(pack: Pick<SkinPack, "id" | "free">, unlockedIds: readonly string[], saleMode: SaleMode): boolean {
  return saleMode === "beta" || isPackOwned(pack, unlockedIds);
}

export function mergeAnimeAssets(
  custom: Partial<Record<AnimeThemeKey, LoadedAnimeCustomAssets>>,
): Record<AnimeThemeKey, Required<LoadedAnimeCustomAssets>> {
  const mergeOne = (k: AnimeThemeKey): Required<LoadedAnimeCustomAssets> => ({
    mobileWallpaper: custom[k]?.mobileWallpaper ?? ANIME_THEME_ASSETS_DEFAULT[k].mobileWallpaper,
    pcWallpaper: custom[k]?.pcWallpaper ?? ANIME_THEME_ASSETS_DEFAULT[k].pcWallpaper,
    playheadIcon: custom[k]?.playheadIcon ?? ANIME_THEME_ASSETS_DEFAULT[k].playheadIcon,
  });
  return {
    shinobi: mergeOne("shinobi"),
    akatsuki: mergeOne("akatsuki"),
    grandline: mergeOne("grandline"),
  };
}

interface ThemeStoreState extends StoredThemeState {
  animeAssets: Record<AnimeThemeKey, Required<LoadedAnimeCustomAssets>>;
  customAnimeOverrides: Partial<Record<AnimeThemeKey, LoadedAnimeCustomAssets>>;
  setSaleMode: (mode: SaleMode) => void;
  setPlayheadStyle: (style: PlayheadStyle) => void;
  setPlayButtonStyle: (style: PlayButtonStyle) => void;
  setSceneStyle: (style: SceneStyle) => void;
  setSceneIntensity: (intensity: number) => void;
  setCustomBgDataUrl: (url: string | null) => void;
  setPaymentInfo: (patch: Partial<SellerPaymentInfo>) => void;
  uploadAnimeAsset: (anime: AnimeThemeKey, slot: AnimeAssetSlot, file: File) => Promise<void>;
  resetAnimeAssets: (anime: AnimeThemeKey) => Promise<void>;
  applyPack: (packId: string) => boolean;
  previewPack: (packId: string) => void;
  redeemCode: (rawCode: string) => { ok: boolean; label: string; scope: "pack" | "all" | "creator" | "invalid" };
  resetCustomizations: () => void;
}

const initial = readStoredState();

export const useThemeStore = create<ThemeStoreState>((set, get) => ({
  ...initial,
  animeAssets: mergeAnimeAssets({}),
  customAnimeOverrides: {},

  setSaleMode: (saleMode) =>
    set((s) => {
      const next: StoredThemeState = { ...s, saleMode };
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

  uploadAnimeAsset: async (anime, slot, file) => {
    await saveAnimeAssetBlob(anime, slot, file);
    const url = URL.createObjectURL(file);
    set((s) => {
      const prevAnime = s.customAnimeOverrides[anime] ?? {};
      const oldEntry = prevAnime[slot];
      if (typeof oldEntry === "string" && oldEntry.startsWith("blob:")) URL.revokeObjectURL(oldEntry);
      else if (oldEntry && typeof oldEntry === "object" && oldEntry.url.startsWith("blob:")) URL.revokeObjectURL(oldEntry.url);

      const updated: LoadedAnimeCustomAssets = {
        ...prevAnime,
        [slot]: slot === "playheadIcon" ? url : { url, isVideo: file.type.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(file.name) },
      };
      const overrides = { ...s.customAnimeOverrides, [anime]: updated };
      return {
        customAnimeOverrides: overrides,
        animeAssets: mergeAnimeAssets(overrides),
      };
    });
  },

  resetAnimeAssets: async (anime) => {
    await clearAnimeAssetGroup(anime);
    set((s) => {
      const prevAnime = s.customAnimeOverrides[anime];
      if (prevAnime) {
        for (const v of Object.values(prevAnime)) {
          if (typeof v === "string" && v.startsWith("blob:")) URL.revokeObjectURL(v);
          else if (v && typeof v === "object" && v.url.startsWith("blob:")) URL.revokeObjectURL(v.url);
        }
      }
      const overrides = { ...s.customAnimeOverrides };
      delete overrides[anime];
      return {
        customAnimeOverrides: overrides,
        animeAssets: mergeAnimeAssets(overrides),
      };
    });
  },

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

  previewPack: (packId) => {
    const pack = SKIN_PACKS.find((p) => p.id === packId);
    if (!pack) return;
    const s = get();
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

// Hydrate any user-uploaded per-anime assets saved in IndexedDB across app restarts.
void loadAllAnimeAssetUrls().then((overrides) => {
  if (!Object.keys(overrides).length) return;
  useThemeStore.setState({
    customAnimeOverrides: overrides,
    animeAssets: mergeAnimeAssets(overrides),
  });
});
