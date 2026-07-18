import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Database, Download, Filter, LayoutDashboard, Network, RefreshCw, Settings2 } from "lucide-react";
import {
  absoluteImageUrl,
  getFilterOptions,
  getGraphElemento,
  getGraphPatologia,
  getGraphAllPatologias,
  getGraphSimilarity,
  getGraphAzapaReference,
  getGraphAzapaElemento,
  getGraphAzapaElements,
  getAzapaSexOptions,
  getAzapaMatrixOptions,
  getAzapaTableRows,
  getAzapaCaseRelation,
  getImagenesIndividuo,
  getMediciones,
  importDemo,
  getGraphRelational,
  getGraphMorroReference,
  getMorroTableRows,
  getGraphMorroElemento,
  getGraphMorroElements,
  getMorroPca
} from "./lib/api";
import { GraphSvg } from "./components/GraphSvg";
import { AdminPanel } from "./components/AdminPanel";
import { ImagePanel } from "./components/ImagePanel";
import { ClusterPanel } from "./components/ClusterPanel";
import "./style.css";
import { GraphLegend } from "./components/GraphLegend";
import { useGraphPathologyData } from "./hooks/useGraphPathologyData";
import { InteractiveGraph } from "./components/Interactivegraph";
import { AzapaTreeGraph, TreeGraph } from "./components/Treegraph";
import { checkAndFix } from "./lib/utils";
import { PcaChart } from "./components/PcaChart";
import { DashboardPanel } from "./components/DashboardPanel";

function downloadText(filename, text, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function rowsToCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value) => {
    const s = value === null || value === undefined ? "" : String(value);
    return `"${s.replaceAll('"', '""')}"`;
  };
  return [headers.join(","), ...rows.map(r => headers.map(h => escape(r[h])).join(","))].join("\n");
}

function exportSvg() {
  const svg = document.getElementById("arqueograph-svg");
  if (!svg) return;
  const clone = svg.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  downloadText("arqueograph_grafo.svg", clone.outerHTML, "image/svg+xml");
}

function exportAzapaSvg() {
  const svg = document.getElementById("arqueograph-svg");
  if (!svg) return;
  const clone = svg.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  downloadText("arqueograph_azapa_grafo.svg", clone.outerHTML, "image/svg+xml");
}

