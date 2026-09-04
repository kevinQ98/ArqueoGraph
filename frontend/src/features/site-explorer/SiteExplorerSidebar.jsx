import {
  BarChart3,
  Beaker,
  Download,
  Eye,
  RefreshCw,
  RotateCcw,
  UploadCloud,
} from "lucide-react";
import { useState } from "react";

function ElementDistribution({ rows = [], activeElement, onSelect }) {
  const maximum = Math.max(1, ...rows.map((row) => row.value));

  return (
    <div className="explorerDistribution" aria-label="Distribución de elementos">
      {rows.length ? rows.map((row) => (
        <button
          type="button"
          key={row.label}
          className={activeElement === row.label ? "active" : ""}
          onClick={() => onSelect(row.label)}
          title={`${row.label}: ${row.value} mediciones`}
        >
          <i style={{ height: `${Math.max(12, (row.value / maximum) * 100)}%` }} />
          <span>{row.label}</span>
        </button>
      )) : <p>Sin mediciones</p>}
    </div>
  );
}

/**
 * Barra lateral del explorador de sitio: filtros, distribución de elementos y herramientas.
 * @param {Object} props
 * @param {string} props.siteName - Nombre del sitio.
 * @param {string} props.fuente - ID del sitio.
 * @param {Object} props.filters - Filtros actuales.
 * @param {Object} props.options - Opciones de filtros.
 * @param {Array} props.elementDistribution - Distribución de elementos (label, value).
 * @param {number} props.filteredCount - Número de individuos filtrados.
 * @param {number} props.totalCount - Total de individuos.
 * @param {string} props.status - Mensaje de estado.
 * @param {Function} props.onChange - Callback al cambiar un filtro.
 * @param {Function} props.onClear - Limpia filtros.
 * @param {Function} props.onRefresh - Recarga los datos.
 * @param {Function} props.onExportCsv - Exporta tabla a CSV.
 * @param {Function} props.onExportJson - Exporta grafo a JSON.
 * @param {Function} props.onUpload - Sube un JSON al backend.
 * @param {Array} props.uploadOptions - Opciones de tipo de archivo.
 * @param {boolean} props.showElementEdges - Muestra aristas de elementos.
 * @param {Function} props.onToggleElementEdges - Alterna aristas de elementos.
 * @param {string} props.activeTab - Pestaña activa (para mostrar/ocultar toggles).
 * @returns {JSX.Element}
 */
