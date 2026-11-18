import { Capacitor } from "@capacitor/core";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "../lib/format";
import { useThemeStore, type SceneStyle } from "../stores/themeStore";

interface Props {
  sceneOverride?: SceneStyle;
  customUrlOverride?: string | null;
  contained?: boolean;
  className?: string;
}

export function useIsMobileViewport() {
  const [mobile, setMobile] = useState(() =>
    Capacitor.isNativePlatform() ||
    (typeof window !== "undefined" ? window.innerWidth < 768 || window.innerHeight > window.innerWidth * 1.05 : false),
  );

  useEffect(() => {
    const check = () => {
      setMobile(
        Capacitor.isNativePlatform() ||
          window.innerWidth < 768 ||
          window.innerHeight > window.innerWidth * 1.05,
      );
    };
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return mobile;
}

export function ThemeSceneBackdrop({ sceneOverride, customUrlOverride, contained = false, className }: Props) {
  const storeScene = useThemeStore((s) => s.sceneStyle);
  const storeCustomUrl = useThemeStore((s) => s.customBgDataUrl);
  const intensity = useThemeStore((s) => s.sceneIntensity);
  const animeAssets = useThemeStore((s) => s.animeAssets);
  const isMobileViewport = useIsMobileViewport();

  const scene = sceneOverride ?? storeScene;
  const customUrl = customUrlOverride !== undefined ? customUrlOverride : storeCustomUrl;

  if (scene === "none") return null;

  const basePos = contained
    ? "pointer-events-none absolute inset-0 overflow-hidden"
    : "pointer-events-none fixed inset-0 z-0 overflow-hidden";
  const effectiveOpacity = contained ? 1 : 0.48 + intensity * 0.52;

  const isAnime = scene === "shinobi" || scene === "akatsuki" || scene === "grandline";
  const mediaAsset = isAnime
    ? isMobileViewport
      ? animeAssets[scene].mobileWallpaper
      : animeAssets[scene].pcWallpaper
    : null;

  return (
    <div aria-hidden="true" className={cn(basePos, className)} style={{ opacity: effectiveOpacity }}>
      {isAnime && mediaAsset && (
        <>
          {mediaAsset.isVideo ? (
            <video
              key={mediaAsset.url}
              src={mediaAsset.url}
              autoPlay
              loop
              muted
              playsInline
              disableRemotePlayback
              preload="auto"
              className="size-full object-cover"
            />
          ) : (
            <img src={mediaAsset.url} alt="" className="size-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/38" />
        </>
      )}

      {scene === "cassette" && (
        <div
          className="relative size-full"
          style={{
            background: "linear-gradient(180deg, #ded9c8 0%, #d4cebc 52%, #c9c3af 100%)",
          }}
        >
          {/* Speckled anodized stone grain + subtle speaker perforation matrix */}
          <div
            className="absolute inset-0 opacity-35"
            style={{
              backgroundImage:
                "radial-gradient(rgba(55,58,64,0.16) 1px, transparent 1px), radial-gradient(rgba(255,255,255,0.45) 1px, transparent 1px)",
              backgroundSize: "14px 14px, 9px 9px",
              backgroundPosition: "0 0, 4px 5px",
            }}
          />
          {!contained && (
            <div className="absolute inset-x-0 top-0 mx-auto h-3 w-48 rounded-b-2xl bg-[#525860]/85 shadow-inner" />
          )}
        </div>
      )}

      {scene === "mirrorflame" && (
        <div
          className="relative size-full"
          style={{
            background:
              "radial-gradient(circle at 50% 24%, rgba(255, 115, 0, 0.14) 0%, transparent 48%), radial-gradient(circle at 68% 62%, rgba(163, 230, 53, 0.1) 0%, transparent 46%), linear-gradient(180deg, #1b1d21 0%, #131518 55%, #0e1013 100%)",
          }}
        >
          {/* Fine dark crinkle/asphalt studio metal texture */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 0), radial-gradient(rgba(0,0,0,0.55) 1px, transparent 0)",
              backgroundSize: "6px 6px, 5px 5px",
              backgroundPosition: "0 0, 2px 3px",
            }}
          />
        </div>
      )}

      {scene === "sandtopo" && (
        <div
          className="relative size-full"
          style={{
            background: "linear-gradient(165deg, #e5d4b3 0%, #dcc8a2 48%, #cfb88e 100%)",
          }}
        >
          {/* Organic Desert Topographic Contour Map SVG */}
          <svg
            viewBox="0 0 800 1000"
            preserveAspectRatio="xMidYMid slice"
            className="size-full opacity-45"
          >
            <g fill="none" stroke="#8a7450" strokeWidth="2.2" strokeLinecap="round">
              <path d="M-60 90 C 90 20, 260 40, 340 150 C 420 260, 310 380, 170 430 C 30 480, -40 410, -80 310 Z" />
              <path d="M-30 125 C 95 65, 235 80, 302 168 C 365 250, 278 348, 162 390 C 50 430, -10 375, -45 292 Z" />
              <path d="M10 162 C 108 112, 210 122, 262 190 C 310 250, 244 316, 152 348 C 68 378, 22 335, -8 272 Z" />
              <path d="M520 -40 C 680 -10, 830 95, 850 245 C 870 395, 720 490, 585 455 C 450 420, 410 280, 445 140 C 470 40, 460 -50, 520 -40 Z" />
              <path d="M548 10 C 672 35, 790 120, 804 242 C 818 362, 698 440, 592 412 C 486 384, 456 270, 484 156 Z" />
              <path d="M580 62 C 668 82, 752 145, 762 238 C 770 326, 682 386, 602 365 C 522 344, 502 258, 524 172 Z" />
              <path d="M-80 760 C 60 660, 270 640, 430 720 C 590 800, 720 740, 880 660" />
              <path d="M-80 810 C 75 705, 275 688, 425 765 C 575 842, 725 785, 885 708" />
              <path d="M-80 860 C 90 752, 280 738, 420 812 C 560 886, 730 832, 890 758" />
              <path d="M-70 915 C 105 805, 285 792, 418 862 C 550 932, 735 882, 895 810" />
              <path d="M180 520 C 310 470, 470 505, 520 595 C 570 685, 450 745, 310 720 C 170 695, 95 570, 180 520 Z" />
              <path d="M225 552 C 322 515, 442 540, 478 606 C 514 672, 426 712, 320 694 C 214 676, 160 588, 225 552 Z" />
            </g>
          </svg>
        </div>
      )}

      {scene === "custom" && customUrl && (
        <>
          <img src={customUrl} alt="" className="size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/70" />
        </>
      )}
    </div>
  );
}

/** Keeps uniform rounded card geometry across themes without clutter or opaque stage boxes. */
export function WorldStageFrame({
  children,
  className,
}: {
  scene: SceneStyle;
  playing?: boolean;
  compact?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("relative flex items-center justify-center rounded-[18px]", className)}>{children}</div>;
}
