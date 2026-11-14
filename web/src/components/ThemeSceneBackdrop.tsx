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
              preload="auto"
              className="size-full object-cover"
            />
          ) : (
            <img src={mediaAsset.url} alt="" className="size-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/38" />
        </>
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
