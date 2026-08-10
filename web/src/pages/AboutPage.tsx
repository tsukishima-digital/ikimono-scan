import { SiteHeader } from "../components/SiteHeader";

export function AboutPage() {
  return (
    <div className="document-shell">
      <SiteHeader />
      <main className="document-page">
        <header className="document-intro">
          <p className="kicker">ABOUT</p>
          <h1>身近な生き物を、<br />その場で調べる。</h1>
          <p>
            生き物スキャンは、撮影した写真を端末内で分類する
            非営利のオープンソースWebアプリです。
          </p>
        </header>

        <section className="document-section" aria-labelledby="supported-title">
          <p className="section-number">01</p>
          <div>
            <h2 id="supported-title">現在判定できる生き物</h2>
            <p className="section-lead">
              現在は、日本で観察された甲虫422種を分類対象にしています。
              対象は今後、甲虫以外の生き物にも広げていきます。
            </p>
            <div className="fact-grid">
              <article>
                <strong>422種</strong>
                <span>現在の分類対象</span>
              </article>
              <article>
                <strong>甲虫</strong>
                <span>現在の対象グループ</span>
              </article>
              <article>
                <strong>重点対象</strong>
                <span>クビアカツヤカミキリ</span>
              </article>
            </div>
            <div className="notice-card">
              <strong>判定結果について</strong>
              <p>
                判定は専門家による同定ではありません。甲虫以外の写真や、暗い・小さい写真では
                正しく判定できないことがあります。防除などの判断には公的情報を確認してください。
              </p>
            </div>
          </div>
        </section>

        <section className="document-section" aria-labelledby="privacy-title">
          <p className="section-number">02</p>
          <div>
            <h2 id="privacy-title">写真は端末の外へ送りません</h2>
            <p className="section-lead">
              写真は外部へ送信しません。判定モデルをブラウザに保存し、
              WebGPUまたはWASMを使って端末内で処理します。
            </p>
          </div>
        </section>

        <section className="document-section" aria-labelledby="open-title">
          <p className="section-number">03</p>
          <div>
            <h2 id="open-title">非営利・オープンソース</h2>
            <p className="section-lead">
              公益に役立つ分類基盤を目指し、ソースコードと再現可能な学習手順を公開します。
            </p>
            <a
              className="text-link"
              href="https://github.com/tsukishima-digital/ikimono-scan"
            >
              GitHubでソースを見る <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>
      </main>
      <footer className="document-footer">生き物スキャン — 月島デジタル</footer>
    </div>
  );
}
