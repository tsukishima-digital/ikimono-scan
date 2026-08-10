import { useEffect, useRef, useState } from "react";

import { SiteHeader } from "../components/SiteHeader";
import externalLinks from "../content/external-links.json";
import { createClassifier } from "../inference/classifier";
import type { ClassificationResult, Classifier } from "../inference/types";
import {
  formatConfidencePercentage,
  visibleAlternativePredictions,
} from "../results/presentation";
import { captureVideoFrame } from "../camera/captureVideoFrame";

const TARGET_SCIENTIFIC_NAME = "Aromia bungii";

type SourceMode = "camera" | "library";
type CameraStatus = "requesting" | "active" | "denied" | "unavailable";
export type ResultPhase =
  | "idle"
  | "loading-model"
  | "classifying"
  | "complete"
  | "error";

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
  const [phase, setPhase] = useState<ResultPhase>("idle");
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
        caught instanceof Error
          ? caught.message
          : "写真を撮影できませんでした。",
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
    <main className="min-h-dvh bg-[#09100c] text-white">
      <SiteHeader overlay />
      <section
        className="relative min-h-dvh w-full overflow-hidden bg-[#09100c]"
        aria-label="生き物を撮影して判定"
      >
        <div
          className="absolute top-[calc(84px+env(safe-area-inset-top))] left-1/2 z-12 flex -translate-x-1/2 rounded-full border border-white/16 bg-[rgb(8_16_11/58%)] p-1 backdrop-blur-[20px] backdrop-saturate-140 max-[720px]:top-[calc(70px+env(safe-area-inset-top))] [@media(prefers-contrast:more)]:border-2 [@media(prefers-contrast:more)]:border-current [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none"
          role="tablist"
          aria-label="写真の入力方法"
        >
          <button
            className="min-w-[108px] cursor-pointer rounded-full border-0 bg-transparent px-[18px] py-2.5 text-sm font-[750] text-white/68 transition-[color,background,transform] duration-150 ease-out active:scale-[0.97] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-lime aria-selected:bg-white/94 aria-selected:text-ink aria-selected:shadow-[0_4px_18px_rgb(0_0_0/18%)] max-[720px]:min-w-[94px] max-[720px]:px-3.5 max-[720px]:py-[9px]"
            type="button"
            role="tab"
            aria-selected={sourceMode === "camera"}
            onClick={() => switchSource("camera")}
          >
            撮影
          </button>
          <button
            className="min-w-[108px] cursor-pointer rounded-full border-0 bg-transparent px-[18px] py-2.5 text-sm font-[750] text-white/68 transition-[color,background,transform] duration-150 ease-out active:scale-[0.97] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-lime aria-selected:bg-white/94 aria-selected:text-ink aria-selected:shadow-[0_4px_18px_rgb(0_0_0/18%)] max-[720px]:min-w-[94px] max-[720px]:px-3.5 max-[720px]:py-[9px]"
            type="button"
            role="tab"
            aria-selected={sourceMode === "library"}
            onClick={() => switchSource("library")}
          >
            写真
          </button>
        </div>

        <div className="absolute inset-0 grid place-items-center overflow-hidden bg-[radial-gradient(circle_at_50%_42%,#23342a_0,#0c1510_56%,#070c09_100%)] after:pointer-events-none after:absolute after:inset-0 after:bg-[linear-gradient(to_bottom,rgb(0_0_0/28%),transparent_26%),linear-gradient(to_top,rgb(0_0_0/52%),transparent_32%)] after:content-['']">
          {previewUrl ? (
            <img
              className="size-full bg-[#070c09] object-cover"
              src={previewUrl}
              alt="判定する写真"
            />
          ) : sourceMode === "camera" ? (
            <>
              <video
                className="size-full object-cover"
                ref={videoRef}
                aria-label="カメラ映像"
                autoPlay
                muted
                playsInline
              />
              {cameraStatus === "requesting" && (
                <div
                  className="absolute z-2 flex items-center gap-3 rounded-full border border-white/12 bg-[rgb(3_8_5/58%)] px-[18px] py-[13px] text-sm backdrop-blur-[18px]"
                  aria-live="polite"
                >
                  <span
                    className="size-5 shrink-0 animate-spin rounded-full border-3 border-white/28 border-t-white"
                    aria-hidden="true"
                  />
                  <strong>カメラを準備しています</strong>
                </div>
              )}
            </>
          ) : (
            <label className="relative z-2 grid min-h-[300px] w-[min(460px,calc(100%_-_40px))] cursor-pointer content-center justify-items-center gap-2.5 rounded-[28px] border border-dashed border-white/34 bg-white/7 text-white transition-[background,border-color,transform] duration-150 ease-out hover:border-lime hover:bg-white/11 active:scale-[0.97] focus-within:outline-3 focus-within:outline-offset-4 focus-within:outline-lime max-[720px]:min-h-[260px]">
              <input
                className="absolute size-px opacity-0"
                type="file"
                aria-label="写真を選ぶ"
                accept="image/*"
                onChange={(event) => void handleFile(event.target.files?.[0])}
              />
              <span
                className="mb-2 grid size-16 place-items-center rounded-[21px] bg-lime text-[32px] text-brand-dark"
                aria-hidden="true"
              >
                ▧
              </span>
              <strong className="text-xl">写真を選ぶ</strong>
              <small className="text-white/58">JPEG・PNG・WebP</small>
            </label>
          )}

          {!previewUrl && cameraMessage && sourceMode === "library" && (
            <p
              className="absolute bottom-[30px] z-3 m-0 text-[13px] text-white/66 max-[720px]:right-6 max-[720px]:bottom-[calc(28px+env(safe-area-inset-bottom))] max-[720px]:left-6 max-[720px]:text-center"
              role="status"
            >
              {cameraMessage}
            </p>
          )}

          {!previewUrl && sourceMode === "camera" && (
            <div className="absolute right-0 bottom-[calc(24px+env(safe-area-inset-bottom))] left-0 z-4 grid grid-cols-[1fr_auto_1fr] items-end px-[max(30px,env(safe-area-inset-left))] max-[720px]:px-[18px]">
              <p className="m-0 max-w-[260px] text-[13px] leading-[1.6] text-white/76 max-[720px]:hidden">
                虫が大きく、明るく写るように近づけてください
              </p>
              <button
                className="grid size-[78px] cursor-pointer place-items-center rounded-full border-3 border-white bg-white/18 p-[5px] transition-[opacity,transform] duration-150 ease-out active:scale-[0.97] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-lime disabled:cursor-wait disabled:opacity-36 max-[720px]:col-start-2 max-[720px]:size-[72px]"
                type="button"
                aria-label="撮影する"
                disabled={cameraStatus !== "active"}
                onClick={() => void capturePhoto()}
              >
                <span className="size-[60px] rounded-full bg-white max-[720px]:size-[54px]" />
              </button>
            </div>
          )}
        </div>

        {(previewUrl || phase === "error") && (
          <ResultSheet
            phase={phase}
            result={result}
            error={error}
            resetLabel={sourceMode === "camera" ? "撮り直す" : "選び直す"}
            onReset={resetScanner}
          />
        )}
      </section>
    </main>
  );
}

