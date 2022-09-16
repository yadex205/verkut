import { ContainerBase, NormalizedContainerMetadata } from "~verkut/containers/container-base";
import { ArrayBufferHandler } from "~verkut/utils/array-buffer-handler";

const loggerPrefix = "[verkut/containers/qt]";

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

interface QtContainerMetadata {
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
      console.debug(loggerPrefix, "dref atom", dataInformation.dataReferences);
    } else {
      console.warn(loggerPrefix, `Unhandled atom type in Data information atom "${atom.atomType}"`);
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
  let edits: QtContainerMetadata["movie"]["tracks"][number]["edits"] = [];

  for await (const atom of scanAtoms(file, start, end)) {
    if (atom.atomType === "elst") {
      edits = parseEditListAtomBody(await atom.getAtomBodyHandler());
      console.debug(loggerPrefix, "elst atom", edits);
    } else {
      console.warn(loggerPrefix, `Unhandled atom type in Edit atom "${atom.atomType}"`);
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
  const media: Partial<QtContainerMetadata["movie"]["tracks"][number]["media"]> = {};

  for await (const atom of scanAtoms(file, start, end)) {
    if (atom.atomType === "mdhd") {
      media.header = parseMediaHeaderAtomBody(await atom.getAtomBodyHandler());
      console.debug(loggerPrefix, "mdhd atom", media.header);
    } else if (atom.atomType === "hdlr") {
      media.handlerReference = parseHandlerReferenceAtomBody(await atom.getAtomBodyHandler());
      console.debug(loggerPrefix, "hdlr atom", media.handlerReference);
    } else if (atom.atomType === "minf") {
      if (media.handlerReference?.componentSubType === "vide") {
        console.debug(loggerPrefix, "minf atom (video media information)");
        media.videoMediaInformation = await parseVideoMediaInformationAtomBody(
          file,
          atom.atomBodyStartsAt,
          atom.atomBodyEndsAt
        );
      }
    } else {
      console.warn(loggerPrefix, `Unhandled atom type in Media atom "${atom.atomType}"`);
    }
  }

  if (!media.header) {
    throw `${loggerPrefix} Missing required atoms in Media atom`;
  }

  return media as QtContainerMetadata["movie"]["tracks"][number]["media"];
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
  const movie: Partial<QtContainerMetadata["movie"]> = {
    tracks: [],
  };

  for await (const atom of scanAtoms(file, start, end)) {
    if (atom.atomType === "mvhd") {
      movie.header = parseMovieHeaderAtomBody(await atom.getAtomBodyHandler());
      console.debug(loggerPrefix, "mvhd atom", movie.header);
    } else if (atom.atomType === "trak") {
      console.debug(loggerPrefix, "trak atom");
      movie?.tracks?.push(await parseTrackAtomBody(file, atom.atomBodyStartsAt, atom.atomBodyEndsAt));
    } else {
      console.warn(loggerPrefix, `Unhandled atom type in Movie atom "${atom.atomType}"`);
    }
  }

  if (!movie.header || !movie.tracks || movie.tracks.length === 0) {
    throw `${loggerPrefix} Missing required atoms in Movie atom`;
  }

  return movie as QtContainerMetadata["movie"];
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
      console.warn(loggerPrefix, `Unhandled media type in Sample description atom "${mediaType}"`);
    }

    sampleDescriptionStartsAt += sampleDescriptionSize;
  }

  return sampleDescriptions;
};

const parseSampleSizeAtomBody = (handler: ArrayBufferHandler) => {
  const fixedSampleSize = handler.getUint32(4);
  const numberOfEntries = handler.getUint32(8);

  if (fixedSampleSize !== 0) {
    return new Array(numberOfEntries).fill(fixedSampleSize);
  } else {
    return new Array(numberOfEntries).fill(null).map((_, index) => {
      return handler.getUint32(12 + index * 4);
    });
  }
};

