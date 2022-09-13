import { ArrayBufferHandler } from "~verkut/utils/array-buffer-handler";

interface VideoSampleDescription {
  dataFormat: string;
  dataReferenceIndex: number;
  version: number;
  revisionLevel: number;
  vendor: string;
  temporalQuality: number;
  spatialQuality: number;
  width: number;
  height: number;
  horizontalResolution: number;
  verticalResolution: number;
  dataSize: number;
  frameCount: number;
  compressorName: string;
  depth: number;
  colorTableId: number;
  extensions: {
    fieldHandling?: {
      fieldCount: number;
      fieldOrdering: number;
    };
  };
}

type SampleDescription = VideoSampleDescription;

interface DataInformation {
  dataReferences: {
    type: string;
    data: string;
  }[];
}

interface QtContainer {
  fileTypeCompatibility: {
    majorBrand: string;
    minorVersion: number;
    compatibleBrands: string[];
  };
  movieData: {
    startsAt: number;
    endsAt: number;
  };
  movie: {
    header: {
      creationTime: number;
      modificationTime: number;
      timeScale: number;
      duration: number;
      preferredRate: number;
      preferredVolume: number;
      matrixStructure: number[];
      previewTime: number;
      previewDuration: number;
      posterTime: number;
      selectionTime: number;
      selectionDuration: number;
      currentTime: number;
      nextTrackId: number;
    };
    tracks: {
      header: {
        creationTime: number;
        modificationTime: number;
        trackId: number;
        duration: number;
        layer: number;
        alternativeGroup: number;
        volume: number;
        matrixStructure: number[];
        trackWidth: number;
        trackHeight: number;
      };
      edits: {
        trackDuration: number;
        mediaTime: number;
        mediaRate: number;
      }[];
      media: {
        header: {
          creationTime: number;
          modificationTime: number;
          timeScale: number;
          duration: number;
          language: number;
          quality: number;
        };
        handlerReference?: {
          componentType: string;
          componentSubType: string;
          componentManufacturer: number;
          componentFlags: number;
          componentFlagsMask: number;
          componentName: string;
        };
        videoMediaInformation: {
          header: {
            graphicsMode: number;
            opColor: [number, number, number];
          };
          handlerReference: {
            componentType: string;
            componentSubType: string;
            componentManufacturer: number;
            componentFlags: number;
            componentFlagsMask: number;
            componentName: string;
          };
          dataInformation: DataInformation;
          sampleTable: {
            sampleDescriptions: SampleDescription[];
            timeToSamples: {
              sampleCount: number;
              sampleDuration: number;
            }[];
            sampleToChunks: {
              firstChunk: number;
              samplesPerChunk: number;
              sampleDescriptionId: number;
            }[];
            sampleSizes: number[];
            chunkOffsets: number[];
          };
        };
      };
    }[];
  };
}

const getHandler = async (file: Blob, start: number, end: number) => {
  return new ArrayBufferHandler(await file.slice(start, end).arrayBuffer(), false);
};

async function* scanAtoms(file: Blob, start: number = 0, end: number = file.size) {
  let seekPosition = start;

  while (seekPosition < end) {
    const atomHeaderHandler = await getHandler(file, seekPosition, seekPosition + 8);
    const atomType = atomHeaderHandler.getAscii(4, 4);
    let atomSize = atomHeaderHandler.getUint32(0);
    let atomBodyStartsAt = seekPosition + 8;

    if (atomSize === 0) {
      atomSize = file.size - seekPosition;
    } else if (atomSize === 1) {
      const extendedSizeHandler = await getHandler(file, seekPosition + 8, seekPosition + 16);
      atomSize = extendedSizeHandler.getUint64(0);
      atomBodyStartsAt += 8;
    }

    const atomBodyEndsAt = seekPosition + atomSize;

    yield {
      atomType,
      atomSize,
      atomBodyStartsAt,
      atomBodyEndsAt,
      getAtomBodyHandler: async () => await getHandler(file, atomBodyStartsAt, atomBodyEndsAt),
    };

    seekPosition += atomSize;
  }
}

