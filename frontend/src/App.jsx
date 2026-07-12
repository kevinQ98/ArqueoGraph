import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Database, Download, Filter, Network, RefreshCw, Settings2 } from "lucide-react";
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
  getImagenesIndividuo,
  getMediciones,
  importDemo
} from "./lib/api";
import { GraphSvg } from "./components/GraphSvg";
import { AdminPanel } from "./components/AdminPanel";
import { ImagePanel } from "./components/ImagePanel";
import { ClusterPanel } from "./components/ClusterPanel";
import "./style.css";
import { GraphLegend } from "./components/GraphLegend";
import { useGraphPathologyData } from "./hooks/useGraphPathologyData";

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

export default function App() {
  const [view, setView] = useState("visualizacion");
  const [modoGrafo, setModoGrafo] = useState("distancia");
  const [modoGrafoAzapa, setModoGrafoAzapa] = useState("distancia");
  const [sexo, setSexo] = useState("");
  const [edad, setEdad] = useState("");
  const [patologia, setPatologia] = useState("");
  const [selectedPatologia, setSelectedPatologia] = useState("");
  const [selectedElement, setSelectedElement] = useState("Mn");
  const [selectedAzapaElement, setSelectedAzapaElement] = useState("Ninguna");
  const [azapaSexo, setAzapaSexo] = useState("");
  const [azapaSexoOptions, setAzapaSexoOptions] = useState([]);
  const [azapaEdad, setAzapaEdad] = useState("");
  const [azapaEdadOptions, setAzapaEdadOptions] = useState([]);
  const [elementsSimilarity, setElementsSimilarity] = useState("Mn,As,Ba");
  const [minSimilarity, setMinSimilarity] = useState(0.55);
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [azapaGraph, setAzapaGraph] = useState({ nodes: [], edges: [] });
  const [mediciones, setMediciones] = useState([]);
  const [options, setOptions] = useState({ sexos: [], edades: [], elementos: [], patologias: [] });
  const [azapaElementOptions, setAzapaElementOptions] = useState(["Ninguna", "Red Completa"]);
  const [selected, setSelected] = useState(null);
  const [showImages, setShowImages] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [status, setStatus] = useState("");
  const [azapaStatus, setAzapaStatus] = useState("");
  const GRAPH_ELEMENT = "Mn";
  const [showElementEdges, setShowElementEdges] = useState(true);
  const { patologiaNodes, patologiaColorMap, stats } = useGraphPathologyData(graph);

  async function loadOptions() {
    try {
      const opts = await getFilterOptions({ fuente: "morro1" });
      setOptions({ ...opts, elementos: Array.isArray(opts.elementos) ? opts.elementos : ["Mn"] });
      if (!opts.elementos?.includes(selectedElement) && opts.elementos?.length) {
        setSelectedElement(opts.elementos[0]);
      }
      if (!selectedElement || selectedElement !== "Mn") {
        setSelectedElement("Mn");
      }
    } catch {
      // Si aún no hay datos, se mantienen opciones por defecto.
      setOptions((prev) => ({ ...prev, elementos: ["Mn"] }));
      setSelectedElement("Mn");
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
  }

  async function load() {
    setStatus("Cargando...");
    try {
      let g;
      let m = [];
      const fuenteMorro1 = "morro1";
      if (selectedPatologia === "RED_COMPLETA") {
        // Red completa con todas las patologías
        g = await getGraphAllPatologias(edad, sexo, fuenteMorro1);
        m = await getMediciones({ sexo, edad, fuente: fuenteMorro1 });
      } else if (selectedPatologia) {
        // Patología individual como nodo central
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
        g = await getGraphElemento(selectedElement || "Mn", edad, sexo, patologia, fuenteMorro1);
        m = await getMediciones({ elemento: selectedElement || "Mn", sexo, edad, patologia, fuente: fuenteMorro1 });
      }
      setGraph(g);
      setMediciones(m);
      setStatus("");
      await loadOptions();
    } catch (err) {
      setStatus("No hay datos cargados. Usa 'Cargar demo'.");
    }
  }

  async function loadAzapaGraph(elementoFilter = selectedAzapaElement) {
    setAzapaStatus("Cargando grafo Azapa...");
    try {
      const normalized = String(elementoFilter || "Ninguna").trim();
      let graphData;
      if (normalized === "Ninguna") {
        graphData = await getGraphAzapaReference(azapaSexo, azapaEdad);
      } else if (normalized === "Red Completa") {
        graphData = await getGraphAzapaElements(azapaSexo, azapaEdad);
      } else {
        graphData = await getGraphAzapaElemento(normalized, azapaSexo, azapaEdad);
      }
      setAzapaGraph(graphData || { nodes: [], edges: [] });
      setAzapaStatus("");
    } catch {
      setAzapaStatus("No hay datos de referencia de Azapa disponibles.");
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
    loadAzapaGraph(selectedAzapaElement);
  }, []);

  useEffect(() => {
    load();
  }, [edad, sexo, modoGrafo, minSimilarity, selectedElement, patologia, selectedPatologia]);

  useEffect(() => {
    if (view === "clusters") {
      loadAzapaGraph(selectedAzapaElement);
    }
  }, [view, selectedAzapaElement, azapaSexo, azapaEdad]);

  const countByCat = {};

  const graphStats = useMemo(() => ({
    nodes: graph.nodes?.length || 0,
    edges: graph.edges?.length || 0,
  }), [graph]);

  function exportCsv() {
    downloadText("arqueograph_tabla_filtrada.csv", rowsToCsv(mediciones), "text/csv");
  }

  function exportJson() {
    downloadText("arqueograph_grafo.json", JSON.stringify(graph, null, 2), "application/json");
  }


  return (
    <div className="app">
      <header>
        <div>
          <h1>ArqueoGraph Local</h1>
          <p> </p>
        </div>
        <div className="topActions">
          <button className={view === "visualizacion" ? "navButton active" : "navButton"} onClick={() => setView("visualizacion")}>
            <Network size={18} /> MORRO1
          </button>
          <button className={view === "administracion" ? "navButton active" : "navButton"} onClick={() => setView("administracion")}>
            <Settings2 size={18} /> Administración
          </button>
          <button className={view === "clusters" ? "navButton active" : "navButton"} onClick={() => setView("clusters")}>
            <Network size={18} /> AZAPA
          </button>
          <button onClick={handleImportDemo} className="primary">
            <Database size={18} /> Cargar demo
          </button>
        </div>
      </header>

      {view === "administracion" ? (
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

              <label>Edad AZAPA</label>
              <select value={azapaEdad} onChange={(e) => setAzapaEdad(e.target.value)}>
                <option value="">Todas</option>
                {(azapaEdadOptions || []).map((edadOpt) => <option key={edadOpt} value={edadOpt}>{edadOpt}</option>)}
              </select>

              <button onClick={() => loadAzapaGraph(selectedAzapaElement)} className="secondary" style={{ marginTop: 10 }}>
                <RefreshCw size={16} /> Actualizar
              </button>
              {azapaStatus && <p className="status">{azapaStatus}</p>}
            </section>
          </aside>
          <section className="panel_grafo_azapa">
            <div className="panel azapa_graphPanel">
              <div className="graphFilterRowAzapa">
                <h2 style={{ marginBottom: 0 }}><Network size={18} /> Grafo azapa: {modoGrafoAzapa}</h2>
                <div className="azapaTopControls">
                  <label style={{ margin: 0 }}>Elemento químico</label>
                  <select value={selectedAzapaElement} onChange={(e) => setSelectedAzapaElement(e.target.value)}>
                    {azapaElementOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="hint">
                Azul = masculino, rojo = femenino, gris = no determinado/probable.
              </p>
              <GraphSvg
                graph={azapaGraph}
                elemento=""
                mode={modoGrafoAzapa}
                onSelect={() => {}}
                selectedNodeId=""
                imageNodes={[]}
                showImages={false}
                hideElementCenter={false}
                showElementEdges={true}
              />
            </div>
          </section>
        </main>
      ) : (
        <main>
          <aside>
            <section className="panel">
              <h2><Filter size={18} /> Filtros</h2>

              <label>Modo de grafo</label>
              <select value={modoGrafo} onChange={(e) => setModoGrafo(e.target.value)}>
                <option value="distancia">Distancia radial</option>
                <option value="similitud">Similitud química</option>
                <option value="disperso">Casos positivos a patologías</option>
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
                <button className="secondary small" onClick={exportSvg}>SVG grafo</button>
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
              <section className="panel">
                <h2>Detalle</h2>
                <p><strong>{selected.label}</strong></p>
                {selected.type === "imagen" ? (
                  <p>Tipo: imagen asociada a un caso</p>
                ) : (
                  <>
                    <p>Sexo: {selected.sexo}</p>
                    <p>Edad: {selected.edad}</p>
                    <p>Estilo: {selected.estilo_momificacion}</p>
                    <p>Estado: {selected.estado}</p>
                  </>
                )}
                {selected.mediciones ? (
                  <div className="miniTable">
                    {Object.entries(selected.mediciones).map(([e, m]) => (
                      <div key={e}><b>{e}</b>: {m.valor} ppm</div>
                    ))}
                  </div>
                ) : null}

                {selectedRelations.length > 0 && (
                  <div className="miniTable">
                    <strong>Relaciones</strong>
                    {selectedRelations.map((edge, idx) => (
                      <div key={`${edge.source}-${edge.target}-${idx}`}>
                        <b>{edge.label}</b> → {edge.otherNode?.label || edge.otherNode?.id || edge.target}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </aside>

          <section className="content">
            <div className="panel graphPanel">
              <h2><Network size={18} /> Grafo: {modoGrafo}</h2>
              <div className="graphFilterRow">
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
              </div>
              <p className="hint">
                Azul = masculino, rojo = femenino, gris = no determinado/probable.
                {modoGrafo === "similitud" ? " Las líneas unen individuos químicamente parecidos." : " Tamaño = concentración."}
              </p>
              <GraphSvg
                graph={graph}
                elemento={selectedElement || "Mn"}
                mode={modoGrafo}
                onSelect={handleSelectNode}
                selectedNodeId={selected?.id || ""}
                imageNodes={selectedImages}
                showImages={showImages}
                hideElementCenter={selectedPatologia !== ""}
                showElementEdges={showElementEdges}
              />
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
                    {mediciones.map((m) => (
                      <tr key={m.id_medicion}>
                        <td>{m.id_documento}</td>
                        <td>{m.numero_cuerpo}</td>
                        <td>{m.sexo}</td>
                        <td>{m.edad}</td>
                        <td>{m.elemento}</td>
                        <td>{m.concentracion}</td>
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
