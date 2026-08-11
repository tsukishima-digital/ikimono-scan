import { MODEL_RESIZE_SCALE } from "../inference/preprocess";

export const MODEL_CROP_MEDIA_CLASS = "size-full object-cover";
export const MODEL_CROP_MEDIA_STYLE = {
  transform: `scale(${MODEL_RESIZE_SCALE})`,
} as const;
