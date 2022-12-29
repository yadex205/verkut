// @TODO: Consider having `onFrameUpdate`
export interface IInputSourceClass {
  displayWidth: number;
  displayHeight: number;
  play: () => void;
  pause: () => void;
}

export interface IFileInputSourceClass extends IInputSourceClass {
  loadFile: (file: Blob) => Promise<boolean>;
}

export interface IVideoFileInputSourceClass extends IFileInputSourceClass {
  seekToRatio: (targetRatio: number) => Promise<void>;
}
