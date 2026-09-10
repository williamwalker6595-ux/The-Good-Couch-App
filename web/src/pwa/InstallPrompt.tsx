import { useEffect, useState } from "react";
import { useStandaloneDisplay } from "./useStandaloneDisplay";

const DISMISSED_KEY = "goodcouch:install-prompt-dismissed";

// Not yet in TypeScript's DOM lib.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function dismiss(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // ignore — worst case the banner reappears next visit
  }
}

function isIos(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

export default function InstallPrompt() {
  const standalone = useStandaloneDisplay();
  const [dismissed, setDismissed] = useState(wasDismissed);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  if (standalone || dismissed) return null;
  if (!deferredPrompt && !isIos()) return null;

  const onDismiss = () => {
    dismiss();
    setDismissed(true);
  };

  if (deferredPrompt) {
    return (
      <div className="pwa-banner">
        <span>Install this dashboard as an app on your phone.</span>
        <div className="pwa-banner-actions">
          <button
            type="button"
            className="button-primary"
            onClick={async () => {
              await deferredPrompt.prompt();
              const { outcome } = await deferredPrompt.userChoice;
              if (outcome === "accepted") setDeferredPrompt(null);
            }}
          >
            Install
          </button>
          <button type="button" onClick={onDismiss}>
            Not now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pwa-banner">
      <span>
        Install this dashboard: tap <strong>Share</strong>, then{" "}
        <strong>Add to Home Screen</strong>.
      </span>
      <div className="pwa-banner-actions">
        <button type="button" onClick={onDismiss}>
          Got it
        </button>
      </div>
    </div>
  );
}
