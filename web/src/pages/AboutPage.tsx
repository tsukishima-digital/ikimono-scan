import { SiteHeader } from "../components/SiteHeader";
import externalLinks from "../content/external-links.json";

export function AboutPage() {
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <SiteHeader />
      <main className="mx-auto w-[min(1040px,calc(100%_-_48px))] max-[720px]:w-[min(1040px,calc(100%_-_36px))]">
        <header className="grid grid-cols-[minmax(0,1fr)_minmax(260px,320px)] items-end gap-x-12 gap-y-6 py-[92px] pb-[86px] max-[720px]:grid-cols-1 max-[720px]:py-16 max-[720px]:pb-[58px]">
          <p className="col-span-full m-0 text-[11px] font-[850] tracking-[0.17em] text-brand uppercase">
            ABOUT
          </p>
          <h1 className="m-0 whitespace-nowrap font-mincho text-[clamp(44px,6vw,70px)] leading-[1.07] font-[550] tracking-[-0.06em] max-[720px]:text-[clamp(32px,10vw,40px)]">
            身近な生き物を、
            <br />
            その場で調べる。
          </h1>
          <p className="mb-1.5 text-[15px] leading-[1.9] text-muted">
            生き物スキャンは、撮影した写真を端末内で分類する
            非営利のオープンソースWebアプリです。
          </p>
        </header>

        <section
          className="grid grid-cols-[120px_minmax(0,1fr)] gap-6 border-t border-line py-16 max-[720px]:grid-cols-1 max-[720px]:gap-2 max-[720px]:py-11"
          aria-labelledby="supported-title"
        >
          <p className="m-0 pt-[9px] text-[11px] font-[850] tracking-[0.17em] text-brand uppercase">
            01
          </p>
          <div>
            <h2
              className="m-0 font-mincho text-[clamp(30px,4vw,48px)] font-semibold tracking-[-0.04em]"
              id="supported-title"
            >
              現在判定できる生き物
            </h2>
            <p className="mt-5 max-w-[680px] text-base leading-[1.9] text-muted">
              現在は、日本で観察された甲虫422種を分類対象にしています。
              対象は今後、甲虫以外の生き物にも広げていきます。
            </p>
            <div className="mt-10 grid grid-cols-3 border-y border-line max-[720px]:grid-cols-1 [&>article+article]:border-l [&>article+article]:border-line max-[720px]:[&>article+article]:border-t max-[720px]:[&>article+article]:border-l-0">
              <article className="flex min-h-[140px] flex-col justify-between p-6 max-[720px]:min-h-[106px]">
                <strong className="font-mincho text-[27px]">422種</strong>
                <span className="text-xs text-muted">現在の分類対象</span>
              </article>
              <article className="flex min-h-[140px] flex-col justify-between p-6 max-[720px]:min-h-[106px]">
                <strong className="font-mincho text-[27px]">甲虫</strong>
                <span className="text-xs text-muted">現在の対象グループ</span>
              </article>
              <article className="flex min-h-[140px] flex-col justify-between p-6 max-[720px]:min-h-[106px]">
                <strong className="font-mincho text-[27px]">重点対象</strong>
                <span className="text-xs text-muted">クビアカツヤカミキリ</span>
              </article>
            </div>
            <div className="mt-7 rounded-[18px] bg-[#e8edde] p-6">
              <strong>判定結果について</strong>
              <p className="mt-2.5 text-sm leading-[1.8] text-muted">
                判定は専門家による同定ではありません。甲虫以外の写真や、暗い・小さい写真では
                正しく判定できないことがあります。防除などの判断には公的情報を確認してください。
              </p>
            </div>
          </div>
        </section>

        <section
          className="grid grid-cols-[120px_minmax(0,1fr)] gap-6 border-t border-line py-16 max-[720px]:grid-cols-1 max-[720px]:gap-2 max-[720px]:py-11"
          aria-labelledby="privacy-title"
        >
          <p className="m-0 pt-[9px] text-[11px] font-[850] tracking-[0.17em] text-brand uppercase">
            02
          </p>
          <div>
            <h2
              className="m-0 font-mincho text-[clamp(30px,4vw,48px)] font-semibold tracking-[-0.04em]"
              id="privacy-title"
            >
              写真は端末の外へ送りません
            </h2>
            <p className="mt-5 max-w-[680px] text-base leading-[1.9] text-muted">
              写真は外部へ送信しません。判定モデルをブラウザに保存し、
              WebGPUまたはWASMを使って端末内で処理します。
            </p>
          </div>
        </section>

        <section
          className="grid grid-cols-[120px_minmax(0,1fr)] gap-6 border-t border-line py-16 max-[720px]:grid-cols-1 max-[720px]:gap-2 max-[720px]:py-11"
          aria-labelledby="open-title"
        >
          <p className="m-0 pt-[9px] text-[11px] font-[850] tracking-[0.17em] text-brand uppercase">
            03
          </p>
          <div>
            <h2
              className="m-0 font-mincho text-[clamp(30px,4vw,48px)] font-semibold tracking-[-0.04em]"
              id="open-title"
            >
              非営利・オープンソース
            </h2>
            <p className="mt-5 max-w-[680px] text-base leading-[1.9] text-muted">
              公益に役立つ分類基盤を目指し、ソースコードと再現可能な学習手順を公開します。
            </p>
            <a
              className="mt-6 inline-block text-[13px] font-extrabold text-brand underline-offset-[5px] hover:underline focus-visible:underline"
              href={externalLinks.githubRepository}
            >
              GitHubでソースを見る <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>
      </main>
      <footer className="mx-auto flex min-h-[100px] w-[min(1040px,calc(100%_-_48px))] items-center border-t border-line text-xs text-muted max-[720px]:w-[min(1040px,calc(100%_-_36px))]">
        生き物スキャン — 月島デジタル
      </footer>
    </div>
  );
}
