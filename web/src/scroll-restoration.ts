import { useEffect } from "react";

const SCROLL_POSITION_PREFIX = "ikimono-scan:scroll-position:";

export function scrollPositionStorageKey(pathname: string) {
  return `${SCROLL_POSITION_PREFIX}${pathname}`;
}

function readScrollPosition(pathname: string) {
  try {
    const stored = window.sessionStorage.getItem(
      scrollPositionStorageKey(pathname),
    );
    if (stored === null) return undefined;
    const position = Number(stored);
    return Number.isFinite(position) && position >= 0 ? position : undefined;
  } catch {
    return undefined;
  }
}

export function saveScrollPosition(pathname: string) {
  try {
    window.sessionStorage.setItem(
      scrollPositionStorageKey(pathname),
      String(window.scrollY),
    );
  } catch {
    // Browsing remains usable when storage is blocked or unavailable.
  }
}

export function useScrollRestoration(pathname: string) {
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    let observer: MutationObserver | undefined;
    let saveAnimationFrame: number | undefined;
    let stopObservingTimer: number | undefined;

    const stopObserving = () => {
      observer?.disconnect();
      observer = undefined;
      if (stopObservingTimer !== undefined) {
        window.clearTimeout(stopObservingTimer);
        stopObservingTimer = undefined;
      }
    };

    const restore = () => {
      if (window.location.hash) return;
      const position = readScrollPosition(pathname);
      if (position === undefined) return;
      window.scrollTo({ top: position, behavior: "auto" });
      if (Math.abs(window.scrollY - position) <= 1) stopObserving();
    };

    const restoreAfterRender = () => {
      const position = readScrollPosition(pathname);
      if (position === undefined || window.location.hash) return;
      restore();
      if (Math.abs(window.scrollY - position) <= 1) return;

      observer = new MutationObserver(restore);
      observer.observe(document.body, { childList: true, subtree: true });
      stopObservingTimer = window.setTimeout(stopObserving, 3_000);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        saveScrollPosition(pathname);
      } else {
        restoreAfterRender();
      }
    };
    const handlePageHide = () => saveScrollPosition(pathname);
    const handleScroll = () => {
      if (saveAnimationFrame !== undefined) return;
      saveAnimationFrame = window.requestAnimationFrame(() => {
        saveAnimationFrame = undefined;
        saveScrollPosition(pathname);
      });
    };

    const animationFrame = window.requestAnimationFrame(restoreAfterRender);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      if (saveAnimationFrame !== undefined) {
        window.cancelAnimationFrame(saveAnimationFrame);
      }
      stopObserving();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [pathname]);
}