const parseChunkOffsetAtomBody = (handler: ArrayBufferHandler) =>
  new Array(handler.getUint32(4)).fill(null).map((_, index) => {
    return handler.getUint32(8 + index * 4);
  });

const parseDataInformationAtomBody = async (file: Blob, start: number, end: number) => {
  const dataInformation: DataInformation = {
    dataReferences: [],
  };

  for await (const atom of scanAtoms(file, start, end)) {
    if (atom.atomType === "dref") {
      dataInformation.dataReferences = parseDataReferenceAtomBody(await atom.getAtomBodyHandler());
    } else {
      console.warn(`Unhandled atom type in Data information atom "${atom.atomType}"`);
    }
  }

  return dataInformation;
};

const parseDataReferenceAtomBody = (handler: ArrayBufferHandler) => {
  let dataReferenceStartsAt = 8;
  const numberOfEntries = handler.getUint32(4);

  return new Array(numberOfEntries).fill(null).map(() => {
    const dataReferenceSize = handler.getUint32(dataReferenceStartsAt);
    const dataReferenceType = handler.getAscii(dataReferenceStartsAt + 4, 4);
    const dataReferenceInformation = handler.getAscii(dataReferenceStartsAt + 12, dataReferenceSize - 12);

    dataReferenceStartsAt += dataReferenceSize;

    return { type: dataReferenceType, data: dataReferenceInformation };
  });
};

const parseEditAtomBody = async (file: Blob, start: number, end: number) => {
  let edits: QtContainer["movie"]["tracks"][number]["edits"] = [];

  for await (const atom of scanAtoms(file, start, end)) {
    if (atom.atomType === "elst") {
      edits = parseEditListAtomBody(await atom.getAtomBodyHandler());
    } else {
      console.warn(`Unhandled atom type in Edit atom "${atom.atomType}"`);
    }
  }

  return edits;
};

const parseEditListAtomBody = (handler: ArrayBufferHandler) =>
  new Array(handler.getUint32(4)).fill(null).map((_, index) => ({
    trackDuration: handler.getUint32(8 + index * 12),
    mediaTime: handler.getUint32(8 + index * 12 + 4),
    mediaRate: handler.getUfix32(8 + index * 12 + 8),
  }));

const parseFileTypeCompatibilityAtomBody = (handler: ArrayBufferHandler) => ({
  majorBrand: handler.getAscii(0, 4),
  minorVersion: handler.getUint32(4),
  compatibleBrands: new Array((handler.size - 8) / 4).fill(null).map((_, index) => {
    return handler.getAscii(8 + index * 4, 4);
  }),
});

const parseHandlerReferenceAtomBody = (handler: ArrayBufferHandler) => ({
  componentType: handler.getAscii(4, 4),
  componentSubType: handler.getAscii(8, 4),
  componentManufacturer: handler.getUint32(12),
  componentFlags: handler.getUint32(16),
  componentFlagsMask: handler.getUint32(20),
  componentName: handler.getPascalAscii(24),
});

const parseMediaAtomBody = async (file: Blob, start: number, end: number) => {
  const media: Partial<QtContainer["movie"]["tracks"][number]["media"]> = {};

  for await (const atom of scanAtoms(file, start, end)) {
    if (atom.atomType === "mdhd") {
      media.header = parseMediaHeaderAtomBody(await atom.getAtomBodyHandler());
    } else if (atom.atomType === "hdlr") {
      media.handlerReference = parseHandlerReferenceAtomBody(await atom.getAtomBodyHandler());
    } else if (atom.atomType === "minf") {
      media.videoMediaInformation = await parseVideoMediaInformationAtomBody(
        file,
        atom.atomBodyStartsAt,
        atom.atomBodyEndsAt,
        media.handlerReference?.componentSubType || ""
      );
    } else {
      console.warn(`Unhandled atom type in Media atom "${atom.atomType}"`);
    }
  }

  if (!media.header) {
    throw "Missing required atoms";
  }

  return media as QtContainer["movie"]["tracks"][number]["media"];
};

