export class ArrayBufferHandler {
  private buffer: ArrayBuffer;
  private dataView: DataView;
  private isLittleEndian: boolean;

  constructor(buffer: ArrayBuffer, isLittleEndian = true) {
    this.buffer = buffer;
    this.dataView = new DataView(buffer);
    this.isLittleEndian = isLittleEndian;
  }

  get size() {
    return this.buffer.byteLength;
  }

  get arrayBuffer() {
    return this.buffer;
  }

  slice = (start: number, end: number | undefined) => {
    return new ArrayBufferHandler(this.buffer.slice(start, end), this.isLittleEndian);
  };

  getUint8 = (offset: number) => {
    return this.dataView.getUint8(offset);
  };

  getUint16 = (offset: number) => {
    return this.dataView.getUint16(offset, this.isLittleEndian);
  };

  getUint32 = (offset: number) => {
    return this.dataView.getUint32(offset, this.isLittleEndian);
  };

  getUint64 = (offset: number) => {
    return Number(this.dataView.getBigUint64(offset, this.isLittleEndian));
  };

  getInt16 = (offset: number) => {
    return this.dataView.getInt16(offset, this.isLittleEndian);
  };

  getUfix16 = (offset: number) => {
    return this.getUint8(offset) + this.getUint8(offset + 1) / 2 ** 8;
  };

  getUfix32 = (offset: number) => {
    return this.getUint16(offset) + this.getUint16(offset + 2) / 2 ** 16;
  };

  getAscii = (offset: number, length: number) => {
    return Array.from(new Uint8Array(this.buffer, offset, length))
      .map((charCode) => String.fromCharCode(charCode))
      .join("");
  };

  getPascalAscii = (offset: number) => {
    const length = this.getUint8(offset);
    return this.getAscii(offset + 1, length);
  };
}