export function SiteExplorerSidebar({
  siteName,
  fuente,
  filters,
  options,
  elementDistribution,
  filteredCount,
  totalCount,
  status,
  onChange,
  onClear,
  onRefresh,
  onExportCsv,
  onExportJson,
  onUpload,
  uploadOptions = [],
  showElementEdges,
  onToggleElementEdges,
  activeTab,
}) {
  const [uploadType, setUploadType] = useState(uploadOptions[0]?.value || "");
  const activeCount = [
    filters.sexo,
    filters.edad,
    filters.matriz,
    filters.referencia,
    filters.elemento !== "Ninguna" ? filters.elemento : "",
    filters.patologia,
  ].filter(Boolean).length;
  const compatibleReferences = (options.referencias || []).filter((reference) => (
    !filters.matriz || (reference.matrices || []).includes(filters.matriz)
  ));

  return (
    <aside className="explorerSidebar">
      <div className="explorerSiteIdentity">
        <span>Sitio arqueológico</span>
        <h1>{siteName}</h1>
        <code>{fuente}</code>
      </div>

      <div className="explorerSidebarScroll">
        <section className="explorerSidebarSection">
          <div className="explorerSidebarHeading">
            <span><BarChart3 size={14} /> Distribución de elementos</span>
          </div>
          <ElementDistribution
            rows={elementDistribution}
            activeElement={filters.elemento}
            onSelect={(value) => onChange("elemento", value)}
          />
        </section>

        <section className="explorerSidebarSection">
          <div className="explorerSidebarHeading">
            <span>Filtros activos</span>
            <button type="button" onClick={onClear} disabled={!activeCount}>
              <RotateCcw size={13} /> Limpiar
            </button>
          </div>

          <label className="explorerField">
            <span>Sexo</span>
            <select value={filters.sexo} onChange={(event) => onChange("sexo", event.target.value)}>
              <option value="">Todos</option>
              {(options.sexos || []).map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>

          <label className="explorerField">
            <span>Grupo etario</span>
            <select value={filters.edad} onChange={(event) => onChange("edad", event.target.value)}>
              <option value="">Todos</option>
              {(options.edades || []).map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>

          {(options.matrices || []).length > 0 && (
            <label className="explorerField">
              <span>Matriz biológica</span>
              <select value={filters.matriz} onChange={(event) => onChange("matriz", event.target.value)}>
                <option value="">Todas</option>
                {options.matrices.map((matrix) => {
                  const value = typeof matrix === "string" ? matrix : matrix.codigo;
                  const label = typeof matrix === "string" ? matrix : `${matrix.nombre} · ${matrix.muestras} muestras`;
                  return <option key={value} value={value}>{label}</option>;
                })}
              </select>
            </label>
          )}

          {compatibleReferences.length > 0 && (
            <label className="explorerField">
              <span>Fuente analítica</span>
              <select value={filters.referencia} onChange={(event) => onChange("referencia", event.target.value)}>
                <option value="">Todas las compatibles</option>
                {compatibleReferences.map((reference) => (
                  <option key={reference.id_referencia} value={reference.id_referencia}>
                    {reference.titulo} · {reference.muestras} muestras
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="explorerField">
            <span>Elemento químico</span>
            <select value={filters.elemento} onChange={(event) => onChange("elemento", event.target.value)}>
              <option value="Ninguna">Grafo base</option>
              <option value="Red Completa">Red completa</option>
              {(options.elementos || []).map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>

          <label className="explorerField">
            <span>Paleopatología</span>
            <select value={filters.patologia} onChange={(event) => onChange("patologia", event.target.value)}>
              <option value="">Ninguna</option>
              <option value="RED_COMPLETA">Red completa</option>
              {(options.patologias || []).map((value) => (
                <option key={value} value={value}>{String(value).replaceAll("_", " ")}</option>
              ))}
            </select>
          </label>

          {activeTab === "network" && filters.elemento !== "Ninguna" && (
            <label className="explorerToggle">
              <input
                type="checkbox"
                checked={showElementEdges}
                onChange={(event) => onToggleElementEdges(event.target.checked)}
              />
              <span><Eye size={15} /> Mostrar conexiones químicas</span>
            </label>
          )}

          <button type="button" className="explorerPrimaryAction" onClick={onRefresh}>
            <RefreshCw size={15} /> Actualizar vista
          </button>
          {status && <p className="explorerStatus">{status}</p>}
        </section>

        <details className="explorerTools">
          <summary><Beaker size={14} /> Herramientas de datos</summary>
          <div>
            <button type="button" onClick={onExportCsv}><Download size={14} /> Tabla CSV</button>
            <button type="button" onClick={onExportJson}><Download size={14} /> Grafo JSON</button>
            {uploadOptions.length > 0 && (
              <div className="explorerUploadGroup">
                {uploadOptions.length > 1 && (
                  <select value={uploadType} onChange={(event) => setUploadType(event.target.value)}>
                    {uploadOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                )}
                <label className="explorerUpload">
                  <UploadCloud size={14} /> Importar JSON
                  <input type="file" accept="application/json,.json" onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onUpload(uploadType || uploadOptions[0].value, file);
                    event.target.value = "";
                  }} />
                </label>
              </div>
            )}
          </div>
        </details>
      </div>

      <div className="explorerCount">
        <div><span>Individuos filtrados</span><strong>{filteredCount} / {totalCount || filteredCount}</strong></div>
        <i><span style={{ width: `${totalCount ? Math.min(100, (filteredCount / totalCount) * 100) : 0}%` }} /></i>
      </div>
    </aside>
  );
}
