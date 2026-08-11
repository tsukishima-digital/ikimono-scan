import { useEffect, useState } from "react";

import {
  hasCompletedOnboarding,
  rememberCompletedOnboarding,
} from "./onboarding";
import { contentPageIdFromPath } from "./content-page-routes";
import { AboutPage } from "./pages/AboutPage";
import { HowToPage } from "./pages/HowToPage";
import { ResultFixturePage } from "./pages/ResultFixturePage";
import { ScannerPage, type SourceMode } from "./pages/ScannerPage";
import { UpdatesPage } from "./pages/UpdatesPage";

function usePathname() {
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const updatePathname = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", updatePathname);
    return () => window.removeEventListener("popstate", updatePathname);
  }, []);

  return pathname;
}

export default function App() {
  const pathname = usePathname();
  const [onboardingComplete, setOnboardingComplete] = useState(
    hasCompletedOnboarding,
  );
  const needsOnboarding = pathname === "/" && !onboardingComplete;

  useEffect(() => {
    if (!needsOnboarding) return;

    window.history.replaceState({}, "", "/how-to");
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, [needsOnboarding]);

  function startScanner(mode: SourceMode) {
    rememberCompletedOnboarding();
    setOnboardingComplete(true);
    const destination = mode === "library" ? "/?mode=photo" : "/";
    window.history.pushState({}, "", destination);
    window.dispatchEvent(new PopStateEvent("popstate"));
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  const contentPage = needsOnboarding
    ? "how-to"
    : contentPageIdFromPath(pathname);
  switch (contentPage) {
    case "about":
      return <AboutPage />;
    case "how-to":
      return <HowToPage onStartScanner={startScanner} />;
    case "changelog":
      return <UpdatesPage />;
  }
  const resultFixturesEnabled =
    import.meta.env.DEV || import.meta.env.VITE_E2E_FIXTURES === "true";
  if (resultFixturesEnabled && pathname === "/__dev/result") {
    return <ResultFixturePage />;
  }
  const initialSourceMode =
    new URLSearchParams(window.location.search).get("mode") === "photo"
      ? "library"
      : "camera";
  return <ScannerPage initialSourceMode={initialSourceMode} />;
}
