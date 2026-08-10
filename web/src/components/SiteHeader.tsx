import { AppLink } from "./AppLink";

interface SiteHeaderProps {
  overlay?: boolean;
}

export function SiteHeader({ overlay = false }: SiteHeaderProps) {
  const headerClassName = [
    "z-20 flex min-h-[78px] items-center justify-between gap-7",
    "px-[max(24px,env(safe-area-inset-left))]",
    "max-[720px]:min-h-[68px] max-[720px]:px-4",
    "[@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none",
    overlay
      ? "absolute inset-x-0 top-0 bg-[linear-gradient(to_bottom,rgb(4_10_7/70%)_0%,rgb(4_10_7/30%)_62%,transparent_100%)] pt-[env(safe-area-inset-top)] text-white"
      : "relative border-b border-ink/10 bg-paper/82 text-ink backdrop-blur-[24px] backdrop-saturate-150",
  ].join(" ");

  return (
    <header className={headerClassName}>
      <AppLink
        className={`inline-flex items-center text-[15px] font-[750] tracking-[0.02em] no-underline transition-transform duration-100 ease-out active:scale-[0.97] max-[720px]:text-[13px] ${overlay ? "drop-shadow-[0_1px_5px_rgb(0_0_0/42%)]" : ""}`}
        href="/"
        aria-label="生き物スキャン ホーム"
      >
        <span>生き物スキャン</span>
      </AppLink>
      <nav
        className={`flex items-center gap-6 max-[720px]:gap-3 ${overlay ? "drop-shadow-[0_1px_5px_rgb(0_0_0/42%)]" : ""}`}
        aria-label="メインナビゲーション"
      >
        <AppLink
          className="text-[13px] font-bold underline-offset-[5px] hover:underline focus-visible:underline max-[720px]:text-[11px]"
          href="/about"
        >
          このアプリについて
        </AppLink>
        <AppLink
          className="text-[13px] font-bold underline-offset-[5px] hover:underline focus-visible:underline max-[720px]:text-[11px]"
          href="/updates"
        >
          更新履歴
        </AppLink>
      </nav>
    </header>
  );
}
