import { describe, expect, it } from "vitest";

import { applyPageMetadata, metadataForPath } from "./page-metadata";

describe("page metadata", () => {
  it("gives each public content page a distinct indexable title", () => {
    const paths = ["/", "/supported-species", "/how-to", "/changelog"];
    const pages = paths.map(metadataForPath);

    expect(new Set(pages.map(({ title }) => title)).size).toBe(paths.length);
    expect(pages.every(({ index }) => index)).toBe(true);
    expect(metadataForPath("/").description).toBe(
      "写真から生き物の名前の候補を調べられるWebアプリ。画像データを外部へ送信せず、端末内で判定します。",
    );
  });

  it("keeps the scanner out of search results", () => {
    expect(metadataForPath("/scan")).toMatchObject({
      canonicalPath: "/scan",
      index: false,
    });
  });

  it("uses changelog as the canonical URL for its legacy alias", () => {
    expect(metadataForPath("/updates").canonicalPath).toBe("/changelog");
  });

  it("updates the document metadata when client-side routing changes", () => {
    applyPageMetadata("/supported-species");

    expect(document.title).toBe("判定できる生き物｜生き物スキャン");
    expect(
      document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')
        ?.content,
    ).toBe("index,follow");
    expect(
      document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
        ?.href,
    ).toBe("https://ikimono-scan.app/supported-species");
  });
});
