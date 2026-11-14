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
              <stop offset="0%" stopColor="#f3e8ff" />
              <stop offset="60%" stopColor="#c084fc" />
              <stop offset="100%" stopColor="#7e22ce" />
            </radialGradient>
          </defs>
          <circle cx="32" cy="32" r="30.5" fill="url(#grandlineNikaGrad)" stroke="#1a1030" strokeWidth="2.5" />
          <circle cx="32" cy="32" r="22" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.8" strokeDasharray="6 4" />
          <circle cx="32" cy="32" r="14" fill="#130524" fillOpacity="0.22" />
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

  const isLightForeground = variant === "akatsuki";
  const isDarkForeground = variant === "shinobi" || variant === "grandline";

  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      style={{ width: px, height: px }}
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-full transition-transform duration-200 ease-out-expo",
        "hover:scale-[1.04] active:scale-[0.95] disabled:opacity-40",
        variant === "default" && "bg-accent text-accent-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.45)]",
        isLightForeground && "text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]",
        isDarkForeground && "text-[#140e00]",
        className,
      )}
      {...rest}
    >
      <PlayDiscDecor variant={variant} playing={isPlaying} />
      <span className="relative z-10 grid place-items-center">{children}</span>
    </button>
  );
});
