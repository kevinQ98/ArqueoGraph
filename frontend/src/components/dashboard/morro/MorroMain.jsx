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
    setPcaData,          // <-- nuevo
    mediciones,
    showTree,
    selectedRelations,
}) {
    // Preparar datos para DetailPanel
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

    return (
        <div className="space-y-6">
            {/* Panel principal: grafo/árbol o PCA + detalle */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                {/* Encabezado con filtros */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Network size={20} className="text-blue-500" />
                        {pcaData ? "PCA - Análisis de componentes principales" : (showTree ? "Árbol Morro1" : "Grafo Morro1")}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-slate-500">Elemento:</span>
                        <div className="flex flex-wrap gap-1">
                            {(options.elementos || []).map((el) => (
                                <button
                                    key={el}
                                    onClick={() => setSelectedElement(el)}
                                    className={`px-3 py-1 text-xs rounded-full border transition-all ${selectedElement === el
                                        ? "bg-blue-600 text-white border-blue-600 font-semibold"
                                        : "bg-white text-slate-700 border-slate-300 hover:border-blue-400"
                                        }`}
                                >
                                    {el}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-slate-500">Patología:</span>
                        <div className="flex flex-wrap gap-1">
                            <button
                                onClick={() => setSelectedPatologia("")}
                                className={`px-3 py-1 text-xs rounded-full border transition-all ${selectedPatologia === ""
                                    ? "bg-blue-600 text-white border-blue-600 font-semibold"
                                    : "bg-white text-slate-700 border-slate-300 hover:border-blue-400"
                                    }`}
                            >
                                Ninguna
                            </button>
                            <button
                                onClick={() => setSelectedPatologia("RED_COMPLETA")}
                                className={`px-3 py-1 text-xs rounded-full border transition-all ${selectedPatologia === "RED_COMPLETA"
                                    ? "bg-blue-600 text-white border-blue-600 font-semibold"
                                    : "bg-white text-slate-700 border-slate-300 hover:border-blue-400"
                                    }`}
                            >
                                Red completa
                            </button>
                            {(options.patologias || []).map((p) => (
                                <button
                                    key={p}
                                    onClick={() => setSelectedPatologia(p)}
                                    className={`px-3 py-1 text-xs rounded-full border transition-all ${selectedPatologia === p
                                        ? "bg-blue-600 text-white border-blue-600 font-semibold"
                                        : "bg-white text-slate-700 border-slate-300 hover:border-blue-400"
                                        }`}
                                >
                                    {p}
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
                                <BarChart3 size={18} className="text-blue-500" />
                                PCA multielemento
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Selecciona tres o más elementos. El cálculo usa casos con todas las mediciones y estandarización z-score.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {(options.elementos || []).filter((el) => el !== "Ninguna").map((el) => (
                                <button
                                    key={`pca-${el}`}
                                    onClick={() => togglePcaElement(el)}
                                    className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${pcaElements.includes(el)
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                            : 'bg-white text-slate-700 border-slate-300 hover:border-blue-400 hover:bg-slate-50'
                                        }`}
                                >
                                    {el}
                                </button>
                            ))}
                            <button
                                onClick={loadPca}
                                disabled={pcaElements.length < 3}
                                className="px-4 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                            >
                                Calcular PCA ({pcaElements.length})
                            </button>
                            {pcaData && (
                                <button
                                    onClick={() => setPcaData(null)}
                                    className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1"
                                >
                                    <X size={16} /> Cerrar PCA
                                </button>
                            )}
                        </div>
                    </div>
                    {pcaStatus && <p className="text-sm text-red-500 mt-2">{pcaStatus}</p>}
                </div>

                {/* Grid de 3 columnas: grafo/árbol o PCA + detalle */}
                <div className="grid lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2">
                        {pcaData ? (
                            // Mostrar el PCA en lugar del grafo/árbol
                            <div>
                                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-800">
                                            PCA: {pcaData.elements.join(" + ")}
                                        </h3>
                                        <p className="text-xs text-slate-500">
                                            {pcaData.summary.complete_cases} casos completos · Haz clic en un punto para ver su detalle.
                                        </p>
                                    </div>
                                    <div className="flex gap-4 text-xs font-medium text-slate-600">
                                        <span>PC1 <strong className="text-slate-900">{(pcaData.explained_variance.pc1 * 100).toFixed(1)}%</strong></span>
                                        <span>PC2 <strong className="text-slate-900">{(pcaData.explained_variance.pc2 * 100).toFixed(1)}%</strong></span>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 mb-3">
                                    <span className="text-xs font-medium text-slate-500">Colorear puntos por</span>
                                    <button
                                        onClick={() => setPcaColorBy("sexo")}
                                        className={`px-3 py-1 text-xs rounded-full border transition-all ${pcaColorBy === "sexo"
                                            ? "bg-blue-600 text-white border-blue-600"
                                            : "bg-white text-slate-700 border-slate-300 hover:border-blue-400"
                                            }`}
                                    >
                                        Sexo
                                    </button>
                                    <button
                                        onClick={() => setPcaColorBy("edad")}
                                        className={`px-3 py-1 text-xs rounded-full border transition-all ${pcaColorBy === "edad"
                                            ? "bg-blue-600 text-white border-blue-600"
                                            : "bg-white text-slate-700 border-slate-300 hover:border-blue-400"
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
                            // Mostrar grafo o árbol normal
                            <>
                                {showTree ? (
                                    <TreeGraph
                                        graph={morroTreeGraph}
                                        rootLabel="MORRO1"
                                        focusElement={selectedElement}
                                        onSelect={handleSelectNode}
                                        selectedNodeId={selected?.id || ""}
                                    />
                                ) : (
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
                                )}
                                <p className="text-xs text-slate-500 mt-3">
                                    Azul = masculino, rojo = femenino, gris = no determinado/probable.
                                    {!showTree && " Tamaño = concentración."}
                                </p>
                            </>
                        )}
                    </div>

                    {/* Columna lateral: Detalle + Imágenes (siempre visible) */}
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

            {/* Tabla filtrada (siempre visible) */}
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