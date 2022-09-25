import { FOUR_CC_TO_DECODER_CLASS_MAP, VideoDecoderClassType } from "~verkut/codecs";
import { ContainerClassType, MIME_TYPE_TO_CONTAINER_CLASS_MAP } from "~verkut/containers";
import { IFileInputSourceClass } from "~verkut/input-sources/interfaces";
import { Yanvas } from "~yanvas";
import { FlatShader } from "~yanvas/shaders/flat-shader";

const LOGGER_PREFIX = "[verkut/input-sources/video-file]";

export class VideoFileInputSource implements IFileInputSourceClass {
  private container?: InstanceType<ContainerClassType>;
  private videoDecoder?: InstanceType<VideoDecoderClassType>;
  private _canvasEl: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private yanvas: Yanvas;

  public constructor() {
    const canvasEl = document.createElement("canvas");
    const gl = canvasEl.getContext("webgl");
    if (!gl) {
      throw `${LOGGER_PREFIX} Cannot obtain WebGL context`;
    }

    const yanvas = new Yanvas(gl);
    const flatShader = new FlatShader(gl);

    flatShader.setVertices(new Float32Array([-1.0, -1.0, 0.0, -1.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, -1.0, 0.0]));
    flatShader.setTextureCoord(new Float32Array([0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0]));
    flatShader.setTextureUnit(0);
    flatShader.use();

    const texture = gl.createTexture();
    if (!texture) {
      throw "Cannot prepare a texture";
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.yanvas = yanvas;

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

  public loadFile = async (file: Blob) => {
    const ContainerClass = MIME_TYPE_TO_CONTAINER_CLASS_MAP[file.type];
    if (!ContainerClass) {
      throw `${LOGGER_PREFIX} Unsupported MIME type "${file.type}"`;
    }
    const container = new ContainerClass();
    await container.loadFile(file);

    const DecoderClass = FOUR_CC_TO_DECODER_CLASS_MAP[container.metadata.videoStream.codecFourCc];
    if (!DecoderClass) {
      throw `${LOGGER_PREFIX} Unsupported codec "${container.metadata.videoStream.codecFourCc}"`;
    }
    const decoder = new DecoderClass();

    const { _canvasEl, gl } = this;

    _canvasEl.width = container.metadata.videoStream.displayWidth;
    _canvasEl.height = container.metadata.videoStream.displayHeight;
    gl.viewport(0, 0, container.metadata.videoStream.displayWidth, container.metadata.videoStream.displayHeight);

    this.container = container;
    this.videoDecoder = decoder;
  };

  public play = () => {
    const { container, videoDecoder, yanvas } = this;

    if (!container || !videoDecoder) {
      return;
    }

    yanvas.stop();

    let frameIndex = 0;
    const framesCount = container.metadata.videoStream.framesMap.length;
    const fps = container.metadata.videoStream.timeScale / container.metadata.videoStream.frameDuration;

    yanvas.drawFunction = async () => {
      const videoChunk = await container.getVideoFrameAtIndex(frameIndex);
      videoDecoder.decode(videoChunk);

      this.render(container, videoDecoder);

      frameIndex = (frameIndex + 1) % framesCount;
    };
    yanvas.fps = fps;

    yanvas.start();
  };

  public pause = () => {
    this.yanvas.stop();
  };

  private render = (container: InstanceType<ContainerClassType>, videoDecoder: InstanceType<VideoDecoderClassType>) => {
    const { gl, yanvas } = this;

    const videoFrame = videoDecoder.getCurrentFrame();
    const glCompressedTextureS3tcExtension =
      yanvas.useGlExtension<WEBGL_compressed_texture_s3tc>("WEBGL_compressed_texture_s3tc");

    if (videoFrame.pixelFormat === "RGB" && videoFrame.pixelCompression === "DXT1" && glCompressedTextureS3tcExtension) {
      gl.compressedTexImage2D(
        gl.TEXTURE_2D,
        0,
        glCompressedTextureS3tcExtension.COMPRESSED_RGB_S3TC_DXT1_EXT,
        container.metadata.videoStream.frameWidth,
        container.metadata.videoStream.frameHeight,
        0,
        new Uint8Array(videoFrame.data)
      );
    }

    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    gl.flush();
  };
}
