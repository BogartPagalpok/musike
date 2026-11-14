import {
  ArrowSquareOutIcon,
  CheckIcon,
  CopyIcon,
  CrownIcon,
  KeyIcon,
  LockKeyIcon,
  MagicWandIcon,
  PaletteIcon,
  PlayIcon,
  ShieldCheckIcon,
  ShoppingBagOpenIcon,
  SparkleIcon,
  StorefrontIcon,
  SwatchesIcon,
  TrashIcon,
  UploadSimpleIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { CustomColorPicker } from "../components/CustomizeSection";
import { PlayDisc } from "../components/IconButton";
import { PageHeader } from "../components/Page";
import { Slider } from "../components/Slider";
import { ThemeSceneBackdrop } from "../components/ThemeSceneBackdrop";
import { cn } from "../lib/format";
import { ACCENTS, useAppearance } from "../stores/appearance";
import {
  ALL_ACCESS_BUNDLE,
  canUsePack,
  isPackOwned,
  PLAY_BUTTON_META,
  PLAYHEAD_META,
  SCENE_META,
  SKIN_PACKS,
  useThemeStore,
  type PlayButtonStyle,
  type PlayheadStyle,
  type SceneStyle,
  type SkinCategory,
  type SkinPack,
} from "../stores/themeStore";
import { toast } from "../stores/ui";

type StoreTab = SkinCategory | "custom";

const TABS: readonly { id: StoreTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "anime", label: "Anime" },
  { id: "trend", label: "Cyber & Retro" },
  { id: "music", label: "Music" },
  { id: "custom", label: "Mix & Match" },
];

const SCENE_FRAME_STYLE: Record<SceneStyle, string> = {
  none: "border-white/15 rounded-lg bg-black/35",
  akatsuki: "border-red-500/60 rounded-lg bg-[#140407]/70 shadow-[0_0_20px_rgba(239,68,68,0.22)]",
  shinobi: "border-orange-400/55 rounded-lg bg-[#1a0d07]/68 shadow-[0_0_18px_rgba(249,115,22,0.2)]",
  grandline: "border-amber-400/60 rounded-lg bg-[#09182e]/68 shadow-[0_0_18px_rgba(251,191,36,0.2)]",
  kpop: "border-pink-300/65 rounded-xl bg-[#220b28]/65 shadow-[0_0_18px_rgba(244,114,182,0.24)]",
  arcade8bit: "border-2 border-yellow-400 rounded-none bg-[#0d102c]/80 shadow-[3px_3px_0_#000]",
  vinyl: "border-amber-500/55 rounded-lg bg-[#1a1009]/72 shadow-[0_0_18px_rgba(245,158,11,0.2)]",
  cyberpunk: "border-cyan-400/65 rounded-sm bg-[#091326]/72 shadow-[0_0_18px_rgba(34,211,238,0.22)]",
  custom: "border-white/25 rounded-lg bg-black/45",
};

async function readWallpaperFile(file: File): Promise<string> {
  if (file.type === "image/gif") {
    if (file.size > 3_500_000) {
      throw new Error("GIF is too large (keep animated GIFs under 3.5 MB).");
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Couldn't read image file."));
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const maxDim = 1920;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas unavailable.");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      } catch (e) {
        reject(e);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unsupported image format."));
    };
    img.src = url;
  });
}

