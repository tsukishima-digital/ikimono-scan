import { SiteHeader } from "../components/SiteHeader";

export function UpdatesPage() {
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <SiteHeader />
      <main className="mx-auto w-[min(1040px,calc(100%_-_48px))] max-[720px]:w-[min(1040px,calc(100%_-_36px))]">
        <header className="grid grid-cols-1 gap-x-12 gap-y-6 py-[92px] pb-16 max-[720px]:py-16 max-[720px]:pb-[58px]">
          <p className="m-0 text-[11px] font-[850] tracking-[0.17em] text-brand uppercase">
            UPDATES
          </p>
          <h1 className="m-0 font-mincho text-[clamp(48px,7vw,72px)] leading-[1.07] font-[550] tracking-[-0.06em]">
            更新履歴
          </h1>
          <p className="mb-1.5 text-[15px] leading-[1.9] text-muted">
            アプリと判定モデルの変更を記録します。
          </p>
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
              <h2 className="m-0 font-mincho text-3xl">甲虫分類MVP</h2>
              <ul className="mt-5 list-disc pl-[1.4em] leading-8 text-muted">
                <li>カメラと端末内画像から甲虫を分類</li>
                <li>クビアカツヤカミキリを重点対象として表示</li>
                <li>WebGPU対応端末ではWebGPU、その他はWASMで推論</li>
              </ul>
            </div>
          </li>
        </ol>
      </main>
      <footer className="mx-auto flex min-h-[100px] w-[min(1040px,calc(100%_-_48px))] items-center border-t border-line text-xs text-muted max-[720px]:w-[min(1040px,calc(100%_-_36px))]">
        生き物スキャン — 月島デジタル
      </footer>
    </div>
  );
}
