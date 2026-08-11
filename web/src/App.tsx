import { useEffect, useState } from "react";

import { contentPageIdFromPath } from "./content-page-routes";
import { applyPageMetadata } from "./page-metadata";
import { HomePage } from "./pages/HomePage";
import { HowToPage } from "./pages/HowToPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PreprocessFixturePage } from "./pages/PreprocessFixturePage";
import { ResultFixturePage } from "./pages/ResultFixturePage";
import { ScannerPage, type SourceMode } from "./pages/ScannerPage";
import { SupportedSpeciesPage } from "./pages/SupportedSpeciesPage";
import { UpdatesPage } from "./pages/UpdatesPage";
import { saveScrollPosition, useScrollRestoration } from "./scroll-restoration";

function usePathname() {
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const updatePathname = () =>
      setPathname((currentPathname) => {
        saveScrollPosition(currentPathname);
        return window.location.pathname;
      });
    window.addEventListener("popstate", updatePathname);
    return () => window.removeEventListener("popstate", updatePathname);
  }, []);

  return pathname;
}

export default function App() {
  const pathname = usePathname();
  useScrollRestoration(pathname);

  useEffect(() => applyPageMetadata(pathname), [pathname]);

  function startScanner(mode: SourceMode) {
    const destination = mode === "library" ? "/scan?mode=photo" : "/scan";
    window.history.pushState({}, "", destination);
    window.dispatchEvent(new PopStateEvent("popstate"));
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  const contentPage = contentPageIdFromPath(pathname);
  switch (contentPage) {
    case "home":
      return <HomePage />;
    case "supported-species":
      return <SupportedSpeciesPage />;
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
  if (resultFixturesEnabled && pathname === "/__dev/preprocess") {
    return <PreprocessFixturePage />;
  }
  if (pathname === "/scan") {
    const initialSourceMode =
      new URLSearchParams(window.location.search).get("mode") === "photo"
        ? "library"
        : "camera";
    return <ScannerPage initialSourceMode={initialSourceMode} />;
  }
  return <NotFoundPage />;
}
