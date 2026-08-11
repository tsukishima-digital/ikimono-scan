import { ContentPageLayout } from "../components/ContentPageLayout";

export function UpdatesPage({ onStartScanner }: { onStartScanner: () => void }) {
  return (
    <ContentPageLayout
      currentPage="changelog"
      eyebrow="CHANGELOG"
      onStartScanner={onStartScanner}
      title="Changelog"
    >
      <ol className="m-0 list-none p-0 pb-[120px]">
        <li className="grid grid-cols-[220px_minmax(0,1fr)] gap-8 border-t border-line py-[46px] max-[720px]:grid-cols-1 max-[720px]:gap-[22px]">
          <div className="flex flex-col gap-2">
            <strong className="text-lg text-brand">v0.1.0</strong>
            <time className="text-xs text-muted" dateTime="2026-08">
              2026年8月
            </time>
          </div>
          <div>
            <h2 className="m-0 font-mincho text-3xl">甲虫分類機能の実装</h2>
            <ul className="mt-5 list-disc pl-[1.4em] leading-8 text-muted">
              <li>カメラ撮影と端末内写真からの甲虫判定</li>
              <li>日本で観察された甲虫422種への対応</li>
              <li>クビアカツヤカミキリの特定外来生物表示</li>
              <li>
                判定モデル読込後のオフライン判定（ページを開いている間）
              </li>
            </ul>
          </div>
        </li>
      </ol>
    </ContentPageLayout>
  );
}
