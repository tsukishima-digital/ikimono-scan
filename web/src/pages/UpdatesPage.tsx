import { SiteHeader } from "../components/SiteHeader";

export function UpdatesPage() {
  return (
    <div className="document-shell">
      <SiteHeader />
      <main className="document-page updates-page">
        <header className="document-intro compact">
          <p className="kicker">UPDATES</p>
          <h1>更新履歴</h1>
          <p>アプリと判定モデルの変更を記録します。</p>
        </header>

        <ol className="updates-list">
          <li>
            <div className="update-meta">
              <strong>v0.1.0</strong>
              <time dateTime="2026-08">2026年8月</time>
            </div>
            <div>
              <h2>甲虫分類MVP</h2>
              <ul>
                <li>カメラと端末内画像から甲虫を分類</li>
                <li>クビアカツヤカミキリを重点対象として表示</li>
                <li>WebGPU対応端末ではWebGPU、その他はWASMで推論</li>
              </ul>
            </div>
          </li>
        </ol>
      </main>
      <footer className="document-footer">生き物スキャン — 月島デジタル</footer>
    </div>
  );
}
