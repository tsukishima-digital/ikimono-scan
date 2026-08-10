import { useEffect, useState } from "react";

import { AboutPage } from "./pages/AboutPage";
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

  if (pathname === "/about") return <AboutPage />;
  if (pathname === "/updates") return <UpdatesPage />;
  return <ScannerPage />;
}
