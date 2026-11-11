import { cn } from "../lib/format";

const RADIO_PATH_1 =
  "M127.818 39.09v74.936a4.582 4.582 0 0 1-4.588 4.587H10.062a4.582 4.582 0 0 1-4.588-4.587V39.09a4.56 4.56 0 0 1 3.043-4.3c.03-.014.061-.043.092-.06L92.904 6.638c.826-3.303 3.823-5.78 7.386-5.78a7.65 7.65 0 0 1 7.647 7.646 7.65 7.65 0 0 1-7.647 7.646c-1.374 0-2.66-.397-3.777-1.04L38.338 34.502h84.892a4.582 4.582 0 0 1 4.588 4.588m-9.176 70.348V68.147H14.65v41.29zm0-50.467V43.678H40.648V58.97zm-87.17 0V43.678H14.65V58.97z";

const RADIO_PATH_2 =
  "M112.525 77.322v21.41a4.582 4.582 0 0 1-4.588 4.588 4.582 4.582 0 0 1-4.588-4.587v-21.41a4.582 4.582 0 0 1 4.588-4.589 4.582 4.582 0 0 1 4.588 4.588m-16.823 0v21.41a4.582 4.582 0 0 1-4.587 4.588 4.582 4.582 0 0 1-4.588-4.587v-21.41a4.582 4.582 0 0 1 4.588-4.589 4.582 4.582 0 0 1 4.587 4.588m-16.822 0v21.41a4.582 4.582 0 0 1-4.588 4.588 4.582 4.582 0 0 1-4.588-4.587v-21.41a4.582 4.582 0 0 1 4.588-4.589 4.582 4.582 0 0 1 4.588 4.588m-39.762-6.117c10.124 0 18.352 8.228 18.352 18.352s-8.228 18.351-18.352 18.351-18.351-8.227-18.351-18.351c0-10.124 8.227-18.352 18.351-18.352m9.176 18.352c0-5.064-4.114-9.176-9.176-9.176s-9.175 4.112-9.175 9.176c0 5.063 4.113 9.176 9.175 9.176s9.176-4.113 9.176-9.176";

/** The Illusive Sounds brand mark: radio symbol only, dynamically colored by the active theme. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="3 0 128 122"
      aria-hidden="true"
      className={cn("select-none text-accent-text transition-colors duration-200", className)}
    >
      <path d={RADIO_PATH_1} fill="currentColor" fillRule="evenodd" />
      <path d={RADIO_PATH_2} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="size-8 shrink-0 text-accent-text" />
      <span className="text-[17px] font-semibold tracking-tight">Illusive Sounds</span>
    </span>
  );
}

/** The mark in motion: marks the track that is playing. */
export function Equalizer({ live, className }: { live: boolean; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("inline-flex h-3.5 items-end gap-[2px]", live && "eq-live", className)}>
      <span className="eq-bar h-full w-[3px] rounded-full bg-accent-text" />
      <span className="eq-bar h-full w-[3px] rounded-full bg-accent-text" />
      <span className="eq-bar h-full w-[3px] rounded-full bg-accent-text" />
    </span>
  );
}

