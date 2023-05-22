export class Player {
  private isPlaying = false;

  public loadFile = () => {}

  public rejectFile = () => {}

  public play = () => {
    if (this.isPlaying) {
      return;
    }

    this.isPlaying = true;
  }

  public pause = () => {
    if (!this.isPlaying) {
      return;
    }

    this.isPlaying = false;
  }

  public drawFrameBuffer = () => {}
}