const parseMediaHeaderAtomBody = (handler: ArrayBufferHandler) => ({
  creationTime: handler.getUint32(4),
  modificationTime: handler.getUint32(8),
  timeScale: handler.getUint32(12),
  duration: handler.getUint32(16),
  language: handler.getUint16(20),
  quality: handler.getUint16(22),
});

const parseMovieAtomBody = async (file: Blob, start: number, end: number) => {
  const movie: Partial<QtContainer["movie"]> = {
    tracks: [],
  };

  for await (const atom of scanAtoms(file, start, end)) {
    if (atom.atomType === "mvhd") {
      movie.header = parseMovieHeaderAtomBody(await atom.getAtomBodyHandler());
    } else if (atom.atomType === "trak") {
      movie?.tracks?.push(await parseTrackAtomBody(file, atom.atomBodyStartsAt, atom.atomBodyEndsAt));
    } else {
      console.warn(`Unhandled atom type in Movie atom "${atom.atomType}"`);
    }
  }

  if (!movie.header || !movie.tracks || movie.tracks.length === 0) {
    throw "Missing required atoms";
  }

  return movie as QtContainer["movie"];
};

const parseMovieHeaderAtomBody = (handler: ArrayBufferHandler) => ({
  creationTime: handler.getUint32(4),
  modificationTime: handler.getUint32(8),
  timeScale: handler.getUint32(12),
  duration: handler.getUint32(16),
  preferredRate: handler.getUfix32(20),
  preferredVolume: handler.getUfix16(24),
  matrixStructure: new Array(9).fill(null).map((_, index) => handler.getUfix32(36 + index * 4)),
  previewTime: handler.getUint32(72),
  previewDuration: handler.getUint32(76),
  posterTime: handler.getUint32(80),
  selectionTime: handler.getUint32(84),
  selectionDuration: handler.getUint32(88),
  currentTime: handler.getUint32(92),
  nextTrackId: handler.getUint32(96),
});

const parseSampleDescriptionAtomBody = (handler: ArrayBufferHandler, mediaType: string) => {
  const sampleDescriptions: SampleDescription[] = [];
  const numberOfEntries = handler.getUint32(4);
  let sampleDescriptionStartsAt = 8;

  for (let entryIndex = 0; entryIndex < numberOfEntries; entryIndex++) {
    const sampleDescriptionSize = handler.getUint32(sampleDescriptionStartsAt);
    const sampleDescriptionHandler = handler.slice(
      sampleDescriptionStartsAt,
      sampleDescriptionStartsAt + sampleDescriptionSize
    );

    if (mediaType === "vide") {
      sampleDescriptions.push(parseVideoMediaDescription(sampleDescriptionHandler));
    } else {
      console.warn(`Unhandled media type in Sample description atom "${mediaType}"`);
    }

    sampleDescriptionStartsAt += sampleDescriptionSize;
  }

  return sampleDescriptions;
};

const parseSampleSizeAtomBody = (handler: ArrayBufferHandler) =>
  new Array(handler.getUint32(8)).fill(null).map((_, index) => {
    return handler.getUint32(12 + index * 4);
  });

