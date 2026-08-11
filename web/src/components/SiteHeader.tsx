import { useEffect, useRef, useState, type MouseEvent } from "react";

import {
  contentPageRoutes,
  type ContentPageId,
} from "../content-page-routes";
import { AppLink } from "./AppLink";
import { contentPageFrameClassName } from "./content-page-frame";

export type CurrentPage = "scan" | ContentPageId;

interface SiteHeaderProps {
  contentFrame?: boolean;
  currentPage?: CurrentPage;
  howToHref?: string;
  onStartScanner?: () => void;
  overlay?: boolean;
}

export function SiteHeader({
  contentFrame = false,
  currentPage = "scan",
  howToHref = "/how-to",
  onStartScanner,
  overlay = false,
}: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    function closeFromOutside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !menuContainerRef.current?.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    }

    function closeFromKeyboard(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    }

    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeFromKeyboard);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeFromKeyboard);
    };
  }, [menuOpen]);

  const headerClassName = [
    "z-30",
    "[@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none",
    overlay
      ? "absolute inset-x-0 top-0 bg-[linear-gradient(to_bottom,rgb(4_10_7/70%)_0%,rgb(4_10_7/30%)_62%,transparent_100%)] pt-[env(safe-area-inset-top)] text-white"
      : "fixed inset-x-0 top-0 bg-paper/78 text-ink backdrop-blur-[24px] backdrop-saturate-150 after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-4 after:bg-gradient-to-b after:from-paper/35 after:to-transparent after:content-[''] [@media(prefers-reduced-transparency:reduce)]:bg-paper",
  ].join(" ");
  const menuLinkClassName = (active: boolean) =>
    [
      "flex items-center justify-between rounded-[14px] px-4 py-3 text-[15px] font-bold tracking-[0.01em] transition-colors focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-lime",
      overlay ? "hover:bg-white/10" : "hover:bg-ink/5",
      active
        ? overlay
          ? "bg-white/14 text-white"
          : "bg-ink/8 text-brand-dark"
        : "",
    ].join(" ");

  function menuLink(page: CurrentPage, href: string, label: string) {
    const active = currentPage === page;
    return (
      <AppLink
        aria-current={active ? "page" : undefined}
        className={menuLinkClassName(active)}
        href={href}
        onClick={(event) => {
          setMenuOpen(false);
          if (page !== "scan" || !onStartScanner) return;
          event.preventDefault();
          onStartScanner();
        }}
      >
        {label}
        {active && (
          <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
        )}
      </AppLink>
    );
  }

  function startScannerFromTitle(event: MouseEvent<HTMLAnchorElement>) {
    if (!onStartScanner) return;
    event.preventDefault();
    onStartScanner();
  }

  return (
    <header className={headerClassName} aria-label="サイトヘッダー">
      <div
        className={`${contentPageFrameClassName} flex min-h-[78px] items-center justify-between gap-7 max-[720px]:min-h-[68px]`}
        data-testid={contentFrame ? "content-page-frame" : undefined}
      >
        <AppLink
          className={`inline-flex items-center text-[15px] font-[750] tracking-[0.02em] no-underline transition-transform duration-100 ease-out active:scale-[0.97] max-[720px]:text-[13px] ${overlay ? "drop-shadow-[0_1px_5px_rgb(0_0_0/42%)]" : ""}`}
          href="/"
          aria-label="生き物スキャン ホーム"
          onClick={startScannerFromTitle}
        >
          <span>生き物スキャン</span>
        </AppLink>
        <div className="relative" ref={menuContainerRef}>
          <button
            className={`relative grid size-11 cursor-pointer place-items-center rounded-full border transition-[background,transform] duration-150 ease-out active:scale-[0.96] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-lime ${
              overlay
                ? "border-white/18 bg-black/24 text-white backdrop-blur-[14px] hover:bg-black/36"
                : "border-ink/12 bg-white/48 text-ink hover:bg-white/80"
            }`}
            type="button"
            aria-label={menuOpen ? "メニューを閉じる" : "メニューを開く"}
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            ref={menuButtonRef}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span
              className={`absolute h-[1.5px] w-[18px] bg-current transition-transform duration-150 ease-out ${menuOpen ? "rotate-45" : "-translate-y-[4px]"}`}
              aria-hidden="true"
            />
            <span
              className={`absolute h-[1.5px] w-[18px] bg-current transition-transform duration-150 ease-out ${menuOpen ? "-rotate-45" : "translate-y-[4px]"}`}
              aria-hidden="true"
            />
          </button>
          {menuOpen && (
            <nav
              className={`animate-materialize absolute top-[calc(100%+8px)] right-0 w-[190px] origin-top-right rounded-[20px] border p-2 shadow-[0_20px_60px_rgb(0_0_0/28%)] backdrop-blur-[24px] backdrop-saturate-150 ${
                overlay
                  ? "border-white/14 bg-[rgb(8_15_11/88%)] text-white"
                  : "border-ink/10 bg-card/94 text-ink"
              }`}
              id="site-menu"
              aria-label="メインナビゲーション"
            >
              {menuLink("scan", "/", "Scan")}
              {contentPageRoutes.map(({ id, menuLabel, paths }) => (
                <span className="contents" key={id}>
                  {menuLink(
                    id,
                    id === "how-to" ? howToHref : paths[0],
                    menuLabel,
                  )}
                </span>
              ))}
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}
