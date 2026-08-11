import { afterEach, describe, expect, it, vi } from "vitest";
import * as ort from "onnxruntime-web/webgpu";

import {
  acceptsPrediction,
  fetchModelManifest,
  fetchVerifiedModel,
  topK,
  verifySha256,
} from "./classifier";

const classes = [
  { id: "a", scientificName: "Species alpha" },
  { id: "b", scientificName: "Species beta" },
  { id: "c", scientificName: "Species gamma" },
];

describe("ONNX Runtime environment", () => {
  it("runs WASM inference without spawning a worker", () => {
    expect(ort.env.wasm.numThreads).toBe(1);
  });
});

describe("topK", () => {
  it("returns predictions ordered by softmax confidence", () => {
    const result = topK([1, 3, 2], classes, 2);

    expect(result.map((item) => item.classInfo.id)).toEqual(["b", "c"]);
    expect(result[0].confidence).toBeGreaterThan(result[1].confidence);
    expect(result.reduce((sum, item) => sum + item.confidence, 0)).toBeLessThan(
      1,
    );
  });

  it("rejects a label count mismatch", () => {
    expect(() => topK([1], classes, 1)).toThrow("分類結果のサイズ");
  });
});

describe("acceptsPrediction", () => {
  it("rejects a closed-set result below the release threshold", () => {
    expect(
      acceptsPrediction([{ classInfo: classes[0], confidence: 0.49 }], 0.6),
    ).toBe(false);
  });

  it("accepts a result at the release threshold", () => {
    expect(
      acceptsPrediction([{ classInfo: classes[0], confidence: 0.6 }], 0.6),
    ).toBe(true);
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

  it("rejects invalid public evaluation values", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          version: "test",
          modelUrl: "/models/test.onnx",
          sha256: "a".repeat(64),
          license: "TEST",
          source: "/models/test.md",
          imageSize: 320,
          minimumConfidence: 0.6,
          evaluation: {
            validationImages: 0,
            accuracy: 1.2,
            macroF1: 0.5,
          },
          classes,
        }),
        { headers: { "content-type": "application/json" } },
      ),
    );

    await expect(fetchModelManifest("/models/manifest.json")).rejects.toThrow(
      "判定モデルの設定が不正です",
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

describe("fetchVerifiedModel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses a previously verified model from the device cache", async () => {
    const cache = {
      match: vi.fn().mockResolvedValue(new Response("model")),
      delete: vi.fn(),
      put: vi.fn(),
    };
    vi.stubGlobal("caches", { open: vi.fn().mockResolvedValue(cache) });
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await fetchVerifiedModel(
      "/models/beetles.onnx",
      "9372c470eeadd5ecd9c3c74c2b3cb633f8e2f2fad799250a0f70d652b6b825e4",
    );

    expect(new TextDecoder().decode(result)).toBe("model");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("replaces a corrupt cached model with a verified download", async () => {
    const cache = {
      match: vi.fn().mockResolvedValue(new Response("tampered")),
      delete: vi.fn().mockResolvedValue(true),
      put: vi.fn().mockResolvedValue(undefined),
    };
    vi.stubGlobal("caches", { open: vi.fn().mockResolvedValue(cache) });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("model", { status: 200 }),
    );

    const result = await fetchVerifiedModel(
      "/models/beetles.onnx",
      "9372c470eeadd5ecd9c3c74c2b3cb633f8e2f2fad799250a0f70d652b6b825e4",
    );

    expect(new TextDecoder().decode(result)).toBe("model");
    expect(cache.delete).toHaveBeenCalledWith("/models/beetles.onnx");
    expect(cache.put).toHaveBeenCalledOnce();
  });
});
