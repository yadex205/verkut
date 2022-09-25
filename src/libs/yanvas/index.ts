type DrawFunctionType = () => void | Promise<void>;

export class Yanvas {
  private gl: WebGLRenderingContext;
  private glExtensions: Record<string, unknown> = {};
  private _fps = 1;
  private _drawFunction: DrawFunctionType = () => {};
  private timerHandle = 0;
  private animationFrameHandle = 0;
  private isPlaying = false;

  public constructor(gl: WebGLRenderingContext) {
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.gl = gl;
  }

  public set fps(value: number) {
    this._fps = value;

    if (this.isPlaying) {
      this.stop();
      this.start();
    }
  }

  public set drawFunction(func: DrawFunctionType) {
    this._drawFunction = func;
  }

  public useGlExtension<T>(extensionName: string): T | null {
    let extension = this.glExtensions[extensionName];
    if (!extension) {
      extension = this.glExtensions[extensionName] = this.gl.getExtension(extensionName);
    }

    return extension as T | null;
  }

  public start = () => {
    if (this.isPlaying) {
      return;
    }

    const intervalDuration = 1000 / this._fps;

    this.timerHandle = window.setInterval(() => {
      window.cancelAnimationFrame(this.animationFrameHandle);
      this.animationFrameHandle = window.requestAnimationFrame(async () => {
        await this._drawFunction();
        this.gl.flush();
      });
    }, intervalDuration);

    this.isPlaying = true;
  };

  public stop = () => {
    window.clearInterval(this.timerHandle);
    this.isPlaying = false;
  };
}
