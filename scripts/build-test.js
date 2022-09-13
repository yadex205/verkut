import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));

await esbuild.build({
  entryPoints: [join(__dirname, "../spec/lib/verkut/codecs/hap.spec.ts")],
  outfile: join(__dirname, "../tmp/test/lib/verkut/codecs/hap.spec.js"),
  bundle: true,
});

await esbuild.build({
  entryPoints: [join(__dirname, "../spec/lib/verkut/containers/qt.spec.ts")],
  outfile: join(__dirname, "../tmp/test/lib/verkut/containers/qt.spec.js"),
  bundle: true,
});
