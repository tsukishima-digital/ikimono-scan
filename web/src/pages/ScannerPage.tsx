import { useEffect, useRef, useState } from "react";

import { SiteHeader } from "../components/SiteHeader";
import { createClassifier } from "../inference/classifier";
import type {
  ClassificationResult,
  Classifier,
} from "../inference/types";
import { captureVideoFrame } from "../camera/captureVideoFrame";

const TARGET_SCIENTIFIC_NAME = "Aromia bungii";
const ENVIRONMENT_MINISTRY_URL =
  "https://www.env.go.jp/nature/intro/4document/species/kubiaka.html";

type SourceMode = "camera" | "library";
type CameraStatus = "requesting" | "active" | "denied" | "unavailable";
type Phase = "idle" | "loading-model" | "classifying" | "complete" | "error";

const CAMERA_FALLBACK_MESSAGE =
  "カメラを利用できないため、写真から選んでください。";

export function ScannerPage() {
  const classifier = useRef<Promise<Classifier> | null>(null);
  const objectUrl = useRef<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraSupported = Boolean(navigator.mediaDevices?.getUserMedia);
  const [sourceMode, setSourceMode] = useState<SourceMode>(
    cameraSupported ? "camera" : "library",
  );
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>(
    cameraSupported ? "requesting" : "unavailable",
  );
  const [cameraMessage, setCameraMessage] = useState<string | undefined>(
    cameraSupported ? undefined : CAMERA_FALLBACK_MESSAGE,
  );
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<ClassificationResult>();
  const [error, setError] = useState<string>();

  const cameraEnabled = sourceMode === "camera" && !previewUrl;

  useEffect(() => {
    if (!cameraEnabled) {
      stopCamera(streamRef);
      return;
    }

    let cancelled = false;
    void navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraStatus("active");
      })
      .catch(() => {
        if (cancelled) return;
        setCameraStatus("denied");
        setCameraMessage(CAMERA_FALLBACK_MESSAGE);
        setSourceMode("library");
      });

    return () => {
      cancelled = true;
      stopCamera(streamRef);
    };
  }, [cameraEnabled]);

  useEffect(
    () => () => {
      stopCamera(streamRef);
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

  async function capturePhoto() {
    if (!videoRef.current) return;
    try {
      await handleFile(await captureVideoFrame(videoRef.current));
    } catch (caught) {
      setPhase("error");
      setError(
        caught instanceof Error ? caught.message : "写真を撮影できませんでした。",
      );
    }
  }

  function resetScanner() {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
    setPreviewUrl(undefined);
    setResult(undefined);
    setError(undefined);
    setPhase("idle");
    if (sourceMode === "camera") setCameraStatus("requesting");
  }

  function switchSource(mode: SourceMode) {
    resetScanner();
    if (mode === "camera" && !navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("unavailable");
      setCameraMessage(CAMERA_FALLBACK_MESSAGE);
      setSourceMode("library");
      return;
    }
    setCameraStatus("requesting");
    setCameraMessage(undefined);
    setSourceMode(mode);
  }

  return (
    <main className="scanner-page">
      <SiteHeader overlay />
      <section className="capture-workspace" aria-label="生き物を撮影して判定">
        <div className="capture-tabs" role="tablist" aria-label="写真の入力方法">
          <button
            type="button"
            role="tab"
            aria-selected={sourceMode === "camera"}
            onClick={() => switchSource("camera")}
          >
            撮影
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={sourceMode === "library"}
            onClick={() => switchSource("library")}
          >
            写真から
          </button>
        </div>

        <div className={previewUrl ? "capture-stage has-photo" : "capture-stage"}>
          {previewUrl ? (
            <img src={previewUrl} alt="判定する写真" />
          ) : sourceMode === "camera" ? (
            <>
              <video
                ref={videoRef}
                aria-label="カメラ映像"
                autoPlay
                muted
                playsInline
              />
              {cameraStatus === "requesting" && (
                <div className="camera-status" aria-live="polite">
                  <span className="spinner light" aria-hidden="true" />
                  <strong>カメラを準備しています</strong>
                </div>
              )}
            </>
          ) : (
            <label className="library-picker">
              <input
                type="file"
                aria-label="写真を選ぶ"
                accept="image/*"
                onChange={(event) => void handleFile(event.target.files?.[0])}
              />
              <span className="library-icon" aria-hidden="true">▧</span>
              <strong>写真を選ぶ</strong>
              <small>JPEG・PNG・WebP</small>
            </label>
          )}

          {!previewUrl && cameraMessage && sourceMode === "library" && (
            <p className="camera-fallback" role="status">{cameraMessage}</p>
          )}

          {!previewUrl && sourceMode === "camera" && (
            <div className="capture-controls">
              <p>虫が大きく、明るく写るように近づけてください</p>
              <button
                className="shutter"
                type="button"
                aria-label="撮影する"
                disabled={cameraStatus !== "active"}
                onClick={() => void capturePhoto()}
              >
                <span />
              </button>
              <span className="privacy-chip">写真は端末内で処理</span>
            </div>
          )}
        </div>

        {(previewUrl || phase === "error") && (
          <ResultSheet
            phase={phase}
            result={result}
            error={error}
            onReset={resetScanner}
          />
        )}
      </section>
    </main>
  );
}

function ResultSheet({
  phase,
  result,
  error,
  onReset,
}: {
  phase: Phase;
  result?: ClassificationResult;
  error?: string;
  onReset: () => void;
}) {
  const topPrediction = result?.predictions[0];
  const isTarget =
    topPrediction?.classInfo.scientificName === TARGET_SCIENTIFIC_NAME;

  return (
    <aside className="result-sheet" aria-live="polite">
      <div className="sheet-handle" aria-hidden="true" />
      {(phase === "loading-model" || phase === "classifying") && (
        <div className="loading-result">
          <span className="spinner" aria-hidden="true" />
          <div>
            <strong>
              {phase === "loading-model"
                ? "判定モデルを準備しています"
                : "写真を判定しています"}
            </strong>
            <p>
              {phase === "loading-model"
                ? "初回だけモデルを端末に保存します。"
                : "写真は端末の外へ送信しません。"}
            </p>
          </div>
        </div>
      )}

      {phase === "error" && (
        <div className="error-result" role="alert">
          <p className="result-eyebrow">判定できませんでした</p>
          <strong>{error}</strong>
          <button type="button" onClick={onReset}>撮り直す</button>
        </div>
      )}

      {phase === "complete" && topPrediction && (
        <div className={isTarget ? "result-content target" : "result-content"}>
          <p className="result-eyebrow">判定結果</p>
          <div className="result-name">
            <div>
              <h1>
                {topPrediction.classInfo.commonName ??
                  topPrediction.classInfo.scientificName}
              </h1>
              <p>{topPrediction.classInfo.scientificName}</p>
            </div>
            <strong>{Math.round(topPrediction.confidence * 100)}<small>%</small></strong>
          </div>

          {isTarget && (
            <div className="legal-status">
              <span>特定外来生物</span>
              <p>
                クビアカツヤカミキリの可能性があります。
                生体を持ち運ばず、最新情報を確認してください。
              </p>
              <a href={ENVIRONMENT_MINISTRY_URL} target="_blank" rel="noreferrer">
                環境省の情報を見る <span aria-hidden="true">↗</span>
              </a>
            </div>
          )}

          {result.predictions.length > 1 && (
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
          )}

          <div className="result-actions">
            <button type="button" onClick={onReset}>撮り直す</button>
            <span>
              {result.executionProvider === "webgpu" ? "WebGPU" : "WASM"}
              で端末内判定
            </span>
          </div>
        </div>
      )}
    </aside>
  );
}

function stopCamera(streamRef: { current: MediaStream | null }) {
  streamRef.current?.getTracks().forEach((track) => track.stop());
  streamRef.current = null;
}
