import { Link, Route, Routes } from "react-router-dom";
import LeadDetailPage from "./pages/LeadDetailPage";
import LeadListPage from "./pages/LeadListPage";
import InstallPrompt from "./pwa/InstallPrompt";
import UpdateToast from "./pwa/UpdateToast";

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="app-title">
          The Good Couch
        </Link>
        <span className="app-subtitle">Lead Dashboard</span>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<LeadListPage />} />
          <Route path="/leads/:leadId" element={<LeadDetailPage />} />
        </Routes>
      </main>
      <div className="pwa-banner-stack">
        <UpdateToast />
        <InstallPrompt />
      </div>
    </div>
  );
}
