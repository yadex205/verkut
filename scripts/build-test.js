import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import * as esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));

const { values: options } = parseArgs({
  options: {
    watch: {
      type: "boolean",
      short: "w",
    },
  },
});

await esbuild.build({
  entryPoints: [join(__dirname, "../spec/libs/verkut/codecs/hap.spec.ts")],
  outfile: join(__dirname, "../tmp/test/libs/verkut/codecs/hap.spec.js"),
  bundle: true,
  logLevel: "info",
  sourcemap: "inline",
  watch: options.watch,
});

await esbuild.build({
  entryPoints: [join(__dirname, "../spec/libs/verkut/containers/qt-container.spec.ts")],
  outfile: join(__dirname, "../tmp/test/libs/verkut/containers/qt-container.spec.js"),
  bundle: true,
  logLevel: "info",
  sourcemap: "inline",
  watch: options.watch,
});
