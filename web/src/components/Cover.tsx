import { ClockCounterClockwiseIcon, DownloadSimpleIcon, HardDriveIcon, HeartIcon, SwatchesIcon } from "./icons";
import { cn } from "../lib/format";
import type { Track } from "../lib/types";
import { Artwork } from "./Artwork";

export type CoverKind = "playlist" | "favorites" | "downloads" | "history" | "device" | "themes";

/** Playlist cover: a 2x2 mosaic from the first distinct covers, or a single cover / icon tile. */
export function Cover({ kind, tracks, className, iconSize = 40 }: { kind: CoverKind; tracks: Track[]; className?: string; iconSize?: number }) {
  if (kind === "favorites") {
    return (
      <span className={cn("grid place-items-center bg-accent text-accent-ink", className)}>
        <HeartIcon size={iconSize} weight="fill" />
      </span>
    );
  }
  if (kind === "themes") {
    return (
      <span className={cn("grid place-items-center bg-surface-4 text-fg", className)}>
        <SwatchesIcon size={iconSize} />
      </span>
    );
  }
  if (kind === "downloads") {
    return (
      <span className={cn("grid place-items-center bg-accent-soft text-accent-text", className)}>
        <DownloadSimpleIcon size={iconSize} weight="bold" />
      </span>
    );
  }
  if (kind === "device") {
    return (
      <span className={cn("grid place-items-center bg-accent-soft text-accent-text", className)}>
        <HardDriveIcon size={iconSize} weight="bold" />
      </span>
    );
  }
  if (kind === "history") {
    return (
      <span className={cn("grid place-items-center bg-surface-4 text-fg", className)}>
        <ClockCounterClockwiseIcon size={iconSize} />
      </span>
    );
  }
  const arts = [...new Map(tracks.map((t) => [t.thumb, t])).values()].slice(0, 4);
  if (arts.length < 4) {
    return <Artwork src={arts[0]?.art} fallback={arts[0]?.thumb} className={className} iconSize={iconSize} />;
  }
  return (
    <span className={cn("grid grid-cols-2 grid-rows-2 overflow-hidden", className)}>
      {arts.map((t) => (
        <Artwork key={t.id} src={t.thumb} className="size-full" />
      ))}
    </span>
  );
}
