import { expect } from "@esm-bundle/chai";
import { parseQtContainer } from "~verkut/containers/qt";

describe("parseQtContainer", () => {
  describe("when QT + Hap video file is given", () => {
    it("returns file type compatibility information", async () => {
      const videoFile = await (await fetch("/spec/samples/hap.mov")).blob();
      const parseResult = await parseQtContainer(videoFile);
      console.log(parseResult.movie.tracks[0].edits);
      console.log(parseResult.movie.tracks[0].media);
      console.log(parseResult.movie.tracks[0].media.videoMediaInformation.sampleTable);

      expect(parseResult.fileTypeCompatibility.majorBrand).to.equal("qt  ");
      expect(parseResult.fileTypeCompatibility.minorVersion).to.equal(512);
      expect(parseResult.fileTypeCompatibility.compatibleBrands.length).to.equal(1);
      expect(parseResult.fileTypeCompatibility.compatibleBrands[0]).to.equal("qt  ");
    });
  });
});
