import { useEffect } from "react";

import { ContentPageLayout } from "../components/ContentPageLayout";
import type { SourceMode } from "./ScannerPage";

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
      description="カメラで撮影するか、端末に保存した写真を選んで判定します。"
      eyebrow="HOW TO USE"
      onStartScanner={() => onStartScanner("camera")}
      title="How to use"
    >
      <nav
        className="grid grid-cols-2 gap-4 border-t border-line py-12 max-[620px]:grid-cols-1 max-[620px]:py-9"
        aria-label="使い方を選ぶ"
      >
        <a
          className="group flex min-h-[150px] flex-col justify-between rounded-[24px] bg-card p-6 no-underline shadow-[0_12px_36px_rgb(20_38_26/8%)] transition-transform duration-100 ease-out active:scale-[0.98] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-lime max-[620px]:min-h-[132px] max-[620px]:p-5"
          href="#camera"
          aria-label="カメラの使い方"
        >
          <span className="text-xs font-bold text-muted">その場で撮影</span>
          <strong className="flex items-end justify-between gap-4 font-mincho text-[26px] tracking-[-0.03em] max-[360px]:text-[23px]">
            カメラの使い方
            <span
              className="shrink-0 font-sans text-lg transition-transform group-hover:translate-y-1"
              aria-hidden="true"
            >
              ↓
            </span>
          </strong>
        </a>
        <a
          className="group flex min-h-[150px] flex-col justify-between rounded-[24px] bg-card p-6 no-underline shadow-[0_12px_36px_rgb(20_38_26/8%)] transition-transform duration-100 ease-out active:scale-[0.98] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-lime max-[620px]:min-h-[132px] max-[620px]:p-5"
          href="#photo"
          aria-label="写真の使い方"
        >
          <span className="text-xs font-bold text-muted">保存済みの画像</span>
          <strong className="flex items-end justify-between gap-4 font-mincho text-[26px] tracking-[-0.03em] max-[360px]:text-[23px]">
            写真の使い方
            <span
              className="shrink-0 font-sans text-lg transition-transform group-hover:translate-y-1"
              aria-hidden="true"
            >
              ↓
            </span>
          </strong>
        </a>
      </nav>

      <HowToSection
        eyebrow="CAMERA"
        id="camera"
        title="カメラで撮る"
        description="カメラの使用を許可し、虫が大きく明るく写るように近づけます。画面下の丸いボタンで撮影すると判定が始まります。"
        actionLabel="カメラを開く"
        onAction={() => onStartScanner("camera")}
      />
      <HowToSection
        eyebrow="PHOTO"
        id="photo"
        title="写真を選ぶ"
        description="端末に保存した写真から、虫が大きく明るく写っているものを選びます。選択するとそのまま判定が始まります。"
        actionLabel="写真から始める"
        onAction={() => onStartScanner("library")}
      />
    </ContentPageLayout>
  );
}

function HowToSection({
  actionLabel,
  description,
  eyebrow,
  id,
  onAction,
  title,
}: {
  actionLabel: string;
  description: string;
  eyebrow: string;
  id: string;
  onAction: () => void;
  title: string;
}) {
  const titleId = `${id}-title`;

  return (
    <section
      className="scroll-mt-[78px] border-t border-line py-16 max-[720px]:scroll-mt-[68px] max-[720px]:py-12"
      id={id}
      aria-labelledby={titleId}
    >
      <div className="grid grid-cols-[minmax(220px,0.72fr)_minmax(0,1fr)] gap-16 max-[720px]:grid-cols-1 max-[720px]:gap-8">
        <div>
          <p className="m-0 text-[11px] font-[850] tracking-[0.14em] text-brand uppercase">
            {eyebrow}
          </p>
          <h2
            className="mt-4 mb-0 font-mincho text-[clamp(32px,5vw,48px)] font-semibold tracking-[-0.045em]"
            id={titleId}
          >
            {title}
          </h2>
        </div>
        <div className="flex flex-col items-start gap-8">
          <p className="m-0 max-w-[620px] text-[15px] leading-[1.9] text-muted">
            {description}
          </p>
          <button
            className="how-to-action"
            data-testid="how-to-action"
            type="button"
            onClick={onAction}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </section>
  );
}