export function ResultSheet({
  phase,
  result,
  error,
  resetLabel,
  onReset,
}: {
  phase: ResultPhase;
  result?: ClassificationResult;
  error?: string;
  resetLabel: "撮り直す" | "選び直す";
  onReset: () => void;
}) {
  const topPrediction = result?.predictions[0];
  const topPercentage = topPrediction
    ? formatConfidencePercentage(topPrediction.confidence)
    : undefined;
  const alternativePredictions = result
    ? visibleAlternativePredictions(result.predictions)
    : [];
  const isTarget =
    topPrediction?.classInfo.scientificName === TARGET_SCIENTIFIC_NAME;

  return (
    <aside
      className="animate-materialize absolute right-[max(24px,env(safe-area-inset-right))] bottom-[max(24px,env(safe-area-inset-bottom))] z-14 max-h-[calc(100dvh-130px)] w-[min(480px,calc(100%_-_48px))] overflow-auto rounded-[28px] border border-white/64 bg-card/94 text-ink shadow-[0_28px_90px_rgb(0_0_0/34%)] backdrop-blur-[30px] backdrop-saturate-150 max-[720px]:right-0 max-[720px]:bottom-0 max-[720px]:left-0 max-[720px]:max-h-[68dvh] max-[720px]:w-full max-[720px]:rounded-t-[28px] max-[720px]:rounded-b-none max-[720px]:border-x-0 max-[720px]:border-b-0 max-[720px]:pb-[env(safe-area-inset-bottom)] [@media(prefers-contrast:more)]:border-2 [@media(prefers-contrast:more)]:border-current [@media(prefers-reduced-transparency:reduce)]:bg-card [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none"
      aria-live="polite"
    >
      {(phase === "loading-model" || phase === "classifying") && (
        <div className="flex min-h-[210px] items-center gap-[18px] p-[34px] max-[720px]:p-6">
          <span
            className="size-7 shrink-0 animate-spin rounded-full border-3 border-[#c9d6c9] border-t-brand"
            aria-hidden="true"
          />
          <div>
            <strong className="text-lg">
              {phase === "loading-model"
                ? "判定モデルを準備しています"
                : "写真を判定しています"}
            </strong>
            <p className="mt-[7px] text-[13px] text-muted">
              {phase === "loading-model"
                ? "初回だけモデルを端末に保存します。"
                : "写真は端末の外へ送信しません。"}
            </p>
          </div>
        </div>
      )}

      {phase === "error" && (
        <div className="p-[30px] max-[720px]:p-6" role="alert">
          <p className="mb-3 text-[11px] font-[850] tracking-[0.17em] text-danger uppercase">
            判定できませんでした
          </p>
          <strong className="mb-6 block text-[17px] leading-normal">
            {error}
          </strong>
          <button
            className="cursor-pointer rounded-full border-0 bg-brand-dark px-[18px] py-[11px] font-extrabold text-white active:scale-[0.97] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-lime"
            type="button"
            onClick={onReset}
          >
            {resetLabel}
          </button>
        </div>
      )}

      {phase === "complete" && topPrediction && (
        <div className="p-[30px] max-[720px]:p-6">
          {!result.accepted ? (
            <>
              <p className="mb-3 text-[11px] font-[850] tracking-[0.17em] text-brand uppercase">
                判定結果
              </p>
              <h1 className="m-0 font-mincho text-[clamp(25px,4vw,36px)] leading-[1.25] font-semibold tracking-[-0.035em]">
                甲虫を判定できませんでした
              </h1>
              <p className="mt-3 text-sm leading-[1.7] text-muted">
                甲虫を画面いっぱいに、明るく写して撮り直してください。
              </p>
              <div className="mt-6">
                <button
                  className="cursor-pointer rounded-full border-0 bg-brand-dark px-[18px] py-[11px] font-extrabold text-white active:scale-[0.97] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-lime"
                  type="button"
                  onClick={onReset}
                >
                  {resetLabel}
                </button>
              </div>
            </>
          ) : (
            <>
              <p
                className={`mb-3 text-[11px] font-[850] tracking-[0.17em] uppercase ${isTarget ? "text-danger" : "text-brand"}`}
              >
                判定結果
              </p>
              <div className="flex items-start justify-between gap-5">
                <div>
                  <h1 className="m-0 font-mincho text-[clamp(28px,4vw,42px)] leading-[1.15] font-semibold tracking-[-0.045em] max-[720px]:text-[29px]">
                    {topPrediction.classInfo.commonName ??
                      topPrediction.classInfo.scientificName}
                  </h1>
                  <p className="mt-[7px] text-[13px] text-muted italic">
                    {topPrediction.classInfo.scientificName}
                  </p>
                </div>
                {topPercentage && (
                  <strong className="font-serif text-[44px] leading-none font-medium text-brand-dark max-[720px]:text-[38px]">
                    {topPercentage}
                    <small className="text-lg">%</small>
                  </strong>
                )}
              </div>

              {isTarget && (
                <div className="mt-6 rounded-2xl border border-danger/20 bg-[#fff1e8] p-[18px]">
                  <span className="inline-block rounded-[5px] bg-danger px-[9px] py-1 text-[11px] font-[850] text-white">
                    特定外来生物
                  </span>
                  <p className="my-3 text-sm leading-[1.65]">
                    クビアカツヤカミキリの可能性があります。
                    生体を持ち運ばず、最新情報を確認してください。
                  </p>
                  <a
                    className="text-[13px] font-extrabold text-danger"
                    href={externalLinks.environmentMinistryAromia}
                    target="_blank"
                    rel="noreferrer"
                  >
                    環境省の情報を見る <span aria-hidden="true">↗</span>
                  </a>
                </div>
              )}

              {alternativePredictions.length > 0 && (
                <details className="mt-5 border-t border-line">
                  <summary className="cursor-pointer px-0 pt-[17px] pb-1 text-[13px] font-extrabold">
                    ほかの候補
                  </summary>
                  <ol className="mt-[9px] list-none p-0">
                    {alternativePredictions.map((prediction) => (
                      <li
                        className="flex justify-between gap-[18px] py-[7px] text-[13px] text-muted"
                        key={prediction.classInfo.id}
                      >
                        <span>
                          {prediction.classInfo.commonName ??
                            prediction.classInfo.scientificName}
                        </span>
                        <span>
                          {formatConfidencePercentage(prediction.confidence)}%
                        </span>
                      </li>
                    ))}
                  </ol>
                </details>
              )}

              <div className="mt-6">
                <button
                  className="cursor-pointer rounded-full border-0 bg-brand-dark px-[18px] py-[11px] font-extrabold text-white active:scale-[0.97] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-lime"
                  type="button"
                  onClick={onReset}
                >
                  {resetLabel}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </aside>
  );
}

function stopCamera(streamRef: { current: MediaStream | null }) {
  streamRef.current?.getTracks().forEach((track) => track.stop());
  streamRef.current = null;
}
