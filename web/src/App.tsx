import { useEffect, useState } from "react";

import {
  hasCompletedOnboarding,
  rememberCompletedOnboarding,
} from "./onboarding";
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

  if (pathname === "/about") return <AboutPage />;
  if (pathname === "/how-to" || needsOnboarding) {
    return <HowToPage onStartScanner={startScanner} />;
  }
  if (pathname === "/changelog" || pathname === "/updates") {
    return <UpdatesPage />;
  }
  if (import.meta.env.DEV && pathname === "/__dev/result") {
    return <ResultFixturePage />;
  }
  const initialSourceMode =
    new URLSearchParams(window.location.search).get("mode") === "photo"
      ? "library"
      : "camera";
  return <ScannerPage initialSourceMode={initialSourceMode} />;
}
