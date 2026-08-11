import { useEffect, useMemo, useState } from "react";

import { ContentPageLayout } from "../components/ContentPageLayout";
import { SpeciesGallery } from "../components/SpeciesGallery";
import externalLinks from "../content/external-links.json";
import {
  photosRequiringAttribution,
  specimenPhotos,
} from "../content/specimen-gallery";
import { speciesPhotos } from "../content/species-photos";
import { fetchModelManifest } from "../inference/classifier";
import type { ModelClass, ModelManifest } from "../inference/types";

const japaneseNameCollator = new Intl.Collator("ja", {
  sensitivity: "base",
  usage: "sort",
});

interface PhotoCredit {
  commonName: string;
  sortName?: string;
  photo: {
    attribution: string;
    license: string;
    licenseUrl: string;
    photoId: number;
    sourcePhotoUrl: string;
  };
}

export function buildPhotoCredits(speciesClasses: ModelClass[]) {
  const creditsByPhotoId = new Map<number, PhotoCredit>();
  for (const specimen of photosRequiringAttribution) {
    creditsByPhotoId.set(specimen.photoId, {
      commonName: specimen.commonName,
      sortName: specimen.commonName,
      photo: specimen,
    });
  }
  for (const species of speciesClasses) {
    const photo = speciesPhotos[species.id];
    if (
      !photo ||
      photo.license === "CC0" ||
      creditsByPhotoId.has(photo.photoId)
    ) {
      continue;
    }
    creditsByPhotoId.set(photo.photoId, {
      commonName: species.commonName || species.scientificName,
      sortName: species.commonName,
      photo,
    });
  }
  return [...creditsByPhotoId.values()].sort((first, second) => {
    if (!first.sortName) {
      return second.sortName
        ? 1
        : first.commonName.localeCompare(second.commonName);
    }
    if (!second.sortName) return -1;
    return (
      japaneseNameCollator.compare(first.sortName, second.sortName) ||
      first.photo.photoId - second.photo.photoId
    );
  });
}

export function SupportedSpeciesPage() {
  const [manifest, setManifest] = useState<ModelManifest>();
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchModelManifest("/models/manifest.json")
      .then((value) => {
        if (!cancelled) setManifest(value);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedClasses = useMemo(
    () =>
      [...(manifest?.classes ?? [])].sort((first, second) => {
        if (!first.commonName) return second.commonName ? 1 : 0;
        if (!second.commonName) return -1;
        return japaneseNameCollator.compare(
          first.commonName,
          second.commonName,
        );
      }),
    [manifest],
  );

  const photoCredits = useMemo(
    () => buildPhotoCredits(sortedClasses),
    [sortedClasses],
  );

  return (
    <ContentPageLayout
      currentPage="supported-species"
      description="現在のモデルで判定候補として表示できる生き物を確認できます。対応範囲は段階的に広げていきます。"
      eyebrow="SUPPORTED SPECIES"
      title="判定できる生き物"
    >
      <section
        className="border-t border-line py-16 max-[720px]:py-11"
        aria-labelledby="supported-title"
      >
        <h2
          className="m-0 font-mincho text-[clamp(30px,4vw,48px)] font-semibold tracking-[-0.04em]"
          id="supported-title"
        >
          現在の対応範囲
        </h2>
        <p className="mt-5 max-w-[680px] text-base leading-[1.9] text-muted">
          現在は、日本で観察された甲虫を分類対象にしています。
          今後は甲虫に限らず、日本で観察される生き物へ広げていきます。
        </p>

        <ul
          className="mt-10 grid list-none grid-cols-2 gap-4 p-0"
          aria-label="判定対象の概要"
        >
          <li className="flex min-h-[140px] flex-col gap-5 rounded-[22px] bg-card p-6 shadow-[0_12px_36px_rgb(20_38_26/8%)] max-[720px]:min-h-[116px] max-[720px]:p-5">
            <span className="text-xs text-muted">現在の分類対象</span>
            <strong className="font-mincho text-[27px]">
              {manifest
                ? `${manifest.classes.length.toLocaleString("ja-JP")}種`
                : "—"}
            </strong>
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

        <section
          className="mt-16 border-t border-line pt-16 max-[720px]:mt-12 max-[720px]:pt-12"
          aria-labelledby="model-evaluation-title"
        >
          <h2
            className="m-0 font-mincho text-[clamp(30px,4vw,44px)] font-semibold tracking-[-0.04em]"
            id="model-evaluation-title"
          >
            どのくらい判定できる？
          </h2>
          <p className="mt-5 max-w-[720px] text-[15px] leading-[1.9] text-muted">
            分類の正解率は以下のようになっています。撮影条件などでパフォーマンスは上下することがあります。
          </p>
          {manifest?.evaluation && (
            <table className="mt-8 w-full max-w-[680px] border-collapse overflow-hidden rounded-[18px] bg-card text-left shadow-[0_12px_36px_rgb(20_38_26/8%)]">
              <tbody>
                <tr className="border-b border-line">
                  <th className="p-5 text-sm font-bold">評価に使った写真</th>
                  <td className="p-5 text-right font-bold">
                    {manifest.evaluation.validationImages.toLocaleString(
                      "ja-JP",
                    )}
                    枚
                  </td>
                </tr>
                <tr>
                  <th className="p-5 text-sm font-bold">
                    正しく種類を選べた割合
                  </th>
                  <td className="p-5 text-right font-bold">
                    {(manifest.evaluation.accuracy * 100).toFixed(1)}%
                  </td>
                </tr>
              </tbody>
            </table>
          )}
          <a
            className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-brand underline-offset-4 hover:underline focus-visible:underline"
            href={externalLinks.githubRepository}
            target="_blank"
            rel="noreferrer"
          >
            GitHubで詳しく見る <span aria-hidden="true">↗</span>
          </a>
        </section>

        <section
          className="mt-16 border-t border-line pt-16 max-[720px]:mt-12 max-[720px]:pt-12"
          aria-labelledby="species-list-title"
        >
          <h2
            className="m-0 font-mincho text-[clamp(30px,4vw,44px)] font-semibold tracking-[-0.04em]"
            id="species-list-title"
          >
            生き物の一覧
          </h2>
          <p className="mt-4 max-w-[680px] text-sm leading-[1.8] text-muted">
            写真をタップすると、大きく表示できます。
          </p>
          {loadFailed && (
            <p
              className="mt-8 rounded-[16px] bg-[#fff1e8] p-5 text-sm text-danger"
              role="alert"
            >
              一覧を読み込めませんでした。時間をおいてもう一度お試しください。
            </p>
          )}
          {manifest && <SpeciesGallery species={sortedClasses} />}
        </section>

        <details
          aria-label="写真クレジット"
          className="mt-16 border-t border-line pt-8 text-[10px] leading-[1.7] text-muted max-[720px]:mt-12"
          role="note"
        >
          <summary className="cursor-pointer text-xs font-bold text-muted-strong">
            写真クレジット
          </summary>
          <ul className="mt-4 mb-0 grid list-none gap-2 p-0">
            {photoCredits.map(({ commonName, photo }) => (
              <li key={photo.photoId}>
                <a
                  className="underline underline-offset-2"
                  href={photo.sourcePhotoUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {commonName}: {photo.attribution}
                </a>{" "}
                /{" "}
                <a
                  className="underline underline-offset-2"
                  href={photo.licenseUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {photo.license}
                </a>
              </li>
            ))}
          </ul>
        </details>
      </section>
    </ContentPageLayout>
  );
}
