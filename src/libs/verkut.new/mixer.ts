import { Layer } from "./layer";

export class Mixer {
  private _layers: Layer[] = [];

  public addLayer = (layer: Layer) => {
    this._layers.push(layer);
  }

  public removeLayerByIndex = (index: number) => {
    this._layers.splice(index, 1);
  }

  public removeLayer = (layer: Layer) => {
    const index = this._layers.indexOf(layer);
    if (index >= 0) {
      this.removeLayerByIndex(index);
    }
  }

  public drawFrameBuffer = () => {}
}
