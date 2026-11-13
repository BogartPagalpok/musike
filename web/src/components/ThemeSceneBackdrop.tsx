import { cn } from "../lib/format";
import { useThemeStore, type SceneStyle } from "../stores/themeStore";

interface Props {
  sceneOverride?: SceneStyle;
  customUrlOverride?: string | null;
  contained?: boolean;
  className?: string;
}

function AkatsukiCloud({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 180 96" aria-hidden="true" className={className}>
      <path
        d="M36 74 C16 74 8 60 12 46 C15 34 26 28 38 30 C44 14 66 8 84 18 C95 8 118 8 130 22 C152 20 168 34 166 52 C164 68 150 74 132 74 Z"
        fill="#dc2626"
        stroke="#f8fafc"
        strokeOpacity="0.88"
        strokeWidth="3.2"
        strokeLinejoin="round"
      />
      <path
        d="M62 42 C72 34 86 38 86 48 C86 56 76 60 70 55"
        fill="none"
        stroke="#f8fafc"
        strokeOpacity="0.72"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ThemeSceneBackdrop({ sceneOverride, customUrlOverride, contained = false, className }: Props) {
  const storeScene = useThemeStore((s) => s.sceneStyle);
  const storeCustomUrl = useThemeStore((s) => s.customBgDataUrl);
  const intensity = useThemeStore((s) => s.sceneIntensity);

  const scene = sceneOverride ?? storeScene;
  const customUrl = customUrlOverride !== undefined ? customUrlOverride : storeCustomUrl;

  if (scene === "none") return null;

  const basePos = contained ? "pointer-events-none absolute inset-0 overflow-hidden" : "pointer-events-none fixed inset-0 z-0 overflow-hidden";
  const opacityStyle = contained ? undefined : { opacity: intensity };

  return (
    <div aria-hidden="true" className={cn(basePos, className)} style={opacityStyle}>
      {scene === "shinobi" && (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 15% 18%, rgba(249, 115, 22, 0.28), transparent 46%), radial-gradient(circle at 82% 78%, rgba(56, 189, 248, 0.22), transparent 50%), linear-gradient(160deg, #160c07 0%, #24130a 55%, #0c1b28 100%)",
            }}
          />
          {/* Giant faint Uzumaki / Leaf Spiral Emblem */}
          <svg
            viewBox="0 0 240 240"
            className={cn("absolute text-orange-400/18", contained ? "right-[-18px] bottom-[-18px] size-28" : "right-[-60px] bottom-[-40px] size-[420px]")}
          >
            <circle cx="120" cy="120" r="96" fill="none" stroke="currentColor" strokeWidth="5" strokeDasharray="16 12" />
            <path
              d="M120 120 m 0 -10 a 10 10 0 1 1 10 10 a 22 22 0 1 1 -22 -22 a 36 36 0 1 1 36 36 a 52 52 0 1 1 -52 -52"
              fill="none"
              stroke="currentColor"
              strokeWidth="4.5"
              strokeLinecap="round"
            />
          </svg>
          {/* Floating Konoha Leaves */}
          <svg
            viewBox="0 0 100 100"
            className={cn("absolute text-orange-400/24 animate-scene-float", contained ? "top-3 left-4 size-8" : "top-[16%] left-[12%] size-20")}
          >
            <path d="M50 8 C78 24 84 62 50 92 C16 62 22 24 50 8 Z" fill="currentColor" />
            <line x1="50" y1="14" x2="50" y2="90" stroke="#0b0c0f" strokeOpacity="0.45" strokeWidth="2.5" />
          </svg>
          <svg
            viewBox="0 0 100 100"
            className={cn("absolute text-sky-400/20 animate-scene-float-slow", contained ? "top-6 right-5 size-6" : "top-[24%] right-[22%] size-14 rotate-45")}
          >
            <path d="M50 8 C78 24 84 62 50 92 C16 62 22 24 50 8 Z" fill="currentColor" />
          </svg>
        </>
      )}

      {scene === "akatsuki" && (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 75% 20%, rgba(239, 68, 68, 0.24), transparent 45%), radial-gradient(circle at 20% 80%, rgba(185, 28, 28, 0.2), transparent 50%), linear-gradient(170deg, #070406 0%, #160508 55%, #090507 100%)",
            }}
          />
          <AkatsukiCloud className={cn("absolute opacity-28 animate-scene-float-slow", contained ? "top-2 right-2 w-20" : "top-[10%] right-[8%] w-64")} />
          <AkatsukiCloud className={cn("absolute opacity-22 animate-scene-float", contained ? "bottom-3 left-3 w-16" : "bottom-[14%] left-[18%] w-56")} />
          {!contained && <AkatsukiCloud className="absolute top-[48%] right-[32%] w-40 opacity-14 animate-scene-float-slow" />}
        </>
      )}

      {scene === "grandline" && (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 72% 20%, rgba(251, 191, 36, 0.24), transparent 42%), radial-gradient(circle at 22% 70%, rgba(56, 189, 248, 0.22), transparent 50%), linear-gradient(170deg, #061020 0%, #0d213d 60%, #1b1710 100%)",
            }}
          />
          {/* Pirate Compass Rose Watermark */}
          <svg
            viewBox="0 0 200 200"
            className={cn("absolute text-amber-300/18 animate-[spin_48s_linear_infinite]", contained ? "right-2 bottom-2 size-16" : "right-[8%] bottom-[12%] size-80")}
          >
            <circle cx="100" cy="100" r="80" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="8 8" />
            <polygon points="100,10 112,88 190,100 112,112 100,190 88,112 10,100 88,88" fill="none" stroke="currentColor" strokeWidth="2.5" />
          </svg>
          {/* Ocean Wave Silhouette */}
          <svg
            viewBox="0 0 1200 180"
            preserveAspectRatio="none"
            className={cn("absolute inset-x-0 bottom-0 text-sky-400/18", contained ? "h-8" : "h-36")}
          >
            <path d="M0 90 Q150 30 300 90 T600 90 T900 90 T1200 90 L1200 180 L0 180 Z" fill="currentColor" />
            <path d="M0 120 Q180 65 360 120 T720 120 T1080 120 L1200 120 L1200 180 L0 180 Z" fill="currentColor" opacity="0.65" />
          </svg>
        </>
      )}

      {scene === "kpop" && (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 22% 24%, rgba(244, 114, 182, 0.34), transparent 46%), radial-gradient(circle at 80% 30%, rgba(103, 232, 249, 0.25), transparent 48%), radial-gradient(circle at 50% 88%, rgba(192, 132, 252, 0.25), transparent 50%), linear-gradient(155deg, #160919 0%, #240c29 55%, #0f1f30 100%)",
            }}
          />
          {/* Chrome Y2K Stars */}
          <svg
            viewBox="0 0 100 100"
            className={cn("absolute text-pink-200/35 animate-pulse", contained ? "top-3 right-4 size-7" : "top-[16%] right-[16%] size-20")}
          >
            <path d="M50 4 L59 41 L96 50 L59 59 L50 96 L41 59 L4 50 L41 41 Z" fill="currentColor" />
          </svg>
          <svg
            viewBox="0 0 100 100"
            className={cn("absolute text-cyan-200/30 animate-scene-float", contained ? "bottom-3 left-5 size-5" : "bottom-[20%] left-[15%] size-14")}
          >
            <path d="M50 4 L59 41 L96 50 L59 59 L50 96 L41 59 L4 50 L41 41 Z" fill="currentColor" />
          </svg>
        </>
      )}

      {scene === "arcade8bit" && (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 30% 25%, rgba(250, 204, 21, 0.16), transparent 45%), radial-gradient(circle at 75% 75%, rgba(74, 222, 128, 0.14), transparent 48%), linear-gradient(180deg, #080a1c 0%, #140f2e 100%)",
            }}
          />
          <div
            className="absolute inset-0 opacity-25"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 4px)",
            }}
          />
          <div
            className="absolute inset-0 opacity-22"
            style={{
              backgroundImage: "radial-gradient(#facc15 1.5px, transparent 1.5px)",
              backgroundSize: contained ? "18px 18px" : "36px 36px",
            }}
          />
        </>
      )}

      {scene === "vinyl" && (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 50% 85%, rgba(245, 158, 11, 0.25), transparent 55%), radial-gradient(circle at 18% 18%, rgba(217, 119, 6, 0.16), transparent 45%), linear-gradient(160deg, #120c08 0%, #21150d 60%, #140e0a 100%)",
            }}
          />
          <svg
            viewBox="0 0 240 240"
            className={cn("absolute text-amber-400/18 animate-[spin_26s_linear_infinite]", contained ? "right-[-16px] bottom-[-16px] size-24" : "right-[-60px] bottom-[-60px] size-[420px]")}
          >
            <circle cx="120" cy="120" r="108" fill="none" stroke="currentColor" strokeWidth="3" />
            <circle cx="120" cy="120" r="88" fill="none" stroke="currentColor" strokeOpacity="0.6" strokeWidth="1.5" />
            <circle cx="120" cy="120" r="68" fill="none" stroke="currentColor" strokeOpacity="0.6" strokeWidth="1.5" />
            <circle cx="120" cy="120" r="48" fill="none" stroke="currentColor" strokeOpacity="0.7" strokeWidth="2" />
            <circle cx="120" cy="120" r="24" fill="currentColor" fillOpacity="0.35" />
          </svg>
        </>
      )}

      {scene === "cyberpunk" && (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 20% 20%, rgba(34, 211, 238, 0.25), transparent 48%), radial-gradient(circle at 82% 72%, rgba(244, 63, 94, 0.24), transparent 48%), linear-gradient(170deg, #060e18 0%, #101330 55%, #23091f 100%)",
            }}
          />
          <div
            className="absolute inset-0 opacity-24"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(34,211,238,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(244,63,94,0.18) 1px, transparent 1px)",
              backgroundSize: contained ? "20px 20px" : "44px 44px",
            }}
          />
        </>
      )}

      {scene === "custom" && customUrl && (
        <>
          <img src={customUrl} alt="" className="size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/45 to-black/75" />
        </>
      )}
    </div>
  );
}

