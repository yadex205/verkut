import { css, html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { VideoFileInputSource } from "~verkut/input-sources/video-file";

@customElement("verkut-demo-hap1-player")
export class VerkutDemoHap1Player extends LitElement {
  private playerWrapperElRef: Ref<HTMLDivElement> = createRef();
  private seekBarElRef: Ref<HTMLInputElement> = createRef();
  private videoFileInputSource = new VideoFileInputSource();

  @state()
  private fileName = "Drag&Drop a video file to this screen";
  @state()
  private displayWidth = 0;
  @state()
  private displayHeight = 0;
  @state()
  private duration = 0;
  @state()
  private currentTime = 0;

  static override styles = css`
    :host {
      display: block;
    }

    .file-receiver {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }

    .player-wrapper {
      position: relative;
      max-width: 100%;
      max-height: 100%;
      margin: auto;
    }

    .player-wrapper canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }

    .control-bar-wrapper {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
    }

    .control-bar {
      margin: 24px;
      padding: 32px 48px;
      border-radius: 24px;
      background-color: rgba(10, 10, 10, 0.8);
      font-family: sans-serif;
    }

    .file-summary {
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .file-name {
      color: #dddddd;
      font-size: 14px;
      font-weight: bold;
    }

    .file-spec {
      margin-left: 12px;
      color: #888888;
      font-size: 12px;
    }

    .seek-bar {
      display: flex;
      margin-top: 12px;
      align-items: center;
    }

    .seek-bar-input {
      flex: 1 1 auto;
    }

    .current-time,
    .duration {
      flex: 0 1 100px;
      color: #aaaaaa;
      font-size: 12px;
    }

    .current-time {
      margin-right: 12px;
      text-align: right;
    }

    .duration {
      margin-left: 12px;
      text-align: left;
    }
  `;

  override firstUpdated() {
    const playerWrapperEl = this.playerWrapperElRef.value;
    const seekBarEl = this.seekBarElRef.value;
    if (!playerWrapperEl || !seekBarEl) {
      return;
    }

    playerWrapperEl.appendChild(this.videoFileInputSource.canvasEl);
    seekBarEl.valueAsNumber = 0;

    seekBarEl.addEventListener("mousedown", () => {
      this.videoFileInputSource.pause();
    });

    seekBarEl.addEventListener("input", (event) => {
      const targetRatio = (event.currentTarget as HTMLInputElement).valueAsNumber / 100;
      this.videoFileInputSource.seekToRatio(targetRatio);
    });

    seekBarEl.addEventListener("mouseup", () => {
      this.videoFileInputSource.play();
    });
  }

  override render() {
    return html`
      <div class="file-receiver" @drop="${this.dropHandler}" @dragover="${this.dragoverHandler}">
        <div class="player-wrapper" ${ref(this.playerWrapperElRef)}></div>
        <div class="control-bar-wrapper">
          <div class="control-bar">
            <div class="file-summary">
              <span class="file-name">${this.fileName}</span>
              <span class="file-spec">W: ${this.displayWidth}px, H: ${this.displayHeight}px</span>
            </div>
            <div class="seek-bar">
              <span class="current-time">${this.currentTime}s</span>
              <input ${ref(this.seekBarElRef)} class="seek-bar-input" type="range" min="0" max="100" />
              <span class="duration">${this.duration}s</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private dragoverHandler = (event: Event) => {
    event.preventDefault();
  };

  private dropHandler = (event: DragEvent) => {
    event.preventDefault();

    if (event.dataTransfer?.items) {
      const fileItem = Array.from(event.dataTransfer.items).find((item) => item.kind === "file");
      const file = fileItem?.getAsFile();

      if (file && file.name.endsWith(".mov")) {
        this.playFile(file);
      }
    } else if (event.dataTransfer?.files) {
      const file = Array.from(event.dataTransfer.files)[0];

      if (file && file.name.endsWith(".mov")) {
        this.playFile(file);
      }
    }
  };

  private playFile = async (file: File) => {
    const playerWrapperEl = this.playerWrapperElRef.value;
    const seekBarEl = this.seekBarElRef.value;

    if (!playerWrapperEl || !seekBarEl) {
      return;
    }

    this.videoFileInputSource.stop();
    await this.videoFileInputSource.loadFile(file);
    this.fileName = file.name;
    this.displayWidth = this.videoFileInputSource.displayWidth;
    this.displayHeight = this.videoFileInputSource.displayHeight;
    this.currentTime = Math.trunc(this.videoFileInputSource.currentTime);
    this.duration = Math.trunc(this.videoFileInputSource.duration);
    seekBarEl.valueAsNumber = 0;
    this.videoFileInputSource.onFrameUpdate = () => {
      this.currentTime = Math.trunc(this.videoFileInputSource.currentTime);
      seekBarEl.valueAsNumber = (this.videoFileInputSource.currentTime / this.videoFileInputSource.duration) * 100;
    };
    playerWrapperEl.style.aspectRatio = `${this.displayWidth} / ${this.displayHeight}`;
    this.videoFileInputSource.play();
  };
}
