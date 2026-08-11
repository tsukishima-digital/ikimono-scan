import type { ReactNode } from "react";

import type { ContentPageId } from "../content-page-routes";
import { contentPageFrameClassName } from "./content-page-frame";
import { SiteHeader } from "./SiteHeader";

interface ContentPageLayoutProps {
  children: ReactNode;
  currentPage: ContentPageId;
  description?: ReactNode;
  eyebrow: string;
  title: ReactNode;
}

export function ContentPageLayout({
  children,
  currentPage,
  description,
  eyebrow,
  title,
}: ContentPageLayoutProps) {
  return (
    <div
      className="min-h-dvh bg-paper text-ink"
      data-testid="content-page-layout"
    >
      <SiteHeader currentPage={currentPage} contentFrame />
      <main
        className={`${contentPageFrameClassName} pt-[78px] max-[720px]:pt-[68px]`}
        data-testid="content-page-frame"
      >
        <header
          className="grid grid-cols-1 gap-y-6 py-[92px] pb-16 max-[720px]:py-16 max-[720px]:pb-[58px]"
          data-testid="page-hero"
        >
          <p className="m-0 text-[11px] font-[850] tracking-[0.17em] text-brand uppercase">
            {eyebrow}
          </p>
          <h1 className="m-0 max-w-[900px] font-mincho text-[clamp(48px,7vw,72px)] leading-[1.07] font-[550] tracking-[-0.06em] max-[720px]:text-[clamp(36px,11vw,48px)]">
            {title}
          </h1>
          {description && (
            <p className="m-0 max-w-[680px] text-base leading-[1.9] text-muted">
              {description}
            </p>
          )}
        </header>
        {children}
      </main>
      <footer
        className={`${contentPageFrameClassName} flex min-h-[100px] items-center border-t border-line text-xs text-muted`}
        data-testid="content-page-frame"
      >
        生き物スキャン
      </footer>
    </div>
  );
}
