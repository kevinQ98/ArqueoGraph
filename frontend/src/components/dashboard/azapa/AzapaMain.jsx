// src/components/dashboard/azapa/AzapaMain.jsx
import { Network, BarChart3, X } from 'lucide-react';
import { PcaChart } from '../../PcaChart';
import { InteractiveGraph } from '../../Interactivegraph';
import { AzapaTreeGraph } from '../../Treegraph';
import { ImagePanel } from '../../ImagePanel';
import DetailPanel from '../DetailPanel';
import DataTable from '../DataTable';

export default function AzapaMain({
    azapaGraph,
    selectedAzapaElement, setSelectedAzapaElement, azapaElementOptions,
    azapaMatriz, setAzapaMatriz, azapaMatrizOptions,
    handleSelectAzapaNode,
    selectedAzapaCase,
    showElementEdges,
    azapaTreeGraph,
    azapaTableRows,
    azapaPcaElements, toggleAzapaPcaElement, loadAzapaPca, azapaPcaStatus, azapaPcaData, azapaPcaColorBy, setAzapaPcaColorBy,
    setAzapaPcaData,
    showTree,
}) {
    // Preparar datos para DetailPanel
    const detailData = selectedAzapaCase?.reference ? {
        label: selectedAzapaCase.reference.tumba || selectedAzapaCase.case_id,
        sexo: selectedAzapaCase.reference.sexo,
        edad: selectedAzapaCase.reference.edad,
        extraFields: [
            { label: "Id", value: selectedAzapaCase.reference.id || selectedAzapaCase.case_id },
            { label: "Cultura", value: selectedAzapaCase.reference.cultura || "—" },
            { label: "Imágenes", value: String(selectedAzapaCase.images_count || 0) }
        ]
    } : null;

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                {/* Encabezado con filtros */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Network size={20} className="text-emerald-500" />
                        {azapaPcaData ? "PCA - Análisis de componentes principales" : (showTree ? "Árbol Azapa" : "Grafo Azapa")}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-slate-500">Elemento:</span>
                        <div className="flex flex-wrap gap-1">
                            {azapaElementOptions.map((option) => (
                                <button
                                    key={option}
                                    onClick={() => setSelectedAzapaElement(option)}
                                    className={`px-3 py-1 text-xs rounded-full border transition-all ${selectedAzapaElement === option
                                        ? "bg-emerald-600 text-white border-emerald-600 font-semibold"
                                        : "bg-white text-slate-700 border-slate-300 hover:border-emerald-400"
                                        }`}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-slate-500">Matriz:</span>
                        <div className="flex flex-wrap gap-1">
                            <button
                                onClick={() => setAzapaMatriz("")}
                                className={`px-3 py-1 text-xs rounded-full border transition-all ${!azapaMatriz
                                    ? "bg-emerald-600 text-white border-emerald-600 font-semibold"
                                    : "bg-white text-slate-700 border-slate-300 hover:border-emerald-400"
                                    }`}
                            >
                                Todas
                            </button>
                            {(azapaMatrizOptions || []).map((mat) => (
                                <button
                                    key={mat}
                                    onClick={() => setAzapaMatriz(mat)}
                                    className={`px-3 py-1 text-xs rounded-full border transition-all ${azapaMatriz === mat
                                        ? "bg-emerald-600 text-white border-emerald-600 font-semibold"
                                        : "bg-white text-slate-700 border-slate-300 hover:border-emerald-400"
                                        }`}
                                >
                                    {mat}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Controles de PCA */}
                <div className="mb-4 pt-4 border-t border-slate-200">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                        <div className="flex-1">
                            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                <BarChart3 size={18} className="text-emerald-500" />
                                PCA multielemento
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Selecciona tres o más elementos. El cálculo usa casos con todas las mediciones y estandarización z-score.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {(azapaElementOptions || []).filter((el) => el !== "Ninguna" && el !== "Red Completa").map((el) => (
                                <button
                                    key={`azapa-pca-${el}`}
                                    onClick={() => toggleAzapaPcaElement(el)}
                                    className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${azapaPcaElements.includes(el)
                                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                            : 'bg-white text-slate-700 border-slate-300 hover:border-emerald-400 hover:bg-slate-50'
                                        }`}
                                >
                                    {el}
                                </button>
                            ))}
                            <button
                                onClick={loadAzapaPca}
                                disabled={azapaPcaElements.length < 3}
                                className="px-4 py-1.5 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                            >
                                Calcular PCA ({azapaPcaElements.length})
                            </button>
                            {azapaPcaData && (
                                <button
                                    onClick={() => setAzapaPcaData(null)}
                                    className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1"
                                >
                                    <X size={16} /> Cerrar PCA
                                </button>
                            )}
                        </div>
                    </div>
                    {azapaPcaStatus && <p className="text-sm text-red-500 mt-2">{azapaPcaStatus}</p>}
                </div>

                {/* Grid de 3 columnas */}
                <div className="grid lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2">
                        {azapaPcaData ? (
                            // Mostrar el PCA en lugar del grafo/árbol
                            <div>
                                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-800">
                                            PCA: {azapaPcaData.elements.join(" + ")}
                                        </h3>
                                        <p className="text-xs text-slate-500">
                                            {azapaPcaData.summary.complete_cases} casos completos · Haz clic en un punto para ver su detalle.
                                        </p>
                                    </div>
                                    <div className="flex gap-4 text-xs font-medium text-slate-600">
                                        <span>PC1 <strong className="text-slate-900">{(azapaPcaData.explained_variance.pc1 * 100).toFixed(1)}%</strong></span>
                                        <span>PC2 <strong className="text-slate-900">{(azapaPcaData.explained_variance.pc2 * 100).toFixed(1)}%</strong></span>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 mb-3">
                                    <span className="text-xs font-medium text-slate-500">Colorear puntos por</span>
                                    <button
                                        onClick={() => setAzapaPcaColorBy("sexo")}
                                        className={`px-3 py-1 text-xs rounded-full border transition-all ${azapaPcaColorBy === "sexo"
                                            ? "bg-emerald-600 text-white border-emerald-600"
                                            : "bg-white text-slate-700 border-slate-300 hover:border-emerald-400"
                                            }`}
                                    >
                                        Sexo
                                    </button>
                                    <button
                                        onClick={() => setAzapaPcaColorBy("edad")}
                                        className={`px-3 py-1 text-xs rounded-full border transition-all ${azapaPcaColorBy === "edad"
                                            ? "bg-emerald-600 text-white border-emerald-600"
                                            : "bg-white text-slate-700 border-slate-300 hover:border-emerald-400"
                                            }`}
                                    >
                                        Edad
                                    </button>
                                </div>
                                {(azapaPcaData.warnings || []).map((warning) => (
                                    <p key={warning} className="text-xs text-amber-600 mb-2">{warning}</p>
                                ))}
                                <PcaChart data={azapaPcaData} onSelect={handleSelectAzapaNode} colorBy={azapaPcaColorBy} />
                                <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
                                    <span className="font-medium text-slate-700">Cargas:</span>
                                    {azapaPcaData.loadings.map((loading) => (
                                        <span key={loading.elemento}>
                                            {loading.elemento}: PC1 {loading.pc1.toFixed(2)}, PC2 {loading.pc2.toFixed(2)}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ) : showTree ? (
                            <AzapaTreeGraph
                                graph={azapaTreeGraph}
                                focusElement={selectedAzapaElement}
                                onSelect={handleSelectAzapaNode}
                                selectedNodeId={selectedAzapaCase?.case_id || ""}
                            />
                        ) : (
                            <>
                                <InteractiveGraph
                                    graph={azapaGraph}
                                    elemento={selectedAzapaElement === "Ninguna" || selectedAzapaElement === "Red Completa" ? "" : selectedAzapaElement}
                                    mode="distancia"
                                    onSelect={handleSelectAzapaNode}
                                    selectedNodeId={selectedAzapaCase?.case_id || ""}
                                    showElementEdges={showElementEdges}
                                />
                                <p className="text-xs text-slate-500 mt-3">
                                    Azul = masculino, rojo = femenino, gris = no determinado/probable.
                                </p>
                            </>
                        )}
                    </div>

                    {/* Columna lateral: Detalle + Imágenes */}
                    <div className="space-y-4">
                        <DetailPanel
                            data={detailData}
                            accentColor="emerald"
                            emptyMessage="Selecciona un nodo en el grafo AZAPA para ver la referencia y las imágenes del caso."
                        />
                        {selectedAzapaCase && selectedAzapaCase.images?.length > 0 && (
                            <ImagePanel
                                individuo={{
                                    id: selectedAzapaCase.case_id,
                                    label: selectedAzapaCase.reference?.tumba || selectedAzapaCase.case_id
                                }}
                                images={selectedAzapaCase.images || []}
                                title="Imágenes"
                                emptyMessage="Este caso AZAPA todavía no tiene imágenes asociadas."
                                emptyHint="Selecciona un nodo del grafo AZAPA para ver la referencia y las imágenes del caso."
                                caseLabelPrefix="Caso AZAPA:"
                                onImagesChange={() => { }}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Tabla filtrada */}
            <DataTable
                title="Tabla filtrada AZAPA"
                iconColor="text-emerald-500"
                headers={["Caso", "Sexo", "Edad", "Elemento", "Valor", "Matriz", "Cultura"]}
                rows={azapaTableRows}
                maxHeight="h-72"
                renderRow={(row, index) => (
                    <tr key={`${row.id_caso}-${index}`} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2 whitespace-nowrap text-slate-700">{row.caso}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-slate-700">{row.sexo}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-slate-700">{row.edad}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-slate-700">{row.elemento}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-slate-700">{row.concentracion}{row.unidad ? ` ${row.unidad}` : ""}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-slate-700">{row.matriz}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-slate-700">{row.cultura}</td>
                    </tr>
                )}
                emptyMessage="No hay datos de Azapa para mostrar."
            />
        </div>
    );
}