import { getProperFileInputSource } from "~verkut/input-sources";
import type { IInputSourceClass } from "~verkut/input-sources/interfaces";
import { VideoFileInputSource } from "~verkut/input-sources/video-file";

export class Player {
  private playingStatus: "playing" | "paused" = "paused";
  private inputSource?: IInputSourceClass;

  public loadFile = async (file: File) => {
    const shouldPlayAfterLoad = this.playingStatus === "playing";

    this.pause();
    this.inputSource = await getProperFileInputSource(file);

    if (shouldPlayAfterLoad) {
      this.play();
    }
  };

  public play = () => {
    this.playingStatus = "playing";
    this.inputSource?.play();
  };

  public pause = () => {
    this.playingStatus = "paused";
    this.inputSource?.pause();
  };

  public get canvasEl() {
    return this.inputSource?.canvasEl;
  }
}
