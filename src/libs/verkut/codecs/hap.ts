import Snappy from "snappyjs";
import {
  IVerkutVideoDecoderClass,
  PixelCompressionString,
  PixelFormatString,
  VerkutEncodedVideoChunk,
  VerkutVideoFrame,
} from "~verkut/codecs/interfaces";
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

export class HapVideoDecoder implements IVerkutVideoDecoderClass {
  private frame: ArrayBuffer = new ArrayBuffer(0);
  private pixelFormat: PixelFormatString = "????";
  private pixelCompression: PixelCompressionString = "NONE";

  public decode = (chunk: VerkutEncodedVideoChunk) => {
    const handler = new ArrayBufferHandler(chunk.data, true);
    const { sectionType, getBodyHandler } = scanSectionHeader(handler);
    const frameFormat = sectionType & 0x0f;
    const compression = sectionType & 0xf0;

    if (compression === 0xa0) {
      this.frame = getBodyHandler().arrayBuffer;
    } else if (compression === 0xb0) {
      this.frame = Snappy.uncompress(getBodyHandler().arrayBuffer);
    }

    if (frameFormat === 0x0b) {
      this.pixelFormat = "RGB";
      this.pixelCompression = "DXT1";
    } else if (frameFormat === 0x0e) {
      this.pixelFormat = "RGBA";
      this.pixelCompression = "DXT5";
    }
  };

  public getCurrentFrame = (): VerkutVideoFrame => ({
    data: this.frame,
    pixelFormat: this.pixelFormat,
    pixelCompression: this.pixelCompression,
  });
}
