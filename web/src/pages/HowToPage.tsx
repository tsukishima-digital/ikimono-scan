import { useEffect } from "react";

import { SiteHeader } from "../components/SiteHeader";
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
    <div className="min-h-dvh bg-paper text-ink">
      <SiteHeader />
      <main className="mx-auto w-[min(920px,calc(100%_-_48px))] pt-[78px] max-[720px]:w-[min(920px,calc(100%_-_36px))] max-[720px]:pt-[68px]">
        <header className="py-[88px] pb-14 max-[720px]:py-14 max-[720px]:pb-10">
          <p className="m-0 text-[11px] font-[850] tracking-[0.17em] text-brand uppercase">
            HOW TO USE
          </p>
          <h1 className="mt-6 mb-0 font-mincho text-[clamp(42px,7vw,68px)] leading-[1.06] font-[550] tracking-[-0.055em] max-[720px]:text-[clamp(36px,12vw,48px)]">
            How to use
          </h1>
          <p className="mt-6 max-w-[620px] text-base leading-[1.9] text-muted">
            カメラで撮影するか、端末に保存した写真を選んで判定します。
          </p>
        </header>

        <nav
          className="grid grid-cols-2 gap-4 border-t border-line py-12 max-[620px]:grid-cols-1 max-[620px]:py-9"
          aria-label="使い方を選ぶ"
        >
          <a
            className="group flex min-h-[150px] flex-col justify-between rounded-[24px] bg-card p-6 no-underline shadow-[0_12px_36px_rgb(20_38_26/8%)] transition-transform duration-100 ease-out active:scale-[0.98] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-lime"
            href="#camera"
            aria-label="カメラの使い方"
          >
            <span className="text-xs font-bold text-muted">その場で撮影</span>
            <strong className="flex items-end justify-between font-mincho text-[26px] tracking-[-0.03em]">
              カメラの使い方
              <span
                className="font-sans text-lg transition-transform group-hover:translate-y-1"
                aria-hidden="true"
              >
                ↓
              </span>
            </strong>
          </a>
          <a
            className="group flex min-h-[150px] flex-col justify-between rounded-[24px] bg-card p-6 no-underline shadow-[0_12px_36px_rgb(20_38_26/8%)] transition-transform duration-100 ease-out active:scale-[0.98] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-lime"
            href="#photo"
            aria-label="写真の使い方"
          >
            <span className="text-xs font-bold text-muted">保存済みの画像</span>
            <strong className="flex items-end justify-between font-mincho text-[26px] tracking-[-0.03em]">
              写真の使い方
              <span
                className="font-sans text-lg transition-transform group-hover:translate-y-1"
                aria-hidden="true"
              >
                ↓
              </span>
            </strong>
          </a>
        </nav>

        <section
          className="scroll-mt-[78px] border-t border-line py-16 max-[720px]:scroll-mt-[68px] max-[720px]:py-12"
          id="camera"
          aria-labelledby="camera-title"
        >
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(240px,0.68fr)] gap-16 max-[720px]:grid-cols-1 max-[720px]:gap-8">
            <div>
              <p className="m-0 text-[11px] font-[850] tracking-[0.14em] text-brand uppercase">
                CAMERA
              </p>
              <h2
                className="mt-4 mb-0 font-mincho text-[clamp(32px,5vw,48px)] font-semibold tracking-[-0.045em]"
                id="camera-title"
              >
                カメラで撮る
              </h2>
            </div>
            <div>
              <p className="m-0 text-[15px] leading-[1.9] text-muted">
                カメラの使用を許可し、虫が大きく明るく写るように近づけます。画面下の丸いボタンで撮影すると判定が始まります。
              </p>
              <button
                className="mt-8 inline-flex min-h-14 cursor-pointer items-center justify-center rounded-full border-0 bg-brand-dark px-7 text-[15px] font-extrabold text-white shadow-[0_14px_32px_rgb(18_64_39/18%)] transition-[background,transform] duration-100 ease-out hover:bg-brand active:scale-[0.97] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-lime max-[620px]:w-full"
                type="button"
                onClick={() => onStartScanner("camera")}
              >
                カメラを開く
              </button>
            </div>
          </div>
        </section>

        <section
          className="scroll-mt-[78px] border-t border-line py-16 max-[720px]:scroll-mt-[68px] max-[720px]:py-12"
          id="photo"
          aria-labelledby="photo-title"
        >
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(240px,0.68fr)] gap-16 max-[720px]:grid-cols-1 max-[720px]:gap-8">
            <div>
              <p className="m-0 text-[11px] font-[850] tracking-[0.14em] text-brand uppercase">
                PHOTO
              </p>
              <h2
                className="mt-4 mb-0 font-mincho text-[clamp(32px,5vw,48px)] font-semibold tracking-[-0.045em]"
                id="photo-title"
              >
                写真を選ぶ
              </h2>
            </div>
            <div>
              <p className="m-0 text-[15px] leading-[1.9] text-muted">
                端末に保存した写真から、虫が大きく明るく写っているものを選びます。選択するとそのまま判定が始まります。
              </p>
              <button
                className="mt-8 inline-flex min-h-14 cursor-pointer items-center justify-center rounded-full border-0 bg-brand-dark px-7 text-[15px] font-extrabold text-white shadow-[0_14px_32px_rgb(18_64_39/18%)] transition-[background,transform] duration-100 ease-out hover:bg-brand active:scale-[0.97] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-lime max-[620px]:w-full"
                type="button"
                onClick={() => onStartScanner("library")}
              >
                写真から始める
              </button>
            </div>
          </div>
        </section>
      </main>
      <footer className="mx-auto flex min-h-[100px] w-[min(920px,calc(100%_-_48px))] items-center border-t border-line text-xs text-muted max-[720px]:w-[min(920px,calc(100%_-_36px))]">
        生き物スキャン
      </footer>
    </div>
  );
}
