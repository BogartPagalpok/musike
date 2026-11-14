import { EyedropperIcon } from "./icons";
import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import { hsvToHex, isHex, rgbToHsv, toRgb } from "../lib/accent";
import { useAppearance } from "../stores/appearance";

interface EyeDropperApi {
  open: () => Promise<{ sRGBHex: string }>;
}

const hasEyeDropper = typeof window !== "undefined" && "EyeDropper" in window;

/** Touch-friendly custom accent picker: saturation/brightness pad, hue strip, hex field and (where supported) an eyedropper. */
export function CustomColorPicker() {
  const t = useT();
  const accent = useAppearance((s) => s.accent);
  const set = useAppearance((s) => s.set);
  const [hsv, setHsv] = useState<[number, number, number]>(() => rgbToHsv(toRgb(accent)));
  const [hexInput, setHexInput] = useState(accent.toUpperCase());
  const svBoxRef = useRef<HTMLDivElement>(null);
  const hueBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHexInput(accent.toUpperCase());
    const next = rgbToHsv(toRgb(accent));
    setHsv((prev) => [next[1] === 0 || next[2] === 0 ? prev[0] : next[0], next[1], next[2]]);
  }, [accent]);

  const applyHsv = (h: number, s: number, v: number) => {
    const c: [number, number, number] = [
      Math.max(0, Math.min(360, Math.round(h))),
      Math.max(0, Math.min(1, s)),
      Math.max(0, Math.min(1, v)),
    ];
    setHsv(c);
    const hex = hsvToHex(c[0], c[1], c[2]);
    setHexInput(hex.toUpperCase());
    set({ accent: hex });
  };

  const onSv = (x: number, y: number) => {
    const r = svBoxRef.current?.getBoundingClientRect();
    if (r) applyHsv(hsv[0], (x - r.left) / r.width, 1 - (y - r.top) / r.height);
  };
  const onHue = (x: number) => {
    const r = hueBoxRef.current?.getBoundingClientRect();
    if (r) applyHsv(((x - r.left) / r.width) * 360, hsv[1] || 0.85, hsv[2] || 0.95);
  };

  const pickWithEyeDropper = async () => {
    try {
      const Ctor = (window as unknown as { EyeDropper: new () => EyeDropperApi }).EyeDropper;
      const res = await new Ctor().open();
      if (isHex(res.sRGBHex)) set({ accent: res.sRGBHex.toLowerCase() });
    } catch {
      /* cancelled */
    }
  };

  const [h, s, v] = hsv;
  const pureHue = hsvToHex(h, 1, 1);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div
        ref={svBoxRef}
        role="slider"
        tabIndex={0}
        aria-label={t.customize.saturationBrightness}
        aria-valuenow={Math.round(s * 100)}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          onSv(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => e.buttons > 0 && onSv(e.clientX, e.clientY)}
        className="relative h-40 w-full cursor-crosshair touch-none overflow-hidden rounded-[10px] select-none"
        style={{
          backgroundColor: pureHue,
          backgroundImage: "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)",
        }}
      >
        <span
          className="pointer-events-none absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-[0_1px_6px_rgba(0,0,0,0.6)]"
          style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%`, backgroundColor: accent }}
        />
      </div>

      <div
        ref={hueBoxRef}
        role="slider"
        tabIndex={0}
        aria-label={t.customize.hue}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={h}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          onHue(e.clientX);
        }}
        onPointerMove={(e) => e.buttons > 0 && onHue(e.clientX)}
        className="relative h-7 w-full cursor-pointer touch-none rounded-full select-none"
        style={{
          background:
            "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
        }}
      >
        <span
          className="pointer-events-none absolute top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-[0_1px_6px_rgba(0,0,0,0.6)]"
          style={{ left: `${(h / 360) * 100}%`, backgroundColor: pureHue }}
        />
      </div>

      <div className="flex items-center gap-2.5">
        <span className="size-10 shrink-0 rounded-[10px] ring-1 ring-line" style={{ backgroundColor: accent }} />
        <label className="flex-1">
          <span className="sr-only">{t.customize.hexLabel}</span>
          <input
            type="text"
            value={hexInput}
            maxLength={7}
            spellCheck={false}
            inputMode="text"
            onChange={(e) => {
              const raw = e.target.value;
              const n = raw.startsWith("#") ? raw : `#${raw}`;
              setHexInput(n.toUpperCase());
              if (isHex(n)) set({ accent: n.toLowerCase() });
            }}
            onBlur={() => setHexInput(accent.toUpperCase())}
            className="h-10 w-full rounded-[10px] bg-surface-3 px-3 font-mono text-sm font-medium text-fg focus:ring-2 focus:ring-accent focus:outline-none"
          />
        </label>
        {hasEyeDropper && (
          <button
            type="button"
            onClick={() => void pickWithEyeDropper()}
            aria-label={t.customize.eyedropper}
            title={t.customize.eyedropper}
            className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-surface-3 text-fg-2 transition-colors hover:text-fg active:scale-95"
          >
            <EyedropperIcon size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
