import { AppLink } from "./AppLink";

interface SiteHeaderProps {
  overlay?: boolean;
}

export function SiteHeader({ overlay = false }: SiteHeaderProps) {
  return (
    <header className={overlay ? "site-header overlay" : "site-header"}>
      <AppLink className="wordmark" href="/" aria-label="生き物スキャン ホーム">
        <span className="mark" aria-hidden="true">生</span>
        <span>生き物スキャン</span>
      </AppLink>
      <nav aria-label="メインナビゲーション">
        <AppLink href="/about">このアプリについて</AppLink>
        <AppLink href="/updates">更新履歴</AppLink>
      </nav>
    </header>
  );
}
