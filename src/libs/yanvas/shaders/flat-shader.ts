import { createProgram } from "~yanvas/shaders/utils";

const LOGGER_PREFIX = "[yanvas/shaders/flat-shader]";

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

export class FlatShader {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private positionAttributeLocation: number;
  private textureCoordAttributeLocation: number;
  private textureUniformLocation: WebGLUniformLocation;
  private positionAttributeVbo: WebGLBuffer;
  private textureCoordAttributeVbo: WebGLBuffer;

  public constructor(gl: WebGL2RenderingContext) {
    const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    const positionAttributeLocation = gl.getAttribLocation(program, "position");
    const textureCoordAttributeLocation = gl.getAttribLocation(program, "textureCoord");
    const textureUniformLocation = gl.getUniformLocation(program, "texture");

    if (!textureUniformLocation) {
      throw `${LOGGER_PREFIX} Cannot obtain uniform location "texture"`;
    }

    const positionAttributeVbo = gl.createBuffer();
    if (!positionAttributeVbo) {
      throw `${LOGGER_PREFIX} Cannot create position attribute VBO`;
    }

    const textureCoordAttributeVbo = gl.createBuffer();
    if (!textureCoordAttributeVbo) {
      throw `${LOGGER_PREFIX} Cannot create textureCoord attribute VBO`;
    }

    gl.useProgram(program);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.enableVertexAttribArray(textureCoordAttributeLocation);

    this.gl = gl;
    this.program = program;
    this.positionAttributeLocation = positionAttributeLocation;
    this.textureCoordAttributeLocation = textureCoordAttributeLocation;
    this.textureUniformLocation = textureUniformLocation;
    this.positionAttributeVbo = positionAttributeVbo;
    this.textureCoordAttributeVbo = textureCoordAttributeVbo;
  }

  public use = () => {
    const { gl, program } = this;

    gl.useProgram(program);
  };

  public setVertices = (data: Float32Array, usage: number = this.gl.STATIC_DRAW) => {
    const { gl, positionAttributeLocation, positionAttributeVbo } = this;

    this.use();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionAttributeVbo);
    gl.bufferData(gl.ARRAY_BUFFER, data, usage);
    gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 0, 0);
  };

  public setTextureCoord = (data: Float32Array, usage: number = this.gl.STATIC_DRAW) => {
    const { gl, textureCoordAttributeLocation, textureCoordAttributeVbo } = this;

    this.use();
    gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordAttributeVbo);
    gl.bufferData(gl.ARRAY_BUFFER, data, usage);
    gl.vertexAttribPointer(textureCoordAttributeLocation, 2, gl.FLOAT, false, 0, 0);
  };

  public setTextureUnit = (unit: number) => {
    const { gl, textureUniformLocation } = this;

    this.use();
    gl.uniform1i(textureUniformLocation, unit);
  };
}
