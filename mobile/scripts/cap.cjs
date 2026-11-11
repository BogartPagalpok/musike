// Runs Capacitor CLI with esbuild-backed ts.transpileModule so capacitor.config.ts works with TypeScript 7 on Node 20+.
Object.defineProperty(process, "version", { value: "v22.0.0" });
const ts = require("typescript");
const esbuild = require("../../server/node_modules/esbuild");
ts.ModuleKind ??= { CommonJS: 1 };
ts.ModuleResolutionKind ??= { NodeJs: 2 };
ts.ScriptTarget ??= { ES2017: 4 };
ts.transpileModule ??= (code) => ({ outputText: esbuild.transformSync(code, { loader: "ts", format: "cjs" }).code });
require("../node_modules/@capacitor/cli/bin/capacitor");
