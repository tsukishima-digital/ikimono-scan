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
