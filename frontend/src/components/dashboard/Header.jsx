import { LayoutDashboard, Network, Save } from 'lucide-react';

function siteLabel(site) {
    return String(site?.sitio || "").replace(/\s+/g, " ").trim();
}

export default function Header({ view, setView, handleBackup, backupStatus, sites = [], activeSite = "", onOpenSite }) {
    return (
        <header className="bg-white shadow-sm border-b border-gray-200 px-4 py-3 sm:px-6 lg:px-8">
            <div className="w-full mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
                {/* Logo / Título */}
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-gray-800 tracking-tight">ArqueoGraph</h1>
                    {/* <span className="hidden sm:inline text-sm text-gray-500 font-light">Visualización arqueométrica</span> */}
                </div>

                {/* Navegación y acciones */}
                <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 w-full sm:w-auto">
                    {/* Botones de navegación */}
                    <button
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${view === "dashboard"
                            ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                            }`}
                        onClick={() => setView("dashboard")}
                    >
                        <LayoutDashboard size={18} />
                        <span className="">Dashboard</span>
                    </button>

                    {sites.map((site) => {
                        const label = siteLabel(site);
                        const active = activeSite === label || (label === "Morro 1" && view === "visualizacion") || (label === "Azapa 140" && view === "clusters");
                        return (
                            <button
                                key={label}
                                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${active
                                    ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                    }`}
                                onClick={() => onOpenSite?.(site)}
                            >
                                <Network size={18} />
                                <span className="">{label}</span>
                            </button>
                        );
                    })}

                    {/* <button
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${view === "administracion"
                            ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                            }`}
                        onClick={() => setView("administracion")}
                    >
                        <Settings2 size={18} />
                        <span className="">Administración</span>
                    </button> */}

                    {/* Botón Respaldar datos */}
                    <button
                        onClick={handleBackup}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-slate-700 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors duration-200"
                    >
                        <Save size={18} />
                        <span className="">Respaldar datos</span>
                    </button>
                    {backupStatus && (
                        <span className="text-xs text-slate-500 whitespace-nowrap">{backupStatus}</span>
                    )}

                </div>
            </div>
        </header>
    );
}
