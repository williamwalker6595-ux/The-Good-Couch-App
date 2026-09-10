import { useEffect, useState } from "react";

interface NavigatorWithIosStandalone extends Navigator {
  standalone?: boolean;
}

function isStandalone(): boolean {
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS Safari's own (non-standard) flag for "launched from home screen".
  return (navigator as NavigatorWithIosStandalone).standalone === true;
}

/** Whether the app is currently running installed (home-screen/standalone), not in a browser tab. */
export function useStandaloneDisplay(): boolean {
  const [standalone, setStandalone] = useState(isStandalone);

  useEffect(() => {
    const query = window.matchMedia("(display-mode: standalone)");
    const onChange = () => setStandalone(isStandalone());
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return standalone;
}
