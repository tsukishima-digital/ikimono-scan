import { AppLink } from "./AppLink";

interface SiteHeaderProps {
  overlay?: boolean;
}

export function SiteHeader({ overlay = false }: SiteHeaderProps) {
  const headerClassName = [
    "z-20 flex min-h-[78px] items-center justify-between gap-7",
    "border-b border-ink/10 bg-paper/82 px-[max(24px,env(safe-area-inset-left))]",
    "backdrop-blur-[24px] backdrop-saturate-150",
    "max-[720px]:min-h-[68px] max-[720px]:px-4",
    "[@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none",
    overlay
      ? "absolute inset-x-0 top-0 border-0 bg-[linear-gradient(to_bottom,rgb(0_0_0/58%)_0%,rgb(0_0_0/22%)_68%,transparent_100%)] pt-[env(safe-area-inset-top)] text-white backdrop-blur-none"
      : "relative text-ink",
  ].join(" ");

  return (
    <header className={headerClassName}>
      <AppLink
        className="inline-flex items-center gap-2.5 text-base font-extrabold tracking-[0.035em] no-underline transition-transform duration-100 ease-out active:scale-[0.97]"
        href="/"
        aria-label="生き物スキャン ホーム"
      >
        <span
          className={[
            "grid size-[34px] place-items-center rounded-[50%_50%_44%_56%]",
            "border border-white/20 font-mincho text-paper",
            overlay
              ? "bg-[rgb(11_32_20/68%)] backdrop-blur-[14px]"
              : "bg-brand-dark",
          ].join(" ")}
          aria-hidden="true"
        >
          生
        </span>
        <span className="max-[720px]:hidden">生き物スキャン</span>
      </AppLink>
      <nav
        className="flex items-center gap-6 max-[720px]:gap-4"
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
