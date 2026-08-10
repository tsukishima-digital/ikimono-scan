import { afterEach, describe, expect, it, vi } from "vitest";

import { captureVideoFrame } from "./captureVideoFrame";

describe("captureVideoFrame", () => {
  afterEach(() => vi.restoreAllMocks());

  it("rejects capture before the camera has dimensions", async () => {
    const video = document.createElement("video");

    await expect(captureVideoFrame(video)).rejects.toThrow(
      "カメラの準備が完了していません",
    );
  });

  it("turns the current video frame into a JPEG file", async () => {
    const video = document.createElement("video");
    Object.defineProperties(video, {
      videoWidth: { value: 1280 },
      videoHeight: { value: 720 },
    });
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      (callback) => callback(new Blob(["jpeg"], { type: "image/jpeg" })),
    );

    const result = await captureVideoFrame(video);

    expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 1280, 720);
    expect(result.type).toBe("image/jpeg");
    expect(result.name).toMatch(/^ikimono-scan-\d+\.jpg$/);
  });
});
