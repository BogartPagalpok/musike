// Builds the iOS app as an .ipa and copies it to release/Illusive-Sounds-Setup-<version>-iOS.ipa at the repository root,
// next to the desktop and Android downloads.
// Needs macOS with Xcode 15+ (xcodebuild). Unsigned by default so Sideloadly, AltStore, or TrollStore can sign it;
// signed with zsign when IOS_P12_PATH and IOS_PROVISION_PATH (and optional IOS_P12_PASSWORD) are set.
//
// MUSIKE_SERVER_URL=https://musike.example.com builds the app against that Musike server instead of the backend
// inside the app; the file is then named Illusive-Sounds-Setup-<version>-iOS-server.ipa.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
// One version for the whole app, as on Android: mobile/package.json (1.5.0 becomes build 10500).
const [major, minor, patch] = version.split(".").map((n) => parseInt(n, 10) || 0);
const build = String(major * 10000 + minor * 100 + patch);
const app = join(root, "ios", "App");
const work = join(root, "ios", "build");
const archive = join(work, "Musike.xcarchive");
const staging = join(work, "ipa");

const run = (cmd, args, cwd = app) => {
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

// The web app with the backend running inside the app, then the copy Capacitor makes of it for the Xcode project
// (from the folder with capacitor.config.ts).
run("pnpm", ["--filter", "@musike/web", "build:native"], join(root, ".."));
run("node", ["scripts/cap.cjs", "sync", "ios"], root);
const setPlist = (plist, key, type, val) => {
  const pb = "/usr/libexec/PlistBuddy";
  if (spawnSync(pb, ["-c", `Set :${key} ${val}`, plist], { stdio: "ignore" }).status !== 0) {
    run(pb, ["-c", `Add :${key} ${type} ${val}`, plist], root);
  }
};

const findPriorIpa = (releaseDir, suffix) => {
  if (!existsSync(releaseDir)) return null;
  const parseVer = (v) => v.split(".").map((n) => parseInt(n, 10) || 0);
  const re = new RegExp(`^Illusive-Sounds-Setup-(\\d+\\.\\d+\\.\\d+)-iOS${suffix ? "(?:-server)?" : ""}\\.ipa$`);
  const candidates = readdirSync(releaseDir)
    .map((name) => {
      const m = name.match(re);
      return m && m[1] !== version ? { name, ver: parseVer(m[1]), exact: name.includes(`-iOS${suffix}.ipa`) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => (Number(b.exact) - Number(a.exact)) || (b.ver[0] - a.ver[0]) || (b.ver[1] - a.ver[1]) || (b.ver[2] - a.ver[2]));
  return candidates.length ? join(releaseDir, candidates[0].name) : null;
};

// An .ipa is a zip with the app bundle inside Payload/.
const suffix = process.env.MUSIKE_SERVER_URL ? "-server" : "";
const releaseDir = join(root, "..", "release");
const target = join(releaseDir, `Illusive-Sounds-Setup-${version}-iOS${suffix}.ipa`);
const hasXcode = existsSync("/Applications/Xcode.app")
  && spawnSync("xcrun", ["--sdk", "iphoneos", "--show-sdk-path"], { stdio: "ignore" }).status === 0;

rmSync(staging, { recursive: true, force: true });
const appBundle = join(staging, "Payload", "Illusive Sounds.app");

if (hasXcode) {
  run("xcodebuild", [
    "-project", "App.xcodeproj",
    "-scheme", "App",
    "-configuration", "Release",
    "-destination", "generic/platform=iOS",
    "-archivePath", archive,
    "archive",
    "CODE_SIGNING_ALLOWED=NO",
    "CODE_SIGNING_REQUIRED=NO",
    "CODE_SIGNING_IDENTITY=",
    `MARKETING_VERSION=${version}`,
    `CURRENT_PROJECT_VERSION=${build}`,
  ]);

  const bundle = join(archive, "Products", "Applications", "App.app");
  if (!existsSync(bundle)) {
    console.error(`No app bundle at ${bundle}`);
    process.exit(1);
  }
  mkdirSync(join(staging, "Payload"), { recursive: true });
  run("cp", ["-R", bundle, appBundle]);
} else {
  const baseIpa = findPriorIpa(releaseDir, suffix);
  if (!baseIpa) {
    console.error("Xcode iphoneos SDK is missing and no prior .ipa found in release/ to repackage.");
    process.exit(1);
  }
  console.warn(`Xcode iphoneos SDK not found; repackaging ${baseIpa} with updated Capacitor web bundle and Info.plist`);
  mkdirSync(staging, { recursive: true });
  run("unzip", ["-oq", baseIpa, "-d", staging], root);
  if (!existsSync(appBundle)) {
    console.error(`Expected bundle missing in base .ipa: ${appBundle}`);
    process.exit(1);
  }
  rmSync(join(appBundle, "public"), { recursive: true, force: true });
  rmSync(join(appBundle, "_CodeSignature"), { recursive: true, force: true });
  run("cp", ["-R", join(app, "App", "public"), join(appBundle, "public")], root);
  const capConfig = join(app, "App", "capacitor.config.json");
  if (existsSync(capConfig)) {
    copyFileSync(capConfig, join(appBundle, "capacitor.config.json"));
  }
  const plist = join(appBundle, "Info.plist");
  setPlist(plist, "CFBundleShortVersionString", "string", version);
  setPlist(plist, "CFBundleVersion", "string", build);
  setPlist(plist, "UIFileSharingEnabled", "bool", "true");
  setPlist(plist, "LSSupportsOpeningDocumentsInPlace", "bool", "true");
}
mkdirSync(dirname(target), { recursive: true });
rmSync(target, { force: true });
const p12Path = process.env.IOS_P12_PATH;
const provPath = process.env.IOS_PROVISION_PATH;
if (p12Path && provPath) {
  const zsignArgs = ["-k", p12Path];
  if (process.env.IOS_P12_PASSWORD !== undefined) zsignArgs.push("-p", process.env.IOS_P12_PASSWORD);
  zsignArgs.push("-m", provPath, "-o", target, "-f", "-z", "9", appBundle);
  run("zsign", zsignArgs, root);
} else {
  run("zip", ["-qry", target, "Payload"], staging);
}
run("rm", ["-rf", staging]);
console.log(`\n${target}`);
