const LOGGER_PREFIX = "[yanvas/geometry/index]";

export class Geometry {
  private _vertices: Float32Array;
  private _verticesBuffer: WebGLBuffer;
  private _textureCoord: Float32Array;
  private _textureCoordBuffer: WebGLBuffer;

  public constructor(gl: WebGL2RenderingContext, vertices: number[], textureCoord: number[]) {
    const verticesBuffer = gl.createBuffer();
    const textureCoordBuffer = gl.createBuffer();

    if (!verticesBuffer || !textureCoordBuffer) {
      throw `${LOGGER_PREFIX} Cannot create buffer`;
    }

    this._vertices = new Float32Array(vertices);
    this._textureCoord = new Float32Array(textureCoord);

    gl.bindBuffer(gl.ARRAY_BUFFER, verticesBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this._vertices, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this._textureCoord, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    this._verticesBuffer = verticesBuffer;
    this._textureCoordBuffer = textureCoordBuffer;
  }

  public get vertexCount() {
    return this._vertices.length / 3;
  }

  public get vertices() {
    return this._vertices;
  }

  public get verticesBuffer() {
    return this._verticesBuffer;
  }

  public get textureCoord() {
    return this._textureCoord;
  }

  public get textureCoordBuffer() {
    return this._textureCoordBuffer;
  }
}
