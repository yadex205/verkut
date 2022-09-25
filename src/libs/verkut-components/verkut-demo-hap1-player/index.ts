import { css, html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { VideoFileInputSource } from "~verkut/input-sources/video-file";

@customElement("verkut-demo-hap1-player")
export class VerkutDemoHap1Player extends LitElement {
  private playerWrapperElRef: Ref<HTMLDivElement> = createRef();
  private videoFileInputSource = new VideoFileInputSource();

  @state()
  private fileName = "N/A";
  @state()
  private displayWidth = 0;
  @state()
  private displayHeight = 0;

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
      width: 100%;
    }

    .player {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }

    .footage-information {
      position: absolute;
      bottom: 0;
      left: 0;
      padding: 32px;
      background-color: rgba(0, 0, 0, 0.8);
      color: #ffffff;
    }

    .footage-information dl {
      margin: 0;
    }
  `;

  override firstUpdated() {
    const playerWrapperEl = this.playerWrapperElRef.value;
    if (!playerWrapperEl) {
      return;
    }

    playerWrapperEl.appendChild(this.videoFileInputSource.canvasEl);
  }

  override render() {
    return html`
      <div class="file-receiver" @drop="${this.dropHandler}" @dragover="${this.dragoverHandler}">
        <div class="player-wrapper" ${ref(this.playerWrapperElRef)}></div>
        <div class="footage-information">
          <dl>
            <dt>File name</dt>
            <dd>${this.fileName}</dd>
            <dt>Resoution</dt>
            <dd>${this.displayWidth}px x ${this.displayHeight}px</dd>
          </dl>
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
    this.videoFileInputSource.pause();
    await this.videoFileInputSource.loadFile(file);
    this.fileName = file.name;
    this.displayWidth = this.videoFileInputSource.displayWidth;
    this.displayHeight = this.videoFileInputSource.displayHeight;
    this.videoFileInputSource.play();
  };
}
