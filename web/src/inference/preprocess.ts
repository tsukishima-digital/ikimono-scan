const IMAGENET_MEAN = [0.485, 0.456, 0.406] as const;
const IMAGENET_STD = [0.229, 0.224, 0.225] as const;

export async function imageFileToNchw(file: File, imageSize: number): Promise<Float32Array> {
  const bitmap = await createImageBitmap(file);
  try {
    const resizeShortSide = Math.round(imageSize * 1.15);
    const scale = resizeShortSide / Math.min(bitmap.width, bitmap.height);
    const resizedWidth = Math.round(bitmap.width * scale);
    const resizedHeight = Math.round(bitmap.height * scale);
    const sourceX = Math.max(0, (resizedWidth - imageSize) / 2);
    const sourceY = Math.max(0, (resizedHeight - imageSize) / 2);

    const canvas = new OffscreenCanvas(imageSize, imageSize);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      throw new Error("画像を処理できませんでした。");
    }

    context.drawImage(
      bitmap,
      -sourceX,
      -sourceY,
      resizedWidth,
      resizedHeight,
    );
    return rgbaToNormalizedNchw(
      context.getImageData(0, 0, imageSize, imageSize).data,
      imageSize,
      imageSize,
    );
  } finally {
    bitmap.close();
  }
}

export function rgbaToNormalizedNchw(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): Float32Array {
  const pixelCount = width * height;
  if (rgba.length !== pixelCount * 4) {
    throw new Error("RGBAデータのサイズが画像寸法と一致しません。");
  }

  const result = new Float32Array(pixelCount * 3);
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    for (let channel = 0; channel < 3; channel += 1) {
      const value = rgba[pixel * 4 + channel] / 255;
      result[channel * pixelCount + pixel] =
        (value - IMAGENET_MEAN[channel]) / IMAGENET_STD[channel];
    }
  }
  return result;
}
