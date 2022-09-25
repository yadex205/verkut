import { FOUR_CC_TO_DECODER_CLASS_MAP, VideoDecoderClassType } from "~verkut/codecs";
import { ContainerClassType, MIME_TYPE_TO_CONTAINER_CLASS_MAP } from "~verkut/containers";
import { IFileInputSourceClass } from "~verkut/input-sources/interfaces";

const LOGGER_PREFIX = "[verkut/input-sources/video-file]";

const vertexShaderSource = `
  attribute vec2 position;
  attribute vec2 textureCoord;

  varying vec2 vTextureCoord;

  void main(void) {
    vTextureCoord = textureCoord;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const fragmentShaderSource = `
  precision lowp float;

  uniform sampler2D texture;
  varying vec2 vTextureCoord;

  void main(void) {
    gl_FragColor = texture2D(texture, vTextureCoord);
  }
`;

export class VideoFileInputSource implements IFileInputSourceClass {
  private container?: InstanceType<ContainerClassType>;
  private videoDecoder?: InstanceType<VideoDecoderClassType>;
  private _canvasEl: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private glCompressedTextureS3tcExtension: WEBGL_compressed_texture_s3tc | null;
  private timer = 0;

  public constructor() {
    const canvasEl = document.createElement("canvas");
    const gl = canvasEl.getContext("webgl");
    if (!gl) {
      throw `${LOGGER_PREFIX} Cannot obtain WebGL context`;
    }

    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.glCompressedTextureS3tcExtension = gl.getExtension("WEBGL_compressed_texture_s3tc");

    const program = gl.createProgram();
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!program || !vertexShader || !fragmentShader) {
      throw `${LOGGER_PREFIX} Cannot prepare WebGL entities`;
    }

    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);
    gl.attachShader(program, vertexShader);
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    const positionAttributeLocation = gl.getAttribLocation(program, "position");
    const textureCoordAttributeLocation = gl.getAttribLocation(program, "textureCoord");

    const vertices = [-1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0];
    const textureCoord = [0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0];

    const verticesVbo = gl.createBuffer();
    const textureCoordVbo = gl.createBuffer();
    if (!verticesVbo || !textureCoordVbo) {
      throw "Cannot prepare buffers";
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, verticesVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoord), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(textureCoordAttributeLocation);
    gl.vertexAttribPointer(textureCoordAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    const textureUniformLocation = gl.getUniformLocation(program, "texture");
    if (!textureUniformLocation) {
      throw "Cannot obtain uniform location";
    }

    const texture = gl.createTexture();
    if (!texture) {
      throw "Cannot prepare a texture";
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(textureUniformLocation, 0);

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
    const { container, videoDecoder } = this;

    if (!container || !videoDecoder) {
      return;
    }

    window.clearInterval(this.timer);

    let frameIndex = 0;
    const framesCount = container.metadata.videoStream.framesMap.length;
    const frameDuration = (1000 * container.metadata.videoStream.frameDuration) / container.metadata.videoStream.timeScale;

    this.timer = window.setInterval(async () => {
      const videoChunk = await container.getVideoFrameAtIndex(frameIndex);
      videoDecoder.decode(videoChunk);

      this.render(container, videoDecoder);

      frameIndex = (frameIndex + 1) % framesCount;
    }, frameDuration);
  };

  public pause = () => {
    window.clearInterval(this.timer);
  };

  private render = (container: InstanceType<ContainerClassType>, videoDecoder: InstanceType<VideoDecoderClassType>) => {
    const { gl } = this;

    const videoFrame = videoDecoder.getCurrentFrame();

    if (videoFrame.pixelFormat === "RGB" && videoFrame.pixelCompression === "DXT1" && this.glCompressedTextureS3tcExtension) {
      gl.compressedTexImage2D(
        gl.TEXTURE_2D,
        0,
        this.glCompressedTextureS3tcExtension.COMPRESSED_RGB_S3TC_DXT1_EXT,
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
