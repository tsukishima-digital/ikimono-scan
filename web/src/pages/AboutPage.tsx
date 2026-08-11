import { ContentPageLayout } from "../components/ContentPageLayout";
import { specimenPhotos } from "../content/specimen-gallery";

export function AboutPage() {
  return (
    <ContentPageLayout
      currentPage="about"
      eyebrow="ABOUT"
      title={
        <>
          生き物スキャンは、
          <br />
          生物の写真を分類できます。
        </>
      }
    >
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

          <ul
            className="mt-10 grid list-none grid-cols-2 gap-4 p-0"
            aria-label="判定対象の概要"
          >
            <li className="flex min-h-[140px] flex-col gap-5 rounded-[22px] bg-card p-6 shadow-[0_12px_36px_rgb(20_38_26/8%)] max-[720px]:min-h-[116px] max-[720px]:p-5">
              <span className="text-xs text-muted">現在の分類対象</span>
              <strong className="font-mincho text-[27px]">422種</strong>
            </li>
            <li className="flex min-h-[140px] flex-col gap-5 rounded-[22px] bg-card p-6 shadow-[0_12px_36px_rgb(20_38_26/8%)] max-[720px]:min-h-[116px] max-[720px]:p-5">
              <span className="text-xs text-muted">現在の対象グループ</span>
              <strong className="font-mincho text-[27px]">甲虫</strong>
            </li>
          </ul>

          <div
            className="mt-8 grid grid-cols-3 gap-4 max-[720px]:-mx-[18px] max-[720px]:grid-flow-col max-[720px]:grid-cols-none max-[720px]:auto-cols-[82%] max-[720px]:snap-x max-[720px]:snap-mandatory max-[720px]:overflow-x-auto max-[720px]:px-[18px] max-[720px]:pb-5 max-[720px]:[scrollbar-width:none] max-[720px]:[&::-webkit-scrollbar]:hidden"
            role="list"
            aria-label="判定対象の例"
          >
            {specimenPhotos.map((specimen) => (
              <figure
                className="m-0 overflow-hidden rounded-[22px] bg-card shadow-[0_12px_36px_rgb(20_38_26/8%)] max-[720px]:snap-start"
                key={specimen.scientificName}
                role="listitem"
              >
                <img
                  className="aspect-[4/3] w-full bg-[#dfe5d8] object-cover"
                  src={specimen.photoUrl}
                  alt={`${specimen.commonName}の観察写真`}
                  loading="lazy"
                />
                <figcaption className="p-5">
                  <div
                    className="mb-3 flex h-[25px] items-start"
                    data-testid="specimen-designation-slot"
                  >
                    {specimen.designation && (
                      <span className="inline-block rounded-full bg-danger/10 px-2.5 py-1 text-[10px] font-extrabold tracking-[0.08em] text-danger">
                        {specimen.designation}
                      </span>
                    )}
                  </div>
                  <strong
                    className="block text-[16px]"
                    data-testid="specimen-common-name"
                  >
                    {specimen.commonName}
                  </strong>
                  <em className="mt-1 block text-xs text-muted">
                    {specimen.scientificName}
                  </em>
                  <p
                    className="mt-4 text-[11px] leading-[1.7] text-muted"
                    data-testid="specimen-license"
                  >
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
          <p className="mt-2.5 text-sm leading-[1.8] text-muted-strong">
            判定は専門家による同定ではありません。甲虫以外の写真や、暗い・小さい写真では
            正しく判定できないことがあります。防除などの判断には公的情報を確認してください。
          </p>
        </div>
      </section>
    </ContentPageLayout>
  );
}
