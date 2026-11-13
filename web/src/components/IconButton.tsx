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
            <radialGradient id="shinobiGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#e0f2fe" />
              <stop offset="35%" stopColor="#38bdf8" />
              <stop offset="85%" stopColor="#0284c7" />
              <stop offset="100%" stopColor="#f97316" />
            </radialGradient>
          </defs>
          <circle cx="32" cy="32" r="30.5" fill="url(#shinobiGrad)" stroke="#f97316" strokeWidth="2.5" />
          <path d="M32 10 A22 22 0 0 1 54 32" fill="none" stroke="#ffffff" strokeOpacity="0.8" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M32 54 A22 22 0 0 1 10 32" fill="none" stroke="#fed7aa" strokeOpacity="0.8" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M32 18 A14 14 0 0 1 46 32" fill="none" stroke="#bae6fd" strokeOpacity="0.85" strokeWidth="2" strokeLinecap="round" />
          <path d="M32 46 A14 14 0 0 1 18 32" fill="none" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="2" strokeLinecap="round" />
          <circle cx="32" cy="32" r="14" fill="#0c4a6e" fillOpacity="0.55" />
        </svg>
      );

    case "akatsuki":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className={cn("pointer-events-none absolute inset-0 size-full", spin)}>
          <circle cx="32" cy="32" r="30.5" fill="#dc2626" stroke="#18181b" strokeWidth="3" />
          <circle cx="32" cy="32" r="19.5" fill="none" stroke="#09090b" strokeWidth="1.8" strokeOpacity="0.85" />
          {[0, 120, 240].map((deg) => (
            <g key={deg} transform={`rotate(${deg} 32 32)`}>
              <circle cx="32" cy="12.5" r="3.4" fill="#09090b" />
              <path d="M32 9.2 Q37 11.5 34.8 15" fill="none" stroke="#09090b" strokeWidth="2" strokeLinecap="round" />
            </g>
          ))}
          <circle cx="32" cy="32" r="13.5" fill="#09090b" fillOpacity="0.85" />
        </svg>
      );

    case "grandline":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className={cn("pointer-events-none absolute inset-0 size-full", spin)}>
          <defs>
            <radialGradient id="grandlineGrad" cx="45%" cy="40%" r="55%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="65%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#b45309" />
            </radialGradient>
          </defs>
          <circle cx="32" cy="32" r="30.5" fill="url(#grandlineGrad)" stroke="#ef4444" strokeWidth="2.8" />
          <circle cx="32" cy="32" r="22" fill="none" stroke="#78350f" strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="4 4" />
          {[0, 90, 180, 270].map((deg) => (
            <polygon
              key={deg}
              points="32,4 35,12 29,12"
              fill="#78350f"
              fillOpacity="0.55"
              transform={`rotate(${deg} 32 32)`}
            />
          ))}
        </svg>
      );

    case "kpop":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className="pointer-events-none absolute inset-0 size-full">
          <defs>
            <linearGradient id="kpopBtnGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fbcfe8" />
              <stop offset="50%" stopColor="#f472b6" />
              <stop offset="100%" stopColor="#67e8f9" />
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r="30.5" fill="url(#kpopBtnGrad)" stroke="#ffffff" strokeOpacity="0.8" strokeWidth="2" />
          <circle cx="32" cy="32" r="24.5" fill="none" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1.2" strokeDasharray="3 3" />
          <path d="M16 14l1.3 3.2L20.5 18.5l-3.2 1.3L16 23l-1.3-3.2-3.2-1.3 3.2-1.3z" fill="#ffffff" fillOpacity="0.9" />
          <path d="M48 41l1.1 2.7L51.8 44.8l-2.7 1.1L48 48.6l-1.1-2.7-2.7-1.1 2.7-1.1z" fill="#ffffff" fillOpacity="0.9" />
        </svg>
      );

    case "arcade8bit":
      return (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[9px] border-2 border-[#fef08a] bg-[#facc15] shadow-[inset_3px_3px_0_rgba(255,255,255,0.6),inset_-3px_-3px_0_rgba(161,98,7,0.8)]"
        />
      );

    case "vinyl":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className={cn("pointer-events-none absolute inset-0 size-full", spin)}>
          <circle cx="32" cy="32" r="30.8" fill="#18181b" stroke="#f59e0b" strokeOpacity="0.85" strokeWidth="2" />
          <circle cx="32" cy="32" r="26" fill="none" stroke="#3f3f46" strokeWidth="1" />
          <circle cx="32" cy="32" r="22" fill="none" stroke="#27272a" strokeWidth="1" />
          <circle cx="32" cy="32" r="18" fill="none" stroke="#3f3f46" strokeWidth="1" />
          <circle cx="32" cy="32" r="14" fill="#d97706" fillOpacity="0.9" />
        </svg>
      );

    case "cyberpunk":
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className="pointer-events-none absolute inset-0 size-full">
          <defs>
            <linearGradient id="cyberBtnGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#083344" />
              <stop offset="55%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#4c0519" />
            </linearGradient>
          </defs>
          <polygon
            points="18,4 46,4 60,18 60,46 46,60 18,60 4,46 4,18"
            fill="url(#cyberBtnGrad)"
            stroke="#22d3ee"
            strokeWidth="2.5"
          />
          <polygon
            points="21,10 43,10 54,21 54,43 43,54 21,54 10,43 10,21"
            fill="none"
            stroke="#f43f5e"
            strokeOpacity="0.65"
            strokeWidth="1.2"
          />
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

  const isLightForeground = variant === "shinobi" || variant === "akatsuki" || variant === "vinyl" || variant === "cyberpunk";
  const isDarkForeground = variant === "grandline" || variant === "kpop" || variant === "arcade8bit";

  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      style={{ width: px, height: px }}
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden transition-transform duration-200 ease-out-expo",
        "hover:scale-[1.04] active:scale-[0.95] disabled:opacity-40",
        variant === "arcade8bit" ? "rounded-[9px]" : "rounded-full",
        variant === "default" && "bg-accent text-accent-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.45)]",
        isLightForeground && "text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]",
        isDarkForeground && "text-[#140d0a]",
        className,
      )}
      {...rest}
    >
      <PlayDiscDecor variant={variant} playing={isPlaying} />
      <span className="relative z-10 grid place-items-center">{children}</span>
    </button>
  );
});
