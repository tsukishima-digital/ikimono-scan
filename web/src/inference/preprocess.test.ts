import { describe, expect, it } from "vitest";

import { rgbaToNormalizedNchw } from "./preprocess";

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
