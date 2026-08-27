import { useRef } from "react";
import {
  AlertTriangle,
  Beaker,
  BookOpen,
  Download,
  GitBranch,
  Maximize2,
  Microscope,
  Network,
  ScatterChart,
  Table2,
} from "lucide-react";
import { InteractiveGraph } from "../../components/Interactivegraph";
import { PcaChart } from "../../components/PcaChart";
import { TreeGraph } from "../../components/Treegraph";
import { checkAndFix } from "../../lib/utils";
import { SiteDetailPanel } from "./SiteDetailPanel";

const TABS = [
  { id: "network", label: "Red", icon: Network },
  { id: "tree", label: "Árbol", icon: GitBranch },
  { id: "pca", label: "PCA", icon: ScatterChart },
  { id: "data", label: "Datos", icon: Table2 },
  { id: "samples", label: "Muestras", icon: Microscope },
];

function DataView({ rows, onSelect }) {
  return (
    <div className="explorerDataView">
      <table>
        <thead>
          <tr><th>Individuo</th><th>Muestra</th><th>Sexo</th><th>Edad</th><th>Elemento</th><th>Concentración</th><th>Matriz</th><th>Fuente analítica</th></tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const id = row.id_individuo || row.id_caso || row.id_documento;
            return (
              <tr key={`${id}-${row.elemento || "row"}-${index}`} onClick={() => onSelect({
                ...row,
                id,
                id_individuo: id,
                type: "individuo",
                label: row.numero_cuerpo || row.caso || row.id_documento || id,
              })}>
                <td><strong>{row.numero_cuerpo || row.caso || row.id_documento || id}</strong><small>{id}</small></td>
                <td><strong>{row.codigo_muestra || "—"}</strong><small>{row.muestra_inferida ? "Reconstruida" : row.id_muestra || ""}</small></td>
                <td>{row.sexo || "—"}</td>
                <td>{row.edad || "—"}</td>
                <td>{row.elemento || "—"}</td>
                <td>{row.concentracion === null || row.concentracion === undefined ? "—" : `${checkAndFix(row.concentracion)} ${row.unidad || "ppm"}`}</td>
                <td>{row.matriz || row.tipo_muestra || "—"}</td>
                <td><span title={row.referencia_cita || row.referencia_titulo || ""}>{row.referencia_titulo || "—"}</span></td>
              </tr>
            );
          })}
          {!rows.length && <tr><td colSpan="8" className="explorerNoData">No hay filas para los filtros actuales.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function AnalyticalContext({ context, filters, selected, detail }) {
  const sample = selected?.type === "muestra" ? (detail?.sample || selected) : null;
  const specificElement = filters.elemento !== "Ninguna" && filters.elemento !== "Red Completa"
    ? filters.elemento
    : "";
  if (!context || (!sample && !specificElement && selected?.type !== "elemento")) return null;

  const selectedMatrix = (context.matrices || []).find((item) => (
    item.codigo === filters.matriz || item.id_matriz === filters.matriz
  ));
  const selectedReference = (context.referencias || []).find((item) => item.id_referencia === filters.referencia);
  const analyses = sample?.analisis_detalle || [];
  const sampleReferences = sample?.referencias || analyses
    .filter((analysis) => analysis.id_referencia)
    .map((analysis) => ({ id_referencia: analysis.id_referencia, titulo: analysis.referencia_titulo }));
  const sampleUnits = sample?.unidades || analyses.flatMap((analysis) => (
    (analysis.mediciones || []).map((measurement) => measurement.unidad).filter(Boolean)
  ));
  const units = [...new Set(sampleUnits.length
    ? sampleUnits
    : (context.elementos || []).flatMap((item) => item.unidades || []))];
  const matrixLabel = sample?.matriz?.nombre || selectedMatrix?.nombre
    || ((context.matrices || []).length === 1 ? context.matrices[0].nombre : `${context.matrices?.length || 0} matrices`);
  const uniqueSampleReferences = [...new Map(sampleReferences.map((reference) => (
    [reference.id_referencia || reference.titulo, reference]
  ))).values()];
  const referenceLabel = uniqueSampleReferences.length === 1
    ? uniqueSampleReferences[0].titulo
    : uniqueSampleReferences.length > 1
      ? `${uniqueSampleReferences.length} fuentes analíticas`
      : selectedReference?.titulo
    || ((context.referencias || []).length === 1 ? context.referencias[0].titulo : `${context.referencias?.length || 0} fuentes compatibles`);
  const measurementCount = sample
    ? Number(sample.mediciones ?? analyses.reduce((total, analysis) => total + (analysis.mediciones?.length || 0), 0))
    : context.summary?.mediciones || 0;
  const measurementLabel = `${measurementCount} ${measurementCount === 1 ? "medición" : "mediciones"}`;
  const warnings = sample
    ? (sample.es_inferida ? [{ code: "inferred_sample", severity: "warning", count: "Inferida", message: "Muestra reconstruida desde mediciones históricas; su código físico requiere validación." }] : [])
    : context.warnings || [];
  const contextTitle = sample
    ? `Muestra ${sample.codigo_muestra || selected.label || "seleccionada"}`
    : `Elemento ${specificElement || selected?.elemento || selected?.label || "seleccionado"}`;

  return (
    <section className="explorerContextBar" aria-label="Contexto analítico activo">
      <div className="explorerContextTitle"><Beaker size={15} /><span>{contextTitle}</span></div>
      <dl>
        <div><dt>Matriz</dt><dd>{matrixLabel}</dd></div>
        <div className="reference"><dt>Fuente</dt><dd title={selectedReference?.cita || referenceLabel}>{referenceLabel}</dd></div>
        <div><dt>Unidades</dt><dd>{units.length ? units.join(" · ") : "Sin datos"}</dd></div>
        <div><dt>Cobertura</dt><dd>{sample ? `1 muestra · ${measurementLabel}` : `${context.summary?.muestras || 0} muestras · ${measurementLabel}`}</dd></div>
      </dl>
      {warnings.length > 0 && (
        <div className="explorerContextWarnings">
          {warnings.map((warning) => (
            <span key={warning.code} title={warning.message} className={warning.severity === "warning" ? "warning" : "info"}>
              <AlertTriangle size={13} /> {warning.count}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function SamplesView({ samples, onSelect }) {
  return (
    <div className="explorerDataView explorerSamplesView">
      <table>
        <thead>
          <tr><th>Muestra</th><th>Individuo</th><th>Matriz biológica</th><th>Fuente analítica</th><th>Elementos</th><th>Estado</th></tr>
        </thead>
        <tbody>
          {samples.map((sample) => (
            <tr
              key={sample.id_muestra}
              onClick={() => onSelect({
                ...sample,
                id: sample.id_muestra,
                id_muestra: sample.id_muestra,
                id_individuo: sample.individuo?.id_individuo,
                label: sample.codigo_muestra,
                type: "muestra",
              })}
            >
              <td><strong>{sample.codigo_muestra}</strong><small>{sample.id_muestra}</small></td>
              <td><strong>{sample.individuo?.numero_cuerpo || sample.individuo?.id_documento || "—"}</strong><small>{sample.individuo?.id_individuo}</small></td>
              <td><strong>{sample.matriz?.nombre || "—"}</strong><small>{sample.tipo_muestra_original || sample.matriz?.codigo}</small></td>
              <td>
                <strong>{sample.referencias?.[0]?.titulo || "Sin referencia"}</strong>
                <small>{sample.referencias?.length > 1 ? `+${sample.referencias.length - 1} fuentes` : `${sample.analisis} análisis`}</small>
              </td>
              <td><strong>{(sample.elementos || []).join(" · ") || "—"}</strong><small>{(sample.unidades || []).join(" · ")}</small></td>
              <td><span className={sample.es_inferida ? "explorerSampleState inferred" : "explorerSampleState"}>{sample.es_inferida ? "Reconstruida" : "Registrada"}</span></td>
            </tr>
          ))}
          {!samples.length && <tr><td colSpan="6" className="explorerNoData">No hay muestras para los filtros actuales.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function PcaView({ pca, elements, availableElements, onToggle, onCalculate, onColorBy, onPathology, onSelect }) {
  const pathologyOptions = pca.data?.pathology_options || [];
  const pcaContext = pca.data?.analysis_context;

  return (
    <div className="explorerPcaView">
      <div className="explorerPcaControls">
        <div>
          <span>Elementos para el análisis</span>
          <div>
            {availableElements.map((element) => (
              <button type="button" key={element} className={elements.includes(element) ? "active" : ""} onClick={() => onToggle(element)}>{element}</button>
            ))}
          </div>
        </div>
        <button type="button" className="explorerPcaCalculate" disabled={elements.length < 3 || pca.loading} onClick={onCalculate}>
          {pca.loading ? "Calculando..." : `Calcular PCA (${elements.length})`}
        </button>
      </div>

      {pca.error && <p className="explorerPcaMessage error">{pca.error}</p>}
      {!pca.data && !pca.error && <div className="explorerPcaEmpty"><ScatterChart size={34} /><p>Selecciona al menos tres elementos para calcular el PCA.</p></div>}
      {pca.data && (
        <div className="explorerPcaResult">
          <header>
            <div><strong>{pca.data.elements.join(" + ")}</strong><span>{pca.data.summary?.complete_cases || 0} casos completos</span></div>
            <div className="explorerPcaDisplay">
              <span>Color de puntos</span>
              <div className="explorerSegmented">
                <button type="button" className={pca.colorBy === "sexo" ? "active" : ""} onClick={() => onColorBy("sexo")}>Sexo</button>
                <button type="button" className={pca.colorBy === "edad" ? "active" : ""} onClick={() => onColorBy("edad")}>Edad</button>
                <button
                  type="button"
                  className={pca.colorBy === "patologia" ? "active" : ""}
                  disabled={!pathologyOptions.length}
                  title={pathologyOptions.length ? "Mostrar estado paleopatológico" : "Este sitio no tiene patologías registradas"}
                  onClick={() => onColorBy("patologia")}
                >
                  Patología
                </button>
              </div>
              {pca.colorBy === "patologia" && pathologyOptions.length > 0 && (
                <label className="explorerPcaPathologySelect">
                  <span>Patología disponible</span>
                  <select value={pca.pathology} onChange={(event) => onPathology(event.target.value)}>
                    {pathologyOptions.map((pathology) => (
                      <option key={pathology} value={pathology}>{pathology.replaceAll("_", " ")}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </header>
          {pcaContext && (
            <div className="explorerPcaProvenance">
              <Beaker size={14} />
              <span><strong>Matriz:</strong> {pcaContext.matriz?.nombre || pcaContext.matriz?.codigo || "Sin declarar"}</span>
              <BookOpen size={14} />
              <span title={(pcaContext.referencias || []).map((item) => item.cita || item.titulo).join("\n")}>
                <strong>Fuente:</strong> {pcaContext.referencia?.titulo || `${pcaContext.referencias?.length || 0} referencias`}
              </span>
              <span><strong>Unidades:</strong> {Object.entries(pcaContext.unidades || {}).map(([element, unit]) => `${element} ${unit}`).join(" · ")}</span>
            </div>
          )}
          {(pca.data.warnings || []).map((warning) => (
            <p key={warning.code} className="explorerPcaMessage"><AlertTriangle size={14} /> {warning.message}</p>
          ))}
          <PcaChart data={pca.data} onSelect={onSelect} colorBy={pca.colorBy} selectedPathology={pca.pathology} />
        </div>
      )}
    </div>
  );
}

export function SiteWorkspace({
  siteName,
  graph,
  treeGraph,
  tableRows,
  activeTab,
  onTabChange,
  selected,
  detail,
  detailLoading,
  onSelect,
  onCloseDetail,
  selectedElement,
  showElementEdges,
  options,
  filters,
  analysisContext,
  showAnalyticalContext,
  samples,
  pca,
  pcaElements,
  onTogglePcaElement,
  onCalculatePca,
  onPcaColorBy,
  onPcaPathology,
  onExportJson,
}) {
  const stageRef = useRef(null);

  function openFullscreen() {
    stageRef.current?.requestFullscreen?.();
  }

  return (
    <section className={showAnalyticalContext ? "explorerWorkspace hasAnalyticalContext" : "explorerWorkspace"} ref={stageRef}>
      <header className="explorerToolbar">
        <nav aria-label="Visualizaciones del sitio">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button type="button" key={id} className={activeTab === id ? "active" : ""} onClick={() => onTabChange(id)}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </nav>
        <div className="explorerToolbarActions">
          <span><i className="individual" /> Individuo <i className="sample" /> Muestra <i className="site" /> Sitio</span>
          <button type="button" onClick={onExportJson} title="Descargar grafo"><Download size={16} /></button>
          <button type="button" onClick={openFullscreen} title="Pantalla completa"><Maximize2 size={16} /></button>
        </div>
      </header>

      {showAnalyticalContext && (
        <AnalyticalContext context={analysisContext} filters={filters} selected={selected} detail={detail} />
      )}

      <div className="explorerWorkspaceBody">
        <div className="explorerCanvas">
          {activeTab === "network" && (
            <InteractiveGraph
              graph={graph}
              elemento={selectedElement === "Ninguna" || selectedElement === "Red Completa" ? undefined : selectedElement}
              mode="distancia"
              onSelect={onSelect}
              selectedNodeId={selected?.id || ""}
              showElementEdges={showElementEdges}
              height={680}
            />
          )}
          {activeTab === "tree" && (
            <TreeGraph
              graph={treeGraph}
              rootLabel={siteName}
              focusGroup={selectedElement}
              onSelect={onSelect}
              selectedNodeId={selected?.id || ""}
              height={680}
            />
          )}
          {activeTab === "pca" && (
            <PcaView
              pca={pca}
              elements={pcaElements}
              availableElements={options.elementos || []}
              onToggle={onTogglePcaElement}
              onCalculate={onCalculatePca}
              onColorBy={onPcaColorBy}
              onPathology={onPcaPathology}
              onSelect={onSelect}
            />
          )}
          {activeTab === "data" && <DataView rows={tableRows} onSelect={onSelect} />}
          {activeTab === "samples" && <SamplesView samples={samples} onSelect={onSelect} />}
        </div>

        <SiteDetailPanel selected={selected} detail={detail} loading={detailLoading} onClose={onCloseDetail} />
      </div>
    </section>
  );
}
