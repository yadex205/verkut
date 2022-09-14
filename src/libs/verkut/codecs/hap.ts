import Snappy from "snappyjs";
import { ArrayBufferHandler } from "~verkut/utils/array-buffer-handler";

const scanSectionHeader = (handler: ArrayBufferHandler, offset = 0) => {
  const sectionType = handler.getUint8(offset + 3);
  let sectionHeaderSize = 4;
  let sectionBodySize = handler.getUint32(offset + 0) & 0xffffff;

  if (sectionBodySize === 0) {
    sectionHeaderSize = 8;
    sectionBodySize = handler.getUint32(offset + 4);
  }

  const sectionBodyStartsAt = offset + sectionHeaderSize;
  const sectionBodyEndsAt = sectionBodyStartsAt + sectionBodySize;

  return {
    sectionType,
    getBodyHandler: () => handler.slice(sectionBodyStartsAt, sectionBodyEndsAt),
  };
};

export const parseHapFrame = (buffer: ArrayBuffer) => {
  const handler = new ArrayBufferHandler(buffer, true);
  const { sectionType, getBodyHandler } = scanSectionHeader(handler);

  console.log(sectionType);

  switch (sectionType & 0xf0) {
    case 0xa0:
      return getBodyHandler().arrayBuffer;
    case 0xb0:
      return Snappy.uncompress(getBodyHandler().arrayBuffer);
    default:
      return new ArrayBuffer(0);
  }
};
