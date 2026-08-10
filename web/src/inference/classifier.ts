import * as ort from "onnxruntime-web/webgpu";

import { imageFileToNchw } from "./preprocess";
import type {
  Classification,
  ClassificationResult,
  Classifier,
  ModelManifest,
} from "./types";

const DEFAULT_MANIFEST_URL = "/models/manifest.json";
const MODEL_CACHE_NAME = "ikimono-scan-models-v1";

export async function createClassifier(
  manifestUrl = DEFAULT_MANIFEST_URL,
): Promise<Classifier> {
  const manifest = await fetchModelManifest(manifestUrl);
  const model = await fetchVerifiedModel(manifest.modelUrl, manifest.sha256);
  const { session, executionProvider } = await createSession(model);
  const inputName = manifest.inputName ?? session.inputNames[0];
  const outputName = manifest.outputName ?? session.outputNames[0];

  if (!inputName || !outputName) {
    throw new Error("モデルの入出力情報を読み取れませんでした。");
  }

  return {
    async classify(file: File): Promise<ClassificationResult> {
      const input = await imageFileToNchw(file, manifest.imageSize);
      const tensor = new ort.Tensor("float32", input, [
        1,
        3,
        manifest.imageSize,
        manifest.imageSize,
      ]);
      const outputs = await session.run({ [inputName]: tensor });
      const logits = outputs[outputName]?.data;
      if (!logits || logits.length !== manifest.classes.length) {
        throw new Error("モデルの出力と分類ラベルが一致しません。");
      }

      const predictions = topK(Array.from(logits, Number), manifest.classes, 3);
      return {
        predictions,
        accepted: acceptsPrediction(predictions, manifest.minimumConfidence),
        executionProvider,
      };
    },
  };
}

export async function fetchModelManifest(url: string): Promise<ModelManifest> {
  const response = await fetch(url);
  if (
    !response.ok ||
    !response.headers.get("content-type")?.includes("application/json")
  ) {
    throw new Error("判定モデルを読み込めませんでした。");
  }
  let manifest: ModelManifest;
  try {
    manifest = (await response.json()) as ModelManifest;
  } catch {
    throw new Error("判定モデルの設定が不正です。");
  }
  if (
    !manifest.version ||
    !manifest.modelUrl ||
    !/^[a-f0-9]{64}$/i.test(manifest.sha256) ||
    !manifest.license ||
    !manifest.source ||
    !Number.isInteger(manifest.imageSize) ||
    manifest.imageSize <= 0 ||
    typeof manifest.minimumConfidence !== "number" ||
    manifest.minimumConfidence < 0 ||
    manifest.minimumConfidence > 1 ||
    !Array.isArray(manifest.classes) ||
    manifest.classes.length === 0
  ) {
    throw new Error("判定モデルの設定が不正です。");
  }
  return manifest;
}

export function acceptsPrediction(
  predictions: Classification[],
  minimumConfidence: number,
): boolean {
  return (predictions[0]?.confidence ?? 0) >= minimumConfidence;
}

export async function fetchVerifiedModel(
  modelUrl: string,
  expectedSha256: string,
): Promise<Uint8Array> {
  const cache = await openModelCache();
  if (cache) {
    const cachedResponse = await cache.match(modelUrl).catch(() => undefined);
    if (cachedResponse) {
      const cachedBytes = new Uint8Array(await cachedResponse.arrayBuffer());
      try {
        await verifySha256(cachedBytes, expectedSha256);
        return cachedBytes;
      } catch {
        await cache.delete(modelUrl).catch(() => false);
      }
    }
  }

  const response = await fetch(modelUrl);
  if (!response.ok) {
    throw new Error("判定モデルをダウンロードできませんでした。");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  await verifySha256(bytes, expectedSha256);
  if (cache) {
    const cacheBody = bytes.slice().buffer;
    await cache
      .put(
        modelUrl,
        new Response(cacheBody, {
          headers: { "content-type": "application/octet-stream" },
        }),
      )
      .catch(() => undefined);
  }
  return bytes;
}

async function openModelCache(): Promise<Cache | undefined> {
  if (!("caches" in globalThis)) return undefined;
  return caches.open(MODEL_CACHE_NAME).catch(() => undefined);
}

export async function verifySha256(
  bytes: Uint8Array,
  expectedSha256: string,
): Promise<void> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new Uint8Array(bytes).buffer,
  );
  const actualSha256 = Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  if (actualSha256 !== expectedSha256.toLowerCase()) {
    throw new Error("判定モデルの整合性を確認できませんでした。");
  }
}

async function createSession(model: Uint8Array): Promise<{
  session: ort.InferenceSession;
  executionProvider: "webgpu" | "wasm";
}> {
  if ("gpu" in navigator) {
    try {
      return {
        session: await ort.InferenceSession.create(model, {
          executionProviders: ["webgpu", "wasm"],
        }),
        executionProvider: "webgpu",
      };
    } catch {
      // WASM is the compatibility path for browsers whose WebGPU implementation
      // cannot execute every operator in the current model.
    }
  }

  return {
    session: await ort.InferenceSession.create(model, {
      executionProviders: ["wasm"],
    }),
    executionProvider: "wasm",
  };
}

export function topK(
  logits: number[],
  classes: ModelManifest["classes"],
  count: number,
): Classification[] {
  if (logits.length !== classes.length || logits.length === 0) {
    throw new Error("分類結果のサイズが不正です。");
  }

  const maxLogit = Math.max(...logits);
  const exponentials = logits.map((value) => Math.exp(value - maxLogit));
  const total = exponentials.reduce((sum, value) => sum + value, 0);

  return exponentials
    .map((value, index) => ({
      classInfo: classes[index],
      confidence: value / total,
    }))
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, Math.max(0, count));
}
