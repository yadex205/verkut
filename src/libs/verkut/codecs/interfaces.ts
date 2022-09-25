export type PixelFormatString = "????" | "RGB" | "RGBA";
export type PixelCompressionString = "NONE" | "DXT1" | "DXT5";

export interface VerkutEncodedVideoChunk {
  type: "key" | "delta";
  timestamp: number;
  frameWidth: number;
  frameHeight: number;
  data: ArrayBuffer;
}

export interface VerkutVideoFrame {
  data: ArrayBuffer;
  pixelFormat: PixelFormatString;
  pixelCompression: PixelCompressionString;
}

export interface IVerkutVideoDecoderClass {
  decode: (chunk: VerkutEncodedVideoChunk) => void;
  getCurrentFrame: () => VerkutVideoFrame;
}
