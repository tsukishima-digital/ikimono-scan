import { describe, expect, it } from "vitest";

import {
  MAX_IMAGE_FILE_BYTES,
  rgbaToNormalizedNchw,
  validateImageDimensions,
  validateImageFile,
} from "./preprocess";

describe("validateImageFile", () => {
  it.each([
    ["landscape.jpg", "image/jpeg"],
    ["portrait.png", "image/png"],
    ["beetle.webp", "image/webp"],
    ["iphone.heic", "image/heic"],
    ["iphone.heif", "image/heif"],
    ["iphone.HEIC", ""],
  ])("accepts %s (%s)", (name, type) => {
    expect(() => validateImageFile(new File(["image"], name, { type }))).not.toThrow();
  });

  it("rejects image formats outside the supported browser contract", () => {
    expect(() =>
      validateImageFile(new File(["gif"], "animated.gif", { type: "image/gif" })),
    ).toThrow("JPEG、PNG、WebP、HEIC");
  });

  it("rejects an input larger than the pre-decode file limit", () => {
    const file = new File(
      [new Uint8Array(MAX_IMAGE_FILE_BYTES + 1)],
      "oversized.jpg",
      { type: "image/jpeg" },
    );

    expect(() => validateImageFile(file)).toThrow("30MB以下");
  });

  it("rejects decoded dimensions above the pixel limit", () => {
    expect(() => validateImageDimensions(10_000, 7_000)).toThrow(
      "6000万画素以下",
    );
  });
});

describe("rgbaToNormalizedNchw", () => {
  it("converts RGBA pixels to normalized channel-first values", () => {
    const result = rgbaToNormalizedNchw(
      new Uint8ClampedArray([
        255, 0, 128, 255,
        0, 255, 64, 255,
      ]),
      2,
      1,
    );

    expect(Array.from(result)).toEqual([
      expect.closeTo((1 - 0.485) / 0.229, 5),
      expect.closeTo((0 - 0.485) / 0.229, 5),
      expect.closeTo((0 - 0.456) / 0.224, 5),
      expect.closeTo((1 - 0.456) / 0.224, 5),
      expect.closeTo((128 / 255 - 0.406) / 0.225, 5),
      expect.closeTo((64 / 255 - 0.406) / 0.225, 5),
    ]);
  });

  it("rejects mismatched dimensions", () => {
    expect(() =>
      rgbaToNormalizedNchw(new Uint8ClampedArray(4), 2, 1),
    ).toThrow("RGBAデータのサイズ");
  });
});
