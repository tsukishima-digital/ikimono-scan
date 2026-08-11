import { contentPageRoutes } from "./content-page-routes";

const SITE_ORIGIN = "https://ikimono-scan.app";

interface PageMetadata {
  title: string;
  description: string;
  canonicalPath: string;
  index: boolean;
}

export function metadataForPath(pathname: string): PageMetadata {
  const contentRoute = contentPageRoutes.find(({ paths }) =>
    paths.some((path) => path === pathname),
  );
  if (contentRoute) {
    return {
      title: contentRoute.title,
      description: contentRoute.description,
      canonicalPath: contentRoute.paths[0],
      index: true,
    };
  }
  if (pathname === "/scan") {
    return {
      title: "写真を判定する｜生き物スキャン",
      description: "カメラで撮影するか、端末に保存した写真から生き物を判定します。",
      canonicalPath: "/scan",
      index: false,
    };
  }
  return {
    title: "ページが見つかりません｜生き物スキャン",
    description: "お探しのページは見つかりませんでした。",
    canonicalPath: pathname,
    index: false,
  };
}

export function applyPageMetadata(pathname: string) {
  const metadata = metadataForPath(pathname);
  const canonicalUrl = `${SITE_ORIGIN}${metadata.canonicalPath}`;
  document.title = metadata.title;
  setMeta("description", metadata.description);
  setMeta("robots", metadata.index ? "index,follow" : "noindex,follow");
  setMetaProperty("og:title", metadata.title);
  setMetaProperty("og:description", metadata.description);
  setMetaProperty("og:url", canonicalUrl);
  setCanonical(canonicalUrl);
}

function setMeta(name: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[name="${name}"]`,
  );
  if (!element) {
    element = document.createElement("meta");
    element.name = name;
    document.head.append(element);
  }
  element.content = content;
}

function setMetaProperty(property: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[property="${property}"]`,
  );
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("property", property);
    document.head.append(element);
  }
  element.content = content;
}

function setCanonical(href: string) {
  let element = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]',
  );
  if (!element) {
    element = document.createElement("link");
    element.rel = "canonical";
    document.head.append(element);
  }
  element.href = href;
}
