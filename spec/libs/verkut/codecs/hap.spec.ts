import { HapVideoDecoder } from "~verkut/codecs/hap";
import { QtContainer } from "~verkut/containers/qt-container";

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

describe("decodeVideoFrame", () => {
  describe("when HAP chunk is given", () => {
    it("returns decoded frame", async () => {
      const videoFile = await (await fetch("/spec/samples/hap.mov")).blob();
      const container = new QtContainer();
      await container.loadFile(videoFile);
      const hapDecoder = new HapVideoDecoder();

      const canvasEl = document.createElement("canvas");
      canvasEl.width = container.metadata.videoStream.displayWidth;
      canvasEl.height = container.metadata.videoStream.displayHeight;
      document.body.append(canvasEl);
      const gl = canvasEl.getContext("webgl");
      if (!gl) {
        throw "Cannot obtain WebGL context";
      }

      gl.clearColor(0.5, 0.5, 0.5, 1.0);
      gl.clearDepth(1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);

      const program = gl.createProgram();
      const vertexShader = gl.createShader(gl.VERTEX_SHADER);
      const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
      if (!program || !vertexShader || !fragmentShader) {
        throw "Cannot prepare WebGL entities";
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

      const vertices = [-0.6, -0.6, -0.8, 0.8, 0.8, 0.8, 0.6, -0.6];
      const textureCoord = [0.0, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0, 0.0];

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

      const videoChunk = await container.getVideoFrameAtTime(1.2);
      hapDecoder.decode(videoChunk);
      const videoFrame = hapDecoder.getCurrentFrame();
      const s3tcExtension = gl.getExtension("WEBGL_compressed_texture_s3tc");

      if (!s3tcExtension) {
        throw "Cannot obtain S3TC extension";
      }

      gl.compressedTexImage2D(
        gl.TEXTURE_2D,
        0,
        s3tcExtension.COMPRESSED_RGB_S3TC_DXT1_EXT,
        videoChunk.frameWidth,
        videoChunk.frameHeight,
        0,
        new Uint8Array(videoFrame.data)
      );

      gl.uniform1i(textureUniformLocation, 0);

      gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
      gl.flush();
    });
  });
});
