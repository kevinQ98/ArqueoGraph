import { useEffect, useRef, useState } from "react";
import { ChevronDown, DatabaseBackup, LayoutDashboard, Menu, Network, Settings, X } from "lucide-react";

export default function Header({ view, onNavigate, onOpenSite, onBackup, backupStatus, sites = [], activeSite }) {
  const [siteMenuOpen, setSiteMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function closeMenu(event) {
      if (!menuRef.current?.contains(event.target)) setSiteMenuOpen(false);
    }
    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, []);

  function navigate(next) {
    onNavigate(next);
    setMobileOpen(false);
    setSiteMenuOpen(false);
  }

  return (
    <header className="appHeader">
      <div className="appBrand">ArqueoGraph</div>
      <button type="button" className="mobileMenuButton" onClick={() => setMobileOpen((current) => !current)} title="Abrir navegación">
        {mobileOpen ? <X size={19} /> : <Menu size={19} />}
      </button>

      <div className={`appHeaderContent ${mobileOpen ? "open" : ""}`}>
        <nav className="globalNav" aria-label="Navegación principal">
          <button type="button" className={view === "dashboard" ? "active" : ""} onClick={() => navigate("dashboard")}>
            <LayoutDashboard size={15} /> Dashboard
          </button>
          <div className="siteNavMenu" ref={menuRef}>
            <button type="button" className={view === "site" ? "active" : ""} onClick={() => setSiteMenuOpen((current) => !current)}>
              <Network size={15} /> Sitios <ChevronDown size={13} />
            </button>
            {siteMenuOpen && (
              <div className="siteNavPopover">
                {(sites || []).map((site) => (
                  <button type="button" key={site.fuente || site.sitio} className={activeSite?.fuente === site.fuente ? "active" : ""} onClick={() => { onOpenSite(site); setSiteMenuOpen(false); setMobileOpen(false); }}>
                    <span>{site.sitio}</span><code>{site.fuente}</code>
                  </button>
                ))}
                {!sites.length && <p>No hay sitios registrados.</p>}
              </div>
            )}
          </div>
          <button type="button" className={view === "admin" ? "active" : ""} onClick={() => navigate("admin")}>
            <Settings size={15} /> Administración
          </button>
        </nav>

        <div className="appHeaderActions">
          <button type="button" className="backupButton" onClick={onBackup} title="Crear respaldo de SQLite">
            <DatabaseBackup size={16} /> Respaldar datos
          </button>
          {backupStatus && <span className="backupStatus" title={backupStatus}>{backupStatus}</span>}
        </div>
      </div>
    </header>
  );
}
