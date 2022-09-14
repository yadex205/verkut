export interface NormalizedContainerMetadata {
  video: {
    codec: string;
    width: number;
    height: number;
  };
}

export abstract class ContainerBase {
  private file: Blob;

  public constructor(file: Blob) {
    this.file = file;
  }

  public parse = async () => {
    await this.parseFile(this.file);
  };

  protected abstract parseFile(file: Blob): Promise<NormalizedContainerMetadata>;
}