const parseSampleTableAtomBody = async (file: Blob, start: number, end: number, mediaType: string) => {
  const sampleTable: Partial<QtContainer["movie"]["tracks"][number]["media"]["videoMediaInformation"]["sampleTable"]> = {};

  for await (const atom of scanAtoms(file, start, end)) {
    if (atom.atomType === "stsd") {
      sampleTable.sampleDescriptions = parseSampleDescriptionAtomBody(await atom.getAtomBodyHandler(), mediaType);
    } else if (atom.atomType === "stts") {
      sampleTable.timeToSamples = parseTimeToSampleAtomBody(await atom.getAtomBodyHandler());
    } else if (atom.atomType === "stsc") {
      sampleTable.sampleToChunks = parseSampleToChunkAtomBody(await atom.getAtomBodyHandler());
    } else if (atom.atomType === "stsz") {
      sampleTable.sampleSizes = parseSampleSizeAtomBody(await atom.getAtomBodyHandler());
    } else if (atom.atomType === "stco") {
      sampleTable.chunkOffsets = parseChunkOffsetAtomBody(await atom.getAtomBodyHandler());
    } else {
      console.warn(`Unhandled atom type in Sample table atom "${atom.atomType}"`);
    }
  }

  if (
    !sampleTable.sampleDescriptions ||
    !sampleTable.timeToSamples ||
    !sampleTable.sampleToChunks ||
    !sampleTable.sampleSizes
  ) {
    throw "Missing required atoms";
  }

  return sampleTable as QtContainer["movie"]["tracks"][number]["media"]["videoMediaInformation"]["sampleTable"];
};

const parseSampleToChunkAtomBody = (handler: ArrayBufferHandler) =>
  new Array(handler.getUint32(4)).fill(null).map((_, index) => ({
    firstChunk: handler.getUint32(8 + index * 12),
    samplesPerChunk: handler.getUint32(8 + index * 12 + 4),
    sampleDescriptionId: handler.getUint32(8 + index * 12 + 8),
  }));

const parseTimeToSampleAtomBody = (handler: ArrayBufferHandler) =>
  new Array(handler.getUint32(4)).fill(null).map((_, index) => ({
    sampleCount: handler.getUint32(8 + index * 8),
    sampleDuration: handler.getUint32(8 + index * 8 + 4),
  }));

const parseTrackAtomBody = async (file: Blob, start: number, end: number) => {
  const track: Partial<QtContainer["movie"]["tracks"][number]> = {};

  for await (const atom of scanAtoms(file, start, end)) {
    if (atom.atomType === "tkhd") {
      track.header = parseTrackHeaderAtomBody(await atom.getAtomBodyHandler());
    } else if (atom.atomType === "edts") {
      track.edits = await parseEditAtomBody(file, atom.atomBodyStartsAt, atom.atomBodyEndsAt);
    } else if (atom.atomType === "mdia") {
      track.media = await parseMediaAtomBody(file, atom.atomBodyStartsAt, atom.atomBodyEndsAt);
    } else {
      console.warn(`Unhandled atom type in Track atom "${atom.atomType}"`);
    }
  }

  if (!track.header || !track.media) {
    throw "Missing required atoms";
  }

  return track as QtContainer["movie"]["tracks"][number];
};

const parseTrackHeaderAtomBody = (handler: ArrayBufferHandler) => ({
  creationTime: handler.getUint32(4),
  modificationTime: handler.getUint32(8),
  trackId: handler.getUint32(12),
  duration: handler.getUint32(20),
  layer: handler.getUint16(32),
  alternativeGroup: handler.getUint16(34),
  volume: handler.getUfix16(36),
  matrixStructure: new Array(9).fill(null).map((_, index) => handler.getUfix32(40 + index * 4)),
  trackWidth: handler.getUfix32(76),
  trackHeight: handler.getUfix32(80),
});

