import { Effect } from "./effect";

export class Layer {
  private _opacity = 1.0;
  private _effects: Effect[] = [];

  public set opacity(value: number) {
    this._opacity = Math.min(1.0, Math.max(0.0, value));
  }

  public get opacity() {
    return this._opacity;
  }

  public drawFrameBuffer = () => {}
}