const parseSampleTableAtomBody = async (file: Blob, start: number, end: number, mediaType: string) => {
  const sampleTable: Partial<QtContainerMetadata["movie"]["tracks"][number]["media"]["videoMediaInformation"]["sampleTable"]> =
    {};

  for await (const atom of scanAtoms(file, start, end)) {
    if (atom.atomType === "stsd") {
      sampleTable.sampleDescriptions = parseSampleDescriptionAtomBody(await atom.getAtomBodyHandler(), mediaType);
      console.debug(loggerPrefix, "stsd atom", sampleTable.sampleDescriptions);
    } else if (atom.atomType === "stts") {
      sampleTable.timeToSamples = parseTimeToSampleAtomBody(await atom.getAtomBodyHandler());
      console.debug(loggerPrefix, "stts atom", sampleTable.timeToSamples);
    } else if (atom.atomType === "stsc") {
      sampleTable.sampleToChunks = parseSampleToChunkAtomBody(await atom.getAtomBodyHandler());
      console.debug(loggerPrefix, "stsc atom", sampleTable.sampleToChunks);
    } else if (atom.atomType === "stsz") {
      sampleTable.sampleSizes = parseSampleSizeAtomBody(await atom.getAtomBodyHandler());
      console.debug(loggerPrefix, "stsz atom", sampleTable.sampleSizes);
    } else if (atom.atomType === "stco") {
      sampleTable.chunkOffsets = parseChunkOffsetAtomBody(await atom.getAtomBodyHandler());
      console.debug(loggerPrefix, "stco atom", sampleTable.chunkOffsets);
    } else {
      console.warn(loggerPrefix, `Unhandled atom type in Sample table atom "${atom.atomType}"`);
    }
  }

  if (
    !sampleTable.sampleDescriptions ||
    !sampleTable.timeToSamples ||
    !sampleTable.sampleToChunks ||
    !sampleTable.sampleSizes
  ) {
    throw `${loggerPrefix} Missing required atoms in Sample table atom`;
  }

  return sampleTable as QtContainerMetadata["movie"]["tracks"][number]["media"]["videoMediaInformation"]["sampleTable"];
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
  const track: Partial<QtContainerMetadata["movie"]["tracks"][number]> = {};

  for await (const atom of scanAtoms(file, start, end)) {
    if (atom.atomType === "tkhd") {
      track.header = parseTrackHeaderAtomBody(await atom.getAtomBodyHandler());
      console.debug(loggerPrefix, "tkhd atom", track.header);
    } else if (atom.atomType === "edts") {
      console.debug(loggerPrefix, "edts atom");
      track.edits = await parseEditAtomBody(file, atom.atomBodyStartsAt, atom.atomBodyEndsAt);
    } else if (atom.atomType === "mdia") {
      console.debug(loggerPrefix, "mdia atom");
      track.media = await parseMediaAtomBody(file, atom.atomBodyStartsAt, atom.atomBodyEndsAt);
    } else {
      console.warn(loggerPrefix, `Unhandled atom type in Track atom "${atom.atomType}"`);
    }
  }

  if (!track.header || !track.media) {
    throw `${loggerPrefix} Missing required atoms in Track atom`;
  }

  return track as QtContainerMetadata["movie"]["tracks"][number];
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

const parseVideoMediaInformationAtomBody = async (file: Blob, start: number, end: number) => {
  const videoMediaInformation: Partial<QtContainerMetadata["movie"]["tracks"][number]["media"]["videoMediaInformation"]> = {};

  for await (const atom of scanAtoms(file, start, end)) {
    if (atom.atomType === "vmhd") {
      videoMediaInformation.header = parseVideoMediaInformationHeaderAtomBody(await atom.getAtomBodyHandler());
      console.debug(loggerPrefix, "vmhd atom", videoMediaInformation.header);
    } else if (atom.atomType === "hdlr") {
      videoMediaInformation.handlerReference = parseHandlerReferenceAtomBody(await atom.getAtomBodyHandler());
      console.debug(loggerPrefix, "hdlr atom", videoMediaInformation.handlerReference);
    } else if (atom.atomType === "dinf") {
      console.debug(loggerPrefix, "dinf atom");
      videoMediaInformation.dataInformation = await parseDataInformationAtomBody(
        file,
        atom.atomBodyStartsAt,
        atom.atomBodyEndsAt
      );
    } else if (atom.atomType === "stbl") {
      console.debug(loggerPrefix, "stbl atom");
      videoMediaInformation.sampleTable = await parseSampleTableAtomBody(
        file,
        atom.atomBodyStartsAt,
        atom.atomBodyEndsAt,
        "vide"
      );
    } else {
      console.warn(loggerPrefix, `Unhandled atom type in Video media information atom "${atom.atomType}"`);
    }
  }

  if (!videoMediaInformation.header || !videoMediaInformation.handlerReference) {
    throw `${loggerPrefix} Missing required atoms in Video media information atom`;
  }

  return videoMediaInformation as QtContainerMetadata["movie"]["tracks"][number]["media"]["videoMediaInformation"];
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

  // @note Some video sample descriptions contain an optional 4-byte terminator with all bytes set to 0.
  // @see https://developer.apple.com/library/archive/documentation/QuickTime/QTFF/QTFFChap3/qtff3.html#//apple_ref/doc/uid/TP40000939-CH205-74522
  while (extensionStartsAt < handler.size - 4) {
    const extensionSize = handler.getUint32(extensionStartsAt);
    const extensionType = handler.getAscii(extensionStartsAt + 4, 4);
    const extensionBodyHandler = handler.slice(extensionStartsAt + 8, extensionStartsAt + extensionSize);

    if (extensionType === "fiel") {
      extensions.fieldHandling = {
        fieldCount: extensionBodyHandler.getUint8(0),
        fieldOrdering: extensionBodyHandler.getUint8(1),
      };
    } else {
      console.warn(loggerPrefix, `Unhandled extension in Video media description "${extensionType}"`);
    }

    extensionStartsAt += extensionSize;
  }

  return extensions;
};

export const parseQtContainerMetadata = async (file: Blob) => {
  const container: Partial<QtContainerMetadata> = {};

  for await (const atom of scanAtoms(file)) {
    if (atom.atomType === "ftyp") {
      container.fileTypeCompatibility = parseFileTypeCompatibilityAtomBody(await atom.getAtomBodyHandler());
      console.debug(loggerPrefix, "ftyp atom", container.fileTypeCompatibility);
    } else if (atom.atomType === "mdat") {
      console.debug(loggerPrefix, "mdat atom");
      container.movieData = {
        startsAt: atom.atomBodyStartsAt,
        endsAt: atom.atomBodyEndsAt,
      };
    } else if (atom.atomType === "moov") {
      console.debug(loggerPrefix, "moov atom");
      container.movie = await parseMovieAtomBody(file, atom.atomBodyStartsAt, atom.atomBodyEndsAt);
    } else if (atom.atomType !== "wide") {
      console.warn(loggerPrefix, `Unhandled atom type in container "${atom.atomType}"`);
    }
  }

  if (!container.fileTypeCompatibility || !container.movieData || !container.movie) {
    throw `${loggerPrefix} Missing required atoms in container`;
  }

  return container as QtContainerMetadata;
};

export class QtContainer extends ContainerBase {
  protected parseFile = async (file: Blob): Promise<NormalizedContainerMetadata> => {
    const metadata = await parseQtContainerMetadata(file);

    const videoTracks = metadata.movie.tracks.filter((track) => track.media.handlerReference?.componentSubType === "vide");

    if (videoTracks.length === 0) {
      throw `${loggerPrefix} Missing video track`;
    } else if (videoTracks.length > 1) {
      console.warn(loggerPrefix, "Only first video track is used");
    }

    const videoTrack = videoTracks[0];
    const videoSampleTable = videoTrack.media.videoMediaInformation.sampleTable;

    if (videoSampleTable.sampleDescriptions.length === 0) {
      throw `${loggerPrefix} Missing codec metadata`;
    } else if (videoSampleTable.sampleDescriptions.length > 1) {
      throw `${loggerPrefix} Multiple codecs in a video track is not supported`;
    }

    if (videoSampleTable.sampleDescriptions[0].frameCount > 1) {
      throw `${loggerPrefix} Multiple frames in a video sample is not supported`;
    }

    if (videoSampleTable.timeToSamples.length > 1) {
      throw `${loggerPrefix} Multiple framerate in a video track is not supported`;
    }

    let frameIndexCounter = 0;
    const framesMap = videoSampleTable.sampleToChunks.flatMap(({ firstChunk, samplesPerChunk }, index) => {
      const numberOfSameEntryChunks =
        index === videoSampleTable.sampleToChunks.length - 1
          ? videoSampleTable.chunkOffsets.length - firstChunk + 1
          : videoSampleTable.sampleToChunks[index + 1].firstChunk - firstChunk;

      return new Array(numberOfSameEntryChunks).fill(null).flatMap((_, localChunkIndex) => {
        const chunkIndex = firstChunk - 1 + localChunkIndex;
        const chunkStartsAt = videoSampleTable.chunkOffsets[chunkIndex];
        const frameIndexStartsAt = frameIndexCounter;

        frameIndexCounter += samplesPerChunk;

        return new Array(samplesPerChunk).fill(null).map((_, localFrameIndex) => {
          const frameIndex = frameIndexStartsAt + localFrameIndex;
          const frameStartsAt = videoSampleTable.sampleSizes
            .slice(frameIndexStartsAt, frameIndex)
            .reduce((sum, size) => sum + size, chunkStartsAt);
          const frameEndsAt = frameStartsAt + videoSampleTable.sampleSizes[frameIndex];

          return [frameStartsAt, frameEndsAt] as [number, number];
        });
      });
    });

    return {
      duration: metadata.movie.header.duration,
      timeScale: metadata.movie.header.timeScale,
      videoStream: {
        timeScale: metadata.movie.header.timeScale,
        streamDuration: videoTrack.media.header.duration,
        frameDuration: videoSampleTable.timeToSamples[0].sampleDuration,
        codec: videoSampleTable.sampleDescriptions[0].dataFormat,
        displayWidth: videoTrack.header.trackWidth,
        displayHeight: videoTrack.header.trackHeight,
        frameWidth: videoSampleTable.sampleDescriptions[0].width,
        frameHeight: videoSampleTable.sampleDescriptions[0].height,
        framesMap,
      },
    };
  };
}
