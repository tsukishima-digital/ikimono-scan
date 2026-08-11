import { AppLink } from "../components/AppLink";
import { SiteHeader } from "../components/SiteHeader";
import { contentPageFrameClassName } from "../components/content-page-frame";

export function NotFoundPage() {
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <SiteHeader currentPage={null} contentFrame />
      <main
        className={`${contentPageFrameClassName} grid min-h-dvh content-center py-28`}
      >
        <p className="m-0 text-[11px] font-[850] tracking-[0.17em] text-brand uppercase">
          NOT FOUND
        </p>
        <h1 className="mt-5 mb-0 font-mincho text-[clamp(38px,7vw,64px)] font-semibold tracking-[-0.05em]">
          ページが見つかりません
        </h1>
        <p className="mt-6 mb-0 text-base text-muted">
          URLを確認するか、最初のページへ戻ってください。
        </p>
        <AppLink
          className="mt-8 inline-flex min-h-14 w-fit items-center justify-center rounded-full bg-brand-dark px-8 font-extrabold text-white no-underline active:scale-[0.97] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-lime"
          href="/"
        >
          最初のページへ戻る
        </AppLink>
      </main>
    </div>
  );
}
