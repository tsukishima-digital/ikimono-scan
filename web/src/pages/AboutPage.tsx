import { SiteHeader } from "../components/SiteHeader";
import { specimenPhotos } from "../content/specimen-gallery";

export function AboutPage() {
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <SiteHeader />
      <main className="mx-auto w-[min(1040px,calc(100%_-_48px))] pt-[78px] max-[720px]:w-[min(1040px,calc(100%_-_36px))] max-[720px]:pt-[68px]">
        <header className="py-[92px] pb-[86px] max-[720px]:py-16 max-[720px]:pb-[58px]">
          <p className="m-0 text-[11px] font-[850] tracking-[0.17em] text-brand uppercase">
            ABOUT
          </p>
          <h1 className="mt-6 mb-0 max-w-[880px] font-mincho text-[clamp(42px,6vw,68px)] leading-[1.1] font-[550] tracking-[-0.055em] max-[720px]:text-[clamp(32px,10vw,42px)]">
            生き物スキャンは、
            <br />
            生物の写真を分類できます。
          </h1>
        </header>

        <section
          className="border-t border-line py-16 max-[720px]:py-11"
          aria-labelledby="supported-title"
        >
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

          <div className="mt-12 grid grid-cols-3 gap-4 max-[720px]:grid-cols-1 max-[720px]:gap-6">
            {specimenPhotos.map((specimen) => (
              <figure
                className="m-0 overflow-hidden rounded-[22px] bg-card shadow-[0_12px_36px_rgb(20_38_26/8%)]"
                key={specimen.scientificName}
              >
                <img
                  className="aspect-[4/3] w-full bg-[#dfe5d8] object-cover"
                  src={specimen.photoUrl}
                  alt={`${specimen.commonName}の観察写真`}
                  loading="lazy"
                />
                <figcaption className="p-5">
                  {specimen.priority && (
                    <span className="mb-3 inline-block rounded-full bg-danger/10 px-2.5 py-1 text-[10px] font-extrabold tracking-[0.08em] text-danger">
                      重点対象
                    </span>
                  )}
                  <strong className="block text-[16px]">
                    {specimen.commonName}
                  </strong>
                  <em className="mt-1 block text-xs text-muted">
                    {specimen.scientificName}
                  </em>
                  <p className="mt-4 text-[11px] leading-[1.7] text-muted">
                    写真: {specimen.attribution} /{" "}
                    <a
                      className="underline underline-offset-2"
                      href={specimen.licenseUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {specimen.license}
                    </a>
                  </p>
                  <a
                    className="mt-3 inline-block text-xs font-bold text-brand underline-offset-4 hover:underline focus-visible:underline"
                    href={`https://www.inaturalist.org/observations/${specimen.observationId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    iNaturalistで見る <span aria-hidden="true">↗</span>
                  </a>
                </figcaption>
              </figure>
            ))}
          </div>

          <div className="mt-10 rounded-[18px] bg-[#e8edde] p-6">
            <strong>判定結果について</strong>
            <p className="mt-2.5 text-sm leading-[1.8] text-muted">
              判定は専門家による同定ではありません。甲虫以外の写真や、暗い・小さい写真では
              正しく判定できないことがあります。防除などの判断には公的情報を確認してください。
            </p>
          </div>
        </section>
      </main>
      <footer className="mx-auto flex min-h-[100px] w-[min(1040px,calc(100%_-_48px))] items-center border-t border-line text-xs text-muted max-[720px]:w-[min(1040px,calc(100%_-_36px))]">
        生き物スキャン
      </footer>
    </div>
  );
}
