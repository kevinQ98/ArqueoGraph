import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { AdminPanel } from "./components/AdminPanel";
import { DashboardPanel } from "./components/DashboardPanel";
import Header from "./components/dashboard/Header";
import { SiteExplorerPage } from "./features/site-explorer/SiteExplorerPage";
import { createBackup, getDashboardOverview } from "./lib/api";
import "./style.css";

export default function App() {
  const [view, setView] = useState("dashboard");
  const [sites, setSites] = useState([]);
  const [activeSite, setActiveSite] = useState(null);
  const [backupStatus, setBackupStatus] = useState("");

  const refreshSites = useCallback(async () => {
    try {
      const payload = await getDashboardOverview();
      setSites(payload?.site_portals || []);
    } catch {
      setSites([]);
    }
  }, []);

  useEffect(() => {
    refreshSites();
  }, [refreshSites]);

  function openSite(site) {
    if (typeof site === "string") {
      const aliases = { visualizacion: "morro1", clusters: "azapa" };
      const source = aliases[site] || site;
      const match = sites.find((item) => item.fuente === source || item.sitio === site);
      if (!match) return;
      setActiveSite(match);
    } else if (site?.sitio) {
      setActiveSite(site);
    } else {
      return;
    }
    setView("site");
  }

  function navigate(nextView) {
    setView(nextView);
    if (nextView !== "site") setActiveSite(null);
    if (nextView === "dashboard") refreshSites();
  }

  async function handleBackup() {
    setBackupStatus("Generando respaldo...");
    try {
      const result = await createBackup();
      setBackupStatus(`Creado: ${result.archivo}`);
    } catch (error) {
      setBackupStatus(error.message || "No se pudo generar el respaldo.");
    }
  }

  return (
    <div className="app appThemeDark">
      <Header
        view={view}
        onNavigate={navigate}
        onOpenSite={openSite}
        onBackup={handleBackup}
        backupStatus={backupStatus}
        sites={sites}
        activeSite={activeSite}
      />

      {view === "dashboard" && <DashboardPanel onNavigate={openSite} />}
      {view === "site" && activeSite && <SiteExplorerPage key={activeSite.fuente} site={activeSite} />}
      {view === "admin" && <main className="adminMain"><AdminPanel /></main>}
    </div>
  );
}

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
