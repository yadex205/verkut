export interface NormalizedContainerMetadata {
  duration: number;
  timeScale: number;
  videoStream: {
    timeScale: number;
    streamDuration: number;
    frameDuration: number;
    codec: string;
    displayWidth: number;
    displayHeight: number;
    frameWidth: number;
    frameHeight: number;
    framesMap: [number, number][];
  };
}

export abstract class ContainerBase {
  private file: Blob;
  private _metadata?: NormalizedContainerMetadata = undefined;

  public constructor(file: Blob) {
    this.file = file;
  }

  public get metadata() {
    return this._metadata;
  }

  public parse = async () => {
    this._metadata = await this.parseFile(this.file);
  };

  protected abstract parseFile(file: Blob): Promise<NormalizedContainerMetadata>;
}
