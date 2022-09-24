import { VerkutEncodedVideoChunk } from "~verkut/codecs/interfaces";

export interface NormalizedContainerMetadata {
  duration: number;
  timeScale: number;
  videoStream: {
    timeScale: number;
    streamDuration: number;
    frameDuration: number;
    codecFourCc: string;
    displayWidth: number;
    displayHeight: number;
    frameWidth: number;
    frameHeight: number;
    framesMap: [number, number][];
  };
}

export interface IContainerClass {
  metadata: NormalizedContainerMetadata;
  loadFile: (file: Blob) => void;
  getVideoFrameAtIndex: (index: number) => Promise<VerkutEncodedVideoChunk>;
  getVideoFrameAtTime: (time: number) => Promise<VerkutEncodedVideoChunk>;
}
