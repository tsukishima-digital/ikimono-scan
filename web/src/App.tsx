import { useEffect, useRef, useState } from "react";

import { createClassifier } from "./inference/classifier";
import type {
  ClassificationResult,
  Classifier,
} from "./inference/types";
import "./App.css";

const TARGET_SCIENTIFIC_NAME = "Aromia bungii";
const ENVIRONMENT_MINISTRY_URL =
  "https://www.env.go.jp/nature/intro/4document/species/kubiaka.html";

type Phase = "idle" | "loading-model" | "classifying" | "complete" | "error";

export default function App() {
  const classifier = useRef<Promise<Classifier> | null>(null);
  const objectUrl = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [fileName, setFileName] = useState<string>();
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<ClassificationResult>();
  const [error, setError] = useState<string>();

  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    [],
  );

  async function handleFile(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhase("error");
      setError("画像ファイルを選んでください。");
      return;
    }

    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = URL.createObjectURL(file);
    setPreviewUrl(objectUrl.current);
    setFileName(file.name);
    setResult(undefined);
    setError(undefined);

    try {
      if (!classifier.current) {
        setPhase("loading-model");
        classifier.current = createClassifier();
      }
      const loadedClassifier = await classifier.current;
      setPhase("classifying");
      setResult(await loadedClassifier.classify(file));
      setPhase("complete");
    } catch (caught) {
      classifier.current = null;
      setPhase("error");
      setError(
        caught instanceof Error
          ? caught.message
          : "判定中に問題が発生しました。",
      );
    }
  }

  const topPrediction = result?.predictions[0];
  const isTarget =
    topPrediction?.classInfo.scientificName === TARGET_SCIENTIFIC_NAME;

  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="/" aria-label="生き物スキャン ホーム">
          <span className="mark" aria-hidden="true">生</span>
          生き物スキャン
        </a>
        <span className="scope-pill">甲虫版</span>
      </header>

      <section className="hero">
        <p className="eyebrow">写真で、甲虫の名前を調べる</p>
        <h1>その虫、<br /><em>なんだろう。</em></h1>
        <p className="lead">
          写真は外部へ送信しません。判定モデルを端末に読み込み、
          ブラウザの中だけで分類します。
        </p>
      </section>

      <section className="scanner" aria-labelledby="scanner-title">
        <div className="scanner-heading">
          <div>
            <p className="step">01</p>
            <h2 id="scanner-title">写真を選ぶ</h2>
          </div>
          <p>甲虫が大きく、明るく写った写真がおすすめです。</p>
        </div>

        <label className={previewUrl ? "drop-zone has-preview" : "drop-zone"}>
          <input
            type="file"
            aria-label="カメラを起動・画像を選択"
            accept="image/*"
            capture="environment"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
          {previewUrl ? (
            <>
              <img src={previewUrl} alt="判定する画像のプレビュー" />
              <span className="replace">別の写真を選ぶ</span>
            </>
          ) : (
            <span className="drop-content">
              <span className="camera-icon" aria-hidden="true">⌾</span>
              <strong>カメラを起動・画像を選択</strong>
              <small>JPEG・PNG・WebP</small>
            </span>
          )}
        </label>
        {fileName && <p className="filename">{fileName}</p>}

        <div className="result-region" aria-live="polite">
          {(phase === "loading-model" || phase === "classifying") && (
            <div className="loading-card">
              <span className="spinner" aria-hidden="true" />
              <div>
                <strong>
                  {phase === "loading-model"
                    ? "判定モデルを準備しています"
                    : "画像を判定しています"}
                </strong>
                <p>初回だけ少し時間がかかることがあります。</p>
              </div>
            </div>
          )}

          {phase === "error" && (
            <div className="error-card" role="alert">
              <strong>まだ判定できませんでした</strong>
              <p>{error}</p>
            </div>
          )}

          {phase === "complete" && topPrediction && (
            <article className={isTarget ? "result-card alert" : "result-card"}>
              <p className="result-label">判定結果</p>
              <div className="result-name">
                <div>
                  <h2>
                    {topPrediction.classInfo.commonName ??
                      topPrediction.classInfo.scientificName}
                  </h2>
                  <p>{topPrediction.classInfo.scientificName}</p>
                </div>
                <strong>
                  {Math.round(topPrediction.confidence * 100)}
                  <small>%</small>
                </strong>
              </div>

              {isTarget && (
                <div className="legal-status">
                  <span>特定外来生物</span>
                  <p>
                    クビアカツヤカミキリの可能性があります。
                    生体を持ち運ばず、最新情報を確認してください。
                  </p>
                  <a
                    href={ENVIRONMENT_MINISTRY_URL}
                    target="_blank"
                    rel="noreferrer"
                  >
                    環境省の情報を見る
                  </a>
                </div>
              )}

              <details>
                <summary>ほかの候補</summary>
                <ol>
                  {result.predictions.slice(1).map((prediction) => (
                    <li key={prediction.classInfo.id}>
                      <span>
                        {prediction.classInfo.commonName ??
                          prediction.classInfo.scientificName}
                      </span>
                      <span>{Math.round(prediction.confidence * 100)}%</span>
                    </li>
                  ))}
                </ol>
              </details>
              <p className="runtime">
                {result.executionProvider === "webgpu" ? "WebGPU" : "WASM"}
                で端末内判定
              </p>
            </article>
          )}
        </div>
      </section>

      <section className="scope" aria-labelledby="scope-title">
        <p className="step">02</p>
        <h2 id="scope-title">この版でわかること</h2>
        <div className="scope-grid">
          <div>
            <strong>日本の甲虫</strong>
            <p>
              現在は甲虫の分類に限定しています。甲虫以外は正しく判定できません。
            </p>
          </div>
          <div>
            <strong>クビアカに重点</strong>
            <p>
              クビアカツヤカミキリを重点対象として、似た甲虫と比較します。
            </p>
          </div>
          <div>
            <strong>参考情報</strong>
            <p>
              判定は専門家による同定ではありません。防除などの判断は公的情報を確認してください。
            </p>
          </div>
        </div>
      </section>

      <footer>
        <p>生き物スキャン — 月島デジタル</p>
        <a href="https://github.com/tsukishima-digital/ikimono-scan">
          GitHubでソースを見る
        </a>
      </footer>
    </main>
  );
}
