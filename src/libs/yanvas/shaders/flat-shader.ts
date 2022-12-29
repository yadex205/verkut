import { IShader } from "~yanvas/shaders/interfaces";
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

export class FlatShader implements IShader {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private positionAttributeLocation: number;
  private textureCoordAttributeLocation: number;
  private textureUniformLocation: WebGLUniformLocation;

  public constructor(gl: WebGL2RenderingContext) {
    const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    const positionAttributeLocation = gl.getAttribLocation(program, "position");
    const textureCoordAttributeLocation = gl.getAttribLocation(program, "textureCoord");
    const textureUniformLocation = gl.getUniformLocation(program, "texture");

    if (!textureUniformLocation) {
      throw `${LOGGER_PREFIX} Cannot obtain uniform location "texture"`;
    }

    gl.useProgram(program);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.enableVertexAttribArray(textureCoordAttributeLocation);

    this.gl = gl;
    this.program = program;
    this.positionAttributeLocation = positionAttributeLocation;
    this.textureCoordAttributeLocation = textureCoordAttributeLocation;
    this.textureUniformLocation = textureUniformLocation;
  }

  public use = () => {
    const { gl, program } = this;

    gl.useProgram(program);
  };

  public setVerticesBuffer = (buffer: WebGLBuffer) => {
    const { gl, positionAttributeLocation } = this;

    this.use();

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 0, 0);
  };

  public setTextureCoordBuffer = (buffer: WebGLBuffer) => {
    const { gl, textureCoordAttributeLocation } = this;

    this.use();

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(textureCoordAttributeLocation, 2, gl.FLOAT, false, 0, 0);
  };

  public setTextureUnit = (unit: number) => {
    const { gl, textureUniformLocation } = this;

    this.use();
    gl.uniform1i(textureUniformLocation, unit);
  };
}
