import { expect } from "@esm-bundle/chai";
import { parseQtContainer } from "~verkut/containers/qt";

describe("parseQtContainer", () => {
  describe("when QT + Hap video file is given", () => {
    it("returns file type compatibility information", async () => {
      const videoFile = await (await fetch("/spec/samples/hap.mov")).blob();
      const parseResult = await parseQtContainer(videoFile);

      const sampleSizes = parseResult.movie.tracks[0].media.videoMediaInformation.sampleTable.sampleSizes;
      console.log(
        sampleSizes.slice(0, 10).reduce((prev, current) => prev + current, 0),
        sampleSizes.slice(0, 11).reduce((prev, current) => prev + current, 0)
      );

      expect(parseResult.fileTypeCompatibility.majorBrand).to.equal("qt  ");
      expect(parseResult.fileTypeCompatibility.minorVersion).to.equal(512);
      expect(parseResult.fileTypeCompatibility.compatibleBrands.length).to.equal(1);
      expect(parseResult.fileTypeCompatibility.compatibleBrands[0]).to.equal("qt  ");
    });
  });
});
