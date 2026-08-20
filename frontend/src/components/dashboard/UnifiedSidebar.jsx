import { useState } from 'react';
import { Filter, Download, RefreshCw, Eye, EyeOff, UploadCloud } from 'lucide-react';

const colorClasses = {
    blue: {
        primary: 'bg-blue-500 hover:bg-blue-600 text-white',
        ring: 'focus:ring-blue-400',
        text: 'text-blue-500',
        checkbox: 'text-blue-500 focus:ring-blue-400',
    },
    emerald: {
        primary: 'bg-emerald-500 hover:bg-emerald-600 text-white',
        ring: 'focus:ring-emerald-400',
        text: 'text-emerald-500',
        checkbox: 'text-emerald-500 focus:ring-emerald-400',
    },
    violet: {
        primary: 'bg-violet-500 hover:bg-violet-600 text-white',
        ring: 'focus:ring-violet-400',
        text: 'text-violet-500',
        checkbox: 'text-violet-500 focus:ring-violet-400',
    },
};

export default function UnifiedSidebar({
    title = 'Filtros',
    color = 'blue',
    siteType = 'morro', // 'morro' o 'azapa'

    // Filtros
    sexo,
    setSexo,
    sexoOptions = [],
    edad,
    setEdad,
    edadOptions = [],
    matriz,
    setMatriz,
    matrizOptions = [],
    showElementEdges,
    setShowElementEdges,

    // Acciones
    load,
    status,
    graphStats = { nodes: 0, edges: 0 },
    tableRowsLength = 0,

    // Exportar
    exportCsv,
    exportJson,

    // Tree
    showTree,
    setShowTree,

    // Importar JSON
    onUpload,
    uploadTipos = ['morro1_analisis_quimico', 'morro1_paleopatologia'],
    pcaMode
}) {
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadStatus, setUploadStatus] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadTipo, setUploadTipo] = useState(
        siteType === 'azapa' ? 'azapa_analisis_quimico' : 'morro1_analisis_quimico'
    );

    const colorStyle = colorClasses[color] || colorClasses.blue;

    async function handleUpload() {
        if (!uploadFile) {
            setUploadStatus('Selecciona primero un archivo .json');
            return;
        }
        setUploading(true);
        setUploadStatus('Subiendo...');
        try {
            const result = await onUpload(uploadTipo, uploadFile);
            setUploadStatus(
                `Listo: ${result.casos_detectados} caso(s) importados desde ${result.archivo_guardado}.`
            );
            setUploadFile(null);
        } catch (error) {
            setUploadStatus(error.message || 'No se pudo subir el archivo.');
        } finally {
            setUploading(false);
        }
    }

    return (
        <aside className="w-full md:w-64 lg:w-72 xl:w-80 2xl:w-96 max-w-full space-y-4 sticky top-4 self-start">
            {/* Filtros */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5">
                <h2 className="text-xs sm:text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-4">
                    <Filter size={16} className={colorStyle.text} />
                    {title}
                </h2>
                <div className="space-y-3 sm:space-y-4">
                    {!pcaMode ? (
                        <div className="flex flex-col items-start bg-slate-100 rounded-lg px-3 py-2">
                            <span className="text-xs font-medium text-slate-500">Modo de grafo</span>
                            <span className="text-sm font-semibold text-slate-700">Distancia radial</span>
                        </div>
                    ) : (
                        <div className="flex flex-col items-start bg-slate-100 rounded-lg px-3 py-2">
                            <span className="text-xs font-medium text-slate-500">Modo</span>
                            <span className="text-sm font-semibold text-slate-700">PCA</span>
                        </div>
                    )}

                    {!pcaMode && (
                        <>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Sexo</label>
                                <select
                                    value={sexo}
                                    onChange={(e) => setSexo(e.target.value)}
                                    className={`w-full rounded-lg border border-slate-300 bg-white text-sm px-3 py-2 text-slate-700 focus:ring-2 ${colorStyle.ring} focus:border-transparent`}
                                >
                                    <option value="">Todos</option>
                                    {sexoOptions.map((s) => (
                                        <option key={s} value={s}>
                                            {s}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Edad</label>
                                <select
                                    value={edad}
                                    onChange={(e) => setEdad(e.target.value)}
                                    className={`w-full rounded-lg border border-slate-300 bg-white text-sm px-3 py-2 text-slate-700 focus:ring-2 ${colorStyle.ring} focus:border-transparent`}
                                >
                                    <option value="">Todas</option>
                                    {edadOptions.map((e) => (
                                        <option key={e} value={e}>
                                            {e}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* {siteType === 'azapa' && matrizOptions.length > 0 && (
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Matriz</label>
                            <select
                                value={matriz}
                                onChange={(e) => setMatriz(e.target.value)}
                                className={`w-full rounded-lg border border-slate-300 bg-white text-sm px-3 py-2 text-slate-700 focus:ring-2 ${colorStyle.ring} focus:border-transparent`}
                            >
                                <option value="">Todas</option>
                                {matrizOptions.map((m) => (
                                    <option key={m} value={m}>
                                        {m}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )} */}

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="showElementEdges"
                                    checked={showElementEdges}
                                    onChange={(e) => setShowElementEdges(e.target.checked)}
                                    className={`w-4 h-4 max-w-4 rounded border-slate-300 ${colorStyle.checkbox} focus:ring-2 cursor-pointer`}
                                />
                                <label
                                    htmlFor="showElementEdges"
                                    className="text-xs text-slate-600 cursor-pointer select-none truncate leading-tight"
                                    title="Mostrar líneas al elemento central"
                                >
                                    Mostrar líneas al elemento
                                </label>
                            </div>

                            <button
                                onClick={() => setShowTree(!showTree)}
                                className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-4 rounded-lg transition-all text-sm"
                            >
                                {showTree ? <EyeOff size={16} /> : <Eye size={16} />}
                                {showTree ? 'Ocultar árbol' : 'Explorador visualización'}
                            </button>

                            <button
                                onClick={load}
                                className={`w-full flex items-center justify-center gap-2 ${colorStyle.primary} font-medium py-2 px-4 rounded-lg transition-all shadow-sm text-sm`}
                            >
                                <RefreshCw size={16} /> Actualizar
                            </button>
                            {status && <p className="text-xs text-red-500 mt-2">{status}</p>}
                        </>
                    )}
                </div>
            </section>

            {/* Resumen */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5">
                <h2 className="text-xs sm:text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
                    Resumen
                </h2>
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-100 rounded-lg py-2">
                        <div className="text-xl font-bold text-slate-800">{graphStats.nodes || 0}</div>
                        <div className="text-xs text-slate-500">nodos</div>
                    </div>
                    <div className="bg-slate-100 rounded-lg py-2">
                        <div className="text-xl font-bold text-slate-800">{graphStats.edges || 0}</div>
                        <div className="text-xs text-slate-500">aristas</div>
                    </div>
                    <div className="bg-slate-100 rounded-lg py-2">
                        <div className="text-xl font-bold text-slate-800">{tableRowsLength || 0}</div>
                        <div className="text-xs text-slate-500">filas</div>
                    </div>
                </div>
            </section>

            {/* Exportar */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5">
                <h2 className="text-xs sm:text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-4">
                    <Download size={16} className={colorStyle.text} />
                    Exportar
                </h2>
                <div className="flex flex-col space-y-2">
                    <button
                        onClick={exportCsv}
                        className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium py-2 px-4 rounded-lg transition-all"
                    >
                        CSV tabla
                    </button>
                    <button
                        onClick={exportJson}
                        className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium py-2 px-4 rounded-lg transition-all"
                    >
                        JSON grafo
                    </button>
                </div>
            </section>

            {/* Importar JSON */}
            {(siteType === 'morro' || siteType === 'azapa') && (
                <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5">
                    <h2 className="text-xs sm:text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-4">
                        <UploadCloud size={16} className={colorStyle.text} />
                        Importar JSON
                    </h2>
                    <div className="space-y-3">
                        {siteType === 'morro' && (
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">
                                    Tipo de archivo
                                </label>
                                <select
                                    value={uploadTipo}
                                    onChange={(e) => setUploadTipo(e.target.value)}
                                    className={`w-full rounded-lg border border-slate-300 bg-white text-sm px-3 py-2 text-slate-700 focus:ring-2 ${colorStyle.ring} focus:border-transparent`}
                                >
                                    {uploadTipos.map((tipo) => (
                                        <option key={tipo} value={tipo}>
                                            {tipo === 'morro1_analisis_quimico' ? 'Análisis químico' : 'Paleopatología'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {siteType === 'azapa' && (
                            <div className="flex items-center justify-between bg-slate-100 rounded-lg px-3 py-2">
                                <span className="text-xs font-medium text-slate-500">Tipo de archivo</span>
                                <span className="text-sm font-semibold text-slate-700">Análisis químico</span>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">
                                Archivo .json
                            </label>
                            <input
                                type="file"
                                accept="application/json,.json"
                                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                                className="w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 file:text-xs file:font-medium hover:file:bg-slate-200 cursor-pointer"
                            />
                        </div>

                        <button
                            onClick={handleUpload}
                            disabled={uploading || !uploadFile}
                            className={`w-full flex items-center justify-center gap-2 ${colorStyle.primary} disabled:opacity-50 disabled:cursor-not-allowed font-medium py-2 px-4 rounded-lg transition-all shadow-sm text-sm`}
                        >
                            <UploadCloud size={16} /> {uploading ? 'Subiendo...' : 'Subir e importar'}
                        </button>
                        {uploadStatus && <p className="text-xs text-slate-500 mt-1">{uploadStatus}</p>}
                    </div>
                </section>
            )}
        </aside>
    );
}