type DrawFunctionType = () => void | Promise<void>;

import { Geometry } from "~yanvas/geometry";
import { Rect } from "~yanvas/geometry/rect";
import { Renderer } from "~yanvas/renderer";
import { FlatShader } from "~yanvas/shaders/flat-shader";
import { IShader } from "~yanvas/shaders/interfaces";
import { Texture } from "~yanvas/texture";

export class Yanvas {
  private gl: WebGL2RenderingContext;
  private _fps = 60;
  private _drawFunction: DrawFunctionType = () => {};
  private currentShader?: IShader;
  private timerHandle = 0;
  private animationFrameHandle = 0;
  private isPlaying = false;

  public constructor(gl: WebGL2RenderingContext) {
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.gl = gl;
  }

  public get rawGlContext() {
    return this.gl;
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

  public createRect = (scale = 1.0) => {
    const { gl } = this;

    return new Rect(gl, scale);
  };

  public createRenderer = (width: number, height: number) => {
    return new Renderer(this.gl, width, height);
  };

  public createFlatShader = () => {
    return new FlatShader(this.gl);
  };

  public createTexture = () => {
    return Texture.create(this.gl);
  };

  public useShader = (shader: IShader) => {
    shader.use();
    this.currentShader = shader;
  };

  public drawGeometry = (geometry: Geometry) => {
    const { currentShader, gl } = this;

    if (!currentShader) {
      return;
    }

    currentShader.setVerticesBuffer(geometry.verticesBuffer);
    currentShader.setTextureCoordBuffer(geometry.textureCoordBuffer);

    gl.drawArrays(gl.TRIANGLE_FAN, 0, geometry.vertexCount);
  };

  public clear = () => {
    const { gl } = this;

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.flush();
  };

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
