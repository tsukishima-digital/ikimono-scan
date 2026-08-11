const IMAGENET_MEAN = [0.485, 0.456, 0.406] as const;
const IMAGENET_STD = [0.229, 0.224, 0.225] as const;
// Implementation: The released checkpoint was trained with this resize-before-center-crop ratio.
export const MODEL_RESIZE_SCALE = 1.15;
const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const SUPPORTED_IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "heif",
]);

// Implementation: These limits admit 48 MP iPhone photos while bounding compressed
// input and decoded dimensions before the model-sized canvas is allocated.
export const MAX_IMAGE_FILE_BYTES = 30 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 60_000_000;

const SUPPORTED_FORMATS_MESSAGE =
  "JPEG、PNG、WebP、HEICの写真を選んでください。";

export function validateImageFile(file: File): void {
  const normalizedType = file.type.toLowerCase();
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const typeIsUnspecified =
    normalizedType === "" || normalizedType === "application/octet-stream";
  const supported =
    SUPPORTED_IMAGE_TYPES.has(normalizedType) ||
    (typeIsUnspecified && SUPPORTED_IMAGE_EXTENSIONS.has(extension));

  if (!supported) {
    if (normalizedType && !normalizedType.startsWith("image/")) {
      throw new Error("画像ファイルを選んでください。");
    }
    throw new Error(`この写真形式には対応していません。${SUPPORTED_FORMATS_MESSAGE}`);
  }
  if (file.size > MAX_IMAGE_FILE_BYTES) {
    throw new Error("写真のファイルサイズが大きすぎます。30MB以下の写真を選んでください。");
  }
}

export function validateImageDimensions(width: number, height: number): void {
  if (width <= 0 || height <= 0) {
    throw new Error(`この写真を読み込めませんでした。${SUPPORTED_FORMATS_MESSAGE}`);
  }
  if (width * height > MAX_IMAGE_PIXELS) {
    throw new Error(
      "写真の解像度が大きすぎます。6000万画素以下の写真を選んでください。",
    );
  }
}

export async function imageFileToNchw(
  file: File,
  imageSize: number,
): Promise<Float32Array> {
  validateImageFile(file);
  const image = await decodeImageFile(file);
  try {
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    validateImageDimensions(width, height);

    const resizeShortSide = Math.round(imageSize * MODEL_RESIZE_SCALE);
    const scale = resizeShortSide / Math.min(width, height);
    const resizedWidth = Math.round(width * scale);
    const resizedHeight = Math.round(height * scale);
    const sourceX = Math.max(0, (resizedWidth - imageSize) / 2);
    const sourceY = Math.max(0, (resizedHeight - imageSize) / 2);

    const canvas = document.createElement("canvas");
    canvas.width = imageSize;
    canvas.height = imageSize;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      throw new Error("画像を処理できませんでした。");
    }

    context.drawImage(
      image,
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
    image.removeAttribute("src");
  }
}

async function decodeImageFile(file: File): Promise<HTMLImageElement> {
  // Implementation: The image-element path matches displayed EXIF orientation and
  // Safari's HEIC decoder; createImageBitmap(File) has inconsistent EXIF handling.
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("decode failed"));
      image.src = objectUrl;
    });
    return image;
  } catch {
    image.removeAttribute("src");
    throw new Error(`この写真を読み込めませんでした。${SUPPORTED_FORMATS_MESSAGE}`);
  } finally {
    URL.revokeObjectURL(objectUrl);
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
