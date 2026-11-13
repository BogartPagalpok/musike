// Stands in for server/src/config.ts in the Android build: only the YouTube Music settings matter on a phone.
import { Capacitor } from "@capacitor/core";
import { makeFetch, nativeFetch, type Transport } from "../http";

/** Uses an explicit chart region choice when set; defaults to "US" for an unbiased international catalog. */
function region(): string {
  try {
    const saved = localStorage.getItem("musike:chart-region")?.toUpperCase();
    if (saved === "PH" || saved === "US" || saved === "GB") return saved;
  } catch {
    /* ignore storage errors */
  }
  return "US";
}

// Development only: a desktop browser running this build can't use native HTTP, so a test harness may provide
// a stand-in transport (a local proxy that does the same job).
const devTransport = (globalThis as { __musikeTransport?: Transport }).__musikeTransport;

export const config = {
  lang: "en",
  location: region(),
  fetch: Capacitor.isNativePlatform() ? nativeFetch : devTransport ? makeFetch(devTransport) : undefined,
};
