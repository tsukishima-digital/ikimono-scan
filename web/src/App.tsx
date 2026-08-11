import { useEffect, useState } from "react";

import {
  hasCompletedOnboarding,
  rememberCompletedOnboarding,
} from "./onboarding";
import { AboutPage } from "./pages/AboutPage";
import { ResultFixturePage } from "./pages/ResultFixturePage";
import { ScannerPage } from "./pages/ScannerPage";
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

    window.history.replaceState({}, "", "/about");
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, [needsOnboarding]);

  function startScanner() {
    rememberCompletedOnboarding();
    setOnboardingComplete(true);
    window.history.pushState({}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  if (pathname === "/about" || needsOnboarding) {
    return <AboutPage onStartScanner={startScanner} />;
  }
  if (pathname === "/changelog" || pathname === "/updates") {
    return <UpdatesPage />;
  }
  if (import.meta.env.DEV && pathname === "/__dev/result") {
    return <ResultFixturePage />;
  }
  return <ScannerPage />;
}
