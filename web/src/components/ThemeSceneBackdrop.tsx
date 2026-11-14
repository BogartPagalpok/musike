import { useId, type ReactNode } from "react";
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
        strokeOpacity="0.92"
        strokeWidth="3.2"
        strokeLinejoin="round"
      />
      <path
        d="M62 42 C72 34 86 38 86 48 C86 56 76 60 70 55"
        fill="none"
        stroke="#f8fafc"
        strokeOpacity="0.78"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Flying crow silhouette with spread wings & tail feathers for Itachi Tsukuyomi scenes. */
function CrowSilhouette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 76" aria-hidden="true" className={className}>
      <path
        d="M10 42 C24 22 44 16 56 30 C64 16 88 8 110 18 C94 26 84 32 76 42 C82 47 88 53 96 58 L74 52 C68 58 60 64 52 70 L56 54 C42 54 26 52 10 42 Z"
        fill="currentColor"
      />
      {/* Hooked beak */}
      <path d="M52 30 L42 26 L51 34 Z" fill="currentColor" />
    </svg>
  );
}

/** Single drifting crow feather. */
function CrowFeather({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 64" aria-hidden="true" className={className}>
      <path
        d="M36 6 C22 14 14 30 12 52 L8 58 L14 55 C26 44 36 28 36 6 Z"
        fill="currentColor"
      />
      <line x1="34" y1="9" x2="10" y2="56" stroke="#ef4444" strokeOpacity="0.35" strokeWidth="1.4" />
    </svg>
  );
}

/** Glowing Crimson Blood Moon with Itachi Mangekyō Sharingan pinwheel pattern inside. */
function BloodMoon({ contained }: { contained?: boolean }) {
  const gradId = useId();
  return (
    <div
      className={cn(
        "pointer-events-none absolute",
        contained
          ? "top-2 right-3 size-22"
          : "top-[5%] right-[5%] size-[230px] sm:size-[300px] md:size-[380px]",
      )}
    >
      {/* Scarlet aura bloom */}
      <div
        className="absolute -inset-[28%] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(239,68,68,0.52) 0%, rgba(185,28,28,0.28) 46%, rgba(127,29,29,0.08) 70%, transparent 80%)",
        }}
      />
      <svg viewBox="0 0 240 240" className="relative size-full drop-shadow-[0_0_28px_rgba(239,68,68,0.65)]">
        <defs>
          <radialGradient id={gradId} cx="42%" cy="38%" r="65%">
            <stop offset="0%" stopColor="#ff4d4d" />
            <stop offset="48%" stopColor="#dc2626" />
            <stop offset="86%" stopColor="#881313" />
            <stop offset="100%" stopColor="#450a0a" />
          </radialGradient>
        </defs>
        <circle cx="120" cy="120" r="102" fill={`url(#${gradId})`} />
        {/* Moon surface crater rings */}
        <circle cx="84" cy="86" r="16" fill="#450a0a" fillOpacity="0.24" />
        <circle cx="152" cy="144" r="22" fill="#450a0a" fillOpacity="0.2" />
        <circle cx="148" cy="80" r="11" fill="#450a0a" fillOpacity="0.18" />

        {/* Itachi Mangekyō Sharingan Silhouette Inside the Moon */}
        <g opacity="0.52" fill="#120204">
          <circle cx="120" cy="120" r="76" fill="none" stroke="#180205" strokeWidth="3.5" />
          <circle cx="120" cy="120" r="40" fill="none" stroke="#180205" strokeWidth="2.5" />
          {[0, 120, 240].map((deg) => (
            <path
              key={deg}
              d="M120 120 C112 72 136 42 162 46 C140 66 138 96 120 120 Z"
              transform={`rotate(${deg} 120 120)`}
            />
          ))}
          <circle cx="120" cy="120" r="14" fill="#090103" />
          <circle cx="120" cy="120" r="5.5" fill="#ff3847" />
        </g>
        {/* Crisp crimson lunar rim */}
        <circle cx="120" cy="120" r="102" fill="none" stroke="#fca5a5" strokeOpacity="0.45" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

