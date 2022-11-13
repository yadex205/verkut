import { VideoFileInputSource } from "~verkut/input-sources/video-file";

const LOGGER_PREFIX = "[verkut/input-sources]";

export type FileInputSourceClassType = typeof VideoFileInputSource;

export const getProperFileInputSource = async (file: File): Promise<InstanceType<FileInputSourceClassType>> => {
  const videoFileInputSource = new VideoFileInputSource();
  if (await videoFileInputSource.loadFile(file)) {
    return videoFileInputSource;
  }

  throw `${LOGGER_PREFIX} Cannot find proper file input source for "${file.name}"`;
};
