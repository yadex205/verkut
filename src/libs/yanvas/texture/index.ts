const LOGGER_PREFIX = "[yanvas/texture/index]";

type EnumGetter = (gl: WebGL2RenderingContext) => GLenum;

export class Texture {
  private static instances = new Map<number, Texture>();
  private static compressedTextureS3tcExtension: WEBGL_compressed_texture_s3tc;
  private static isExtensionPrepared = false;

  private gl: WebGL2RenderingContext;
  private texture: WebGLTexture;
  private _unitNumber: number;

  public static get RGBA(): EnumGetter {
    return (gl) => gl.RGBA;
  }

  public static get COMPRESSED_RGB_S3TC_DXT1(): EnumGetter {
    return () => this.compressedTextureS3tcExtension.COMPRESSED_RGB_S3TC_DXT1_EXT;
  }

  public static create = (gl: WebGL2RenderingContext, unitNumber?: number) => {
    if (typeof unitNumber === "number" && this.instances.has(unitNumber)) {
      throw `${LOGGER_PREFIX} Texture Unit ${unitNumber} is already used`;
    }

    for (let candidateUnitNumber = 0; candidateUnitNumber < gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS; candidateUnitNumber++) {
      if (this.instances.has(candidateUnitNumber)) {
        continue;
      }

      unitNumber = candidateUnitNumber;
      break;
    }

    if (typeof unitNumber !== "number") {
      throw `${LOGGER_PREFIX} No more texture can be created`;
    }

    return new Texture(gl, unitNumber);
  };

  private static prepareExtensions = (gl: WebGL2RenderingContext) => {
    if (this.isExtensionPrepared) {
      return;
    }

    const compressedTextureS3tcExtension = gl.getExtension("WEBGL_compressed_texture_s3tc");
    if (!compressedTextureS3tcExtension) {
      throw `${LOGGER_PREFIX} Cannot obtain Compressed Texture S3TC Extension`;
    }

    this.compressedTextureS3tcExtension = compressedTextureS3tcExtension;
  };

  private constructor(gl: WebGL2RenderingContext, unitNumber: number) {
    const texture = gl.createTexture();
    if (!texture) {
      throw `${LOGGER_PREFIX} Cannot create a texture`;
    }

    Texture.prepareExtensions(gl);

    gl.activeTexture(gl.TEXTURE0 + unitNumber);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.gl = gl;
    this.texture = texture;
    this._unitNumber = unitNumber;
  }

  public get unitNumber() {
    return this._unitNumber;
  }

  public setImage = (
    internalFormatGetter: EnumGetter,
    formatGetter: EnumGetter,
    width: number,
    height: number,
    data: Uint8Array | null
  ) => {
    const { gl, texture, _unitNumber: unitNumber } = this;

    gl.activeTexture(gl.TEXTURE0 + unitNumber);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormatGetter(gl), width, height, 0, formatGetter(gl), gl.UNSIGNED_BYTE, data);
  };

  public setCompressedImage = (internalFormatGetter: EnumGetter, width: number, height: number, data: Uint8Array) => {
    const { gl, texture, _unitNumber: unitNumber } = this;

    gl.activeTexture(gl.TEXTURE0 + unitNumber);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.compressedTexImage2D(gl.TEXTURE_2D, 0, internalFormatGetter(gl), width, height, 0, data);
  };
}