const parseVideoMediaInformationAtomBody = async (file: Blob, start: number, end: number, mediaType: string) => {
  const videoMediaInformation: Partial<QtContainer["movie"]["tracks"][number]["media"]["videoMediaInformation"]> = {};

  for await (const atom of scanAtoms(file, start, end)) {
    if (atom.atomType === "vmhd") {
      videoMediaInformation.header = parseVideoMediaInformationHeaderAtomBody(await atom.getAtomBodyHandler());
    } else if (atom.atomType === "hdlr") {
      videoMediaInformation.handlerReference = parseHandlerReferenceAtomBody(await atom.getAtomBodyHandler());
    } else if (atom.atomType === "dinf") {
      videoMediaInformation.dataInformation = await parseDataInformationAtomBody(
        file,
        atom.atomBodyStartsAt,
        atom.atomBodyEndsAt
      );
    } else if (atom.atomType === "stbl") {
      videoMediaInformation.sampleTable = await parseSampleTableAtomBody(
        file,
        atom.atomBodyStartsAt,
        atom.atomBodyEndsAt,
        mediaType
      );
    } else {
      console.warn(`Unhandled atom type in Video media information atom "${atom.atomType}"`);
    }
  }

  if (!videoMediaInformation.header || !videoMediaInformation.handlerReference) {
    throw "Missing requried atoms";
  }

  return videoMediaInformation as QtContainer["movie"]["tracks"][number]["media"]["videoMediaInformation"];
};

const parseVideoMediaInformationHeaderAtomBody = (handler: ArrayBufferHandler) => ({
  graphicsMode: handler.getUint16(4),
  opColor: [handler.getUint16(6), handler.getUint16(8), handler.getUint16(10)] as [number, number, number],
});

const parseVideoMediaDescription = (handler: ArrayBufferHandler) => ({
  dataFormat: handler.getAscii(4, 4),
  dataReferenceIndex: handler.getUint16(14),
  version: handler.getUint16(16),
  revisionLevel: handler.getUint16(18),
  vendor: handler.getAscii(20, 4),
  temporalQuality: handler.getUint32(24),
  spatialQuality: handler.getUint32(28),
  width: handler.getUint16(32),
  height: handler.getUint16(34),
  horizontalResolution: handler.getUfix32(36),
  verticalResolution: handler.getUfix32(40),
  dataSize: handler.getUint32(44),
  frameCount: handler.getUint16(48),
  compressorName: handler.getPascalAscii(50),
  depth: handler.getUint16(82),
  colorTableId: handler.getUint16(84),
  extensions: parseVideoMediaDescriptionExtensions(handler.slice(86, handler.size)),
});

const parseVideoMediaDescriptionExtensions = (handler: ArrayBufferHandler) => {
  const extensions: VideoSampleDescription["extensions"] = {};

  let extensionStartsAt = 0;

  while (extensionStartsAt < handler.size) {
    const extensionSize = handler.getUint32(extensionStartsAt);
    const extensionType = handler.getAscii(extensionStartsAt + 4, 4);
    const extensionBodyHandler = handler.slice(extensionStartsAt + 8, extensionStartsAt + extensionSize);

    if (extensionType === "fiel") {
      extensions.fieldHandling = {
        fieldCount: extensionBodyHandler.getUint8(0),
        fieldOrdering: extensionBodyHandler.getUint8(1),
      };
    } else {
      console.warn(`Unhandled extension in Video media description "${extensionType}"`);
    }

    extensionStartsAt += extensionSize;
  }

  return extensions;
};

export const parseQtContainer = async (file: Blob) => {
  const container: Partial<QtContainer> = {};

  for await (const atom of scanAtoms(file)) {
    if (atom.atomType === "ftyp") {
      container.fileTypeCompatibility = parseFileTypeCompatibilityAtomBody(await atom.getAtomBodyHandler());
    } else if (atom.atomType === "mdat") {
      container.movieData = {
        startsAt: atom.atomBodyStartsAt,
        endsAt: atom.atomBodyEndsAt,
      };
    } else if (atom.atomType === "moov") {
      container.movie = await parseMovieAtomBody(file, atom.atomBodyStartsAt, atom.atomBodyEndsAt);
    } else if (atom.atomType !== "wide") {
      console.warn(`Unhandled atom type in container "${atom.atomType}"`);
    }
  }

  if (!container.fileTypeCompatibility || !container.movieData || !container.movie) {
    throw "Missing required atoms";
  }

  return container as QtContainer;
};