export default function App() {
  const [view, setView] = useState("dashboard");
  const [modoGrafo, setModoGrafo] = useState("distancia");
  const [modoGrafoAzapa, setModoGrafoAzapa] = useState("distancia");
  const [sexo, setSexo] = useState("");
  const [edad, setEdad] = useState("");
  const [patologia, setPatologia] = useState("");
  const [selectedPatologia, setSelectedPatologia] = useState("");
  const [selectedElement, setSelectedElement] = useState("Ninguna");
  const [selectedAzapaElement, setSelectedAzapaElement] = useState("Ninguna");
  const [azapaSexo, setAzapaSexo] = useState("");
  const [azapaSexoOptions, setAzapaSexoOptions] = useState([]);
  const [azapaEdad, setAzapaEdad] = useState("");
  const [azapaEdadOptions, setAzapaEdadOptions] = useState([]);
  const [azapaMatriz, setAzapaMatriz] = useState("");
  const [azapaMatrizOptions, setAzapaMatrizOptions] = useState([]);
  const [elementsSimilarity, setElementsSimilarity] = useState("Mn,As,Ba");
  const [minSimilarity, setMinSimilarity] = useState(0.55);
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [azapaGraph, setAzapaGraph] = useState({ nodes: [], edges: [] });
  const [mediciones, setMediciones] = useState([]);
  const [azapaTableRows, setAzapaTableRows] = useState([]);
  const [options, setOptions] = useState({ sexos: [], edades: [], elementos: [], patologias: [] });
  const [azapaElementOptions, setAzapaElementOptions] = useState(["Ninguna", "Red Completa"]);
  const [selected, setSelected] = useState(null);
  const [showImages, setShowImages] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedAzapaCase, setSelectedAzapaCase] = useState(null);
  const [status, setStatus] = useState("");
  const [azapaStatus, setAzapaStatus] = useState("");
  const GRAPH_ELEMENT = "Mn";
  const [showElementEdges, setShowElementEdges] = useState(true);
  const { patologiaNodes, patologiaColorMap, stats } = useGraphPathologyData(graph);

  const [azapaTreeGraph, setAzapaTreeGraph] = useState({ nodes: [], edges: [] });
  const [morroTreeGraph, setMorroTreeGraph] = useState({ nodes: [], edges: [] });
  const [pcaElements, setPcaElements] = useState([]);
  const [pcaData, setPcaData] = useState(null);
  const [pcaStatus, setPcaStatus] = useState("");
  const [pcaColorBy, setPcaColorBy] = useState("sexo");

  async function loadMorroTreeGraph() {
    try {
      const data = await getGraphMorroElements(sexo, edad, ""); // Sin matriz
      setMorroTreeGraph(data || { nodes: [], edges: [] });
    } catch {
      setMorroTreeGraph({ nodes: [], edges: [] });
    }
  }

  async function loadAzapaTreeGraph() {
    try {
      const data = await getGraphAzapaElements(azapaSexo, azapaEdad, azapaMatriz);
      setAzapaTreeGraph(data || { nodes: [], edges: [] });
    } catch {
      setAzapaTreeGraph({ nodes: [], edges: [] });
    }
  }

  function togglePcaElement(element) {
    setPcaElements((current) => (
      current.includes(element)
        ? current.filter((item) => item !== element)
        : [...current, element]
    ));
    setPcaData(null);
    setPcaStatus("");
  }

  async function loadPca() {
    if (pcaElements.length < 3) {
      setPcaStatus("Selecciona al menos tres elementos.");
      setPcaData(null);
      return;
    }
    setPcaStatus("Calculando PCA...");
    try {
      const result = await getMorroPca({ elements: pcaElements, sexo, edad });
      setPcaData(result);
      setPcaStatus("");
    } catch (error) {
      setPcaData(null);
      setPcaStatus(error.message || "No fue posible calcular el PCA.");
    }
  }

  async function loadOptions() {
    try {
      const opts = await getFilterOptions({ fuente: "morro1" });
      const elementosConNinguna = ["Ninguna", ...(opts.elementos || [])];
      setOptions({ ...opts, elementos: elementosConNinguna });
      // Solo actualizar si selectedElement no está en la lista
      if (!elementosConNinguna.includes(selectedElement)) {
        // Por defecto, elegir el primero (que será "Ninguna")
        setSelectedElement(elementosConNinguna[0] || "Mn");
      }
    } catch {
      setOptions((prev) => ({ ...prev, elementos: ["Ninguna", "Mn"] }));
      // Si falla, mantener "Ninguna" como predeterminado
      if (!["Ninguna", "Mn"].includes(selectedElement)) {
        setSelectedElement("Ninguna");
      }
    }
  }

  async function loadAzapaFilterOptions() {
    try {
      const opts = await getFilterOptions({ fuente: "azapa" });
      const elementos = Array.isArray(opts.elementos) ? opts.elementos : [];
      const baseOptions = ["Ninguna", "Red Completa", ...elementos.filter(Boolean)];
      setAzapaElementOptions(baseOptions);
      if (!baseOptions.includes(selectedAzapaElement) && baseOptions.length) {
        setSelectedAzapaElement(baseOptions[0]);
      }
    } catch {
      setAzapaElementOptions(["Ninguna", "Red Completa"]);
    }
    try {
      const sexOpts = await getAzapaSexOptions();
      const sexos = Array.isArray(sexOpts?.sexos) ? sexOpts.sexos.filter(Boolean) : [];
      setAzapaSexoOptions(sexos);
      if (azapaSexo && !sexos.includes(azapaSexo)) {
        setAzapaSexo("");
      }
    } catch {
      setAzapaSexoOptions([]);
    }
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000"}/graph/azapa/reference`);
      if (response.ok) {
        const data = await response.json();
        const edades = Array.from(new Set((data?.nodes || [])
          .filter((node) => node?.type === "individuo" && node?.edad)
          .map((node) => String(node.edad))
          .filter(Boolean)));
        setAzapaEdadOptions(edades.sort((a, b) => a.localeCompare(b)));
        if (azapaEdad && !edades.includes(azapaEdad)) {
          setAzapaEdad("");
        }
      }
    } catch {
      setAzapaEdadOptions([]);
    }
    try {
      const matrixOpts = await getAzapaMatrixOptions();
      const matrices = Array.isArray(matrixOpts?.matrices) ? matrixOpts.matrices.filter(Boolean) : [];
      setAzapaMatrizOptions(matrices);
      if (azapaMatriz && !matrices.includes(azapaMatriz)) {
        setAzapaMatriz("");
      }
    } catch {
      setAzapaMatrizOptions([]);
    }
  }

  async function load() {
    setStatus("Cargando...");
    try {
      let g;
      let m = [];
      const fuenteMorro1 = "morro1";

      if (selectedPatologia === "RED_COMPLETA") {
        g = await getGraphAllPatologias(edad, sexo, fuenteMorro1);
        m = await getMediciones({ sexo, edad, fuente: fuenteMorro1 });
      } else if (selectedPatologia) {
        g = await getGraphPatologia(selectedPatologia, edad, sexo, fuenteMorro1);
        m = await getMediciones({ sexo, edad, patologia: selectedPatologia, fuente: fuenteMorro1 });
      } else if (modoGrafo === "similitud") {
        g = await getGraphSimilarity({
          elements: elementsSimilarity,
          min_similarity: Number(minSimilarity),
          sexo,
          edad,
          patologia,
          fuente: fuenteMorro1,
        });
        m = await getMediciones({ sexo, edad, patologia, fuente: fuenteMorro1 });
      } else if (modoGrafo === "disperso") {
        g = await getGraphAllPatologias(edad, sexo, fuenteMorro1);
        m = await getMediciones({ sexo, edad, fuente: fuenteMorro1 });
      } else {
        if (selectedElement === "Ninguna") {
          g = await getGraphMorroReference(sexo, edad, selectedPatologia);
          m = await getMorroTableRows({ sexo, edad });
        } else {
          g = await getGraphMorroElemento(selectedElement, sexo, edad, "");
          m = await getMorroTableRows({ elemento: selectedElement, sexo, edad });
        }
      }
      setGraph(g);
      setMediciones(m);
      setStatus("");
      await loadOptions();
    } catch (err) {
      console.log(err)
      setStatus("No hay datos cargados. Usa 'Cargar demo'.");
    }
  }

  async function loadAzapaGraph(elementoFilter = selectedAzapaElement) {
    setAzapaStatus("Cargando grafo Azapa...");
    try {
      const normalized = String(elementoFilter || "Ninguna").trim();
      let graphData;
      if (normalized === "Ninguna") {
        graphData = await getGraphAzapaReference(azapaSexo, azapaEdad, azapaMatriz);
      } else if (normalized === "Red Completa") {
        graphData = await getGraphAzapaElements(azapaSexo, azapaEdad, azapaMatriz);
      } else {
        graphData = await getGraphAzapaElemento(normalized, azapaSexo, azapaEdad, azapaMatriz);
      }
      setAzapaGraph(graphData || { nodes: [], edges: [] });
      const rows = await getAzapaTableRows({
        sexo: azapaSexo || undefined,
        edad: azapaEdad || undefined,
        matriz: azapaMatriz || undefined,
        elemento: normalized === "Ninguna" || normalized === "Red Completa" ? undefined : normalized,
      });
      setAzapaTableRows(Array.isArray(rows) ? rows : []);
      setAzapaStatus("");
    } catch {
      setAzapaStatus("No hay datos de referencia de Azapa disponibles.");
      setAzapaTableRows([]);
    }
  }

  async function handleImportDemo() {
    setStatus("Importando demo...");
    await importDemo();
    await loadOptions();
    await load();
    setStatus("Demo cargada.");
  }

  async function handleSelectNode(node) {
    setSelected(node);
    setSelectedImage(null);
    setSelectedImages([]);

    if (node?.type === "imagen" && node?.url) {
      setSelectedImage({
        id_imagen: node.id,
        url: node.url,
        titulo: node.label,
        filename_original: node.label,
        descripcion: node.label,
        id_individuo: node.id_individuo,
      });
      setShowImages(true);
      if (node.id_individuo) {
        try {
          const imgsRaw = await getImagenesIndividuo(node.id_individuo);
          // Accept any registered image returned by the API (not only imagenes_momias)
          const imgs = imgsRaw.filter((img) => {
            const u = (img.url || img.relative_path || "").toString();
            return Boolean(u);
          });
          setSelectedImages(imgs);
          const match = imgs.find((img) => img.id_imagen === node.id || img.url === node.url);
          if (match) {
            setSelectedImage(match);
          }
        } catch {
          setSelectedImages([]);
        }
      }
      return;
    }

    if (node?.type === "individuo" && node?.id) {
      setShowImages(true);
      try {
        const imgsRaw = await getImagenesIndividuo(node.id);
        const imgs = imgsRaw.filter((img) => {
          const u = (img.url || img.relative_path || "").toString();
          return Boolean(u);
        });
        setSelectedImages(imgs);
        if (imgs.length > 0) {
          setSelectedImage(imgs[0]);
        }
      } catch {
        setSelectedImages([]);
      }
    }
  }

  async function toggleImages() {
    const next = !showImages;
    setShowImages(next);
    if (next && selected?.id) {
      try {
        const imgsRaw = await getImagenesIndividuo(selected.id);
        const imgs = imgsRaw.filter((img) => {
          const u = (img.url || img.relative_path || "").toString();
          return Boolean(u);
        });
        setSelectedImages(imgs);
      } catch {
        setSelectedImages([]);
      }
    }
    if (!next) {
      setSelectedImages([]);
    }
  }

  async function handleSelectAzapaNode(node) {
    if (!node?.id) {
      setSelectedAzapaCase(null);
      return;
    }
    setSelectedAzapaCase(null);
    try {
      const relation = await getAzapaCaseRelation(node.id);
      setSelectedAzapaCase(relation);
    } catch {
      setSelectedAzapaCase(null);
    }
  }

  const selectedRelations = useMemo(() => {
    if (!selected || !graph?.edges?.length) return [];
    const nodeLookup = Object.fromEntries((graph.nodes || []).map((n) => [n.id, n]));
    return (graph.edges || [])
      .filter((edge) => edge.source === selected.id || edge.target === selected.id)
      .map((edge) => {
        const otherId = edge.source === selected.id ? edge.target : edge.source;
        return {
          ...edge,
          otherNode: nodeLookup[otherId],
        };
      });
  }, [selected, graph]);

  useEffect(() => {
    loadOptions();
    loadAzapaFilterOptions();
  }, []);

  useEffect(() => {
    if (view !== "visualizacion") return;
    load();
    loadMorroTreeGraph();
  }, [view, edad, sexo, modoGrafo, minSimilarity, selectedElement, patologia, selectedPatologia]);

  useEffect(() => {
    setPcaData(null);
    setPcaStatus("");
  }, [edad, sexo]);

  useEffect(() => {
    if (view !== "clusters") return;
    loadAzapaGraph(selectedAzapaElement);
    loadAzapaTreeGraph();
  }, [view, selectedAzapaElement, azapaSexo, azapaEdad, azapaMatriz]);

  const countByCat = {};

  const azapaStats = useMemo(() => ({
    nodes: azapaGraph?.nodes?.length || 0,
    edges: azapaGraph?.edges?.length || 0,
    rows: azapaTableRows?.length || 0,
  }), [azapaGraph, azapaTableRows]);

  const graphStats = useMemo(() => ({
    nodes: graph.nodes?.length || 0,
    edges: graph.edges?.length || 0,
  }), [graph]);

  function exportCsv() {
    downloadText("arqueograph_tabla_filtrada.csv", rowsToCsv(mediciones), "text/csv");
  }

  function exportAzapaCsv() {
    downloadText("arqueograph_azapa_tabla_filtrada.csv", rowsToCsv(azapaTableRows), "text/csv");
  }

  function exportJson() {
    downloadText("arqueograph_grafo.json", JSON.stringify(graph, null, 2), "application/json");
  }

  function exportAzapaJson() {
    downloadText("arqueograph_azapa_grafo.json", JSON.stringify(azapaGraph, null, 2), "application/json");
  }

  const hideElementNodes = selectedPatologia !== "" || modoGrafo === "disperso";

  return (
    <div className="app">
      <header>
        <div>
          <h1>ArqueoGraph Local</h1>
          <p> </p>
        </div>
        <div className="topActions">
          <button className={view === "dashboard" ? "navButton active" : "navButton"} onClick={() => setView("dashboard")}>
            <LayoutDashboard size={18} /> Dashboard
          </button>
          <button className={view === "visualizacion" ? "navButton active" : "navButton"} onClick={() => setView("visualizacion")}>
            <Network size={18} /> MORRO1
          </button>
          <button className={view === "clusters" ? "navButton active" : "navButton"} onClick={() => setView("clusters")}>
            <Network size={18} /> AZAPA
          </button>
          <button className={view === "administracion" ? "navButton active" : "navButton"} onClick={() => setView("administracion")}>
            <Settings2 size={18} /> Administración
          </button>
          <button onClick={handleImportDemo} className="primary">
            <Database size={18} /> Cargar demo
          </button>
        </div>
      </header>

      {view === "dashboard" ? (
        <DashboardPanel onNavigate={setView} />
      ) : view === "administracion" ? (
        <main className="adminMain">
          <AdminPanel />
        </main>
      ) : view === "clusters" ? (
        <main className="adminMain_azapa">
          <aside>
            <section className="panel_azapa">
              <h2><Filter size={18} /> Filtros azapa </h2>

              <label>Modo de grafo azapa</label>
              <select value={modoGrafoAzapa} onChange={(e) => setModoGrafoAzapa(e.target.value)}>
                <option value="distancia">Distancia radial</option>
              </select>

              <label>Sexo </label>
              <select value={azapaSexo} onChange={(e) => setAzapaSexo(e.target.value)}>
                <option value="">Todos</option>
                {(azapaSexoOptions || []).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>

              <label>Edad </label>
              <select value={azapaEdad} onChange={(e) => setAzapaEdad(e.target.value)}>
                <option value="">Todas</option>
                {(azapaEdadOptions || []).map((edadOpt) => <option key={edadOpt} value={edadOpt}>{edadOpt}</option>)}
              </select>

              <label className="hint" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                <input type="checkbox" style={{ width: "auto" }} checked={showElementEdges} onChange={(e) => setShowElementEdges(e.target.checked)} />
                Mostrar líneas al elemento central
              </label>

              <button onClick={() => loadAzapaGraph(selectedAzapaElement)} className="secondary" style={{ marginTop: 10 }}>
                <RefreshCw size={16} /> Actualizar
              </button>
              {azapaStatus && <p className="status">{azapaStatus}</p>}
            </section>

            <section className="panel_azapa">
              <h2>Resumen </h2>
              <div className="summary">
                <div><strong>{azapaStats.nodes}</strong><span>nodos</span></div>
                <div><strong>{azapaStats.edges}</strong><span>aristas</span></div>
                <div><strong>{azapaStats.rows}</strong><span>filas</span></div>
              </div>
            </section>

            <section className="panel_azapa">
              <h2><Download size={18} /> Exportar </h2>
              <div className="exportGrid">
                <button className="secondary small" onClick={exportAzapaCsv}>CSV tabla</button>
                <button className="secondary small" onClick={exportAzapaJson}>JSON grafo</button>
                {/* <button className="secondary small" onClick={exportAzapaSvg}>SVG grafo</button> */}
              </div>
            </section>

            <section className="panel_azapa">
              <h2>Imágenes azapa</h2>
              <button className={showImages ? "primary fullButton" : "secondary fullButton"} onClick={toggleImages}>
                {showImages ? "Ocultar imágenes del grafo" : "Imágenes"}
              </button>
              <p className="hint">Selecciona un caso y presiona "Imágenes" para abrir nodos de imagen asociados.</p>
              {showImages && selected && <p className="status">{selectedImages.length} imagen(es) asociadas al caso.</p>}
            </section>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-2">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                <span className="w-1 h-6 bg-emerald-500 rounded-full"></span>
                Detalle AZAPA
              </h2>
              {!selectedAzapaCase?.reference ? (
                <p className="text-sm text-gray-500 italic">Selecciona un nodo del grafo para ver la referencia y las imágenes del caso AZAPA.</p>
              ) : (
                <div className="space-y-1 text-sm">
                  <p className="text-base font-medium text-gray-900 truncate">
                    {selectedAzapaCase.reference.tumba || selectedAzapaCase.case_id}
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    <span className="text-gray-500">Id:</span>
                    <span className="text-gray-800 font-medium truncate">{selectedAzapaCase.reference.id || selectedAzapaCase.case_id}</span>
                    <span className="text-gray-500">Sexo:</span>
                    <span className="text-gray-800 font-medium">{selectedAzapaCase.reference.sexo || "—"}</span>
                    <span className="text-gray-500">Edad:</span>
                    <span className="text-gray-800 font-medium">{selectedAzapaCase.reference.edad || "—"}</span>
                    <span className="text-gray-500">Cultura:</span>
                    <span className="text-gray-800 font-medium">{selectedAzapaCase.reference.cultura || "—"}</span>
                    <span className="text-gray-500">Imágenes:</span>
                    <span className="text-gray-800 font-medium">{selectedAzapaCase.images_count || 0}</span>
                  </div>
                </div>
              )}
            </div>

          </aside>
          <section className="panel_grafo_azapa">
            <div className="panel azapa_graphPanel">
              <div className="graphFilterRowAzapa">
                <h2 style={{ marginBottom: 0 }}><Network size={18} /> Grafo azapa: {modoGrafoAzapa}</h2>
              </div>
              <div className="azapaTopControls azapaFiltersRow">
                <div className="azapaFilterGroup">
                  <label style={{ margin: 0 }}>Elemento químico</label>
                  <div className="flex overflow-x-auto whitespace-nowrap gap-2 py-1 max-w-full">
                    {azapaElementOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={`px-3 py-1.5 rounded-full border ${selectedAzapaElement === option ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300"} text-sm font-semibold transition-all hover:border-blue-500`}
                        onClick={() => setSelectedAzapaElement(option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="azapaFilterGroup azapaMatrixGroup">
                  <label>Matriz AZAPA</label>
                  <div className="flex overflow-x-auto whitespace-nowrap gap-2 py-1 border border-gray-200 rounded-lg p-1 max-w-xl scrollbar-thin">
                    <button
                      type="button"
                      className={`px-3 py-1.5 rounded-full ${!azapaMatriz ? "bg-blue-600 text-white" : "bg-white text-gray-700"} text-sm font-semibold transition-all hover:bg-blue-100`}
                      onClick={() => setAzapaMatriz("")}
                    >
                      Todas
                    </button>
                    {(azapaMatrizOptions || []).map((matrizOpt) => (
                      <button
                        key={matrizOpt}
                        type="button"
                        className={`px-3 py-1.5 rounded-full ${azapaMatriz === matrizOpt ? "bg-blue-600 text-white" : "bg-white text-gray-700"} text-sm font-semibold transition-all hover:bg-blue-100`}
                        onClick={() => setAzapaMatriz(matrizOpt)}
                      >
                        {matrizOpt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <p className="hint">
                Azul = masculino, rojo = femenino, gris = no determinado/probable.
              </p>

              <div className="grid grid-cols-1 gap-4">
                {/* <GraphSvg
                  graph={azapaGraph}
                  elemento=""
                  mode={modoGrafoAzapa}
                  onSelect={handleSelectAzapaNode}
                  selectedNodeId={selectedAzapaCase?.case_id || ""}
                  imageNodes={[]}
                  showImages={false}
                  hideElementCenter={false}
                  showElementEdges={true}
                /> */}
                <InteractiveGraph
                  graph={azapaGraph}
                  elemento={selectedAzapaElement === "Ninguna" || selectedAzapaElement === "Red Completa" ? "" : selectedAzapaElement}
                  mode="distancia"
                  onSelect={handleSelectAzapaNode}
                  selectedNodeId={selectedAzapaCase?.case_id || ""}
                  showElementEdges={showElementEdges}
                />

                <div className="col-span-2">
                  <AzapaTreeGraph
                    graph={azapaTreeGraph}
                    focusElement={selectedAzapaElement}
                    onSelect={handleSelectAzapaNode}
                    selectedNodeId={selectedAzapaCase?.case_id || ""}
                  />
                </div>
              </div>
            </div>

            <div className="azapaContentColumn">
              <div className="panel_azapa">
                <ImagePanel
                  individuo={{ id: selectedAzapaCase?.case_id, label: selectedAzapaCase?.reference?.tumba || selectedAzapaCase?.case_id || "" }}
                  images={selectedAzapaCase?.images || []}
                  title="Imágenes AZAPA"
                  emptyMessage="Este caso AZAPA todavía no tiene imágenes asociadas."
                  emptyHint="Selecciona un nodo del grafo AZAPA para ver la referencia y las imágenes del caso."
                  caseLabelPrefix="Caso AZAPA:"
                  onImagesChange={() => { }}
                />
              </div>


            </div>

            <div className="panel_azapa">
              <h2>Tabla filtrada AZAPA</h2>
              <div className="tableWrapAzapa">
                <table>
                  <thead>
                    <tr>
                      <th>Caso</th>
                      <th>Sexo</th>
                      <th>Edad</th>
                      <th>Elemento</th>
                      <th>Valor</th>
                      <th>Matriz</th>
                      <th>Cultura</th>
                    </tr>
                  </thead>
                  <tbody>
                    {azapaTableRows.map((row, index) => (
                      <tr key={`${row.id_caso - index}-${index}`}>
                        <td>{row.caso}</td>
                        <td>{row.sexo}</td>
                        <td>{row.edad}</td>
                        <td>{row.elemento}</td>
                        <td>{row.concentracion}{row.unidad ? ` ${row.unidad}` : ""}</td>
                        <td>{row.matriz}</td>
                        <td>{row.cultura}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </main>
      ) : (
        <main>
          <aside>
            <section className="panel">
              <h2><Filter size={18} /> Filtros</h2>

              <label>Modo de grafo</label>
              <select value={modoGrafo} onChange={(e) => setModoGrafo(e.target.value)} disabled>
                <option value="distancia">Distancia radial</option>
                {/* <option value="similitud">Similitud química</option> */}
                {/* <option value="disperso">Casos positivos a patologías</option> */}
              </select>



              <label>Sexo</label>
              <select value={sexo} onChange={(e) => setSexo(e.target.value)}>
                <option value="">Todos</option>
                {(options.sexos || []).map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              {modoGrafo === "similitud" && (
                <>
                  <label>Similitud mínima: {minSimilarity}</label>
                  <input
                    type="range"
                    min="0.1"
                    max="0.95"
                    step="0.05"
                    value={minSimilarity}
                    onChange={(e) => setMinSimilarity(Number(e.target.value))}
                  />
                </>
              )}

              <label>Edad</label>
              <select value={edad} onChange={(e) => setEdad(e.target.value)}>
                <option value="">Todas</option>
                {(options.edades || []).map(e => <option key={e} value={e}>{e}</option>)}
              </select>

              <label className="hint" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                <input type="checkbox" style={{ width: "auto" }} checked={showElementEdges} onChange={(e) => setShowElementEdges(e.target.checked)} />
                Mostrar líneas al elemento central
              </label>

              <button onClick={load} className="secondary">
                <RefreshCw size={16} /> Actualizar
              </button>

              {status && <p className="status">{status}</p>}
            </section>

            <section className="panel">
              <h2>Resumen</h2>
              <div className="summary">
                <div><strong>{graphStats.nodes}</strong><span>nodos</span></div>
                <div><strong>{graphStats.edges}</strong><span>aristas</span></div>
                <div><strong>{mediciones.length}</strong><span>filas</span></div>
              </div>
            </section>

            <section className="panel">
              <h2><Download size={18} /> Exportar</h2>
              <div className="exportGrid">
                <button className="secondary small" onClick={exportCsv}>CSV tabla</button>
                <button className="secondary small" onClick={exportJson}>JSON grafo</button>
                {/* <button className="secondary small" onClick={exportSvg}>SVG grafo</button> */}
              </div>
            </section>

            <section className="panel">
              <h2>Imágenes</h2>
              <button className={showImages ? "primary fullButton" : "secondary fullButton"} onClick={toggleImages}>
                {showImages ? "Ocultar imágenes del grafo" : "Imágenes"}
              </button>
              <p className="hint">Selecciona un caso y presiona "Imágenes" para abrir nodos de imagen asociados.</p>
              {showImages && selected && <p className="status">{selectedImages.length} imagen(es) asociadas al caso.</p>}
            </section>

            {selected && (
              <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-3">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1 h-6 bg-blue-500 rounded-full"></span>
                  Detalle
                </h2>
                <div className="space-y-1">
                  <p className="text-base font-medium text-gray-900 truncate">{selected.label}</p>
                  {selected.type === "imagen" ? (
                    <p className="text-sm text-gray-500">Tipo: imagen asociada a un caso</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <span className="text-gray-500">Sexo:</span>
                      <span className="text-gray-800 font-medium">{selected.sexo || "—"}</span>
                      <span className="text-gray-500">Edad:</span>
                      <span className="text-gray-800 font-medium">{selected.edad || "—"}</span>
                      <span className="text-gray-500">Estilo:</span>
                      <span className="text-gray-800 font-medium">{selected.estilo_momificacion || "—"}</span>
                      <span className="text-gray-500">Estado:</span>
                      <span className="text-gray-800 font-medium">{selected.estado || "—"}</span>
                      {selected.referencia_datos && (
                        <>
                          <span className="text-gray-500">Referencia datos:</span>
                          <span className="text-gray-800 font-medium truncate">{selected.referencia_datos}</span>
                        </>
                      )}
                      {selected.matriz && (
                        <>
                          <span className="text-gray-500">Matriz:</span>
                          <span className="text-gray-800 font-medium">{selected.matriz}</span>
                        </>
                      )}
                    </div>
                  )}
                  {selected.mediciones && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Mediciones</p>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-sm mt-1">
                        {Object.entries(selected.mediciones).map(([e, m]) => (
                          <div key={e} className="flex justify-between">
                            <span className="text-gray-600 font-medium">{e}:</span>
                            <span className="text-gray-800">{m.valor} ppm</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedRelations.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Relaciones</p>
                      <div className="space-y-0.5 text-sm mt-1">
                        {selectedRelations.map((edge, idx) => (
                          <div key={`${edge.source}-${edge.target}-${idx}`} className="flex justify-between">
                            <span className="text-gray-600">{edge.label}</span>
                            <span className="text-gray-800 truncate max-w-[120px]">
                              {edge.otherNode?.label || edge.otherNode?.id || edge.target}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}
          </aside>

          <section className="space-y-4">
            <div className="panel graphPanel flex-1">
              <h2><Network size={18} /> Grafo: {modoGrafo}</h2>
              {/* <div className="graphFilterRow">
                <div className="graphFilterItem">
                  <label>Elemento</label>
                  <select value={selectedElement} onChange={(e) => setSelectedElement(e.target.value)}>
                    {(options.elementos || []).map((el) => (
                      <option key={el} value={el}>{el}</option>
                    ))}
                  </select>
                </div>
                <div className="graphFilterItem">
                  <label>Patología</label>
                  <select value={selectedPatologia} onChange={(e) => setSelectedPatologia(e.target.value)}>
                    <option value="">Ninguna</option>
                    <option value="RED_COMPLETA">Red completa</option>
                    {(options.patologias || []).map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className="graphSourceInfo"> </div>
              </div> */}
              <div className="morroTopControls" style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginBottom: "1rem" }}>
                {/* Filtro de elemento químico */}
                <div className="morroFilterGroup">
                  <label style={{ margin: 0, fontWeight: 600, fontSize: "0.875rem" }}>Elemento químico</label>
                  <div className="flex overflow-x-auto whitespace-nowrap gap-2 py-1 max-w-full">
                    {(options.elementos || []).map((el) => (
                      <button
                        key={el}
                        type="button"
                        className={`px-3 py-1.5 rounded-full border ${selectedElement === el ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300"} text-sm font-semibold transition-all hover:border-blue-500`}
                        onClick={() => setSelectedElement(el)}
                      >
                        {el}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filtro de patología */}
                <div className="morroFilterGroup">
                  <label style={{ margin: 0, fontWeight: 600, fontSize: "0.875rem" }}>Patología</label>
                  <div className="flex overflow-x-auto whitespace-nowrap gap-2 py-1 max-w-xl border border-gray-200 rounded-lg p-1 scrollbar-thin">
                    <button
                      type="button"
                      className={`px-3 py-1.5 rounded-full ${selectedPatologia === "" ? "bg-blue-600 text-white" : "bg-white text-gray-700"} text-sm font-semibold transition-all hover:bg-blue-100`}
                      onClick={() => setSelectedPatologia("")}
                    >
                      Ninguna
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-1.5 rounded-full ${selectedPatologia === "RED_COMPLETA" ? "bg-blue-600 text-white" : "bg-white text-gray-700"} text-sm font-semibold transition-all hover:bg-blue-100`}
                      onClick={() => setSelectedPatologia("RED_COMPLETA")}
                    >
                      Red completa
                    </button>
                    {(options.patologias || []).map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`px-3 py-1.5 rounded-full ${selectedPatologia === p ? "bg-blue-600 text-white" : "bg-white text-gray-700"} text-sm font-semibold transition-all hover:bg-blue-100`}
                        onClick={() => setSelectedPatologia(p)}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="pcaControls">
                <div>
                  <label className="pcaTitle">PCA multielemento</label>
                  <p className="hint">Selecciona tres o más elementos. El cálculo usa casos con todas las mediciones y estandarización z-score.</p>
                </div>
                <div className="pcaElementButtons">
                  {(options.elementos || []).filter((element) => element !== "Ninguna").map((element) => (
                    <button
                      key={`pca-${element}`}
                      type="button"
                      className={`graphFilterButton ${pcaElements.includes(element) ? "active" : ""}`}
                      onClick={() => togglePcaElement(element)}
                      aria-pressed={pcaElements.includes(element)}
                    >
                      {element}
                    </button>
                  ))}
                  <button type="button" className="primary pcaRunButton" onClick={loadPca} disabled={pcaElements.length < 3}>
                    Calcular PCA ({pcaElements.length})
                  </button>
                </div>
                {pcaStatus && <p className="status">{pcaStatus}</p>}
              </div>
              {pcaData && (
                <div className="pcaPanel">
                  <div className="pcaHeader">
                    <div>
                      <h2>PCA: {pcaData.elements.join(" + ")}</h2>
                      <p className="hint">{pcaData.summary.complete_cases} casos completos · Haz clic en un punto para ver su detalle.</p>
                    </div>
                    <div className="pcaVariance">
                      <span>PC1 <strong>{(pcaData.explained_variance.pc1 * 100).toFixed(1)}%</strong></span>
                      <span>PC2 <strong>{(pcaData.explained_variance.pc2 * 100).toFixed(1)}%</strong></span>
                    </div>
                  </div>
                  <div className="pcaDashboardControls" role="group" aria-label="Colorear PCA por">
                    <span>Colorear puntos por</span>
                    <button
                      type="button"
                      className={pcaColorBy === "sexo" ? "active" : ""}
                      onClick={() => setPcaColorBy("sexo")}
                      aria-pressed={pcaColorBy === "sexo"}
                    >
                      Sexo
                    </button>
                    <button
                      type="button"
                      className={pcaColorBy === "edad" ? "active" : ""}
                      onClick={() => setPcaColorBy("edad")}
                      aria-pressed={pcaColorBy === "edad"}
                    >
                      Edad
                    </button>
                  </div>
                  {(pcaData.warnings || []).map((warning) => <p key={warning} className="pcaWarning">{warning}</p>)}
                  <PcaChart data={pcaData} onSelect={handleSelectNode} colorBy={pcaColorBy} />
                  <div className="pcaLoadings">
                    <strong>Cargas:</strong>
                    {pcaData.loadings.map((loading) => (
                      <span key={loading.elemento}>{loading.elemento}: PC1 {loading.pc1.toFixed(2)}, PC2 {loading.pc2.toFixed(2)}</span>
                    ))}
                  </div>
                </div>
              )}
              <p className="hint">
                Azul = masculino, rojo = femenino, gris = no determinado/probable.
                {modoGrafo === "similitud" ? " Las líneas unen individuos químicamente parecidos." : " Tamaño = concentración."}
              </p>
              <div className="grid grid-cols-1 gap-4">
                {/* <GraphSvg
                  graph={graph}
                  elemento={selectedElement || "Mn"}
                  mode={modoGrafo}
                  onSelect={handleSelectNode}
                  selectedNodeId={selected?.id || ""}
                  imageNodes={selectedImages}
                  showImages={showImages}
                  hideElementCenter={selectedPatologia !== ""}
                  showElementEdges={showElementEdges}
                /> */}
                <InteractiveGraph
                  graph={graph}
                  elemento={selectedElement === "Ninguna" ? undefined : selectedElement}
                  mode={modoGrafo === "disperso" ? "distancia" : modoGrafo}
                  onSelect={handleSelectNode}
                  selectedNodeId={selected?.id || ""}
                  imageNodes={selectedImages}
                  showImages={showImages}
                  showElementEdges={showElementEdges}
                  hideElementNodes={hideElementNodes}
                />

                <div className="">
                  <TreeGraph
                    graph={morroTreeGraph}
                    rootLabel="MORRO1"
                    focusElement={selectedElement}
                    onSelect={handleSelectNode}
                    selectedNodeId={selected?.id || ""}
                  />
                  {/* <AzapaTreeGraph
                    graph={azapaTreeGraph}
                    focusElement={selectedAzapaElement}
                    onSelect={handleSelectAzapaNode}
                    selectedNodeId={selectedAzapaCase?.case_id || ""}
                  /> */}
                </div>
              </div>
            </div>

            <div className="graphSide">
              <GraphLegend
                mode={modoGrafo}
                patologiaColorMap={patologiaColorMap}
                patologiaNodes={patologiaNodes}
                stats={stats}
              />
            </div>

            {showImages && (
              <ImagePanel
                individuo={selected?.type === "individuo" ? selected : null}
                onImagesChange={setSelectedImages}
              />
            )}

            <div className="panel">
              <h2>Tabla filtrada</h2>
              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Caso</th>
                      <th>Cuerpo</th>
                      <th>Sexo</th>
                      <th>Edad</th>
                      <th>Elemento</th>
                      <th>ppm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mediciones.map((m, idx) => (
                      <tr key={idx}>
                        <td>{m.id_documento || m.id_caso}</td>
                        <td>{m.numero_cuerpo || m.caso}</td>
                        <td>{m.sexo}</td>
                        <td>{m.edad}</td>
                        <td>{m.elemento}</td>
                        <td>{checkAndFix(m.concentracion)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
