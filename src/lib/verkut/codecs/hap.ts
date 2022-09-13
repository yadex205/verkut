import Snappy from "snappyjs";
import { ArrayBufferHandler } from "~verkut/utils/array-buffer-handler";

interface Section {
  type: number;
  getBodyHandler: () => ArrayBufferHandler;
}

const scanSections = (handler: ArrayBufferHandler) => {
  const sections: Section[] = [];
  let sectionStartsAt = 0;

  while (sectionStartsAt < handler.size) {
    let sectionHeaderSize = 4;
    let sectionBodySize = handler.getUint32(0) & 0xffffff;
    const sectionType = handler.getUint8(3);

    if (sectionBodySize === 0) {
      sectionHeaderSize = 8;
      sectionBodySize = handler.getUint32(4);
    }

    const sectionBodyStartsAt = sectionStartsAt + sectionHeaderSize;
    const sectionBodyEndsAt = sectionBodyStartsAt + sectionBodySize;
    console.log(sectionBodyStartsAt, sectionBodyEndsAt);

    sections.push({
      type: sectionType,
      getBodyHandler: () => handler.slice(sectionBodyStartsAt, sectionBodyEndsAt),
    });

    sectionStartsAt += sectionHeaderSize + sectionBodySize;
  }

  return sections;
};

export const parseHapFrame = (buffer: ArrayBuffer) => {
  const handler = new ArrayBufferHandler(buffer, true);
  const sections = scanSections(handler);

  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
    const section = sections[sectionIndex];
    const isSnappyCompressed = (section.type & 0xf0) === 0xb0;

    if (isSnappyCompressed) {
      const decompressedBody = Snappy.uncompress(section.getBodyHandler().arrayBuffer);
      console.log(decompressedBody.byteLength);
    }
  }
};
