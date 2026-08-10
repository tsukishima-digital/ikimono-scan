export async function captureVideoFrame(video: HTMLVideoElement): Promise<File> {
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error("カメラの準備が完了していません。");
  }

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("写真を撮影できませんでした。");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) =>
        result
          ? resolve(result)
          : reject(new Error("写真を撮影できませんでした。")),
      "image/jpeg",
      0.92,
    );
  });
  return new File([blob], `ikimono-scan-${Date.now()}.jpg`, {
    type: "image/jpeg",
  });
}
