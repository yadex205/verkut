import { expect } from "@esm-bundle/chai";
import { parseQtContainerMetadata, QtContainer } from "~verkut/containers/qt-container";

describe("parseQtContainer", () => {
  describe("when QT + Hap video file is given", () => {
    it("returns file type compatibility information", async () => {
      const videoFile = await (await fetch("/spec/samples/hap.mov")).blob();
      const parseResult = await parseQtContainerMetadata(videoFile);

      expect(parseResult.fileTypeCompatibility.majorBrand).to.equal("qt  ");
    });
  });
});

describe("QtContainer", () => {
  describe(".loadFile", () => {
    it("generates metadata", async () => {
      const videoFile = await (await fetch("/spec/samples/hap.mov")).blob();
      const container = new QtContainer();
      await container.loadFile(videoFile);

      expect(container.metadata?.duration).to.be.a("number");
    });
  });
});
