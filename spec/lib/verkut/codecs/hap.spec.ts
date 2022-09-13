import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseQtContainer } from "~verkut/containers/qt";
import { parseHapFrame } from "~verkut/codecs/hap";

describe("decodeVideoFrame", () => {
  describe("when HAP chunk is given", () => {
    it("returns decoded frame", async () => {
      const __dirname = dirname(fileURLToPath(import.meta.url));
      const videoFileRawData = await readFile(resolve(__dirname, "../../../samples/hap.mov"));
      const videoFile = new Blob([new Uint8Array(videoFileRawData.buffer)]);
      const rawFrame = await videoFile.slice(36, 21719).arrayBuffer();
      parseHapFrame(rawFrame);
    });
  });
});
