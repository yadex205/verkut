import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseQtContainer } from "~verkut/containers/qt";

describe("parseQtContainer", () => {
  describe("when QT + Hap video file is given", () => {
    it("returns file type compatibility information", async () => {
      const __dirname = dirname(fileURLToPath(import.meta.url));
      const videoFileRawData = await readFile(resolve(__dirname, "../../../samples/hap.mov"));
      const videoFile = new Blob([new Uint8Array(videoFileRawData.buffer)]);
      const parseResult = await parseQtContainer(videoFile);

      expect(parseResult.fileTypeCompatibility.majorBrand).toBe("qt  ");
      expect(parseResult.fileTypeCompatibility.minorVersion).toBe(512);
      expect(parseResult.fileTypeCompatibility.compatibleBrands.length).toBe(1);
      expect(parseResult.fileTypeCompatibility.compatibleBrands[0]).toBe("qt  ");
    });
  });
});
