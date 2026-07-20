import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  getFilterOptions,
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
  getMediciones,
  importDemo,
  getGraphMorroReference,
  getMorroTableRows,
  getGraphMorroElemento,
  getGraphMorroElements,
  getMorroPca,
  getMorroCaseRelation,
  getAzapaPca
} from "./lib/api";
import { AdminPanel } from "./components/AdminPanel";
import "./style.css";
import { useGraphPathologyData } from "./hooks/useGraphPathologyData";
import { DashboardPanel } from "./components/DashboardPanel";
import MorroMain from "./components/dashboard/morro/MorroMain";
import MorroSidebar from "./components/dashboard/morro/MorroSidebar";
import AzapaMain from "./components/dashboard/azapa/AzapaMain";
import AzapaSidebar from "./components/dashboard/azapa/AzapaSidebar";
import Header from "./components/dashboard/Header";

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
  const [selectedAzapaCase, setSelectedAzapaCase] = useState(null);
  const [status, setStatus] = useState("");
  const [azapaStatus, setAzapaStatus] = useState("");
  const [showElementEdges, setShowElementEdges] = useState(true);
  const { patologiaNodes, patologiaColorMap, stats } = useGraphPathologyData(graph);

  const [azapaTreeGraph, setAzapaTreeGraph] = useState({ nodes: [], edges: [] });
  const [morroTreeGraph, setMorroTreeGraph] = useState({ nodes: [], edges: [] });
  const [pcaElements, setPcaElements] = useState([]);
  const [pcaData, setPcaData] = useState(null);
  const [pcaStatus, setPcaStatus] = useState("");
  const [pcaColorBy, setPcaColorBy] = useState("sexo");
  const [azapaPcaElements, setAzapaPcaElements] = useState([]);
  const [azapaPcaData, setAzapaPcaData] = useState(null);
  const [azapaPcaStatus, setAzapaPcaStatus] = useState("");
  const [azapaPcaColorBy, setAzapaPcaColorBy] = useState("sexo");
  // new
  const [showTreeMorro, setShowTreeMorro] = useState(false);
  const [showTreeAzapa, setShowTreeAzapa] = useState(false);

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

  function toggleAzapaPcaElement(element) {
    setAzapaPcaElements((current) => (
      current.includes(element)
        ? current.filter((item) => item !== element)
        : [...current, element]
    ));
    setAzapaPcaData(null);
    setAzapaPcaStatus("");
  }

  async function loadAzapaPca() {
    if (azapaPcaElements.length < 3) {
      setAzapaPcaStatus("Selecciona al menos tres elementos.");
      setAzapaPcaData(null);
      return;
    }
    setAzapaPcaStatus("Calculando PCA...");
    try {
      const result = await getAzapaPca({ elements: azapaPcaElements, sexo: azapaSexo, edad: azapaEdad, matriz: azapaMatriz });
      setAzapaPcaData(result);
      setAzapaPcaStatus("");
    } catch (error) {
      setAzapaPcaData(null);
      setAzapaPcaStatus(error.message || "No fue posible calcular el PCA.");
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
      } else {
        // Siempre distancia radial
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
      console.log(err);
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

  const handleSelectNode = useCallback(async (node) => {
    setSelected(node);
    setSelectedImages([]);

    if (node?.type === "imagen" && node?.url) {
      setShowImages(true);
      if (node.id_individuo) {
        try {
          const data = await getMorroCaseRelation(node.id);
          const imgs = data.images || [];
          setSelectedImages(imgs);
        } catch (error) {
          console.error("Error cargando imágenes de Morro1:", error);
          setSelectedImages([]);
        }
      }
      return;
    }
    if (node?.type === "individuo" && node?.id) {
      setShowImages(true);
      const idToFetch = node.id.startsWith("Morro1_") ? node.id : node.numero_cuerpo;
      if (idToFetch) {
        try {
          const data = await getMorroCaseRelation(idToFetch);
          const imgs = data.images || [];
          setSelectedImages(imgs);
        } catch (error) {
          console.error("Error cargando imágenes de Morro1:", error);
          setSelectedImages([]);
        }
      }
    }
  }, []);

  const toggleImages = useCallback(() => {
    setShowImages(prev => !prev);
  }, []);

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

  useEffect(() => {
    loadOptions();
    loadAzapaFilterOptions();
  }, []);

  useEffect(() => {
    if (view !== "visualizacion") return;
    load();
    loadMorroTreeGraph();
  }, [view, edad, sexo, selectedElement, patologia, selectedPatologia]);

  useEffect(() => {
    setPcaData(null);
    setPcaStatus("");
  }, [edad, sexo]);

  useEffect(() => {
    if (view !== "clusters") return;
    loadAzapaGraph(selectedAzapaElement);
    loadAzapaTreeGraph();
  }, [view, selectedAzapaElement, azapaSexo, azapaEdad, azapaMatriz]);

  useEffect(() => {
    setAzapaPcaData(null);
    setAzapaPcaStatus("");
  }, [azapaEdad, azapaSexo, azapaMatriz]);

  // ✅ MOVEMOS EL useMemo AQUÍ, EN EL NIVEL SUPERIOR
  const selectedRelations = useMemo(() => {
    if (!selected || !graph?.edges?.length) return [];
    const nodeLookup = Object.fromEntries((graph.nodes || []).map((n) => [n.id, n]));
    return (graph.edges || [])
      .filter((edge) => edge.source === selected.id || edge.target === selected.id)
      .map((edge) => {
        const otherId = edge.source === selected.id ? edge.target : edge.source;
        return { ...edge, otherNode: nodeLookup[otherId] };
      });
  }, [selected, graph]);

  return (
    <div className="app">
      <Header view={view} setView={setView} handleImportDemo={handleImportDemo} />

      {view === "dashboard" ? (
        <DashboardPanel onNavigate={setView} />
      ) : view === "administracion" ? (
        <main className="adminMain">
          <AdminPanel />
        </main>
      ) : view === "clusters" ? (
        <main className="adminMain_azapa">
          <AzapaSidebar
            azapaSexo={azapaSexo} setAzapaSexo={setAzapaSexo} azapaSexoOptions={azapaSexoOptions}
            azapaEdad={azapaEdad} setAzapaEdad={setAzapaEdad} azapaEdadOptions={azapaEdadOptions}
            azapaMatriz={azapaMatriz} setAzapaMatriz={setAzapaMatriz} azapaMatrizOptions={azapaMatrizOptions}
            modoGrafoAzapa={modoGrafoAzapa} setModoGrafoAzapa={setModoGrafoAzapa}
            showElementEdges={showElementEdges} setShowElementEdges={setShowElementEdges}
            loadAzapaGraph={loadAzapaGraph}
            loadAzapaFilterOptions={loadAzapaFilterOptions}
            azapaStatus={azapaStatus}
            azapaStats={{ nodes: azapaGraph?.nodes?.length || 0, edges: azapaGraph?.edges?.length || 0, rows: azapaTableRows?.length || 0 }}
            exportAzapaCsv={() => downloadText("arqueograph_azapa_tabla_filtrada.csv", rowsToCsv(azapaTableRows), "text/csv")}
            exportAzapaJson={() => downloadText("arqueograph_azapa_grafo.json", JSON.stringify(azapaGraph, null, 2), "application/json")}
            toggleImages={toggleImages} showImages={showImages}
            selectedAzapaCase={selectedAzapaCase}
            showTree={showTreeAzapa}
            setShowTree={setShowTreeAzapa}
          />
          <AzapaMain
            azapaGraph={azapaGraph}
            selectedAzapaElement={selectedAzapaElement} setSelectedAzapaElement={setSelectedAzapaElement} azapaElementOptions={azapaElementOptions}
            azapaMatriz={azapaMatriz} setAzapaMatriz={setAzapaMatriz} azapaMatrizOptions={azapaMatrizOptions}
            modoGrafoAzapa={modoGrafoAzapa}
            handleSelectAzapaNode={handleSelectAzapaNode}
            selectedAzapaCase={selectedAzapaCase}
            showElementEdges={showElementEdges}
            azapaTreeGraph={azapaTreeGraph}
            azapaTableRows={azapaTableRows}
            azapaPcaElements={azapaPcaElements} toggleAzapaPcaElement={toggleAzapaPcaElement} loadAzapaPca={loadAzapaPca}
            azapaPcaStatus={azapaPcaStatus} azapaPcaData={azapaPcaData} azapaPcaColorBy={azapaPcaColorBy} setAzapaPcaColorBy={setAzapaPcaColorBy}
            setAzapaPcaData={setAzapaPcaData}
            showTree={showTreeAzapa}
          />
        </main>
      ) : (
        <main>
          <MorroSidebar
            sexo={sexo} setSexo={setSexo} options={options}
            edad={edad} setEdad={setEdad}
            modoGrafo={modoGrafo} setModoGrafo={setModoGrafo}
            minSimilarity={minSimilarity} setMinSimilarity={setMinSimilarity}
            showElementEdges={showElementEdges} setShowElementEdges={setShowElementEdges}
            load={load} status={status}
            graphStats={{ nodes: graph.nodes?.length || 0, edges: graph.edges?.length || 0 }}
            mediciones={mediciones}
            exportCsv={() => downloadText("arqueograph_tabla_filtrada.csv", rowsToCsv(mediciones), "text/csv")}
            exportJson={() => downloadText("arqueograph_grafo.json", JSON.stringify(graph, null, 2), "application/json")}
            showImages={showImages} toggleImages={toggleImages}
            selectedImages={selectedImages} selected={selected}
            selectedRelations={selectedRelations} showTree={showTreeMorro}
            setShowTree={setShowTreeMorro}
          />
          <MorroMain
            graph={graph}
            selectedElement={selectedElement} setSelectedElement={setSelectedElement}
            selectedPatologia={selectedPatologia} setSelectedPatologia={setSelectedPatologia}
            modoGrafo={modoGrafo}
            handleSelectNode={handleSelectNode}
            selected={selected}
            selectedImages={selectedImages}
            showImages={showImages}
            showElementEdges={showElementEdges}
            hideElementNodes={selectedPatologia !== "" || modoGrafo === "disperso"}
            morroTreeGraph={morroTreeGraph}
            options={options}
            pcaElements={pcaElements} togglePcaElement={togglePcaElement} loadPca={loadPca} pcaStatus={pcaStatus} pcaData={pcaData} pcaColorBy={pcaColorBy} setPcaColorBy={setPcaColorBy}
            mediciones={mediciones}
            patologiaColorMap={patologiaColorMap}
            patologiaNodes={patologiaNodes}
            stats={stats}
            showTree={showTreeMorro}
            setPcaData={setPcaData}
          />
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