import { AppLink } from "../components/AppLink";
import { ContentPageLayout } from "../components/ContentPageLayout";
import externalLinks from "../content/external-links.json";

export function HomePage() {
  return (
    <ContentPageLayout
      currentPage="home"
      description="見つけた生き物を写真に撮ると、名前の候補を端末内で調べられます。"
      eyebrow="IKIMONO SCAN"
      title="写真から、生き物を知る。"
    >
      <section
        className="border-t border-line py-16 max-[720px]:py-12"
        aria-labelledby="mission-title"
      >
        <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(280px,1.1fr)] gap-16 max-[760px]:grid-cols-1 max-[760px]:gap-8">
          <h2
            className="m-0 font-mincho text-[clamp(30px,4vw,48px)] leading-[1.3] font-semibold tracking-[-0.04em]"
            id="mission-title"
          >
            公益のために、
            <br />
            生き物を見分ける
          </h2>
          <div className="text-[15px] leading-[1.95] text-muted">
            <p className="m-0">
              生き物スキャンは、侵略的外来種の早期発見と、在来種の誤った駆除を減らすことを目指す、非営利のオープンソースプロジェクトです。
            </p>
            <p className="mt-5 mb-0">
              判定は専門家による同定ではありません。捕獲や防除を行う前に、自治体や国が公開する情報も確認してください。
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap gap-4">
          <AppLink
            className="inline-flex min-h-14 items-center justify-center rounded-full bg-brand-dark px-8 text-[16px] font-extrabold text-white no-underline shadow-[0_14px_32px_rgb(18_64_39/20%)] transition-[background,transform] duration-100 ease-out hover:bg-brand active:scale-[0.97] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-lime max-[520px]:w-full"
            href="/scan"
          >
            写真を判定する
          </AppLink>
          <AppLink
            className="inline-flex min-h-14 items-center justify-center rounded-full border border-brand-dark/20 bg-card px-8 text-[15px] font-extrabold text-brand-dark no-underline transition-[background,transform] duration-100 ease-out hover:bg-[#e8edde] active:scale-[0.97] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-lime max-[520px]:w-full"
            href="/supported-species"
          >
            判定できる生き物を見る
          </AppLink>
        </div>
      </section>

      <section
        className="grid grid-cols-2 gap-4 border-t border-line py-16 max-[680px]:grid-cols-1 max-[680px]:py-12"
        aria-label="生き物スキャンの特徴"
      >
        <article className="rounded-[22px] bg-card p-7 shadow-[0_12px_36px_rgb(20_38_26/8%)]">
          <p className="m-0 text-[11px] font-[850] tracking-[0.14em] text-brand uppercase">
            PRIVATE
          </p>
          <h2 className="mt-4 mb-0 font-mincho text-[28px] font-semibold tracking-[-0.035em]">
            写真は端末の中で判定
          </h2>
          <p className="mt-4 mb-0 text-sm leading-[1.85] text-muted">
            選んだ写真を判定のために外部へ送信しません。モデルを読み込み、ブラウザの中で処理します。
          </p>
        </article>
        <article className="rounded-[22px] bg-card p-7 shadow-[0_12px_36px_rgb(20_38_26/8%)]">
          <p className="m-0 text-[11px] font-[850] tracking-[0.14em] text-brand uppercase">
            OPEN
          </p>
          <h2 className="mt-4 mb-0 font-mincho text-[28px] font-semibold tracking-[-0.035em]">
            誰でも使える非営利OSS
          </h2>
          <p className="mt-4 mb-0 text-sm leading-[1.85] text-muted">
            対応する生き物を日本全体へ広げるため、開発内容を公開しています。
          </p>
          <a
            className="mt-5 inline-flex text-sm font-bold text-brand underline-offset-4 hover:underline focus-visible:underline"
            href={externalLinks.githubRepository}
            target="_blank"
            rel="noreferrer"
          >
            GitHubを見る <span aria-hidden="true">↗</span>
          </a>
        </article>
      </section>
    </ContentPageLayout>
  );
}
