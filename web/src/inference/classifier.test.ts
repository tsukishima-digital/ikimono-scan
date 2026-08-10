import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchModelManifest, topK, verifySha256 } from "./classifier";

const classes = [
  { id: "a", scientificName: "Species alpha" },
  { id: "b", scientificName: "Species beta" },
  { id: "c", scientificName: "Species gamma" },
];

describe("topK", () => {
  it("returns predictions ordered by softmax confidence", () => {
    const result = topK([1, 3, 2], classes, 2);

    expect(result.map((item) => item.classInfo.id)).toEqual(["b", "c"]);
    expect(result[0].confidence).toBeGreaterThan(result[1].confidence);
    expect(result.reduce((sum, item) => sum + item.confidence, 0)).toBeLessThan(1);
  });

  it("rejects a label count mismatch", () => {
    expect(() => topK([1], classes, 1)).toThrow("分類結果のサイズ");
  });
});

describe("fetchModelManifest", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows a stable error when the SPA fallback returns HTML", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<!doctype html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );

    await expect(fetchModelManifest("/models/manifest.json")).rejects.toThrow(
      "判定モデルを読み込めませんでした",
    );
  });
});

describe("verifySha256", () => {
  it("accepts bytes that match the published model digest", async () => {
    const bytes = new TextEncoder().encode("model");

    await expect(
      verifySha256(
        bytes,
        "9372c470eeadd5ecd9c3c74c2b3cb633f8e2f2fad799250a0f70d652b6b825e4",
      ),
    ).resolves.toBeUndefined();
  });

  it("rejects a model with a different digest", async () => {
    await expect(
      verifySha256(new TextEncoder().encode("tampered"), "0".repeat(64)),
    ).rejects.toThrow("整合性を確認できませんでした");
  });
});
