import { useEffect } from "react";

import { ContentPageLayout } from "../components/ContentPageLayout";
import { ModelCropFrame } from "../components/ModelCropFrame";
import {
  MODEL_CROP_MEDIA_CLASS,
  MODEL_CROP_MEDIA_STYLE,
} from "../components/modelCropPresentation";
import { photoGuideExample } from "../content/specimen-gallery";
import type { SourceMode } from "./ScannerPage";

const photoTips = [
  {
    title: "近づきすぎず、中央に",
    description:
      "虫全体が枠の半分から3分の2ほどを占める大きさを目安に、触角や脚まで収めます。",
  },
  {
    title: "明るく鮮明に",
    description: "模様と輪郭が見える明るさで、虫にピントを合わせます。",
  },
  {
    title: "全体を隠さない",
    description: "触角や脚までなるべく写し、葉や指で隠れない角度を選びます。",
  },
  {
    title: "1匹をそのまま",
    description: "複数の虫、強いフィルター、文字入れのある写真は避けます。",
  },
];

export function HowToPage({
  onStartScanner,
}: {
  onStartScanner: (mode: SourceMode) => void;
}) {
  useEffect(() => {
    if (!window.location.hash) return;
    const target = document.getElementById(window.location.hash.slice(1));
    if (!(target instanceof HTMLElement)) return;
    target.scrollIntoView?.({ block: "start", behavior: "auto" });
  }, []);

  return (
    <ContentPageLayout
      currentPage="how-to"
      description="撮影でも保存済みの写真でも、判定に向いた1枚を用意するポイントは同じです。"
      eyebrow="HOW TO USE"
      title="How to use"
    >
      <section
        className="scroll-mt-[78px] border-t border-line py-16 max-[720px]:scroll-mt-[68px] max-[720px]:py-12"
        id="photo-guide"
        aria-labelledby="photo-guide-title"
      >
        <p className="m-0 text-[11px] font-[850] tracking-[0.14em] text-brand uppercase">
          PHOTO GUIDE
        </p>
        <h2
          className="mt-4 mb-0 max-w-[760px] font-mincho text-[clamp(32px,5vw,48px)] leading-[1.25] font-semibold tracking-[-0.045em]"
          id="photo-guide-title"
        >
          判定しやすい写真を用意する
        </h2>
        <p className="mt-6 mb-0 max-w-[780px] text-[15px] leading-[1.9] text-muted">
          虫全体が中央に写り、模様や輪郭が明るく鮮明に見える写真は、より安定して判定できます。
          撮影する場合も保存済みの写真を選ぶ場合も、見本の画像を参考にしてください。
        </p>

        <div className="mt-10 grid grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] items-stretch gap-12 max-[760px]:grid-cols-1 max-[760px]:gap-9">
          <figure
            className="m-0 overflow-hidden rounded-[24px] bg-card shadow-[0_12px_36px_rgb(20_38_26/8%)]"
            data-testid="photo-guide-example"
          >
            <ModelCropFrame
              className="size-full bg-[#dfe5d8]"
              label="大きさの見本"
              testId="model-crop-example"
            >
              <img
                className={MODEL_CROP_MEDIA_CLASS}
                style={MODEL_CROP_MEDIA_STYLE}
                src={photoGuideExample.photoUrl}
                alt="判定しやすい写真の見本"
              />
            </ModelCropFrame>
          </figure>

          <ol
            className="m-0 grid list-none grid-rows-4 gap-3 p-0"
            aria-label="判定しやすい写真のポイント"
            data-testid="photo-guide-tips"
          >
            {photoTips.map((tip, index) => (
              <li
                className="grid grid-cols-[38px_1fr] content-center gap-4 rounded-[18px] bg-card p-5"
                key={tip.title}
              >
                <span
                  className="grid size-[38px] place-items-center rounded-full bg-[#e8edde] text-sm font-extrabold text-brand"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <div>
                  <strong className="block text-[15px]">{tip.title}</strong>
                  <p className="mt-1.5 mb-0 text-[13px] leading-[1.75] text-muted">
                    {tip.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-14 border-t border-line pt-12 max-[720px]:mt-11 max-[720px]:pt-10">
          <h3 className="m-0 font-mincho text-[clamp(26px,4vw,36px)] font-semibold tracking-[-0.04em]">
            写真を用意できたら
          </h3>
          <p className="mt-4 mb-0 max-w-[680px] text-[15px] leading-[1.9] text-muted">
            その場で撮影するか、端末に保存した写真を選んで判定します。
          </p>
          <div className="mt-8 grid max-w-[600px] grid-cols-2 gap-3 max-[620px]:grid-cols-1">
            <button
              className="how-to-action w-full"
              data-testid="how-to-action"
              type="button"
              onClick={() => onStartScanner("camera")}
            >
              カメラを開く
            </button>
            <button
              className="how-to-action w-full"
              data-testid="how-to-action"
              type="button"
              onClick={() => onStartScanner("library")}
            >
              写真から始める
            </button>
          </div>
        </div>
      </section>
    </ContentPageLayout>
  );
}
