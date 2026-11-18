import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../lib/format";
import { usePlayer } from "../player/player";
import { useThemeStore, type PlayButtonStyle } from "../stores/themeStore";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  size?: "sm" | "md" | "lg";
}

const sizes = { sm: "size-8", md: "size-10", lg: "size-11" };

export const IconButton = forwardRef<HTMLButtonElement, Props>(function IconButton(
  { label, active, size = "md", className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "relative grid shrink-0 place-items-center rounded-full transition-[transform,color,background-color] duration-200 ease-out-expo",
        "hover:bg-surface-3 active:scale-[0.92] disabled:pointer-events-none disabled:opacity-35",
        active ? "text-accent-text" : "text-fg-2 hover:text-fg",
        sizes[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});

function PlayDiscDecor({ variant, playing }: { variant: PlayButtonStyle; playing: boolean }) {
  const spin = playing ? "animate-[spin_6s_linear_infinite]" : "";

  switch (variant) {
    case "shinobi":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className={cn("pointer-events-none absolute inset-0 size-full", spin)}>
          <defs>
            <radialGradient id="shinobiMoonGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="55%" stopColor="#facc15" />
              <stop offset="100%" stopColor="#ca8a04" />
            </radialGradient>
          </defs>
          <circle cx="32" cy="32" r="30.5" fill="url(#shinobiMoonGrad)" stroke="#0d0f17" strokeWidth="2.5" />
          <path d="M32 10 A22 22 0 0 1 54 32" fill="none" stroke="#1e2438" strokeOpacity="0.45" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M32 54 A22 22 0 0 1 10 32" fill="none" stroke="#fefce8" strokeOpacity="0.8" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="32" cy="32" r="17" fill="none" stroke="#0d0f17" strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="5 4" />
        </svg>
      );

    case "akatsuki":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className={cn("pointer-events-none absolute inset-0 size-full", spin)}>
          <circle cx="32" cy="32" r="30.5" fill="#dc2626" stroke="#140407" strokeWidth="3" />
          <circle cx="32" cy="32" r="19.5" fill="none" stroke="#090204" strokeWidth="1.8" strokeOpacity="0.85" />
          {[0, 120, 240].map((deg) => (
            <path
              key={deg}
              d="M32 32 C29 18 37 10 45 12 C38 17 37 26 32 32 Z"
              fill="#090204"
              transform={`rotate(${deg} 32 32)`}
            />
          ))}
          <circle cx="32" cy="32" r="12.5" fill="#090204" fillOpacity="0.88" />
        </svg>
      );

    case "grandline":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className={cn("pointer-events-none absolute inset-0 size-full", spin)}>
          <defs>
            <radialGradient id="grandlineNikaGrad" cx="45%" cy="40%" r="55%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="60%" stopColor="#fde68a" />
              <stop offset="100%" stopColor="#d97706" />
            </radialGradient>
          </defs>
          <circle cx="32" cy="32" r="30.5" fill="url(#grandlineNikaGrad)" stroke="#451a03" strokeWidth="2.5" />
          <circle cx="32" cy="32" r="22" fill="none" stroke="#ffffff" strokeOpacity="0.65" strokeWidth="1.8" strokeDasharray="6 4" />
          <circle cx="32" cy="32" r="14" fill="#291502" fillOpacity="0.18" />
        </svg>
      );

    case "cassette":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className="pointer-events-none absolute inset-0 size-full">
          <defs>
            <linearGradient id="cassetteKeyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#737880" />
              <stop offset="55%" stopColor="#555a61" />
              <stop offset="100%" stopColor="#3c4046" />
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r="30.5" fill="url(#cassetteKeyGrad)" stroke="#23262b" strokeWidth="2.5" />
          <circle cx="32" cy="32" r="25" fill="none" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="1.2" />
        </svg>
      );

    case "mirrorflame":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className="pointer-events-none absolute inset-0 size-full">
          <defs>
            <linearGradient id="mirrorFlameRing" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff6a00" />
              <stop offset="55%" stopColor="#ffb700" />
              <stop offset="100%" stopColor="#b8ff2c" />
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r="30.5" fill="#181a1f" stroke="#2f343d" strokeWidth="2" />
          <circle cx="32" cy="32" r="25.5" fill="#1e2128" stroke="url(#mirrorFlameRing)" strokeWidth="2.8" />
        </svg>
      );

    case "sandtopo":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className="pointer-events-none absolute inset-0 size-full">
          <circle cx="32" cy="32" r="30.5" fill="#dfd0b1" stroke="#b9a37b" strokeWidth="1.6" />
          <circle cx="32" cy="32" r="24" fill="#d8c6a3" stroke="#6b5b3e" strokeWidth="2.2" />
        </svg>
      );

    default:
      return null;
  }
}

export interface PlayDiscProps extends Omit<Props, "active"> {
  px?: number;
  styleVariant?: PlayButtonStyle;
  playing?: boolean;
}

/** The primary play button: dynamically styled by the active Theme Store Play Button skin. */
export const PlayDisc = forwardRef<HTMLButtonElement, PlayDiscProps>(function PlayDisc(
  { label, className, children, px = 48, styleVariant, playing, ...rest },
  ref,
) {
  const activeStyle = useThemeStore((s) => s.playButtonStyle);
  const playerPlaying = usePlayer((s) => s.status === "playing");
  const variant = styleVariant ?? activeStyle;
  const isPlaying = playing ?? playerPlaying;

  const isLightForeground = variant === "akatsuki" || variant === "cassette";
  const isDarkForeground = variant === "shinobi" || variant === "grandline";
  const alwaysShowIcon =
    variant === "default" || variant === "cassette" || variant === "mirrorflame" || variant === "sandtopo";

  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      style={{ width: px, height: px }}
      className={cn(
        "group/disc relative grid shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full transition-[transform,opacity,background-color] duration-150 ease-out",
        "hover:opacity-92 active:scale-[0.95] disabled:opacity-40",
        variant === "default" && "bg-fg text-bg",
        variant === "mirrorflame" && "text-[#ff8a1f] shadow-[0_0_16px_rgba(255,122,0,0.32)]",
        variant === "sandtopo" && "text-[#5c4d33] shadow-[0_6px_14px_rgba(92,74,42,0.24)]",
        isLightForeground && "text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]",
        isDarkForeground && "text-[#140e00]",
        className,
      )}
      {...rest}
    >
      <PlayDiscDecor variant={variant} playing={isPlaying} />
      {alwaysShowIcon ? (
        <span className="relative z-10 grid place-items-center">{children}</span>
      ) : (
        <span className="relative z-10 grid place-items-center rounded-full bg-black/65 p-1.5 text-white opacity-0 transition-opacity duration-150 group-hover/disc:opacity-95 group-focus-visible/disc:opacity-95">
          {children}
        </span>
      )}
    </button>
  );
});
