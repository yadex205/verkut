import { FOUR_CC_TO_DECODER_CLASS_MAP, VideoDecoderClassType } from "~verkut/codecs";
import { ContainerClassType, MIME_TYPE_TO_CONTAINER_CLASS_MAP } from "~verkut/containers";
import { IFileInputSourceClass } from "~verkut/input-sources/interfaces";
import { Yanvas } from "~yanvas";
import { FlatShader } from "~yanvas/shaders/flat-shader";
import { Texture } from "~yanvas/texture";

const LOGGER_PREFIX = "[verkut/input-sources/video-file]";

// @TODO Support video with non-I frames
export class VideoFileInputSource implements IFileInputSourceClass {
  private container?: InstanceType<ContainerClassType>;
  private videoDecoder?: InstanceType<VideoDecoderClassType>;
  private _canvasEl: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private yanvas: Yanvas;
  private texture: Texture;
  private _currentFrameIndex = 0;
  private _currentTime = 0;
  private _duration = 0;
  private _onFrameUpdate: () => void = () => {};

  public constructor() {
    const canvasEl = document.createElement("canvas");
    const gl = canvasEl.getContext("webgl2");
    if (!gl) {
      throw `${LOGGER_PREFIX} Cannot obtain WebGL2 context`;
    }

    const yanvas = new Yanvas(gl);
    const flatShader = new FlatShader(gl);
    const texture = new Texture(gl, 0);

    flatShader.setVertices(new Float32Array([-1.0, -1.0, 0.0, -1.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, -1.0, 0.0]));
    flatShader.setTextureCoord(new Float32Array([0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0]));
    flatShader.setTextureUnit(0);
    flatShader.use();

    this.yanvas = yanvas;
    this.texture = texture;

    this._canvasEl = canvasEl;
    this.gl = gl;
  }

  public get canvasEl() {
    return this._canvasEl;
  }

  public get displayWidth() {
    const { container } = this;
    if (!container) {
      return 0;
    }

    return container.metadata.videoStream.displayWidth;
  }

  public get displayHeight() {
    const { container } = this;
    if (!container) {
      return 0;
    }

    return container.metadata.videoStream.displayHeight;
  }

  public get currentTime() {
    return this._currentTime;
  }

  public get duration() {
    return this._duration;
  }

  public set onFrameUpdate(func: typeof this._onFrameUpdate) {
    this._onFrameUpdate = func;
  }

  public loadFile = async (file: Blob) => {
    const ContainerClass = MIME_TYPE_TO_CONTAINER_CLASS_MAP[file.type];
    if (!ContainerClass) {
      console.warn(`${LOGGER_PREFIX} Unsupported MIME type "${file.type}"`);
      return false;
    }
    const container = new ContainerClass();
    await container.loadFile(file);

    const DecoderClass = FOUR_CC_TO_DECODER_CLASS_MAP[container.metadata.videoStream.codecFourCc];
    if (!DecoderClass) {
      console.warn(`${LOGGER_PREFIX} Unsupported codec "${container.metadata.videoStream.codecFourCc}"`);
      return false;
    }
    const decoder = new DecoderClass();

    const { _canvasEl, gl } = this;

    _canvasEl.width = container.metadata.videoStream.displayWidth;
    _canvasEl.height = container.metadata.videoStream.displayHeight;
    gl.viewport(0, 0, container.metadata.videoStream.displayWidth, container.metadata.videoStream.displayHeight);

    this.container = container;
    this.videoDecoder = decoder;
    this._currentTime = 0;
    this._duration = container.metadata.duration / container.metadata.timeScale;

    return true;
  };

  public play = () => {
    const { container, videoDecoder, yanvas } = this;

    if (!container || !videoDecoder) {
      return;
    }

    yanvas.stop();

    const framesCount = container.metadata.videoStream.framesMap.length;
    const fps = container.metadata.videoStream.timeScale / container.metadata.videoStream.frameDuration;

    yanvas.drawFunction = async () => {
      const videoChunk = await container.getVideoFrameAtIndex(this._currentFrameIndex);
      videoDecoder.decode(videoChunk);

      this.render(container, videoDecoder);

      this._currentFrameIndex = (this._currentFrameIndex + 1) % framesCount;
      this._currentTime = videoChunk.timestamp / 1000000;
      this._onFrameUpdate();
    };
    yanvas.fps = fps;

    yanvas.start();
  };

  public pause = () => {
    this.yanvas.stop();
  };

  public seekToRatio = async (targetRatio: number) => {
    const { container, videoDecoder } = this;

    if (!container || !videoDecoder) {
      return;
    }

    const framesCount = container.metadata.videoStream.framesMap.length;
    const videoChunk = await container.getVideoFileAtRatio(targetRatio);
    videoDecoder.decode(videoChunk);

    this.render(container, videoDecoder);

    this._currentFrameIndex = (videoChunk.frameIndex + 1) % framesCount;
    this._currentTime = videoChunk.timestamp / 1000000;
    this._onFrameUpdate();
  };

  public stop = () => {
    const { gl } = this;

    this.yanvas.stop();
    this._currentFrameIndex = 0;
    this._currentTime = 0;

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.flush();

    this._onFrameUpdate();
  };

  private render = (container: InstanceType<ContainerClassType>, videoDecoder: InstanceType<VideoDecoderClassType>) => {
    const { gl } = this;

    const videoFrame = videoDecoder.getCurrentFrame();

    if (videoFrame.pixelFormat === "RGB" && videoFrame.pixelCompression === "DXT1") {
      this.texture.setCompressedImage(
        videoFrame.data,
        Texture.COMPRESSED_RGB_S3TC_DXT1,
        container.metadata.videoStream.frameWidth,
        container.metadata.videoStream.frameHeight
      );
    }

    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    gl.flush();
  };
}
