import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getAzapaCaseRelation,
  getDashboardOverview,
  getFilterOptions,
  getMorroCaseRelation,
  getSiteAnalysisContext,
  getSiteCaseRelation,
  getSiteGraphElemento,
  getSiteGraphElements,
  getSiteGraphPatologia,
  getSiteGraphPatologias,
  getSiteGraphReference,
  getSitePca,
  getSiteSampleDetail,
  getSiteSamples,
  getSiteTableRows,
  uploadAzapaJson,
  uploadMorro1Json,
} from "../../lib/api";
import { SiteExplorerSidebar } from "./SiteExplorerSidebar";
import { SiteWorkspace } from "./SiteWorkspace";

const EMPTY_FILTERS = {
  sexo: "",
  edad: "",
  matriz: "",
  referencia: "",
  elemento: "Ninguna",
  patologia: "",
};

function downloadText(filename, text, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function rowsToCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
}

function siteKind(fuente) {
  const value = String(fuente || "").trim().toLowerCase();
  if (value === "azapa") return "azapa";
  if (value === "morro1") return "morro";
  return "generic";
}

function normalizedSite(site) {
  return {
    sitio: site?.sitio || "Sitio sin nombre",
    fuente: site?.fuente || String(site?.sitio || "sitio").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""),
    individuos: Number(site?.individuos || 0),
  };
}

