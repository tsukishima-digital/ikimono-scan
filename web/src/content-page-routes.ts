export type ContentPageId =
  | "home"
  | "supported-species"
  | "how-to"
  | "changelog";

export interface ContentPageRoute {
  id: ContentPageId;
  menuLabel: string;
  paths: readonly string[];
  title: string;
  description: string;
}

export const contentPageRoutes = [
  {
    id: "home",
    menuLabel: "このサイトについて",
    paths: ["/"],
    title: "写真で生き物の名前を判定｜生き物スキャン",
    description:
      "写真から生き物の名前の候補を調べる、非営利のWebアプリ。写真は外部へ送信せず、端末内で判定します。",
  },
  {
    id: "supported-species",
    menuLabel: "判定できる生き物",
    paths: ["/supported-species"],
    title: "判定できる生き物｜生き物スキャン",
    description:
      "生き物スキャンが現在判定できる生き物の和名・学名と、モデルの評価結果を確認できます。",
  },
  {
    id: "how-to",
    menuLabel: "使い方",
    paths: ["/how-to"],
    title: "判定しやすい写真の撮り方｜生き物スキャン",
    description:
      "生き物全体を中央に、明るく鮮明に写すためのポイントと、写真判定の始め方を紹介します。",
  },
  {
    id: "changelog",
    menuLabel: "更新情報",
    paths: ["/changelog", "/updates"],
    title: "更新情報｜生き物スキャン",
    description: "生き物スキャンの対応種、判定機能、使い方に関する更新情報です。",
  },
] as const satisfies readonly ContentPageRoute[];

export const contentPagePaths = contentPageRoutes.flatMap(({ paths }) => paths);

export function contentPageIdFromPath(pathname: string) {
  return contentPageRoutes.find(({ paths }) =>
    paths.some((path) => path === pathname),
  )?.id;
}
