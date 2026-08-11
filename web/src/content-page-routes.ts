export type ContentPageId = "about" | "how-to" | "changelog";

export interface ContentPageRoute {
  id: ContentPageId;
  menuLabel: string;
  paths: readonly string[];
}

export const contentPageRoutes = [
  { id: "how-to", menuLabel: "How to use", paths: ["/how-to"] },
  { id: "about", menuLabel: "About", paths: ["/about"] },
  {
    id: "changelog",
    menuLabel: "Changelog",
    paths: ["/changelog", "/updates"],
  },
] as const satisfies readonly ContentPageRoute[];

export const contentPagePaths = contentPageRoutes.flatMap(({ paths }) => paths);

export function contentPageIdFromPath(pathname: string) {
  return contentPageRoutes.find(({ paths }) =>
    paths.some((path) => path === pathname),
  )?.id;
}
