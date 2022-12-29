import { Geometry } from "~yanvas/geometry";

const BASE_VERTICES = [-0.5, -0.5, 0.0, -0.5, 0.5, 0.0, 0.5, 0.5, 0.0, 0.5, -0.5, 0.0];
const BASE_TEXTURE_COORD = [0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0];

export class Rect extends Geometry {
  public constructor(gl: WebGL2RenderingContext, scale = 1.0) {
    super(
      gl,
      BASE_VERTICES.map((value) => value * scale),
      BASE_TEXTURE_COORD
    );
  }
}
