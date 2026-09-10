import { useRegisterSW } from "virtual:pwa-register/react";

export default function UpdateToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error("Service worker registration failed", error);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="pwa-banner">
      <span>A new version of the dashboard is ready.</span>
      <div className="pwa-banner-actions">
        <button
          type="button"
          className="button-primary"
          onClick={() => updateServiceWorker(true)}
        >
          Refresh
        </button>
        <button type="button" onClick={() => setNeedRefresh(false)}>
          Later
        </button>
      </div>
    </div>
  );
}
