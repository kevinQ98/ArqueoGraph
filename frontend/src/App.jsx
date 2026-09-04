import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { DashboardPanel } from "./components/DashboardPanel";
import Header from "./components/dashboard/Header";
import { SiteExplorerPage } from "./features/site-explorer/SiteExplorerPage";
import { createBackup, getDashboardOverview } from "./lib/api";
import "./style.css";

/**
 * Componente raíz de la aplicación.
 * Gestiona el estado global: vista actual, sitios disponibles, sitio activo, y respaldo.
 * @returns {JSX.Element}
 */
export default function App() {
  // Estado de la vista actual ("dashboard" | "site" | "admin")
  const [view, setView] = useState("dashboard");
  // Lista de sitios disponibles (desde el dashboard)
  const [sites, setSites] = useState([]);
  // Sitio activo (objeto con sitio, fuente, individuos)
  const [activeSite, setActiveSite] = useState(null);
  // Estado del respaldo (mensaje)
  const [backupStatus, setBackupStatus] = useState("");

  /**
   * Refresca la lista de sitios desde el dashboard.
   * @returns {Promise<void>}
   */
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

  /**
   * Abre un sitio en el explorador.
   * @param {Object|string} site - Objeto sitio o alias ("visualizacion", "clusters").
   * @returns {void}
   */
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

  /**
   * Navega a otra vista (dashboard, admin, site).
   * @param {string} nextView - Nombre de la vista.
   * @returns {void}
   */
  function navigate(nextView) {
    setView(nextView);
    if (nextView !== "site") setActiveSite(null);
    if (nextView === "dashboard") refreshSites();
  }

  /**
   * Maneja la creación de un respaldo.
   * @returns {Promise<void>}
   */
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
      {/* {view === "admin" && <main className="adminMain"><AdminPanel /></main>} */}
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
