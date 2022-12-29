export interface IShader {
  setVerticesBuffer: (buffer: WebGLBuffer) => void;
  setTextureCoordBuffer: (buffer: WebGLBuffer) => void;
  setTextureUnit: (textureUnitNumber: number) => void;
  use: () => void;
}
