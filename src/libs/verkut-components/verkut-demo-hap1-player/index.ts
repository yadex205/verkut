import { css, html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { parseHapFrame } from "~verkut/codecs/hap";
import { QtContainer } from "~verkut/containers/qt";

@customElement("verkut-demo-hap1-player")
export class VerkutDemoHap1Player extends LitElement {
  private canvasElRef: Ref<HTMLCanvasElement> = createRef();
  private playerWrapperElRef: Ref<HTMLDivElement> = createRef();
  private gl?: WebGLRenderingContext = undefined;
  private texture: WebGLTexture | null = null;
  private s3tcExtension: WEBGL_compressed_texture_s3tc | null = null;
  private intervalHandle = -1;

  static override styles = css`
    :host {
      display: block;
    }

    .file-receiver {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }

    .player-wrapper {
      position: relative;
      width: 100%;
    }

    .player {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }
  `;

  override firstUpdated() {
    const gl = this.canvasElRef.value?.getContext("webgl");
    if (!gl) {
      throw "Cannot obtain WebGL context";
    }

    this.initCanvas(gl);
    this.gl = gl;
  }

  override render() {
    return html`
      <div class="file-receiver" @drop="${this.dropHandler}" @dragover="${this.dragoverHandler}">
        <div class="player-wrapper" ${ref(this.playerWrapperElRef)}>
          <canvas class="player" ${ref(this.canvasElRef)}></canvas>
        </div>
      </div>
    `;
  }

  private dragoverHandler = (event: Event) => {
    event.preventDefault();
  };

  private dropHandler = (event: DragEvent) => {
    event.preventDefault();

    if (event.dataTransfer?.items) {
      const fileItem = Array.from(event.dataTransfer.items).find((item) => item.kind === "file");
      const file = fileItem?.getAsFile();

      if (file && file.name.endsWith(".mov")) {
        this.playFile(file);
      }
    } else if (event.dataTransfer?.files) {
      const file = Array.from(event.dataTransfer.files)[0];

      if (file && file.name.endsWith(".mov")) {
        this.playFile(file);
      }
    }
  };

  private playFile = async (file: Blob) => {
    window.clearInterval(this.intervalHandle);

    const gl = this.gl;
    const s3tcExtension = this.s3tcExtension;
    const playerWrapperElRef = this.playerWrapperElRef.value;

    if (!gl || !s3tcExtension || !playerWrapperElRef) {
      return;
    }

    const container = new QtContainer(file);
    await container.parse();

    const videoStream = container.metadata?.videoStream;

    if (!videoStream) {
      throw "Cannot find video stream";
    }

    gl.canvas.width = videoStream.displayWidth;
    gl.canvas.height = videoStream.displayHeight;
    gl.viewport(0, 0, videoStream.displayWidth, videoStream.displayHeight);
    playerWrapperElRef.style.paddingBottom = `${(100 * videoStream.displayHeight) / videoStream.displayWidth}%`;

    const interval = (1000 * videoStream.frameDuration) / videoStream.timeScale;
    let frameCount = 0;

    this.intervalHandle = window.setInterval(async () => {
      const [frameStartsAt, frameEndsAt] = videoStream.framesMap[frameCount];
      const rawFrame = await file.slice(frameStartsAt, frameEndsAt).arrayBuffer();
      const textureData = parseHapFrame(rawFrame);

      gl.compressedTexImage2D(
        gl.TEXTURE_2D,
        0,
        s3tcExtension.COMPRESSED_RGB_S3TC_DXT1_EXT,
        videoStream.frameWidth,
        videoStream.frameHeight,
        0,
        new Uint8Array(textureData)
      );
      gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
      gl.flush();

      frameCount = (frameCount + 1) % videoStream.framesMap.length;
    }, interval);
  };

  private initCanvas = (gl: WebGLRenderingContext) => {
    const s3tcExtension = gl.getExtension("WEBGL_compressed_texture_s3tc");
    if (!s3tcExtension) {
      throw "Cannot obtain S3TC extension";
    }

    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE0);

    const program = gl.createProgram();
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!program || !vertexShader || !fragmentShader) {
      throw "Cannot prepare shader entities";
    }

    gl.shaderSource(
      vertexShader,
      `
        attribute vec2 position;
        attribute vec2 textureCoord;
        varying vec2 vTextureCoord;

        void main(void) {
          vTextureCoord = textureCoord;
          gl_Position = vec4(position, 0.0, 1.0);
        }
      `
    );
    gl.compileShader(vertexShader);
    gl.attachShader(program, vertexShader);

    gl.shaderSource(
      fragmentShader,
      `
        precision lowp float;
        uniform sampler2D texture;
        varying vec2 vTextureCoord;

        void main(void) {
          gl_FragColor = texture2D(texture, vTextureCoord);
        }
      `
    );
    gl.compileShader(fragmentShader);
    gl.attachShader(program, fragmentShader);

    gl.linkProgram(program);
    gl.useProgram(program);

    const positionAttributeLocation = gl.getAttribLocation(program, "position");
    const textureCoordAttributeLocation = gl.getAttribLocation(program, "textureCoord");
    const textureUniformLocation = gl.getUniformLocation(program, "texture");

    if (!textureUniformLocation) {
      throw "Cannot obtain uniform location";
    }

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

    const texture = gl.createTexture();
    if (!texture) {
      throw "Cannot prepare texture";
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(textureUniformLocation, 0);

    this.texture = texture;
    this.s3tcExtension = s3tcExtension;
  };
}
