import { useEffect, useState } from "react";
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

/** Opening animated splash screen using the uploaded illusive-sound-animated-logo.svg asset. */
export function OpeningSplash() {
  const [phase, setPhase] = useState<"playing" | "fading" | "done">("playing");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("fading"), 1950);
    const t2 = setTimeout(() => setPhase("done"), 2350);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (phase === "done") return null;

  return (
    <div
      onClick={() => setPhase("done")}
      role="status"
      aria-label="Loading Illusive Sounds"
      className={cn(
        "fixed inset-0 z-[200] flex flex-col items-center justify-center bg-bg transition-opacity duration-400 select-none",
        phase === "fading" ? "pointer-events-none opacity-0" : "opacity-100",
      )}
    >
      <style>{`
        .lm-ai{transform-box:view-box;animation:lm-fly .8s cubic-bezier(.2,1.25,.35,1) var(--d) backwards}
        .lm-aw{transform-box:view-box;animation:lm-pop .9s cubic-bezier(.3,1.45,.5,1) var(--d) backwards}
        .lm-an{transform-box:view-box;animation:lm-rise .6s cubic-bezier(.2,1.3,.4,1) var(--d) backwards}
        .lm-at{transform-box:view-box;animation:lm-fade .5s ease-out var(--d) backwards}
        @keyframes lm-fly{0%{opacity:0;transform:translate(var(--dx),var(--dy)) rotate(var(--r)) scale(.2)}30%{opacity:1}100%{opacity:1;transform:none}}
        @keyframes lm-pop{0%{opacity:0;transform:scale(.3) rotate(-20deg)}35%{opacity:1}100%{opacity:1;transform:none}}
        @keyframes lm-rise{0%{opacity:0;transform:translateY(var(--dy)) scale(.6)}40%{opacity:1}100%{opacity:1;transform:none}}
        @keyframes lm-fade{0%{opacity:0;transform:translateY(var(--dy))}100%{opacity:1;transform:none}}
      `}</style>
      <div className="relative flex flex-col items-center gap-6 px-6">
        <div className="pointer-events-none absolute inset-0 -z-10 scale-150 rounded-full bg-accent/15 blur-3xl" />
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="120 340.359 560 119.283"
          className="h-auto w-[min(82vw,460px)] overflow-visible text-fg"
        >
          <g className="lm-an" style={{ fill: "currentColor", ["--d" as string]: "0.69s", ["--dy" as string]: "28px", transformOrigin: "266.2px 401.25px" }}><path d="M 268.7 418.75 L 263.7 418.75 L 263.7 383.75 L 268.7 383.75 Z" /></g>
          <g className="lm-an" style={{ fill: "currentColor", ["--d" as string]: "0.744s", ["--dy" as string]: "30px", transformOrigin: "281.31px 400px" }}><path d="M 286.3 418.75 L 285.05 418.75 Q 282.65 418.75 280.65 417.57 Q 278.65 416.4 277.47 414.42 Q 276.3 412.45 276.3 410 L 276.3 381.25 L 281.3 381.25 L 281.3 410 Q 281.3 411.55 282.4 412.65 Q 283.5 413.75 285.05 413.75 L 286.3 413.75 Z" transform="matrix(1 0 0 1 0.01 0)" /></g>
          <g className="lm-an" style={{ fill: "currentColor", ["--d" as string]: "0.798s", ["--dy" as string]: "30px", transformOrigin: "295.45px 400px" }}><path d="M 300.45 418.75 L 299.2 418.75 Q 296.8 418.75 294.8 417.57 Q 292.8 416.4 291.63 414.42 Q 290.45 412.45 290.45 410 L 290.45 381.25 L 295.45 381.25 L 295.45 410 Q 295.45 411.55 296.55 412.65 Q 297.65 413.75 299.2 413.75 L 300.45 413.75 Z" /></g>
          <g className="lm-an" style={{ fill: "currentColor", ["--d" as string]: "0.852s", ["--dy" as string]: "22px", transformOrigin: "320.2px 405px" }}><path d="M 336.4 418.75 L 317.65 418.75 Q 314.8 418.75 312.33 417.67 Q 309.85 416.6 307.98 414.7 Q 306.1 412.8 305.05 410.32 Q 304 407.85 304 405 L 304 391.25 L 309 391.25 L 309 405 Q 309 407.4 310.18 409.37 Q 311.35 411.35 313.3 412.52 Q 315.25 413.7 317.65 413.75 L 331.4 413.75 L 331.4 391.25 L 336.4 391.25 Z" /></g>
          <g className="lm-an" style={{ fill: "currentColor", ["--d" as string]: "0.905s", ["--dy" as string]: "22px", transformOrigin: "357.31px 405px" }}><path d="M 372.3 410 Q 372.3 412.45 371.13 414.42 Q 369.95 416.4 367.98 417.57 Q 366 418.75 363.55 418.75 L 342.3 418.75 L 342.3 413.75 L 363.55 413.75 Q 365.1 413.75 366.2 412.65 Q 367.3 411.55 367.3 410 Q 367.3 408.45 366.2 407.35 Q 365.1 406.25 363.55 406.25 L 349.8 406.25 Q 347.75 406.25 346.03 405.25 Q 344.3 404.25 343.3 402.52 Q 342.3 400.8 342.3 398.75 Q 342.3 396.65 343.3 394.95 Q 344.3 393.25 346.03 392.25 Q 347.75 391.25 349.8 391.25 L 369.8 391.25 L 369.8 396.25 L 349.8 396.25 Q 348.75 396.25 348.03 396.97 Q 347.3 397.7 347.3 398.75 Q 347.3 399.8 348.03 400.52 Q 348.75 401.25 349.8 401.25 L 363.55 401.25 Q 366 401.25 367.98 402.42 Q 369.95 403.6 371.13 405.57 Q 372.3 407.55 372.3 410 Z" transform="matrix(1 0 0 1 0.01 0)" /></g>
          <g className="lm-an" style={{ fill: "currentColor", ["--d" as string]: "0.959s", ["--dy" as string]: "6px", transformOrigin: "379.95px 385px" }}><path d="M383.7 385q0 1.55-1.1 2.65-1.1 1.1-2.65 1.1-1.55 0-2.65-1.1-1.1-1.1-1.1-2.65 0-1.55 1.1-2.65 1.1-1.1 2.65-1.1 1.55 0 2.65 1.1 1.1 1.1 1.1 2.65z" /></g>
          <g className="lm-an" style={{ fill: "currentColor", ["--d" as string]: "0.986s", ["--dy" as string]: "22px", transformOrigin: "379.95px 405px" }}><path d="M382.45 418.75l-5 0 0-27.5 5 0z" /></g>
          <g className="lm-an" style={{ fill: "currentColor", ["--d" as string]: "1.04s", ["--dy" as string]: "22px", transformOrigin: "404.75px 405px" }}><path d="M 422.75 391.25 L 407.55 418.75 L 401.85 418.75 L 386.75 391.25 L 392.6 391.25 L 404.7 413.55 L 416.9 391.25 Z" /></g>
          <g className="lm-an" style={{ fill: "currentColor", ["--d" as string]: "1.094s", ["--dy" as string]: "22px", transformOrigin: "440.38px 405px" }}><path d="M 457.25 400 Q 457.25 402.4 456.08 404.4 Q 454.9 406.4 452.92 407.57 Q 450.95 408.75 448.5 408.75 L 429.35 408.75 Q 430.4 410.95 432.48 412.35 Q 434.55 413.75 437.15 413.75 L 453.5 413.75 L 453.5 418.75 L 437.15 418.75 Q 434.3 418.75 431.83 417.67 Q 429.35 416.6 427.48 414.7 Q 425.6 412.8 424.55 410.32 Q 423.5 407.85 423.5 405 Q 423.5 402.15 424.55 399.67 Q 425.6 397.2 427.48 395.3 Q 429.35 393.4 431.83 392.32 Q 434.3 391.25 437.15 391.25 L 448.5 391.25 Q 450.95 391.25 452.92 392.42 Q 454.9 393.6 456.08 395.57 Q 457.25 397.55 457.25 400 Z M 448.5 403.75 Q 450.05 403.75 451.15 402.65 Q 452.25 401.55 452.25 400 Q 452.25 398.45 451.15 397.35 Q 450.05 396.25 448.5 403.75 L 437.15 396.25 Q 434.95 396.25 433.13 397.25 Q 431.3 398.25 430.1 399.95 Q 428.9 401.65 428.6 403.75 Z" /></g>
          <g className="lm-an" style={{ fill: "currentColor", ["--d" as string]: "1.148s", ["--dy" as string]: "28px", transformOrigin: "499.95px 401.25px" }}><path d="M 520.15 408.75 Q 520.15 411.5 518.8 413.77 Q 517.45 416.05 515.2 417.4 Q 512.95 418.75 510.15 418.75 L 479.75 418.75 L 479.75 413.75 L 510.15 413.75 Q 512.25 413.75 513.7 412.27 Q 515.15 410.8 515.15 408.75 Q 515.15 406.7 513.7 405.22 Q 512.25 403.75 510.15 403.75 L 489.75 403.75 Q 487 403.75 484.73 402.4 Q 482.45 401.05 481.1 398.77 Q 479.75 396.5 479.75 393.75 Q 479.75 391 481.1 388.72 Q 482.45 386.45 484.73 385.1 Q 487 383.75 489.75 383.75 L 517.65 383.75 L 517.65 388.75 L 489.75 388.75 Q 487.7 388.75 486.23 390.22 Q 484.75 391.7 484.75 393.75 Q 484.75 395.8 486.23 397.27 Q 487.7 398.75 489.75 398.75 L 510.15 398.75 Q 512.95 398.75 515.2 400.1 Q 517.45 401.45 518.8 403.72 Q 520.15 406 520.15 408.75 Z" /></g>
          <g className="lm-an" style={{ fill: "currentColor", ["--d" as string]: "1.202s", ["--dy" as string]: "22px", transformOrigin: "541.15px 405px" }}><path d="M 558.65 405 Q 558.65 407.85 557.6 410.32 Q 556.55 412.8 554.67 414.7 Q 552.8 416.6 550.32 417.67 Q 547.85 418.75 545 418.75 L 537.3 418.75 Q 534.45 418.75 531.97 417.67 Q 529.5 416.6 527.63 414.7 Q 525.75 412.8 524.7 410.32 Q 523.65 407.85 523.65 405 Q 523.65 402.15 524.7 399.67 Q 525.75 397.2 527.63 395.3 Q 529.5 393.4 531.97 392.32 Q 534.45 391.25 537.3 391.25 L 545 391.25 Q 547.85 391.25 550.32 392.32 Q 552.8 393.4 554.67 395.3 Q 556.55 397.2 557.6 399.67 Q 558.65 402.15 558.65 405 Z M 553.65 405 Q 553.65 402.6 552.5 400.62 Q 551.35 398.65 549.38 397.45 Q 547.4 396.25 545 396.25 L 537.3 396.25 Q 534.9 396.25 532.95 397.45 Q 531 398.65 529.82 400.62 Q 528.65 402.6 528.65 405 Q 528.65 407.4 529.82 409.37 Q 531 411.35 532.95 412.55 Q 534.9 413.75 537.3 413.75 L 545 413.75 Q 547.4 413.75 549.38 412.55 Q 551.35 411.35 552.5 409.37 Q 553.65 407.4 553.65 405 Z" /></g>
          <g className="lm-an" style={{ fill: "currentColor", ["--d" as string]: "1.255s", ["--dy" as string]: "22px", transformOrigin: "579.85px 405px" }}><path d="M 596.05 418.75 L 577.3 418.75 Q 574.45 418.75 571.98 417.67 Q 569.5 416.6 567.63 414.7 Q 565.75 412.8 564.7 410.32 Q 563.65 407.85 563.65 405 L 563.65 391.25 L 568.65 391.25 L 568.65 405 Q 568.65 407.4 569.83 409.37 Q 571 411.35 572.95 412.52 Q 574.9 413.7 577.3 413.75 L 591.05 413.75 L 591.05 391.25 L 596.05 391.25 Z" /></g>
          <g className="lm-an" style={{ fill: "currentColor", ["--d" as string]: "1.309s", ["--dy" as string]: "22px", transformOrigin: "619.45px 405px" }}><path d="M 608.25 418.75 L 603.25 418.75 L 603.25 391.25 L 622 391.25 Q 624.85 391.25 627.32 392.32 Q 629.8 393.4 631.67 395.3 Q 633.55 397.2 634.6 399.67 Q 635.65 402.15 635.65 405 L 635.65 418.75 L 630.65 418.75 L 630.65 405 Q 630.65 402.6 629.5 400.62 Q 628.35 398.65 626.38 397.45 Q 624.4 396.25 622 396.25 L 608.25 396.25 Z" /></g>
          <g className="lm-an" style={{ fill: "currentColor", ["--d" as string]: "1.363s", ["--dy" as string]: "30px", transformOrigin: "656.85px 400px" }}><path d="M 673.05 418.75 L 668.05 418.75 L 668.05 396.25 L 654.3 396.25 Q 651.9 396.25 649.95 397.42 Q 648 398.6 646.82 400.6 Q 645.65 402.6 645.65 405 Q 645.65 407.4 646.82 409.37 Q 648 411.35 649.95 412.52 Q 651.9 413.7 654.3 413.75 L 665.55 413.75 L 665.55 418.75 L 654.3 418.75 Q 651.45 418.75 648.97 417.67 Q 646.5 416.6 644.63 414.7 Q 642.75 412.8 641.7 410.32 Q 640.65 407.85 640.65 405 Q 640.65 402.15 641.7 399.67 Q 642.75 397.2 644.63 395.3 Q 646.5 393.4 648.97 392.32 Q 651.45 391.25 654.3 391.25 L 668.05 391.25 L 668.05 381.25 L 673.05 381.25 Z" /></g>
          <g className="lm-ai text-accent-text" style={{ fill: "currentColor", ["--d" as string]: "0s", ["--dx" as string]: "90.69px", ["--dy" as string]: "6.68px", ["--r" as string]: "85.8deg", transformOrigin: "181.21px 399.26px" }}><path d="M 90 36.5 L 90 85.5 C 90 87.16 88.66 88.5 87 88.5 L 13 88.5 C 11.34 88.5 10 87.16 10 85.5 L 10 36.5 C 10 35.2 10.83 34.101 11.99 33.689 C 12.01 33.679 12.03 33.66 12.05 33.649 L 67.17 15.28 C 67.71000000000001 13.12 69.67 11.5 72 11.5 C 74.76 11.5 77 13.74 77 16.5 C 77 19.259999999999998 74.76 21.5 72 21.5 C 71.101 21.5 70.26 21.24 69.53 20.82 L 31.49 33.5 L 87 33.5 C 88.66 33.5 90 34.84 90 36.5 M 84 82.5 L 84 55.5 L 16 55.5 L 16 82.5 z M 84 49.5 L 84 39.5 L 33 39.5 L 33 49.5 z M 27 49.5 L 27 39.5 L 16 39.5 L 16 49.5 z" transform="matrix(1.53 0 0 1.53 104.705 322.765)" /></g>
          <g className="lm-ai text-accent-text" style={{ fill: "currentColor", ["--d" as string]: "0.06s", ["--dx" as string]: "-44.83px", ["--dy" as string]: "-135.16px", ["--r" as string]: "-17deg", transformOrigin: "153.67px 429.1px" }}><path d="M32 57.5c6.62 0 12 5.38 12 12 0 6.62-5.38 12-12 12-6.62 0-12-5.38-12-12 0-6.62 5.38-12 12-12M38 69.5c0-3.311-2.69-6-6-6-3.31 0-6 2.689-6 6 0 3.311 2.69 6 6 6 3.31 0 6-2.689 6-6" transform="matrix(1.53 0 0 1.53 104.705 322.765)" /></g>
          <g className="lm-ai text-accent-text" style={{ fill: "currentColor", ["--d" as string]: "0.12s", ["--dx" as string]: "-108.39px", ["--dy" as string]: "23.35px", ["--r" as string]: "9.6deg", transformOrigin: "222.52px 427.57px" }}><path d="M80 61.5l0 14c0 1.66-1.34 3-3 3-1.66 0-3-1.34-3-3l0-14c0-1.66 1.34-3 3-3 1.66 0 3 1.34 3 3" transform="matrix(1.53 0 0 1.53 104.705 322.765)" /></g>
          <g className="lm-ai text-accent-text" style={{ fill: "currentColor", ["--d" as string]: "0.18s", ["--dx" as string]: "-14.27px", ["--dy" as string]: "-111.97px", ["--r" as string]: "-61.9deg", transformOrigin: "205.69px 427.57px" }}><path d="M69 61.5l0 14c0 1.66-1.34 3-3 3-1.66 0-3-1.34-3-3l0-14c0-1.66 1.34-3 3-3 1.66 0 3 1.34 3 3" transform="matrix(1.53 0 0 1.53 104.705 322.765)" /></g>
          <g className="lm-ai text-accent-text" style={{ fill: "currentColor", ["--d" as string]: "0.24s", ["--dx" as string]: "-12.56px", ["--dy" as string]: "-141.5px", ["--r" as string]: "-54.5deg", transformOrigin: "188.86px 427.57px" }}><path d="M58 61.5l0 14c0 1.66-1.34 3-3 3-1.66 0-3-1.34-3-3l0-14c0-1.66 1.34-3 3-3 1.66 0 3 1.34 3 3" transform="matrix(1.53 0 0 1.53 104.705 322.765)" /></g>
        </svg>
      </div>
    </div>
  );
}

