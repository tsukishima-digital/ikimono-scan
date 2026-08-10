import { SiteHeader } from "../components/SiteHeader";

export function UpdatesPage() {
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <SiteHeader />
      <main className="mx-auto w-[min(1040px,calc(100%_-_48px))] pt-[78px] max-[720px]:w-[min(1040px,calc(100%_-_36px))] max-[720px]:pt-[68px]">
        <header className="grid grid-cols-1 gap-x-12 gap-y-6 py-[92px] pb-16 max-[720px]:py-16 max-[720px]:pb-[58px]">
          <p className="m-0 text-[11px] font-[850] tracking-[0.17em] text-brand uppercase">
            CHANGELOG
          </p>
          <h1 className="m-0 font-mincho text-[clamp(48px,7vw,72px)] leading-[1.07] font-[550] tracking-[-0.06em]">
            Changelog
          </h1>
        </header>

        <ol className="m-0 list-none p-0 pb-[120px]">
          <li className="grid grid-cols-[220px_minmax(0,1fr)] gap-8 border-t border-line py-[46px] max-[720px]:grid-cols-1 max-[720px]:gap-[22px]">
            <div className="flex flex-col gap-2">
              <strong className="text-lg text-brand">v0.1.0</strong>
              <time className="text-xs text-muted" dateTime="2026-08">
                2026年8月
              </time>
            </div>
            <div>
              <h2 className="m-0 font-mincho text-3xl">
                甲虫分類機能の実装
              </h2>
              <ul className="mt-5 list-disc pl-[1.4em] leading-8 text-muted">
                <li>カメラ撮影と端末内写真からの甲虫判定</li>
                <li>日本で観察された甲虫422種への対応</li>
                <li>クビアカツヤカミキリの重点対象表示</li>
                <li>
                  判定モデル読込後のオフライン判定（ページを開いている間）
                </li>
              </ul>
            </div>
          </li>
        </ol>
      </main>
      <footer className="mx-auto flex min-h-[100px] w-[min(1040px,calc(100%_-_48px))] items-center border-t border-line text-xs text-muted max-[720px]:w-[min(1040px,calc(100%_-_36px))]">
        生き物スキャン
      </footer>
    </div>
  );
}