export function SiteExplorerPage({ site }) {
  const currentSite = useMemo(() => normalizedSite(site), [site]);
  const kind = siteKind(currentSite.fuente);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [options, setOptions] = useState({
    sexos: [],
    edades: [],
    elementos: [],
    patologias: [],
    matrices: [],
    referencias: [],
  });
  const [analysisContext, setAnalysisContext] = useState(null);
  const [samples, setSamples] = useState([]);
  const [overview, setOverview] = useState(null);
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [treeGraph, setTreeGraph] = useState({ nodes: [], edges: [] });
  const [tableRows, setTableRows] = useState([]);
  const [status, setStatus] = useState("Cargando sitio...");
  const [activeTab, setActiveTab] = useState("network");
  const [showElementEdges, setShowElementEdges] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [pcaElements, setPcaElements] = useState([]);
  const [pca, setPca] = useState({ data: null, loading: false, error: "", colorBy: "sexo", pathology: "" });

  const loadOptions = useCallback(async () => {
    try {
      const [filterData, contextData, siteData] = await Promise.all([
        getFilterOptions({ fuente: currentSite.fuente }),
        getSiteAnalysisContext(currentSite.fuente),
        getDashboardOverview({ sitio: currentSite.sitio }).catch(() => null),
      ]);
      setOptions({
        sexos: filterData.sexos || [],
        edades: filterData.edades || [],
        elementos: (contextData.elementos || []).map((item) => item.elemento),
        patologias: filterData.patologias || [],
        matrices: contextData.matrices || [],
        referencias: contextData.referencias || [],
      });
      setAnalysisContext(contextData);
      setOverview(siteData);
    } catch (error) {
      setOptions({ sexos: [], edades: [], elementos: [], patologias: [], matrices: [], referencias: [] });
      setStatus(error.message || "No fue posible cargar las opciones del sitio.");
    }
  }, [currentSite.fuente, currentSite.sitio]);

  const loadSiteData = useCallback(async () => {
    setStatus("Actualizando visualización...");
    const { sexo, edad, matriz, referencia, elemento, patologia } = filters;
    const selectedElement = elemento === "Ninguna" || elemento === "Red Completa" ? "" : elemento;
    const selectedPathology = patologia === "RED_COMPLETA" ? "" : patologia;
    const analyticalFilters = { sexo, edad, matriz, referencia };

    try {
      let graphRequest;

      if (patologia) {
        graphRequest = patologia === "RED_COMPLETA"
          ? getSiteGraphPatologias(currentSite.fuente, analyticalFilters)
          : getSiteGraphPatologia(currentSite.fuente, patologia, analyticalFilters);
      } else {
        graphRequest = elemento === "Ninguna"
          ? getSiteGraphReference(currentSite.fuente, analyticalFilters)
          : elemento === "Red Completa"
            ? getSiteGraphElements(currentSite.fuente, analyticalFilters)
            : getSiteGraphElemento(currentSite.fuente, elemento, analyticalFilters);
      }

      const dataFilters = {
        ...analyticalFilters,
        elemento: selectedElement,
        patologia: selectedPathology,
      };
      const [graphData, rows, treeData, contextData, sampleData] = await Promise.all([
        graphRequest,
        getSiteTableRows(currentSite.fuente, dataFilters),
        getSiteGraphElements(currentSite.fuente, analyticalFilters),
        getSiteAnalysisContext(currentSite.fuente, dataFilters),
        getSiteSamples(currentSite.fuente, dataFilters),
      ]);
      setGraph(graphData || { nodes: [], edges: [] });
      setTreeGraph(treeData || { nodes: [], edges: [] });
      setTableRows(Array.isArray(rows) ? rows : []);
      setAnalysisContext(contextData);
      setSamples(sampleData.items || []);
      setStatus("");
    } catch (error) {
      setGraph({ nodes: [], edges: [] });
      setTreeGraph({ nodes: [], edges: [] });
      setTableRows([]);
      setSamples([]);
      setStatus(error.message || "No fue posible cargar el sitio.");
    }
  }, [currentSite.fuente, filters]);

  const pcaAvailableElements = useMemo(() => {
    // analysisContext.elementos viene como [{ elemento: 'Mn', mediciones: 10, ... }]
    return (analysisContext?.elementos || []).map((item) => item.elemento);
  }, [analysisContext]);

  useEffect(() => {
    setFilters(EMPTY_FILTERS);
    setSelected(null);
    setDetail(null);
    setSamples([]);
    setPcaElements([]);
    setPca({ data: null, loading: false, error: "", colorBy: "sexo", pathology: "" });
    loadOptions();
  }, [currentSite.fuente, loadOptions]);

  useEffect(() => {
    loadSiteData();
    setPca((current) => ({ ...current, data: null, error: "" }));
  }, [loadSiteData]);

  const handleSelect = useCallback(async (node) => {
    if (!node) return;
    if (node.type === "elemento") {
      const element = node.elemento || node.label;
      if (element) {
        setFilters((current) => ({ ...current, elemento: element, patologia: "" }));
        setSelected(null);
        setDetail(null);
      }
      return;
    }
    if (!["individuo", "muestra"].includes(node.type)) return;
    if (node.type === "muestra") {
      const sampleId = node.id_muestra || node.id;
      if (!sampleId) return;
      setSelected({
        ...node,
        id: sampleId,
        label: node.codigo_muestra || node.label || sampleId,
        type: "muestra",
      });
      setDetail(null);
      setDetailLoading(true);
      try {
        const sample = await getSiteSampleDetail(currentSite.fuente, sampleId);
        const caseId = sample.individuo?.id_individuo || node.id_individuo;
        const relation = caseId
          ? await getSiteCaseRelation(currentSite.fuente, caseId).catch(() => null)
          : null;
        setDetail({
          ...(relation || { images: [], pathologies: [], datings: [] }),
          case: relation?.case || sample.individuo || {},
          sample,
          samples: [sample],
          measurements: (sample.analisis_detalle || []).flatMap((analysis) => (
            (analysis.mediciones || []).map((measurement) => ({
              ...measurement,
              id_muestra: sample.id_muestra,
              codigo_muestra: sample.codigo_muestra,
              matriz_codigo: sample.matriz?.codigo,
              matriz_nombre: sample.matriz?.nombre,
              codigo_analisis: analysis.codigo_analisis,
              dataset_origen: analysis.dataset_origen,
              analisis_metodo: analysis.metodo,
              analisis_laboratorio: analysis.laboratorio,
              fecha_analisis: analysis.fecha,
              id_referencia: analysis.id_referencia,
              referencia_titulo: analysis.referencia_titulo,
              referencia_cita: analysis.cita,
            }))
          )),
        });
      } catch (error) {
        setDetail({ sample: node, case: node.individuo || {}, images: [], measurements: [], pathologies: [], datings: [] });
        setStatus(error.message || "No fue posible cargar la muestra.");
      } finally {
        setDetailLoading(false);
      }
      return;
    }
    const caseId = node.id_individuo || node.id;
    if (!caseId) return;
    setSelected({ ...node, id: caseId });
    setDetail(null);
    setDetailLoading(true);
    try {
      const payload = await getSiteCaseRelation(currentSite.fuente, caseId);
      setDetail(payload);
    } catch {
      try {
        const legacy = kind === "azapa" ? await getAzapaCaseRelation(caseId) : kind === "morro" ? await getMorroCaseRelation(caseId) : null;
        setDetail(legacy ? { case: legacy.reference || node, images: legacy.images || [], measurements: [], pathologies: [], datings: [] } : null);
      } catch {
        setDetail({ case: node, images: [], measurements: [], pathologies: [], datings: [] });
      }
    } finally {
      setDetailLoading(false);
    }
  }, [currentSite.fuente, kind]);

  function updateFilter(field, value) {
    setFilters((current) => {
      if (field === "elemento" && value !== "Ninguna") return { ...current, elemento: value, patologia: "" };
      if (field === "patologia" && value) return { ...current, patologia: value, elemento: "Ninguna" };
      if (field === "matriz") {
        const selectedReference = (options.referencias || []).find((item) => item.id_referencia === current.referencia);
        const keepReference = !value || !selectedReference || (selectedReference.matrices || []).includes(value);
        return { ...current, matriz: value, referencia: keepReference ? current.referencia : "" };
      }
      return { ...current, [field]: value };
    });
    if (field === "matriz" || field === "referencia") {
      setPcaElements([]);
      setPca((current) => ({ ...current, data: null, error: "" }));
    }
    setSelected(null);
    setDetail(null);
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setSelected(null);
    setDetail(null);
  }

  function togglePcaElement(element) {
    setPcaElements((current) => current.includes(element) ? current.filter((item) => item !== element) : [...current, element]);
    setPca((current) => ({ ...current, data: null, error: "" }));
  }

  async function calculatePca() {
    if (pcaElements.length < 3) return;
    setPca((current) => ({ ...current, data: null, loading: true, error: "" }));
    try {
      const payload = await getSitePca(currentSite.fuente, {
        elements: pcaElements,
        sexo: filters.sexo,
        edad: filters.edad,
        matriz: filters.matriz,
        referencia: filters.referencia,
        patologia: filters.patologia === "RED_COMPLETA" ? "" : filters.patologia,
      });
      setPca((current) => {
        const pathologyOptions = payload.pathology_options || [];
        const pathology = pathologyOptions.includes(current.pathology)
          ? current.pathology
          : pathologyOptions[0] || "";
        return {
          ...current,
          data: payload,
          loading: false,
          error: "",
          pathology,
          colorBy: current.colorBy === "patologia" && !pathology ? "sexo" : current.colorBy,
        };
      });
    } catch (error) {
      setPca((current) => ({ ...current, data: null, loading: false, error: error.message || "No fue posible calcular el PCA." }));
    }
  }

  async function uploadJson(type, file) {
    setStatus(`Importando ${file.name}...`);
    try {
      if (kind === "azapa") await uploadAzapaJson(file);
      if (kind === "morro") await uploadMorro1Json(type, file);
      await loadOptions();
      await loadSiteData();
      setStatus("Importación completada.");
    } catch (error) {
      setStatus(error.message || "No fue posible importar el archivo.");
    }
  }

  const elementDistribution = useMemo(() => {
    if (analysisContext?.elementos?.length) {
      return analysisContext.elementos.map((item) => ({
        label: item.elemento,
        value: item.mediciones,
      }));
    }
    return overview?.chemical_coverage || [];
  }, [analysisContext, overview]);
  const filteredCount = useMemo(() => new Set((graph.nodes || []).filter((node) => node.type === "individuo").map((node) => node.id)).size, [graph]);
  const totalCount = overview?.kpis?.individuos || currentSite.individuos || filteredCount;
  const hasSpecificElement = filters.elemento !== "Ninguna" && filters.elemento !== "Red Completa";
  const showAnalyticalContext = hasSpecificElement || selected?.type === "muestra" || selected?.type === "elemento";
  const slug = currentSite.fuente.replace(/[^a-z0-9_-]+/gi, "_");
  const uploadOptions = kind === "morro" ? [
    { value: "morro1_analisis_quimico", label: "Análisis químico" },
    { value: "morro1_paleopatologia", label: "Paleopatología" },
  ] : kind === "azapa" ? [{ value: "azapa_analisis_quimico", label: "Análisis químico" }] : [];

  return (
    <main className="siteExplorerPage">
      <SiteExplorerSidebar
        siteName={currentSite.sitio}
        fuente={currentSite.fuente}
        filters={filters}
        options={options}
        elementDistribution={elementDistribution}
        filteredCount={filteredCount}
        totalCount={totalCount}
        status={status}
        onChange={updateFilter}
        onClear={clearFilters}
        onRefresh={loadSiteData}
        onExportCsv={() => downloadText(`arqueograph_${slug}.csv`, rowsToCsv(tableRows), "text/csv")}
        onExportJson={() => downloadText(`arqueograph_${slug}_grafo.json`, JSON.stringify(graph, null, 2), "application/json")}
        onUpload={uploadJson}
        uploadOptions={uploadOptions}
        showElementEdges={showElementEdges}
        onToggleElementEdges={setShowElementEdges}
        activeTab={activeTab}
      />
      <SiteWorkspace
        siteName={currentSite.sitio}
        graph={graph}
        treeGraph={treeGraph}
        tableRows={tableRows}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        selected={selected}
        detail={detail}
        detailLoading={detailLoading}
        onSelect={handleSelect}
        onCloseDetail={() => { setSelected(null); setDetail(null); }}
        selectedElement={filters.elemento}
        showElementEdges={showElementEdges}
        options={options}
        filters={filters}
        analysisContext={analysisContext}
        showAnalyticalContext={showAnalyticalContext}
        samples={samples}
        pca={pca}
        pcaElements={pcaElements}
        pcaAvailableElements={pcaAvailableElements}
        onTogglePcaElement={togglePcaElement}
        onCalculatePca={calculatePca}
        onPcaColorBy={(colorBy) => setPca((current) => ({ ...current, colorBy }))}
        onPcaPathology={(pathology) => setPca((current) => ({ ...current, pathology }))}
        onExportJson={() => downloadText(`arqueograph_${slug}_grafo.json`, JSON.stringify(graph, null, 2), "application/json")}
      />
    </main>
  );
}
