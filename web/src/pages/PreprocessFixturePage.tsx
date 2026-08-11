import { useState } from "react";

import { imageFileToNchw } from "../inference/preprocess";

const IMAGE_SIZE = 12;
const MEAN = [0.485, 0.456, 0.406] as const;
const STANDARD_DEVIATION = [0.229, 0.224, 0.225] as const;

export function PreprocessFixturePage() {
  const [signature, setSignature] = useState("");
  const [error, setError] = useState<string>();

  async function preprocess(file?: File) {
    if (!file) return;
    setSignature("");
    setError(undefined);
    try {
      const input = await imageFileToNchw(file, IMAGE_SIZE);
      setSignature(cornerSignature(input));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "前処理に失敗しました。");
    }
  }

  return (
    <main>
      <h1>Image preprocessing fixture</h1>
      <label>
        前処理する写真
        <input
          aria-label="前処理する写真"
          type="file"
          onChange={(event) => void preprocess(event.target.files?.[0])}
        />
      </label>
      {signature && <p>処理できました</p>}
      <output aria-label="前処理結果">{signature}</output>
      {error && <p role="alert">{error}</p>}
    </main>
  );
}

function cornerSignature(input: Float32Array): string {
  const corners = [
    [1, 1],
    [IMAGE_SIZE - 2, 1],
    [1, IMAGE_SIZE - 2],
    [IMAGE_SIZE - 2, IMAGE_SIZE - 2],
  ] as const;
  const pixelCount = IMAGE_SIZE * IMAGE_SIZE;

  return corners
    .map(([x, y]) => {
      const pixel = y * IMAGE_SIZE + x;
      const channels = MEAN.map(
        (mean, channel) =>
          input[channel * pixelCount + pixel] * STANDARD_DEVIATION[channel] +
          mean,
      );
      const dominant = channels.indexOf(Math.max(...channels));
      return (["red", "green", "blue"] as const)[dominant];
    })
    .join(",");
}
