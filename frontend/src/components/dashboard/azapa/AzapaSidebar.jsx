import { Filter, Download, RefreshCw, Eye, EyeOff } from 'lucide-react';

export default function AzapaSidebar({
    azapaSexo, setAzapaSexo, azapaSexoOptions,
    azapaEdad, setAzapaEdad, azapaEdadOptions,
    azapaMatriz, setAzapaMatriz, azapaMatrizOptions,
    showElementEdges, setShowElementEdges,
    loadAzapaGraph,
    azapaStatus,
    azapaStats,
    exportAzapaCsv, exportAzapaJson,
    toggleImages, showImages,
    selectedAzapaCase,
    showTree, setShowTree,   // <--- nuevo
}) {
    return (
        <aside className="w-full md:w-72 lg:w-80 space-y-4">
            {/* Filtros AZAPA */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-4">
                    <Filter size={16} className="text-emerald-500" />
                    Filtros Azapa
                </h2>
                <div className="space-y-4">
                    <div className="flex items-center justify-between bg-slate-100 rounded-lg px-3 py-2">
                        <span className="text-xs font-medium text-slate-500">Modo de grafo</span>
                        <span className="text-sm font-semibold text-slate-700">Distancia radial</span>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Sexo</label>
                        <select
                            value={azapaSexo}
                            onChange={(e) => setAzapaSexo(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white text-sm px-3 py-2 text-slate-700 focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
                        >
                            <option value="">Todos</option>
                            {(azapaSexoOptions || []).map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Edad</label>
                        <select
                            value={azapaEdad}
                            onChange={(e) => setAzapaEdad(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white text-sm px-3 py-2 text-slate-700 focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
                        >
                            <option value="">Todas</option>
                            {(azapaEdadOptions || []).map((e) => <option key={e} value={e}>{e}</option>)}
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="showElementEdgesAzapa"
                            checked={showElementEdges}
                            onChange={(e) => setShowElementEdges(e.target.checked)}
                            className="w-4 h-4 max-w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-400 focus:ring-2 cursor-pointer"
                        />
                        <label htmlFor="showElementEdgesAzapa" className="text-xs text-slate-600 cursor-pointer select-none">
                            Mostrar líneas al elemento central
                        </label>
                    </div>

                    <button
                        onClick={() => setShowTree(!showTree)}
                        className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-4 rounded-lg transition-all"
                    >
                        {showTree ? <EyeOff size={16} /> : <Eye size={16} />}
                        {showTree ? "Ocultar árbol" : "Explorador visualización"}
                    </button>

                    <button
                        onClick={() => loadAzapaGraph()}
                        className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2 px-4 rounded-lg transition-all shadow-sm"
                    >
                        <RefreshCw size={16} /> Actualizar
                    </button>
                    {azapaStatus && <p className="text-xs text-red-500 mt-2">{azapaStatus}</p>}
                </div>
            </section>

            {/* Resumen */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">Resumen</h2>
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-100 rounded-lg py-2">
                        <div className="text-xl font-bold text-slate-800">{azapaStats.nodes}</div>
                        <div className="text-xs text-slate-500">nodos</div>
                    </div>
                    <div className="bg-slate-100 rounded-lg py-2">
                        <div className="text-xl font-bold text-slate-800">{azapaStats.edges}</div>
                        <div className="text-xs text-slate-500">aristas</div>
                    </div>
                    <div className="bg-slate-100 rounded-lg py-2">
                        <div className="text-xl font-bold text-slate-800">{azapaStats.rows}</div>
                        <div className="text-xs text-slate-500">filas</div>
                    </div>
                </div>
            </section>

            {/* Exportar */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-4">
                    <Download size={16} className="text-emerald-500" />
                    Exportar
                </h2>
                <div className="flex flex-col space-y-2">
                    <button
                        onClick={exportAzapaCsv}
                        className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium py-2 px-4 rounded-lg transition-all"
                    >
                        CSV tabla
                    </button>
                    <button
                        onClick={exportAzapaJson}
                        className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium py-2 px-4 rounded-lg transition-all"
                    >
                        JSON grafo
                    </button>
                </div>
            </section>
        </aside>
    );
}