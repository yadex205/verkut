import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));

await mkdir(join(__dirname, "../build"), { recursive: true });

await copyFile(join(__dirname, "../src/pages/index.html"), join(__dirname, "../build/index.html"));

await esbuild.build({
  entryPoints: [join(__dirname, "../src/libs/verkut-components/index.ts")],
  outfile: join(__dirname, "../build/assets/verkut-components.js"),
  bundle: true,
  minify: true,
  drop: ["console"],
  watch: true,
});