/** Animated Rotating Sharingan Disc Artwork (3-tomoe / Mangekyō) */
function SharinganSealRing({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true" className={className}>
      <circle cx="100" cy="100" r="94" fill="#180205" fillOpacity="0.72" stroke="#ef4444" strokeWidth="3.5" />
      <circle cx="100" cy="100" r="68" fill="none" stroke="#ef4444" strokeOpacity="0.75" strokeWidth="2" />
      {[0, 120, 240].map((deg) => (
        <path
          key={deg}
          d="M100 100 C92 58 114 34 136 38 C118 54 114 82 100 100 Z"
          fill="#ef4444"
          fillOpacity="0.82"
          transform={`rotate(${deg} 100 100)`}
        />
      ))}
      <circle cx="100" cy="100" r="18" fill="#070204" stroke="#ef4444" strokeWidth="2.5" />
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
  const effectiveOpacity = contained ? 1 : 0.45 + intensity * 0.55;

  return (
    <div aria-hidden="true" className={cn(basePos, className)} style={{ opacity: effectiveOpacity }}>
      {scene === "akatsuki" && (
        <>
          {/* Crimson-Black Tsukuyomi Night Sky */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 80% 18%, rgba(220, 38, 38, 0.44), transparent 52%), radial-gradient(circle at 18% 82%, rgba(153, 27, 27, 0.34), transparent 55%), linear-gradient(175deg, #050102 0%, #170306 46%, #2b060b 78%, #0a0103 100%)",
            }}
          />

          {/* Glowing Crimson Blood Moon with Itachi Mangekyō Sharingan */}
          <BloodMoon contained={contained} />

          {/* Uchiha Compound Utility Pole, Power Lines, Torii & Silhouettes */}
          {!contained ? (
            <svg
              viewBox="0 0 1440 420"
              preserveAspectRatio="xMaxYMax slice"
              className="absolute inset-x-0 bottom-0 h-[56%] w-full text-[#060102]"
            >
              {/* Distant Uchiha Clan Rooftops */}
              <path
                d="M0 420 L0 362 L110 342 L220 365 L350 348 L470 374 L620 356 L770 368 L900 344 L1060 360 L1210 340 L1440 362 L1440 420 Z"
                fill="#0b0204"
              />
              {/* Traditional Torii Gate Silhouette on Left Horizon */}
              <g fill="#060102" stroke="#ef4444" strokeOpacity="0.22" strokeWidth="1.2">
                <path d="M128 242 Q200 256 272 242 L276 254 Q200 266 124 254 Z" />
                <rect x="142" y="274" width="116" height="8" />
                <rect x="158" y="254" width="12" height="166" />
                <rect x="230" y="254" width="12" height="166" />
                <rect x="195" y="254" width="10" height="22" />
              </g>

              {/* Sagging Power Lines Across the Blood Moon */}
              <path d="M-40 160 Q560 220 1168 118" fill="none" stroke="#080102" strokeWidth="2.8" />
              <path d="M-40 198 Q560 254 1168 148" fill="none" stroke="#080102" strokeWidth="2.4" />
              <path d="M1168 118 Q1310 142 1480 128" fill="none" stroke="#080102" strokeWidth="2.8" />
              <path d="M1168 148 Q1310 174 1480 162" fill="none" stroke="#080102" strokeWidth="2.4" />

              {/* Iconic Uchiha Utility Pole Silhouette (Right Foreground) */}
              <g fill="#060102">
                <rect x="1160" y="64" width="17" height="356" />
                <rect x="1116" y="108" width="106" height="10" rx="2" />
                <rect x="1124" y="140" width="90" height="9" rx="2" />
                {/* Diagonal brace struts */}
                <line x1="1168" y1="138" x2="1134" y2="112" stroke="#060102" strokeWidth="4" />
                <line x1="1169" y1="138" x2="1203" y2="112" stroke="#060102" strokeWidth="4" />
                {/* Insulators */}
                <rect x="1122" y="99" width="6" height="10" rx="1" />
                <rect x="1144" y="99" width="6" height="10" rx="1" />
                <rect x="1192" y="99" width="6" height="10" rx="1" />
                <rect x="1212" y="99" width="6" height="10" rx="1" />
                {/* Transformer cylinder */}
                <rect x="1134" y="166" width="26" height="44" rx="4" />
                {/* Perched Crow Atop the Utility Pole with Crimson Sharingan Eye */}
                <g transform="translate(1136 8) scale(0.85)">
                  <path
                    d="M44 18 C50 18 54 22 55 27 L66 30 L55 34 C54 44 48 54 38 60 L20 74 L14 68 L28 52 C24 44 26 32 34 24 C37 20 40 18 44 18 Z"
                    fill="#060102"
                    stroke="#ef4444"
                    strokeOpacity="0.65"
                    strokeWidth="1.6"
                  />
                  <circle cx="48" cy="26" r="2.4" fill="#ff2e3b" />
                </g>
              </g>
            </svg>
          ) : (
            <svg viewBox="0 0 320 120" preserveAspectRatio="xMaxYMax slice" className="absolute inset-x-0 bottom-0 h-16 w-full text-[#060102]">
              <path d="M0 120 L0 94 L60 86 L120 98 L190 88 L260 96 L320 84 L320 120 Z" fill="#080103" />
              <path d="M0 40 Q140 68 256 32" fill="none" stroke="#060102" strokeWidth="1.5" />
              <rect x="252" y="20" width="6" height="100" fill="#060102" />
              <rect x="236" y="32" width="38" height="4" fill="#060102" />
              {/* Mini Perched Crow atop the pole */}
              <g transform="translate(242 -1) scale(0.32)">
                <path
                  d="M44 18 C50 18 54 22 55 27 L66 30 L55 34 C54 44 48 54 38 60 L20 74 L14 68 L28 52 C24 44 26 32 34 24 C37 20 40 18 44 18 Z"
                  fill="#060102"
                />
                <circle cx="48" cy="26" r="3" fill="#ff2e3b" />
              </g>
            </svg>
          )}

          {/* Animated Flock of Flying Crows */}
          <CrowSilhouette
            className={cn(
              "animate-scene-float absolute text-[#070102] drop-shadow-[0_0_8px_rgba(239,68,68,0.45)]",
              contained ? "top-5 left-4 w-9 -rotate-12" : "top-[16%] left-[12%] w-24 -rotate-12",
            )}
          />
          <CrowSilhouette
            className={cn(
              "animate-scene-float-slow absolute text-[#070102] drop-shadow-[0_0_8px_rgba(239,68,68,0.45)]",
              contained ? "top-11 left-16 w-7 rotate-6" : "top-[28%] left-[26%] w-16 rotate-6",
            )}
          />
          <CrowSilhouette
            className={cn(
              "animate-scene-float absolute text-[#070102] drop-shadow-[0_0_6px_rgba(239,68,68,0.4)]",
              contained ? "right-16 bottom-12 w-7 -rotate-6" : "top-[12%] right-[24%] w-20 -rotate-6",
            )}
          />
          {!contained && (
            <>
              <CrowSilhouette className="animate-scene-float-slow absolute top-[46%] right-[28%] w-14 rotate-12 text-[#070102]" />
              <CrowSilhouette className="animate-scene-float absolute bottom-[24%] left-[44%] w-20 -rotate-12 text-[#070102]" />
              <CrowSilhouette className="animate-scene-float-slow absolute top-[8%] left-[48%] w-12 rotate-3 text-[#070102]" />

              {/* Drifting Black Crow Feathers */}
              <CrowFeather className="animate-scene-float absolute top-[22%] left-[38%] w-6 rotate-12 text-[#080102]" />
              <CrowFeather className="animate-scene-float-slow absolute top-[54%] left-[18%] w-7 -rotate-45 text-[#080102]" />
              <CrowFeather className="animate-scene-float absolute right-[36%] bottom-[32%] w-6 rotate-45 text-[#080102]" />
            </>
          )}

          {/* Iconic Akatsuki Red Clouds */}
          <AkatsukiCloud
            className={cn(
              "animate-scene-float-slow absolute",
              contained ? "top-12 right-2 w-12 opacity-65" : "top-[32%] right-[6%] w-48 opacity-48",
            )}
          />
          <AkatsukiCloud
            className={cn(
              "animate-scene-float absolute",
              contained ? "bottom-4 left-3 w-14 opacity-55" : "bottom-[14%] left-[8%] w-56 opacity-44",
            )}
          />
        </>
      )}

      {scene === "shinobi" && (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 76% 22%, rgba(249, 115, 22, 0.38), transparent 48%), radial-gradient(circle at 18% 72%, rgba(56, 189, 248, 0.28), transparent 52%), linear-gradient(165deg, #120804 0%, #2a1207 52%, #0b1c2c 100%)",
            }}
          />
          {/* Giant Golden Uzumaki / Six Paths Fuinjutsu Seal */}
          <svg
            viewBox="0 0 260 260"
            className={cn(
              "animate-[spin_65s_linear_infinite] absolute text-orange-400/38",
              contained ? "top-1 right-1 size-24" : "top-[4%] right-[5%] size-[340px]",
            )}
          >
            <circle cx="130" cy="130" r="112" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="18 10" />
            <circle cx="130" cy="130" r="88" fill="none" stroke="#38bdf8" strokeOpacity="0.5" strokeWidth="2" strokeDasharray="6 8" />
            <path
              d="M130 130 m 0 -10 a 10 10 0 1 1 10 10 a 22 22 0 1 1 -22 -22 a 38 38 0 1 1 38 38 a 56 56 0 1 1 -56 -56"
              fill="none"
              stroke="currentColor"
              strokeWidth="4.5"
              strokeLinecap="round"
            />
          </svg>
          {/* Hokage Rock Mountain Silhouette & Konoha Village Horizon */}
          <svg
            viewBox="0 0 1200 220"
            preserveAspectRatio="none"
            className={cn("absolute inset-x-0 bottom-0 text-[#0c0603]", contained ? "h-12" : "h-44")}
          >
            {/* Hokage Monument Cliff Face Ridge */}
            <path
              d="M0 220 L0 120 L120 92 L240 102 L340 62 L480 68 L590 48 L740 58 L870 86 L990 78 L1110 112 L1200 104 L1200 220 Z"
              fill="#140905"
            />
            {/* Carved Hokage silhouettes */}
            <path
              d="M270 118 L295 82 L322 118 M400 118 L428 78 L456 118 M540 116 L568 72 L598 116 M680 120 L708 80 L736 120"
              fill="none"
              stroke="#f97316"
              strokeOpacity="0.28"
              strokeWidth="3"
            />
            <path d="M0 220 L0 176 L180 162 L360 178 L580 156 L820 172 L1040 158 L1200 170 L1200 220 Z" fill="#080302" />
          </svg>
          {/* Floating Konoha Leaves & Flying Kunai Silhouette */}
          <svg
            viewBox="0 0 100 100"
            className={cn("animate-scene-float absolute text-orange-400/55", contained ? "top-3 left-4 size-7" : "top-[16%] left-[12%] size-20")}
          >
            <path d="M50 8 C78 24 84 62 50 92 C16 62 22 24 50 8 Z" fill="currentColor" />
            <line x1="50" y1="14" x2="50" y2="90" stroke="#160c07" strokeOpacity="0.6" strokeWidth="3" />
          </svg>
          {!contained && (
            <svg viewBox="0 0 120 40" className="animate-scene-float-slow absolute top-[38%] left-[24%] w-24 -rotate-18 text-sky-300/40">
              <polygon points="8,20 68,10 80,20 68,30" fill="currentColor" />
              <rect x="80" y="18" width="22" height="4" fill="currentColor" />
              <circle cx="108" cy="20" r="6" fill="none" stroke="currentColor" strokeWidth="3" />
            </svg>
          )}
        </>
      )}

      {scene === "grandline" && (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 75% 20%, rgba(251, 191, 36, 0.36), transparent 46%), radial-gradient(circle at 20% 70%, rgba(56, 189, 248, 0.30), transparent 52%), linear-gradient(170deg, #040d1c 0%, #0b213f 58%, #1f170b 100%)",
            }}
          />
          {/* Dawn Moon / Sun + Gear 5 Clouds */}
          <div
            className={cn(
              "absolute rounded-full bg-amber-100/85 shadow-[0_0_70px_rgba(251,191,36,0.75)]",
              contained ? "top-2 right-3 size-12" : "top-[8%] right-[9%] size-44",
            )}
          />
          <svg
            viewBox="0 0 200 200"
            className={cn(
              "animate-[spin_48s_linear_infinite] absolute text-amber-300/32",
              contained ? "top-3 left-3 size-12" : "top-[12%] left-[12%] size-56",
            )}
          >
            <circle cx="100" cy="100" r="80" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="8 8" />
            <polygon points="100,10 112,88 190,100 112,112 100,190 88,112 10,100 88,88" fill="none" stroke="currentColor" strokeWidth="2.5" />
          </svg>
          {/* Ocean Waves */}
          <svg
            viewBox="0 0 1200 220"
            preserveAspectRatio="none"
            className={cn("animate-scene-float-slow absolute inset-x-0 bottom-0", contained ? "h-10" : "h-36")}
          >
            <path d="M0 130 Q150 75 300 130 T600 130 T900 130 T1200 130 L1200 220 L0 220 Z" fill="#0ea5e9" fillOpacity="0.28" />
            <path d="M0 158 Q180 105 360 158 T720 158 T1080 158 L1200 158 L1200 220 L0 220 Z" fill="#041124" fillOpacity="0.88" />
          </svg>
          {/* Thousand Sunny Pirate Ship Silhouette */}
          <svg
            viewBox="0 0 260 190"
            className={cn(
              "animate-scene-float-slow absolute",
              contained ? "right-2 bottom-2 w-16" : "right-[8%] bottom-[7%] w-52 md:w-64",
            )}
          >
            <g fill="#060f1e" stroke="#fbbf24" strokeOpacity="0.55" strokeWidth="2.4">
              <path d="M40 120 Q130 156 230 120 L210 148 Q130 172 56 148 Z" />
              <rect x="128" y="22" width="8" height="104" />
              <path d="M84 36 Q132 18 184 36 L176 92 Q132 82 92 92 Z" />
              <rect x="178" y="54" width="6" height="68" />
              <path d="M180 60 L226 88 L180 96 Z" />
            </g>
          </svg>
        </>
      )}

      {scene === "kpop" && (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 22% 24%, rgba(244, 114, 182, 0.42), transparent 48%), radial-gradient(circle at 80% 25%, rgba(103, 232, 249, 0.32), transparent 50%), radial-gradient(circle at 50% 88%, rgba(192, 132, 252, 0.30), transparent 50%), linear-gradient(155deg, #16071b 0%, #2b0b32 55%, #0e2236 100%)",
            }}
          />
          {/* Liquid Chrome Ring */}
          <svg
            viewBox="0 0 240 240"
            className={cn(
              "animate-[spin_32s_linear_infinite] absolute text-pink-200/30",
              contained ? "top-2 right-2 size-20" : "top-[8%] right-[10%] size-72",
            )}
          >
            <ellipse cx="120" cy="120" rx="96" ry="42" fill="none" stroke="currentColor" strokeWidth="6" transform="rotate(-24 120 120)" />
            <ellipse cx="120" cy="120" rx="86" ry="36" fill="none" stroke="#67e8f9" strokeOpacity="0.45" strokeWidth="3" transform="rotate(28 120 120)" />
          </svg>
          {/* Chrome Y2K Stars */}
          <svg
            viewBox="0 0 100 100"
            className={cn("animate-pulse absolute text-pink-200/65", contained ? "top-3 right-5 size-7" : "top-[16%] right-[18%] size-20")}
          >
            <path d="M50 4 L59 41 L96 50 L59 59 L50 96 L41 59 L4 50 L41 41 Z" fill="currentColor" />
          </svg>
          <svg
            viewBox="0 0 100 100"
            className={cn("animate-scene-float absolute text-cyan-200/55", contained ? "bottom-4 left-4 size-6" : "bottom-[22%] left-[14%] size-16")}
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
                "radial-gradient(circle at 75% 24%, rgba(250, 204, 21, 0.28), transparent 46%), radial-gradient(circle at 25% 75%, rgba(74, 222, 128, 0.22), transparent 50%), linear-gradient(180deg, #07091b 0%, #151034 100%)",
            }}
          />
          {/* Blocky Pixel Moon */}
          <svg
            viewBox="0 0 64 64"
            className={cn("absolute text-yellow-300/65", contained ? "top-3 right-4 size-10" : "top-[10%] right-[12%] size-32")}
          >
            <rect x="20" y="8" width="24" height="48" fill="currentColor" />
            <rect x="12" y="16" width="40" height="32" fill="currentColor" />
            <rect x="8" y="22" width="48" height="20" fill="currentColor" />
            <rect x="20" y="18" width="8" height="8" fill="#151034" fillOpacity="0.45" />
            <rect x="34" y="34" width="10" height="8" fill="#151034" fillOpacity="0.45" />
          </svg>
          {/* Pixel Skyline Silhouette */}
          <svg
            viewBox="0 0 640 100"
            preserveAspectRatio="none"
            className={cn("absolute inset-x-0 bottom-0 text-[#050614]", contained ? "h-8" : "h-32")}
          >
            <path
              d="M0 100 L0 60 L32 60 L32 40 L72 40 L72 68 L112 68 L112 28 L168 28 L168 56 L216 56 L216 36 L264 36 L264 72 L320 72 L320 22 L384 22 L384 52 L440 52 L440 34 L496 34 L496 66 L552 66 L552 44 L608 44 L608 64 L640 64 L640 100 Z"
              fill="currentColor"
            />
            <rect x="128" y="40" width="8" height="8" fill="#facc15" fillOpacity="0.65" />
            <rect x="148" y="40" width="8" height="8" fill="#4ade80" fillOpacity="0.65" />
            <rect x="340" y="36" width="10" height="10" fill="#facc15" fillOpacity="0.7" />
            <rect x="360" y="54" width="10" height="10" fill="#facc15" fillOpacity="0.55" />
            <rect x="460" y="48" width="8" height="8" fill="#4ade80" fillOpacity="0.65" />
          </svg>
          {/* CRT Scanlines */}
          <div
            className="absolute inset-0 opacity-32"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 1px, transparent 1px, transparent 4px)",
            }}
          />
          <div
            className="absolute inset-0 opacity-28"
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
                "radial-gradient(circle at 50% 85%, rgba(245, 158, 11, 0.34), transparent 55%), radial-gradient(circle at 18% 18%, rgba(217, 119, 6, 0.24), transparent 48%), linear-gradient(160deg, #120b07 0%, #26160c 60%, #110a06 100%)",
            }}
          />
          {/* Grooved LP Vinyl Platter + Tonearm Silhouette */}
          <svg
            viewBox="0 0 240 240"
            className={cn(
              "animate-[spin_22s_linear_infinite] absolute text-amber-400/32",
              contained ? "right-[-16px] bottom-[-16px] size-28" : "right-[-40px] bottom-[-40px] size-[420px]",
            )}
          >
            <circle cx="120" cy="120" r="108" fill="none" stroke="currentColor" strokeWidth="3.5" />
            <circle cx="120" cy="120" r="88" fill="none" stroke="currentColor" strokeOpacity="0.65" strokeWidth="1.5" />
            <circle cx="120" cy="120" r="68" fill="none" stroke="currentColor" strokeOpacity="0.65" strokeWidth="1.5" />
            <circle cx="120" cy="120" r="48" fill="none" stroke="currentColor" strokeOpacity="0.75" strokeWidth="2.5" />
            <circle cx="120" cy="120" r="24" fill="currentColor" fillOpacity="0.45" />
          </svg>
        </>
      )}

      {scene === "cyberpunk" && (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 20% 20%, rgba(34, 211, 238, 0.34), transparent 48%), radial-gradient(circle at 82% 72%, rgba(244, 63, 94, 0.32), transparent 50%), linear-gradient(170deg, #050d18 0%, #101334 55%, #280922 100%)",
            }}
          />
          {/* Cyber City Skyline */}
          <svg
            viewBox="0 0 1200 180"
            preserveAspectRatio="none"
            className={cn("absolute inset-x-0 bottom-0 text-[#050814]", contained ? "h-10" : "h-40")}
          >
            <path
              d="M0 180 L0 120 L55 120 L55 72 L130 72 L130 105 L195 105 L195 44 L268 44 L268 94 L350 94 L350 62 L430 62 L430 112 L540 112 L540 28 L610 28 L610 88 L710 88 L710 54 L810 54 L810 108 L900 108 L900 38 L980 38 L980 86 L1090 86 L1090 58 L1200 58 L1200 180 Z"
              fill="currentColor"
            />
            <rect x="210" y="60" width="40" height="4" fill="#22d3ee" fillOpacity="0.7" />
            <rect x="556" y="42" width="38" height="4" fill="#f43f5e" fillOpacity="0.8" />
            <rect x="916" y="54" width="44" height="4" fill="#22d3ee" fillOpacity="0.7" />
          </svg>
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(34,211,238,0.28) 1px, transparent 1px), linear-gradient(to bottom, rgba(244,63,94,0.22) 1px, transparent 1px)",
              backgroundSize: contained ? "20px 20px" : "44px 44px",
            }}
          />
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