function PackCard({
  pack,
  active,
  owned,
  usable,
  saleMode,
  onApply,
  onPreview,
  onUnlock,
}: {
  pack: SkinPack;
  active: boolean;
  owned: boolean;
  usable: boolean;
  saleMode: "beta" | "live";
  onApply: () => void;
  onPreview: () => void;
  onUnlock: () => void;
}) {
  const frameCls = SCENE_FRAME_STYLE[pack.scene];

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-[16px] bg-surface-2 ring-1 transition-all",
        active ? "ring-[2px] ring-accent shadow-[0_12px_32px_rgb(0_0_0/0.4)]" : "ring-line hover:ring-line-strong",
      )}
    >
      {/* Live Miniature App Window Showcase */}
      <div
        onClick={usable ? onApply : onPreview}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (usable) onApply();
            else onPreview();
          }
        }}
        className="relative flex h-[186px] cursor-pointer flex-col justify-between overflow-hidden p-3 select-none"
        style={{ background: pack.previewGradient }}
      >
        <ThemeSceneBackdrop sceneOverride={pack.scene} contained />

        {/* Top Chrome: World Crest Badge & Status */}
        <div className="relative z-10 flex items-center justify-between gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider uppercase backdrop-blur-sm"
            style={{
              backgroundColor: "rgba(0,0,0,0.62)",
              borderColor: `${pack.accent}66`,
              color: pack.accent,
            }}
          >
            {pack.worldLabel}
          </span>
          {active ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10.5px] font-bold text-accent-ink shadow-xs">
              <CheckIcon size={11} weight="bold" />
              Equipped
            </span>
          ) : !pack.free && owned ? (
            <span className="rounded-full bg-emerald-500/25 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-200 ring-1 ring-emerald-400/40 backdrop-blur-sm">
              Owned
            </span>
          ) : !pack.free && saleMode === "beta" ? (
            <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10.5px] font-semibold text-amber-300 ring-1 ring-amber-400/35 backdrop-blur-sm">
              Free Trial · ₱{pack.pricePhp}
            </span>
          ) : !pack.free ? (
            <span className="rounded-full bg-black/65 px-2 py-0.5 text-[10.5px] font-bold text-white ring-1 ring-white/25 backdrop-blur-sm">
              ₱{pack.pricePhp}
            </span>
          ) : (
            <span className="rounded-full bg-black/55 px-2 py-0.5 text-[10.5px] font-semibold text-white/80 ring-1 ring-white/15 backdrop-blur-sm">
              Free
            </span>
          )}
        </div>

        {/* Miniature App Layout + Controls Mockup */}
        <div className={cn("relative z-10 mt-2 flex flex-1 flex-col justify-between border p-2 backdrop-blur-[3px]", frameCls)}>
          <div className="flex min-h-0 flex-1 gap-2">
            {/* Mini Sidebar Rail */}
            <div className="flex w-11 shrink-0 flex-col gap-1 border-r border-white/10 pr-1.5">
              <span className="h-1.5 w-full rounded-full opacity-75" style={{ backgroundColor: pack.accent }} />
              <span className="h-1 w-4/5 rounded-full bg-white/25" />
              <span className="h-1 w-3/4 rounded-full bg-white/15" />
              <span className="mt-auto h-1 w-2/3 rounded-full bg-white/20" />
            </div>

            {/* Mini Stage Artwork & Lyrics */}
            <div className="flex min-w-0 flex-1 items-center gap-2.5 pl-0.5">
              <div
                className={cn(
                  "size-10 shrink-0 border",
                  pack.scene === "arcade8bit" ? "rounded-none" : "rounded-md",
                )}
                style={{
                  borderColor: pack.accent,
                  background: `radial-gradient(circle at 35% 35%, ${pack.accent}66, rgba(0,0,0,0.65))`,
                }}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="h-1.5 w-3/4 rounded-full bg-white/75" />
                <span className="h-1 w-1/2 rounded-full opacity-80" style={{ backgroundColor: pack.secondaryAccent }} />
                <span className="h-1 w-2/3 rounded-full bg-white/30" />
              </div>
            </div>
          </div>

          {/* Mini Player Bar with Actual Custom PlayButton & Scrubber */}
          <div className="mt-1.5 flex items-center gap-2.5 border-t border-white/10 pt-1.5">
            <div onClick={(e) => e.stopPropagation()}>
              <PlayDisc px={34} styleVariant={pack.playButton} playing label={`${pack.name} play button`}>
                <PlayIcon size={14} weight="fill" />
              </PlayDisc>
            </div>
            <div className="min-w-0 flex-1" onClick={(e) => e.stopPropagation()}>
              <Slider
                variant={pack.playhead}
                isPlaying
                value={64}
                max={100}
                label={`${pack.name} scrubber`}
                onChange={() => {}}
                className="h-4"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Crisp Footer: Title, 1-Line Summary, Action */}
      <div className="flex items-center justify-between gap-3 px-3.5 py-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14.5px] font-bold tracking-tight text-fg">{pack.name}</h3>
          <p className="mt-0.5 truncate text-[11.5px] text-fg-2">{pack.tagline}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {!pack.free && !owned && saleMode === "beta" && (
            <button
              type="button"
              onClick={onUnlock}
              title={`Buy or redeem key (₱${pack.pricePhp})`}
              aria-label={`Purchase ${pack.name}`}
              className="grid size-8 place-items-center rounded-full bg-surface-3 text-fg-2 ring-1 ring-line transition-colors hover:bg-surface-4 hover:text-fg"
            >
              <ShoppingBagOpenIcon size={15} />
            </button>
          )}
          {usable ? (
            <button
              type="button"
              onClick={onApply}
              className={cn(
                "flex h-8.5 items-center gap-1 rounded-full px-3.5 text-xs font-semibold transition-transform active:scale-95",
                active ? "bg-surface-3 text-fg ring-1 ring-line-strong" : "bg-accent text-accent-ink",
              )}
            >
              {active ? (
                <>
                  <CheckIcon size={13} weight="bold" />
                  <span>Equipped</span>
                </>
              ) : (
                "Equip"
              )}
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onPreview}
                title={`Preview ${pack.name} live`}
                className="flex h-8.5 items-center rounded-full bg-surface-3 px-3 text-xs font-semibold text-fg ring-1 ring-line transition-transform hover:bg-surface-4 active:scale-95"
              >
                Test
              </button>
              <button
                type="button"
                onClick={onUnlock}
                className="flex h-8.5 items-center gap-1 rounded-full bg-accent px-3 text-xs font-semibold text-accent-ink transition-transform active:scale-95"
              >
                <LockKeyIcon size={13} weight="bold" />
                <span>₱{pack.pricePhp}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function CheckoutModal({
  open,
  targetPack,
  onClose,
}: {
  open: boolean;
  targetPack: SkinPack | "all-access" | "redeem" | null;
  onClose: () => void;
}) {
  const unlockedIds = useThemeStore((s) => s.unlockedIds);
  const creatorUnlocked = useThemeStore((s) => s.creatorUnlocked);
  const paymentInfo = useThemeStore((s) => s.paymentInfo);
  const setPaymentInfo = useThemeStore((s) => s.setPaymentInfo);
  const redeemCode = useThemeStore((s) => s.redeemCode);
  const previewPack = useThemeStore((s) => s.previewPack);

  const [keyInput, setKeyInput] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [gcash, setGcash] = useState(paymentInfo.gcashNumber);
  const [maya, setMaya] = useState(paymentInfo.mayaNumber);
  const [checkoutUrl, setCheckoutUrl] = useState(paymentInfo.checkoutUrl);
  const [sellerNote, setSellerNote] = useState(paymentInfo.sellerNote);

  useEffect(() => {
    setGcash(paymentInfo.gcashNumber);
    setMaya(paymentInfo.mayaNumber);
    setCheckoutUrl(paymentInfo.checkoutUrl);
    setSellerNote(paymentInfo.sellerNote);
  }, [paymentInfo, open]);

  useEffect(() => {
    if (!open) {
      setKeyInput("");
      setFeedback(null);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!open || !targetPack) return null;

  const isAll = targetPack === "all-access";
  const isRedeemOnly = targetPack === "redeem";
  const packObj = typeof targetPack === "object" ? targetPack : null;
  const title = isRedeemOnly
    ? "Redeem Theme Unlock Key"
    : isAll
      ? ALL_ACCESS_BUNDLE.title
      : packObj?.name ?? "Unlock Theme";
  const priceText = isRedeemOnly
    ? null
    : isAll
      ? `₱${ALL_ACCESS_BUNDLE.pricePhp} / $${ALL_ACCESS_BUNDLE.priceUsd.toFixed(2)}`
      : packObj
        ? `₱${packObj.pricePhp} / $${packObj.priceUsd.toFixed(2)}`
        : null;

  const handleRedeem = () => {
    const res = redeemCode(keyInput);
    setFeedback({ ok: res.ok, text: res.label });
    if (res.ok) {
      toast(res.label, "info");
      if (res.scope === "pack" || res.scope === "all") {
        setTimeout(() => onClose(), 700);
      }
    }
  };

  const copyText = (txt: string, label: string) => {
    void navigator.clipboard?.writeText(txt).then(
      () => toast(`Copied ${label}: ${txt}`),
      () => toast(`${label}: ${txt}`),
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-scrim" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-escape-closes
        className="relative flex max-h-[90dvh] w-full max-w-[540px] flex-col overflow-hidden rounded-t-[20px] bg-surface-1 ring-1 ring-line-strong shadow-[0_28px_70px_rgba(0,0,0,0.65)] sm:rounded-[20px]"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-text">
              {isRedeemOnly ? <KeyIcon size={18} weight="bold" /> : <CrownIcon size={18} weight="bold" />}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-[16px] font-bold text-fg">{title}</h2>
              {priceText && <p className="text-xs font-semibold text-accent-text">{priceText} · Lifetime unlock</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-full text-fg-2 hover:bg-surface-3 hover:text-fg">
            <XIcon size={18} />
          </button>
        </div>

        <div className="scroll-area flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {packObj && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] bg-accent-soft/75 p-3.5 ring-1 ring-accent/35">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-fg">Want to try this world first?</p>
                <p className="text-[11px] text-fg-2">Test its background scene, playhead &amp; controls live before unlocking.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  previewPack(packObj.id);
                  toast(`Testing "${packObj.name}" live!`);
                  onClose();
                }}
                className="h-8 shrink-0 rounded-full bg-accent px-3.5 text-xs font-bold text-accent-ink transition-transform active:scale-95"
              >
                Test Theme Free
              </button>
            </div>
          )}
          {!isRedeemOnly && (
            <div className="space-y-3 rounded-[14px] bg-surface-2 p-4 ring-1 ring-line">
              <p className="text-xs font-semibold uppercase tracking-wider text-fg-3">Step 1 · Direct Payment (0% App Store Fee)</p>
              <p className="text-xs leading-relaxed text-fg-2">{paymentInfo.sellerNote}</p>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-3/80 px-3 py-2">
                  <span className="font-semibold text-fg">GCash:</span>
                  <span className="truncate font-mono text-fg-2">{paymentInfo.gcashNumber}</span>
                  <button type="button" onClick={() => copyText(paymentInfo.gcashNumber, "GCash")} className="shrink-0 text-accent-text hover:underline">
                    <CopyIcon size={14} />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-3/80 px-3 py-2">
                  <span className="font-semibold text-fg">Maya:</span>
                  <span className="truncate font-mono text-fg-2">{paymentInfo.mayaNumber}</span>
                  <button type="button" onClick={() => copyText(paymentInfo.mayaNumber, "Maya")} className="shrink-0 text-accent-text hover:underline">
                    <CopyIcon size={14} />
                  </button>
                </div>
              </div>
              {paymentInfo.checkoutUrl && (
                <a
                  href={paymentInfo.checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-full bg-surface-3 px-4 text-xs font-semibold text-fg ring-1 ring-line transition-colors hover:bg-surface-4"
                >
                  Open Online Checkout Link <ArrowSquareOutIcon size={14} />
                </a>
              )}
            </div>
          )}

          {/* License Key Input */}
          <div className="space-y-2.5 rounded-[14px] bg-surface-2 p-4 ring-1 ring-line">
            <label htmlFor="theme-unlock-key" className="block text-xs font-semibold uppercase tracking-wider text-fg-3">
              {isRedeemOnly ? "Enter Unlock / Creator Key" : "Step 2 · Enter Unlock Key"}
            </label>
            <div className="flex gap-2">
              <input
                id="theme-unlock-key"
                type="text"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRedeem();
                }}
                placeholder="e.g. ILLUSIVE-AKATSUKI-9R2M"
                className="h-10 min-w-0 flex-1 rounded-xl bg-surface-3 px-3 font-mono text-xs text-fg uppercase placeholder:normal-case placeholder:text-fg-3 ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <button
                type="button"
                onClick={handleRedeem}
                className="h-10 shrink-0 rounded-xl bg-accent px-4 text-xs font-bold text-accent-ink transition-transform active:scale-95"
              >
                Unlock
              </button>
            </div>
            {feedback && (
              <p className={cn("text-xs font-medium", feedback.ok ? "text-emerald-400" : "text-danger")}>{feedback.text}</p>
            )}
            <p className="text-[11px] text-fg-3">
              Unlocked passes on this device: {unlockedIds.length === 0 ? "None yet" : unlockedIds.join(", ")}
            </p>
          </div>

          {/* Creator / Seller Key Vault */}
          <div className="rounded-[14px] bg-surface-2 p-4 ring-1 ring-line">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheckIcon size={17} className="text-accent-text" weight="fill" />
                <span className="text-xs font-bold text-fg">Creator / Seller Tools</span>
              </div>
              {!creatorUnlocked && (
                <span className="text-[11px] text-fg-3">Enter creator code above to manage payment &amp; keys</span>
              )}
            </div>

            {creatorUnlocked && (
              <div className="mt-3 space-y-4 border-t border-line pt-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="text-[11px] text-fg-2">
                    GCash Number / Account
                    <input
                      value={gcash}
                      onChange={(e) => setGcash(e.target.value)}
                      className="mt-1 h-8 w-full rounded-lg bg-surface-3 px-2.5 text-xs text-fg ring-1 ring-line"
                    />
                  </label>
                  <label className="text-[11px] text-fg-2">
                    Maya Number / Account
                    <input
                      value={maya}
                      onChange={(e) => setMaya(e.target.value)}
                      className="mt-1 h-8 w-full rounded-lg bg-surface-3 px-2.5 text-xs text-fg ring-1 ring-line"
                    />
                  </label>
                  <label className="text-[11px] text-fg-2 sm:col-span-2">
                    Checkout URL (Ko-fi / Gumroad / PayMongo)
                    <input
                      value={checkoutUrl}
                      onChange={(e) => setCheckoutUrl(e.target.value)}
                      className="mt-1 h-8 w-full rounded-lg bg-surface-3 px-2.5 text-xs text-fg ring-1 ring-line"
                    />
                  </label>
                  <label className="text-[11px] text-fg-2 sm:col-span-2">
                    Buyer Instructions
                    <input
                      value={sellerNote}
                      onChange={(e) => setSellerNote(e.target.value)}
                      className="mt-1 h-8 w-full rounded-lg bg-surface-3 px-2.5 text-xs text-fg ring-1 ring-line"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentInfo({ gcashNumber: gcash, mayaNumber: maya, checkoutUrl, sellerNote });
                    toast("Saved seller payment details.");
                  }}
                  className="h-8 rounded-full bg-surface-3 px-3.5 text-xs font-semibold text-fg ring-1 ring-line hover:bg-surface-4"
                >
                  Save Payment Details
                </button>

                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-3">Unlock Keys to Send to Buyers</p>
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-3/70 px-3 py-1.5 text-xs">
                    <span className="truncate font-semibold text-amber-300">All-Access Pass</span>
                    <code className="font-mono text-[11px] text-fg">{ALL_ACCESS_BUNDLE.unlockCode}</code>
                    <button type="button" onClick={() => copyText(ALL_ACCESS_BUNDLE.unlockCode, "All-Access Key")} className="text-accent-text">
                      <CopyIcon size={14} />
                    </button>
                  </div>
                  {SKIN_PACKS.filter((p) => !p.free).map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-3/50 px-3 py-1.5 text-xs">
                      <span className="truncate text-fg-2">{p.name}</span>
                      <div className="flex shrink-0 items-center gap-2">
                        <code className="font-mono text-[11px] text-fg">{p.unlockCode}</code>
                        <button type="button" onClick={() => copyText(p.unlockCode, p.name)} className="text-accent-text">
                          <CopyIcon size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Shared gallery + Mix & Match studio used inside both SettingsDialog and `/themes`. */
export function ThemeStoreContent({ embedded = false }: { embedded?: boolean }) {
  const [tab, setTab] = useState<StoreTab>("all");
  const [checkoutTarget, setCheckoutTarget] = useState<SkinPack | "all-access" | "redeem" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const saleMode = useThemeStore((s) => s.saleMode);
  const setSaleMode = useThemeStore((s) => s.setSaleMode);
  const activePackId = useThemeStore((s) => s.activePackId);
  const playheadStyle = useThemeStore((s) => s.playheadStyle);
  const playButtonStyle = useThemeStore((s) => s.playButtonStyle);
  const sceneStyle = useThemeStore((s) => s.sceneStyle);
  const customBgDataUrl = useThemeStore((s) => s.customBgDataUrl);
  const sceneIntensity = useThemeStore((s) => s.sceneIntensity);
  const unlockedIds = useThemeStore((s) => s.unlockedIds);

  const setPlayheadStyle = useThemeStore((s) => s.setPlayheadStyle);
  const setPlayButtonStyle = useThemeStore((s) => s.setPlayButtonStyle);
  const setSceneStyle = useThemeStore((s) => s.setSceneStyle);
  const setSceneIntensity = useThemeStore((s) => s.setSceneIntensity);
  const setCustomBgDataUrl = useThemeStore((s) => s.setCustomBgDataUrl);
  const applyPack = useThemeStore((s) => s.applyPack);
  const previewPack = useThemeStore((s) => s.previewPack);
  const resetCustomizations = useThemeStore((s) => s.resetCustomizations);

  const accent = useAppearance((s) => s.accent).toLowerCase();
  const setAppearance = useAppearance((s) => s.set);

  const hasAllAccess = unlockedIds.includes(ALL_ACCESS_BUNDLE.id) || saleMode === "beta";
  const visiblePacks = tab === "custom" ? [] : SKIN_PACKS.filter((p) => tab === "all" || p.category === tab);

  const onWallpaperPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!hasAllAccess) {
      toast("Unlock the All-Access Pro Pass (or use Beta Preview) for Custom Wallpapers.", "info");
      setCheckoutTarget("all-access");
      return;
    }
    try {
      const dataUrl = await readWallpaperFile(file);
      setCustomBgDataUrl(dataUrl);
      toast("Custom wallpaper applied.");
    } catch (err) {
      toast((err as Error).message || "Could not load wallpaper image.", "error");
    }
  };

  return (
    <div className={cn("@container/store space-y-4", embedded && "pb-1")}>
      {/* Compact Store Control Bar (Zero Marketing Fluff) */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-[14px] bg-surface-2 px-3 py-2.5 ring-1 ring-line">
        <div role="tablist" aria-label="Theme Categories" className="no-scrollbar flex max-w-full items-center gap-1 overflow-x-auto">
          {TABS.map((tItem) => (
            <button
              key={tItem.id}
              type="button"
              role="tab"
              aria-selected={tab === tItem.id}
              onClick={() => setTab(tItem.id)}
              className={cn(
                "flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold whitespace-nowrap transition-colors",
                tab === tItem.id ? "bg-accent text-accent-ink" : "text-fg-2 hover:bg-surface-3 hover:text-fg",
              )}
            >
              {tItem.id === "custom" && <MagicWandIcon size={13} weight="bold" />}
              {tItem.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div role="tablist" aria-label="Store Mode" className="inline-flex rounded-full bg-surface-3 p-0.5 ring-1 ring-line">
            <button
              type="button"
              role="tab"
              aria-selected={saleMode === "beta"}
              onClick={() => setSaleMode("beta")}
              className={cn(
                "h-7 rounded-full px-2.5 text-[11px] font-semibold transition-colors",
                saleMode === "beta" ? "bg-accent text-accent-ink" : "text-fg-2 hover:text-fg",
              )}
            >
              Beta Free
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={saleMode === "live"}
              onClick={() => setSaleMode("live")}
              className={cn(
                "h-7 rounded-full px-2.5 text-[11px] font-semibold transition-colors",
                saleMode === "live" ? "bg-accent text-accent-ink" : "text-fg-2 hover:text-fg",
              )}
            >
              Paid Store
            </button>
          </div>

          <button
            type="button"
            onClick={() => setCheckoutTarget("redeem")}
            className="flex h-8 items-center gap-1 rounded-full bg-surface-3 px-2.5 text-[11.5px] font-semibold text-fg ring-1 ring-line hover:bg-surface-4"
          >
            <KeyIcon size={13} weight="bold" />
            <span>Key</span>
          </button>

          <button
            type="button"
            onClick={() => setCheckoutTarget("all-access")}
            className="flex h-8 items-center gap-1 rounded-full bg-accent-soft px-3 text-[11.5px] font-bold text-accent-text ring-1 ring-accent/35 hover:bg-accent hover:text-accent-ink transition-colors"
          >
            <CrownIcon size={13} weight="fill" />
            <span>{unlockedIds.includes(ALL_ACCESS_BUNDLE.id) ? "Pro Unlocked" : `Pro · ₱${ALL_ACCESS_BUNDLE.pricePhp}`}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              resetCustomizations();
              toast("Restored default Pixel Wave theme.");
            }}
            className="px-2 text-[11.5px] font-medium text-fg-3 hover:text-fg"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Visual Gallery Grid */}
      {tab !== "custom" && (
        <div className="grid grid-cols-1 gap-3.5 @[520px]/store:grid-cols-2 @[840px]/store:grid-cols-3">
          {visiblePacks.map((pack) => {
            const owned = isPackOwned(pack, unlockedIds);
            const usable = canUsePack(pack, unlockedIds, saleMode);
            const active = activePackId === pack.id;
            return (
              <PackCard
                key={pack.id}
                pack={pack}
                active={active}
                owned={owned}
                usable={usable}
                saleMode={saleMode}
                onApply={() => {
                  if (applyPack(pack.id)) {
                    toast(`Equipped "${pack.name}"`);
                  }
                }}
                onPreview={() => {
                  previewPack(pack.id);
                  toast(`Testing "${pack.name}" live!`);
                }}
                onUnlock={() => setCheckoutTarget(pack)}
              />
            );
          })}
        </div>
      )}

      {/* Custom Mix & Match Studio */}
      {tab === "custom" && (
        <div className="space-y-4">
          {/* 1. Custom Playhead Picker */}
          <section className="rounded-[16px] bg-surface-2 p-4 ring-1 ring-line">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MagicWandIcon size={16} className="text-accent-text" weight="fill" />
                <h3 className="text-[14px] font-bold text-fg">Playhead Scrubber</h3>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 @[460px]/store:grid-cols-2 @[760px]/store:grid-cols-3">
              {PLAYHEAD_META.map((item) => {
                const selected = playheadStyle === item.id;
                const locked =
                  saleMode === "live" &&
                  item.id !== "default" &&
                  item.id !== "pixel" &&
                  !unlockedIds.includes(ALL_ACCESS_BUNDLE.id) &&
                  !SKIN_PACKS.some((p) => p.playhead === item.id && unlockedIds.includes(p.id));
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (locked) {
                        setCheckoutTarget(SKIN_PACKS.find((p) => p.playhead === item.id) ?? "all-access");
                        return;
                      }
                      setPlayheadStyle(item.id as PlayheadStyle);
                      toast(`Playhead: ${item.label}`);
                    }}
                    className={cn(
                      "flex flex-col gap-1.5 rounded-[12px] bg-surface-3/65 p-2.5 text-left ring-1 transition-all",
                      selected ? "ring-2 ring-accent bg-surface-3" : "ring-line hover:bg-surface-3",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-fg">{item.label}</span>
                      {locked ? (
                        <LockKeyIcon size={13} className="text-amber-300" />
                      ) : selected ? (
                        <CheckIcon size={13} className="text-accent-text" weight="bold" />
                      ) : null}
                    </div>
                    <Slider variant={item.id} isPlaying value={58} max={100} label={item.label} onChange={() => {}} />
                  </button>
                );
              })}
            </div>
          </section>

          {/* 2. Custom Play Button Picker */}
          <section className="rounded-[16px] bg-surface-2 p-4 ring-1 ring-line">
            <div className="mb-3 flex items-center gap-2">
              <SwatchesIcon size={16} className="text-accent-text" weight="fill" />
              <h3 className="text-[14px] font-bold text-fg">Play Button</h3>
            </div>
            <div className="grid grid-cols-2 gap-2 @[460px]/store:grid-cols-4">
              {PLAY_BUTTON_META.map((item) => {
                const selected = playButtonStyle === item.id;
                const locked =
                  saleMode === "live" &&
                  item.id !== "default" &&
                  !unlockedIds.includes(ALL_ACCESS_BUNDLE.id) &&
                  !SKIN_PACKS.some((p) => p.playButton === item.id && unlockedIds.includes(p.id));
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (locked) {
                        setCheckoutTarget(SKIN_PACKS.find((p) => p.playButton === item.id) ?? "all-access");
                        return;
                      }
                      setPlayButtonStyle(item.id as PlayButtonStyle);
                      toast(`Play button: ${item.label}`);
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-[12px] bg-surface-3/65 p-2.5 text-center ring-1 transition-all",
                      selected ? "ring-2 ring-accent bg-surface-3" : "ring-line hover:bg-surface-3",
                    )}
                  >
                    <div className="relative">
                      <PlayDisc px={44} styleVariant={item.id} playing label={item.label}>
                        <PlayIcon size={18} weight="fill" />
                      </PlayDisc>
                      {locked && (
                        <span className="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-surface-1 text-amber-300 ring-1 ring-line">
                          <LockKeyIcon size={10} weight="bold" />
                        </span>
                      )}
                    </div>
                    <span className="text-[11.5px] font-semibold text-fg">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 3. Background World Scene + Custom Wallpaper */}
          <section className="rounded-[16px] bg-surface-2 p-4 ring-1 ring-line">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <SparkleIcon size={16} className="text-accent-text" weight="fill" />
                <h3 className="text-[14px] font-bold text-fg">World Backdrop &amp; Wallpaper</h3>
              </div>
              <div className="flex items-center gap-2">
                <input ref={fileRef} type="file" accept="image/*" onChange={onWallpaperPick} className="hidden" />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex h-8 items-center gap-1.5 rounded-full bg-accent px-3 text-xs font-semibold text-accent-ink active:scale-95"
                >
                  <UploadSimpleIcon size={13} weight="bold" />
                  Upload Photo / GIF
                </button>
                {customBgDataUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomBgDataUrl(null);
                      toast("Removed custom wallpaper.");
                    }}
                    className="flex h-8 items-center gap-1 rounded-full bg-surface-3 px-2.5 text-xs font-medium text-danger ring-1 ring-line hover:bg-surface-4"
                  >
                    <TrashIcon size={13} /> Clear
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 @[460px]/store:grid-cols-3 @[760px]/store:grid-cols-5">
              {SCENE_META.map((item) => {
                const selected = sceneStyle === item.id;
                const needsUpload = item.id === "custom" && !customBgDataUrl;
                const locked =
                  saleMode === "live" &&
                  item.id !== "none" &&
                  !unlockedIds.includes(ALL_ACCESS_BUNDLE.id) &&
                  !SKIN_PACKS.some((p) => p.scene === item.id && unlockedIds.includes(p.id));
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (locked) {
                        setCheckoutTarget(SKIN_PACKS.find((p) => p.scene === item.id) ?? "all-access");
                        return;
                      }
                      if (needsUpload) {
                        fileRef.current?.click();
                        return;
                      }
                      setSceneStyle(item.id as SceneStyle);
                      toast(`World scene: ${item.label}`);
                    }}
                    className={cn(
                      "group relative flex h-20 flex-col justify-end overflow-hidden rounded-[10px] bg-surface-3 p-2 text-left ring-1 transition-all",
                      selected ? "ring-2 ring-accent" : "ring-line hover:ring-line-strong",
                    )}
                  >
                    <ThemeSceneBackdrop sceneOverride={item.id} customUrlOverride={customBgDataUrl} contained />
                    <div className="relative z-10 flex items-center justify-between gap-1">
                      <span className="truncate text-[11.5px] font-bold text-white drop-shadow">{item.label}</span>
                      {locked ? (
                        <LockKeyIcon size={12} className="shrink-0 text-amber-300" />
                      ) : selected ? (
                        <CheckIcon size={12} className="shrink-0 text-accent-text" weight="bold" />
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>

            {sceneStyle !== "none" && (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-surface-3/60 px-3 py-2 ring-1 ring-line">
                <span className="text-xs font-medium text-fg-2">Backdrop Visibility</span>
                <input
                  type="range"
                  min={0.25}
                  max={1}
                  step={0.05}
                  value={sceneIntensity}
                  onChange={(e) => setSceneIntensity(Number(e.target.value))}
                  className="h-1.5 flex-1 cursor-pointer accent-accent"
                  aria-label="Backdrop Visibility"
                />
                <span className="w-10 text-right font-mono text-xs text-fg-2">{Math.round(sceneIntensity * 100)}%</span>
              </div>
            )}
          </section>

          {/* 4. Accent Color Override */}
          <section className="rounded-[16px] bg-surface-2 p-4 ring-1 ring-line">
            <div className="mb-3 flex items-center gap-2">
              <PaletteIcon size={16} className="text-accent-text" weight="fill" />
              <h3 className="text-[14px] font-bold text-fg">Accent Colour</h3>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              {ACCENTS.map(({ id, color }) => {
                const on = accent === color.toLowerCase();
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setAppearance({ accent: color })}
                    aria-label={id}
                    className={cn(
                      "size-8 rounded-full transition-transform active:scale-90",
                      on && "ring-2 ring-fg ring-offset-2 ring-offset-surface-2",
                    )}
                    style={{ backgroundColor: color }}
                  />
                );
              })}
            </div>
            <CustomColorPicker />
          </section>
        </div>
      )}

      <CheckoutModal open={!!checkoutTarget} targetPack={checkoutTarget} onClose={() => setCheckoutTarget(null)} />
    </div>
  );
}

export default function ThemeStore() {
  return (
    <div className="@container/themes pb-12">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <StorefrontIcon size={22} weight="fill" className="text-accent-text" />
            Theme Store
          </span>
        }
      />
      <div className="mx-auto max-w-[1320px] px-4 pt-3 @[680px]/themes:px-6">
        <ThemeStoreContent />
      </div>
    </div>
  );
}
