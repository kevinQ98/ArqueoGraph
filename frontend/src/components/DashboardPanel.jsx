import React, { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Beaker,
  Bone,
  Database,
  Image as ImageIcon,
  LayoutDashboard,
  RefreshCw,
  RotateCcw,
  Search,
  MapPinned,
  Users,
} from "lucide-react";
import { getDashboardOverview } from "../lib/api";

const ArchaeologicalMap = lazy(() => import("./ArchaeologicalMap").then((module) => ({
  default: module.ArchaeologicalMap,
})));

const EMPTY_FILTERS = {
  sitio: "",
  sexo: "",
  edad: "",
  elemento: "",
  patologia: "",
};

function readable(value) {
  return String(value || "Sin dato").replaceAll("_", " ");
}

function formatNumber(value, digits = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("es-CL", { maximumFractionDigits: digits }) : "—";
}

function KpiCard({ icon: Icon, label, value, note, tone }) {
  return (
    <article className={`dashboardKpi ${tone}`}>
      <div className="dashboardKpiIcon"><Icon size={21} /></div>
      <div>
        <span>{label}</span>
        <strong>{formatNumber(value, 1)}</strong>
        <small>{note}</small>
      </div>
    </article>
  );
}

function BarChart({ title, subtitle, data = [], selected = "", onSelect, color = "blue", formatLabels = false }) {
  const maximum = Math.max(1, ...data.map((row) => row.value));
  return (
    <section className="dashboardVisual">
      <div className="dashboardVisualHeader">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      <div className="dashboardBars">
        {!data.length && <p className="dashboardEmpty">Sin datos para los filtros seleccionados.</p>}
        {data.map((row) => {
          const active = selected && String(selected).toLowerCase() === String(row.label).toLowerCase();
          return (
            <button
              type="button"
              key={row.label}
              className={`dashboardBarRow ${active ? "active" : ""}`}
              onClick={() => onSelect?.(active ? "" : row.label)}
              title={`${readable(row.label)}: ${row.value}`}
            >
              <span className="dashboardBarLabel">{formatLabels ? readable(row.label) : row.label}</span>
              <span className="dashboardBarTrack">
                <i className={color} style={{ width: `${Math.max(3, (row.value / maximum) * 100)}%` }} />
              </span>
              <strong>{row.value}</strong>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function AvailabilityChart({ rows = [] }) {
  return (
    <section className="dashboardVisual">
      <div className="dashboardVisualHeader">
        <div>
          <h3>Disponibilidad documental</h3>
          <p>Cobertura de cada modalidad en la selección actual.</p>
        </div>
      </div>
      <div className="availabilityGrid">
        {rows.map((row) => {
          const percentage = row.total ? (row.value / row.total) * 100 : 0;
          return (
            <div key={row.label} className="availabilityItem">
              <div><span>{row.label}</span><strong>{percentage.toFixed(0)}%</strong></div>
              <div className="availabilityTrack"><i style={{ width: `${percentage}%` }} /></div>
              <small>{row.value} de {row.total}</small>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ChemicalSummary({ rows = [], element }) {
  if (!element) {
    return (
      <section className="dashboardVisual dashboardCallout">
        <Beaker size={25} />
        <div>
          <h3>Resumen químico comparativo</h3>
          <p>Selecciona un elemento para comparar sus valores entre sitios.</p>
        </div>
      </section>
    );
  }
  return (
    <section className="dashboardVisual">
      <div className="dashboardVisualHeader">
        <div><h3>Resumen de {element}</h3><p>Estadística descriptiva por sitio.</p></div>
      </div>
      <div className="chemicalSummaryGrid">
        {!rows.length && <p className="dashboardEmpty">No hay mediciones suficientes.</p>}
        {rows.map((row) => (
          <article key={row.sitio}>
            <h4>{row.sitio}</h4>
            <div><span>n</span><strong>{row.n}</strong></div>
            <div><span>Mediana</span><strong>{formatNumber(row.median)}</strong></div>
            <div><span>Promedio</span><strong>{formatNumber(row.mean)}</strong></div>
            <div><span>Rango</span><strong>{formatNumber(row.min)}–{formatNumber(row.max)}</strong></div>
          </article>
        ))}
      </div>
    </section>
  );
}

function SitePortal({ site, onOpen, onFilter }) {
  const isMorro = site.sitio === "Morro 1";
  return (
    <article className={`sitePortal ${isMorro ? "morro" : "azapa"}`}>
      <div className="sitePortalTop">
        <div className="sitePortalMarker"><MapPinned size={20} /></div>
        <div><span>Colección de sitio</span><h3>{site.sitio}</h3></div>
      </div>
      <div className="sitePortalMetrics">
        <div><strong>{site.individuos}</strong><span>individuos</span></div>
        <div><strong>{site.con_quimica}</strong><span>analizados</span></div>
        <div><strong>{site.con_imagenes}</strong><span>con imágenes</span></div>
      </div>
      <p>{site.culturas?.length ? `Contextos: ${site.culturas.join(", ")}` : "Contexto cultural pendiente de normalización."}</p>
      <div className="sitePortalActions">
        <button type="button" className="secondary" onClick={() => onFilter(site.sitio)}>Filtrar panel</button>
        <button type="button" className="primary" onClick={() => onOpen(site.view)}>Abrir visualización</button>
      </div>
    </article>
  );
}

export function DashboardPanel({ onNavigate }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("Cargando dashboard...");
  const [search, setSearch] = useState("");

  async function refresh(nextFilters = filters) {
    setStatus("Actualizando visualizaciones...");
    try {
      const payload = await getDashboardOverview(nextFilters);
      setData(payload);
      setStatus("");
    } catch (error) {
      setStatus(error.message || "No fue posible cargar el dashboard.");
    }
  }

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setSearch("");
  }

  useEffect(() => {
    refresh(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.sitio, filters.sexo, filters.edad, filters.elemento, filters.patologia]);

  const visibleCases = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return data?.cases || [];
    return (data?.cases || []).filter((row) => [
      row.id, row.label, row.sitio, row.sexo, row.edad, row.cultura,
      ...(row.elementos || []), ...(row.patologias || []),
    ].some((value) => String(value || "").toLowerCase().includes(normalized)));
  }, [data, search]);

  const options = data?.filter_options || { sitios: [], sexos: [], edades: [], elementos: [], patologias: [] };
  const kpis = data?.kpis || {};
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <main className="dashboardMain">
      <section className="dashboardHero">
        <div>
          <p className="dashboardEyebrow"><LayoutDashboard size={15} /> ArqueoGraph 0.8 · Panel general</p>
          <h2>Colección Bioarqueológica IAI</h2>
          <p>Consulta el estado general de la colección y accede a las interfaces especializadas de cada sitio.</p>
        </div>
        <div className="dashboardHeroActions">
          <button type="button" className="secondary" onClick={() => refresh()}><RefreshCw size={16} /> Actualizar</button>
          <button type="button" className="secondary" onClick={clearFilters} disabled={!activeFilterCount}><RotateCcw size={16} /> Limpiar filtros ({activeFilterCount})</button>
        </div>
      </section>

      <section className="dashboardSlicers" aria-label="Segmentadores del dashboard">
        <label>Sitio<select value={filters.sitio} onChange={(event) => updateFilter("sitio", event.target.value)}><option value="">Todos</option>{options.sitios.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Sexo<select value={filters.sexo} onChange={(event) => updateFilter("sexo", event.target.value)}><option value="">Todos</option>{options.sexos.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Edad<select value={filters.edad} onChange={(event) => updateFilter("edad", event.target.value)}><option value="">Todas</option>{options.edades.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Elemento<select value={filters.elemento} onChange={(event) => updateFilter("elemento", event.target.value)}><option value="">Todos</option>{options.elementos.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Paleopatología<select value={filters.patologia} onChange={(event) => updateFilter("patologia", event.target.value)}><option value="">Todas</option>{options.patologias.map((value) => <option key={value} value={value}>{readable(value)}</option>)}</select></label>
      </section>

      {status && <p className="dashboardStatus"><Activity size={16} /> {status}</p>}

      <section className="dashboardKpis">
        <KpiCard icon={Users} label="Individuos" value={kpis.individuos || 0} note="universo filtrado" tone="blue" />
        <KpiCard icon={MapPinned} label="Sitios" value={kpis.sitios || 0} note="colecciones visibles" tone="green" />
        <KpiCard icon={Bone} label="Patologías" value={kpis.con_patologia || 0} note="individuos positivos" tone="amber" />
        <KpiCard icon={Beaker} label="Analizados" value={kpis.con_quimica || 0} note={`${kpis.cobertura_quimica_pct || 0}% de cobertura`} tone="violet" />
        <KpiCard icon={ImageIcon} label="Con imágenes" value={kpis.con_imagenes || 0} note="carpetas asociadas" tone="green" />
      </section>

      <section className="dashboardGrid dashboardGridTwo collectionOverviewGrid">
        <Suspense fallback={<section className="dashboardVisual dashboardMapLoading">Cargando cartografía...</section>}>
          <ArchaeologicalMap sites={data?.site_portals || []} selectedSite={filters.sitio} onSelectSite={(value) => updateFilter("sitio", value)} />
        </Suspense>
        <BarChart title="Individuos por contexto cultural" subtitle="Contextos disponibles; Morro 1 aún no posee esta clasificación." data={data?.distributions?.cultura} color="blue" />
      </section>

      <section className="dashboardGrid dashboardGridTwo">
        <div className="dashboardGrid dashboardGridTwo dashboardNestedGrid">
          <BarChart title="Distribución por sexo" subtitle="Clasificación normalizada." data={data?.distributions?.sexo} selected={filters.sexo} onSelect={(value) => updateFilter("sexo", value)} color="violet" />
          <BarChart title="Grupos de edad" subtitle="Adulto, subadulto e indeterminado." data={data?.distributions?.edad} selected={filters.edad} onSelect={(value) => updateFilter("edad", value)} color="green" />
        </div>
        <AvailabilityChart rows={data?.availability} />
      </section>

      <section className="sitePortalSection">
        <div className="sitePortalHeader"><div><h3>Explorar colecciones por sitio</h3><p>Accede a grafos, PCA, imágenes, tablas y filtros especializados.</p></div></div>
        <div className="sitePortalGrid">
          {(data?.site_portals || []).map((site) => <SitePortal key={site.sitio} site={site} onOpen={onNavigate} onFilter={(value) => updateFilter("sitio", value)} />)}
        </div>
      </section>

      <section className="dashboardGrid dashboardGridTwo">
        <BarChart title="Cobertura química" subtitle="Número de individuos con medición." data={data?.chemical_coverage} selected={filters.elemento} onSelect={(value) => updateFilter("elemento", value)} color="cyan" />
        <ChemicalSummary rows={data?.chemical_summary} element={filters.elemento} />
      </section>

      <section className="dashboardGrid dashboardGridTwo">
        <BarChart title="Paleopatologías" subtitle="Frecuencia de presencias positivas." data={data?.pathology_distribution} selected={filters.patologia} onSelect={(value) => updateFilter("patologia", value)} color="amber" formatLabels />
        <BarChart title="Estado de conservación" subtitle="Ocho categorías más frecuentes." data={data?.distributions?.conservacion} color="rose" />
      </section>

      <section className="dashboardVisual dashboardCases">
        <div className="dashboardTableHeader">
          <div>
            <h3>Casos de la selección</h3>
            <p>Se muestran hasta 100 casos devueltos por el dashboard.</p>
          </div>
          <div className="dashboardSearch"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar caso, elemento o patología" /></div>
        </div>
        <div className="tableWrap">
          <table>
            <thead><tr><th>Caso</th><th>Sitio</th><th>Sexo</th><th>Edad</th><th>Elementos</th><th>Patologías</th><th>Imágenes</th></tr></thead>
            <tbody>
              {visibleCases.map((row) => (
                <tr key={row.id}>
                  <td><strong>{row.label}</strong><small className="dashboardCaseId">{row.id}</small></td>
                  <td>{row.sitio}</td><td>{row.sexo}</td><td>{row.edad}</td>
                  <td><div className="dashboardTags">{row.elementos.map((item) => <span key={item}>{item}</span>)}</div></td>
                  <td>{row.patologias.length ? <span title={row.patologias.map(readable).join(", ")}>{row.patologias.length}</span> : "—"}</td>
                  <td>{row.imagenes || "—"}</td>
                </tr>
              ))}
              {!visibleCases.length && <tr><td colSpan="7" className="dashboardEmpty">No hay casos para esta selección.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dashboardWarnings">
        <Database size={18} />
        <div><strong>Notas de interpretación</strong>{(data?.warnings || []).map((warning) => <p key={warning}>{warning}</p>)}</div>
        <button type="button" className="secondary small" onClick={() => onNavigate?.("visualizacion")}>Abrir Morro 1</button>
      </section>
    </main>
  );
}
