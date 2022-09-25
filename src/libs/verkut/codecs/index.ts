import { HapVideoDecoder } from "~verkut/codecs/hap";

export type VideoDecoderClassType = typeof HapVideoDecoder;

export const FOUR_CC_TO_DECODER_CLASS_MAP: Record<string, VideoDecoderClassType | undefined> = {
  HAP1: HapVideoDecoder,
  HAP5: HapVideoDecoder,
};
