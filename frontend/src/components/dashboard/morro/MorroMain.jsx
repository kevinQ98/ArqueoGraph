// src/components/dashboard/morro/MorroMain.jsx
import { Network, BarChart3, X } from 'lucide-react';
import { PcaChart } from '../../PcaChart';
import { InteractiveGraph } from '../../Interactivegraph';
import { TreeGraph } from '../../Treegraph';
import { ImagePanel } from '../../ImagePanel';
import DetailPanel from '../DetailPanel';
import DataTable from '../DataTable';
import { checkAndFix } from '../../../lib/utils';

export default function MorroMain({
    graph,
    selectedElement, setSelectedElement,
    selectedPatologia, setSelectedPatologia,
    handleSelectNode,
    selected,
    selectedImages,
    showImages,
    showElementEdges,
    hideElementNodes,
    morroTreeGraph,
    options,
    pcaElements, togglePcaElement, loadPca, pcaStatus, pcaData, pcaColorBy, setPcaColorBy,
    setPcaData,
    mediciones,
    showTree, setShowTree,   // <-- ahora necesitamos setShowTree aquí también
    selectedRelations,
    siteName = "Morro 1",
    pcaMode, setPcaMode,
    resetPca,
}) {
    const detailData = selected ? {
        label: selected.label,
        type: selected.type,
        sexo: selected.sexo,
        edad: selected.edad,
        estilo: selected.estilo_momificacion,
        estado: selected.estado,
        referencia_datos: selected.referencia_datos,
        matriz: selected.matriz,
        mediciones: selected.mediciones,
        relations: selectedRelations?.map(edge => ({
            label: edge.label,
            target: edge.otherNode?.label || edge.otherNode?.id || edge.target
        }))
    } : null;

    const activeTab = pcaMode ? "pca" : (showTree ? "tree" : "graph");

    function goToTab(tab) {
        if (tab === "pca") {
            setPcaMode(true);
        } else {
            if (pcaMode) resetPca();          // sale de PCA y limpia selección
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
                                    ? "text-blue-600"
                                    : "text-slate-500 hover:text-slate-700"
                                    }`}
                            >
                                {tab.label}
                                {activeTab === tab.key && (
                                    <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-blue-600 rounded-full" />
                                )}
                            </button>
                        ))}
                    </div>
                    <span className="hidden sm:block text-xs font-medium text-slate-400 pb-3">
                        {siteName}
                    </span>
                </div>

                {/* Toolbar contextual */}
                {activeTab !== "pca" ? (
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3 bg-slate-50/70 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Elemento</span>
                            <div className="flex flex-wrap gap-1">
                                {(options.elementos || []).map((el) => (
                                    <button
                                        key={el}
                                        onClick={() => setSelectedElement(el)}
                                        className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${selectedElement === el
                                            ? "bg-blue-600 text-white border-blue-600 font-semibold"
                                            : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                                            }`}
                                    >
                                        {el}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Patología</span>
                            <select
                                value={selectedPatologia}
                                onChange={(e) => setSelectedPatologia(e.target.value)}
                                className="rounded-md border border-slate-200 bg-white text-xs px-2 py-1.5 text-slate-700 focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                            >
                                <option value="">Ninguna</option>
                                <option value="RED_COMPLETA">Red completa</option>
                                {(options.patologias || []).map((p) => (
                                    <option key={p} value={p}>{p}</option>
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
                                    {(options.elementos || []).filter((el) => el !== "Ninguna").map((el) => (
                                        <button
                                            key={`pca-${el}`}
                                            onClick={() => togglePcaElement(el)}
                                            className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${pcaElements.includes(el)
                                                ? "bg-blue-600 text-white border-blue-600"
                                                : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                                                }`}
                                        >
                                            {el}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={loadPca}
                                    disabled={pcaElements.length < 3}
                                    className="px-4 py-1.5 text-sm font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    Calcular ({pcaElements.length})
                                </button>
                                <button
                                    onClick={resetPca}
                                    className="px-3 py-1.5 text-sm font-medium rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors flex items-center gap-1"
                                >
                                    <X size={14} /> Salir
                                </button>
                            </div>
                        </div>
                        {pcaStatus && <p className="text-xs text-red-500 mt-2">{pcaStatus}</p>}
                    </div>
                )}

                {/* Contenido */}
                <div className="grid lg:grid-cols-3 gap-4 p-5">
                    <div className="lg:col-span-2">
                        {pcaMode ? (
                            pcaData ? (
                                <div>
                                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                        <div>
                                            <h3 className="text-sm font-semibold text-slate-800">
                                                {pcaData.elements.join(" + ")}
                                            </h3>
                                            <p className="text-xs text-slate-500">
                                                {pcaData.summary.complete_cases} casos completos · clic en un punto para ver detalle
                                            </p>
                                        </div>
                                        <div className="flex gap-4 text-xs font-medium text-slate-600">
                                            <span>PC1 <strong className="text-slate-900">{(pcaData.explained_variance.pc1 * 100).toFixed(1)}%</strong></span>
                                            <span>PC2 <strong className="text-slate-900">{(pcaData.explained_variance.pc2 * 100).toFixed(1)}%</strong></span>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 mb-3">
                                        <span className="text-xs font-medium text-slate-500 mr-1">Color por</span>
                                        <button
                                            onClick={() => setPcaColorBy("sexo")}
                                            className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${pcaColorBy === "sexo" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                                                }`}
                                        >
                                            Sexo
                                        </button>
                                        <button
                                            onClick={() => setPcaColorBy("edad")}
                                            className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${pcaColorBy === "edad" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                                                }`}
                                        >
                                            Edad
                                        </button>
                                    </div>
                                    {(pcaData.warnings || []).map((warning) => (
                                        <p key={warning} className="text-xs text-amber-600 mb-2">{warning}</p>
                                    ))}
                                    <PcaChart data={pcaData} onSelect={handleSelectNode} colorBy={pcaColorBy} />
                                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
                                        <span className="font-medium text-slate-700">Cargas:</span>
                                        {pcaData.loadings.map((loading) => (
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
                            <TreeGraph
                                graph={morroTreeGraph}
                                rootLabel={siteName}
                                focusElement={selectedElement}
                                onSelect={handleSelectNode}
                                selectedNodeId={selected?.id || ""}
                            />
                        ) : (
                            <>
                                <InteractiveGraph
                                    graph={graph}
                                    elemento={selectedElement === "Ninguna" ? undefined : selectedElement}
                                    mode="distancia"
                                    onSelect={handleSelectNode}
                                    selectedNodeId={selected?.id || ""}
                                    imageNodes={selectedImages}
                                    showImages={showImages}
                                    showElementEdges={showElementEdges}
                                    hideElementNodes={hideElementNodes}
                                />
                                <p className="text-xs text-slate-500 mt-3 flex flex-wrap items-center gap-2">
                                    <span>🔵 Masculino · 🔴 Femenino · ⚪ Indeterminado</span>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 font-bold rounded-full text-slate-100 bg-blue-500">
                                        Concentración: cerca del centro = mayor
                                    </span>
                                </p>
                            </>
                        )}
                    </div>

                    <div className="space-y-4">
                        <DetailPanel
                            data={detailData}
                            accentColor="blue"
                            emptyMessage="Selecciona un nodo en el grafo MORRO1 para ver su información detallada."
                        />
                        <ImagePanel
                            individuo={{ id: (selected?.id || selected?.numero_cuerpo) || "", label: selected?.label }}
                            images={selectedImages || []}
                            title="Imágenes"
                            emptyMessage="Selecciona un nodo en el grafo MORRO1 para ver sus imágenes."
                            emptyHint="Selecciona un nodo con imágenes para verlas aquí."
                            caseLabelPrefix="Caso:"
                        />
                    </div>
                </div>
            </div>

            <DataTable
                title="Tabla filtrada"
                iconColor="text-blue-500"
                headers={["Caso", "Cuerpo", "Sexo", "Edad", "Elemento", "ppm"]}
                rows={mediciones}
                maxHeight="h-72"
                renderRow={(m, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2 whitespace-nowrap text-slate-700">{m.id_documento || m.id_caso}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-slate-700">{m.numero_cuerpo || m.caso}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-slate-700">{m.sexo}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-slate-700">{m.edad}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-slate-700">{m.elemento}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-slate-700">{checkAndFix(m.concentracion)}</td>
                    </tr>
                )}
                emptyMessage="No hay mediciones para mostrar."
            />
        </div>
    );
}
