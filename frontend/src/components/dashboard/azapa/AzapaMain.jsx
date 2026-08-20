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
    showTree, setShowTree,
    pcaMode, setPcaMode,
    resetPca,
}) {
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

    const activeTab = pcaMode ? "pca" : (showTree ? "tree" : "graph");

    function goToTab(tab) {
        if (tab === "pca") {
            setPcaMode(true);
        } else {
            if (pcaMode) resetPca();
            setShowTree(tab === "tree");
        }
    }

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">

                {/* Barra de tabs */}
                <div className="flex items-center justify-between border-b border-slate-200 px-5 pt-4">
                    <div className="flex items-center gap-1">
                        {[
                            { key: "graph", label: "Grafo" },
                            { key: "pca", label: "PCA" },
                        ].map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => goToTab(tab.key)}
                                className={`relative px-4 py-2.5 text-sm font-semibold transition-colors ${activeTab === tab.key
                                    ? "text-emerald-600"
                                    : "text-slate-500 hover:text-slate-700"
                                    }`}
                            >
                                {tab.label}
                                {activeTab === tab.key && (
                                    <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-emerald-600 rounded-full" />
                                )}
                            </button>
                        ))}
                    </div>
                    <span className="hidden sm:block text-xs font-medium text-slate-400 pb-3">
                        Azapa 140
                    </span>
                </div>

                {/* Toolbar contextual */}
                {activeTab !== "pca" ? (
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3 bg-slate-50/70 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Elemento</span>
                            <div className="flex flex-wrap gap-1">
                                {azapaElementOptions.map((option) => (
                                    <button
                                        key={option}
                                        onClick={() => setSelectedAzapaElement(option)}
                                        className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${selectedAzapaElement === option
                                            ? "bg-emerald-600 text-white border-emerald-600 font-semibold"
                                            : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"
                                            }`}
                                    >
                                        {option}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Matriz</span>
                            <select
                                value={azapaMatriz}
                                onChange={(e) => setAzapaMatriz(e.target.value)}
                                className="rounded-md border border-slate-200 bg-white text-xs px-2 py-1.5 text-slate-700 focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
                            >
                                <option value="">Todas</option>
                                {(azapaMatrizOptions || []).map((mat) => (
                                    <option key={mat} value={mat}>{mat}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                ) : (
                    <div className="px-5 py-4 bg-slate-50/70 border-b border-slate-100">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                            <div>
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                                    Elementos para PCA (mínimo 3)
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {(azapaElementOptions || []).filter((el) => el !== "Ninguna" && el !== "Red Completa").map((el) => (
                                        <button
                                            key={`azapa-pca-${el}`}
                                            onClick={() => toggleAzapaPcaElement(el)}
                                            className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${azapaPcaElements.includes(el)
                                                ? "bg-emerald-600 text-white border-emerald-600"
                                                : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"
                                                }`}
                                        >
                                            {el}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={loadAzapaPca}
                                    disabled={azapaPcaElements.length < 3}
                                    className="px-4 py-1.5 text-sm font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    Calcular ({azapaPcaElements.length})
                                </button>
                                <button
                                    onClick={resetPca}
                                    className="px-3 py-1.5 text-sm font-medium rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors flex items-center gap-1"
                                >
                                    <X size={14} /> Salir
                                </button>
                            </div>
                        </div>
                        {azapaPcaStatus && <p className="text-xs text-red-500 mt-2">{azapaPcaStatus}</p>}
                    </div>
                )}

                {/* Contenido */}
                <div className="grid lg:grid-cols-3 gap-4 p-5">
                    <div className="lg:col-span-2">
                        {pcaMode ? (
                            azapaPcaData ? (
                                <div>
                                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                        <div>
                                            <h3 className="text-sm font-semibold text-slate-800">
                                                {azapaPcaData.elements.join(" + ")}
                                            </h3>
                                            <p className="text-xs text-slate-500">
                                                {azapaPcaData.summary.complete_cases} casos completos · clic en un punto para ver detalle
                                            </p>
                                        </div>
                                        <div className="flex gap-4 text-xs font-medium text-slate-600">
                                            <span>PC1 <strong className="text-slate-900">{(azapaPcaData.explained_variance.pc1 * 100).toFixed(1)}%</strong></span>
                                            <span>PC2 <strong className="text-slate-900">{(azapaPcaData.explained_variance.pc2 * 100).toFixed(1)}%</strong></span>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 mb-3">
                                        <span className="text-xs font-medium text-slate-500 mr-1">Color por</span>
                                        <button
                                            onClick={() => setAzapaPcaColorBy("sexo")}
                                            className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${azapaPcaColorBy === "sexo" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"
                                                }`}
                                        >
                                            Sexo
                                        </button>
                                        <button
                                            onClick={() => setAzapaPcaColorBy("edad")}
                                            className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${azapaPcaColorBy === "edad" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"
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
                            ) : (
                                <div className="flex items-center justify-center h-64 text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl">
                                    Selecciona 3+ elementos y calcula el PCA para ver el gráfico.
                                </div>
                            )
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