/** World-specific decorative stage frame around album covers / video players. */
export function WorldStageFrame({
  scene,
  playing = false,
  compact = false,
  children,
  className,
}: {
  scene: SceneStyle;
  playing?: boolean;
  compact?: boolean;
  children: ReactNode;
  className?: string;
}) {
  if (scene === "none" || scene === "custom") {
    return <div className={cn("relative flex items-center justify-center", className)}>{children}</div>;
  }

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      {/* Behind-artwork Halo Ring */}
      {scene === "akatsuki" && (
        <SharinganSealRing
          className={cn(
            "pointer-events-none absolute -z-0 opacity-50 transition-opacity",
            playing && "animate-[spin_18s_linear_infinite]",
            compact ? "-inset-4" : "-inset-7",
          )}
        />
      )}

      {scene === "shinobi" && (
        <svg
          viewBox="0 0 200 200"
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute -z-0 text-orange-400/50",
            playing && "animate-[spin_14s_linear_infinite]",
            compact ? "-inset-4" : "-inset-7",
          )}
        >
          <circle cx="100" cy="100" r="94" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="12 8" />
          <circle cx="100" cy="100" r="82" fill="none" stroke="#38bdf8" strokeOpacity="0.65" strokeWidth="2.5" strokeDasharray="4 6" />
        </svg>
      )}

      {scene === "vinyl" && !compact && (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute right-[-20%] aspect-square h-[88%] rounded-full bg-gradient-to-br from-neutral-900 via-neutral-800 to-black shadow-2xl ring-2 ring-amber-400/45",
            playing && "animate-[spin_6s_linear_infinite]",
          )}
        >
          <div className="absolute inset-[14%] rounded-full border border-white/15" />
          <div className="absolute inset-[28%] rounded-full border border-white/10" />
          <div className="absolute inset-[38%] rounded-full bg-amber-500/85 ring-2 ring-amber-200/40" />
          <div className="absolute inset-[47%] rounded-full bg-neutral-950" />
        </div>
      )}

      {/* Framed Content Container */}
      <div
        className={cn(
          "relative z-10 w-full transition-all",
          scene === "akatsuki" &&
            "rounded-[18px] ring-2 ring-red-500/80 shadow-[0_0_40px_rgba(239,68,68,0.35)]",
          scene === "shinobi" &&
            "rounded-[18px] ring-2 ring-orange-400/80 shadow-[0_0_36px_rgba(249,115,22,0.3)]",
          scene === "grandline" &&
            "rounded-[14px] ring-2 ring-amber-400/85 shadow-[0_0_36px_rgba(251,191,36,0.28)]",
          scene === "arcade8bit" &&
            "rounded-none border-2 border-yellow-400 shadow-[5px_5px_0_#000]",
          scene === "cyberpunk" &&
            "rounded-[8px] ring-2 ring-cyan-400/80 shadow-[0_0_32px_rgba(34,211,238,0.28)]",
          scene === "kpop" &&
            "rounded-[20px] ring-2 ring-pink-300/80 shadow-[0_0_36px_rgba(244,114,182,0.35)]",
          scene === "vinyl" &&
            "rounded-[12px] ring-2 ring-amber-500/70 shadow-[0_18px_45px_rgba(0,0,0,0.75)]",
        )}
      >
        {children}
      </div>
    </div>
  );
}
