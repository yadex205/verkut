const LOGGER_PREFIX = "[yanvas/texture/index]";

export class Texture {
  private static compressedTextureS3tcExtension: WEBGL_compressed_texture_s3tc;
  private static isExtensionPrepared = false;

  private gl: WebGL2RenderingContext;
  private texture: WebGLTexture;
  private textureUnitNumber: number;

  public static get COMPRESSED_RGB_S3TC_DXT1() {
    return this.compressedTextureS3tcExtension.COMPRESSED_RGB_S3TC_DXT1_EXT;
  }

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

  public constructor(gl: WebGL2RenderingContext, textureUnitNumber: number) {
    const texture = gl.createTexture();
    if (!texture) {
      throw `${LOGGER_PREFIX} Cannot create a texture`;
    }

    Texture.prepareExtensions(gl);

    gl.activeTexture(gl.TEXTURE0 + textureUnitNumber);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.gl = gl;
    this.texture = texture;
    this.textureUnitNumber = textureUnitNumber;
  }

  public setCompressedImage = (data: ArrayBuffer, internalFormat: GLenum, width: number, height: number) => {
    const gl = this.gl;

    gl.activeTexture(gl.TEXTURE0 + this.textureUnitNumber);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.compressedTexImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, new Uint8Array(data));
  };
}
