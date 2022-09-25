import { QtContainer } from "~verkut/containers/qt-container";

export type ContainerClassType = typeof QtContainer;

export const MIME_TYPE_TO_CONTAINER_CLASS_MAP: Record<string, ContainerClassType | undefined> = {
  "video/quicktime": QtContainer,
};
