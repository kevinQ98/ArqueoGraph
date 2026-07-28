import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  Images,
  RefreshCw,
  Route,
  Search,
  UploadCloud,
} from "lucide-react";
import {
  apiUrl,
  getAppCasos,
  getAppOverview,
  getDatasetExportUrl,
  loadDemoGuided,
  syncImagenes,
} from "../lib/api";

function StatCard({ label, value, tone = "blue" }) {
  return (
    <div className={`guideStat ${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function StepCard({ step }) {
  const ready = step.status === "ready";
  return (
    <article className={ready ? "guideStep ready" : "guideStep"}>
      <div className="stepIcon">
        {ready ? <CheckCircle2 size={20} /> : <Route size={20} />}
      </div>
      <div>
        <strong>{step.title}</strong>
        <p>{step.description}</p>
        <small>{step.action}</small>
      </div>
    </article>
  );
}

function CaseRow({ row }) {
  return (
    <tr>
      <td>{row.id_documento}</td>
      <td>{row.numero_cuerpo || "—"}</td>
      <td>{row.mediciones_count}</td>
      <td>{row.imagenes_count}</td>
      <td>
        <span className={row.estado_curaduria === "listo" ? "badge green" : "badge amber"}>
          {row.estado_curaduria}
        </span>
      </td>
      <td>{row.faltantes?.length ? row.faltantes.join(", ") : "—"}</td>
    </tr>
  );
}

export function GuidePanel({ onNavigate, onDemoLoaded }) {
  const [overview, setOverview] = useState(null);
  const [casos, setCasos] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  async function refresh() {
    setStatus("Actualizando tablero...");
    try {
      const [nextOverview, nextCasos] = await Promise.all([
        getAppOverview(),
        getAppCasos({ q }),
      ]);
      setOverview(nextOverview);
      setCasos(nextCasos);
      setStatus("");
    } catch (err) {
      setStatus(`No pude cargar el tablero: ${err.message}`);
    }
  }

  async function handleLoadDemo() {
    setStatus("Cargando demo y sincronizando imágenes...");
    try {
      await loadDemoGuided({ syncImages: true });
      await refresh();
      await onDemoLoaded?.();
      setStatus("Demo lista. Ya puedes explorar el grafo o revisar curaduría.");
    } catch (err) {
      setStatus(`Error cargando demo: ${err.message}`);
    }
  }

  async function handleSyncImages() {
    setStatus("Sincronizando imágenes copiadas a carpetas...");
    try {
      await syncImagenes();
      await refresh();
      setStatus("Imágenes sincronizadas.");
    } catch (err) {
      setStatus(`Error sincronizando imágenes: ${err.message}`);
    }
  }

  function downloadDataset() {
    window.location.href = getDatasetExportUrl();
  }

  useEffect(() => {
    refresh();
  }, []);

  const qualityTone = useMemo(() => {
    const score = overview?.quality?.score || 0;
    if (score >= 80) return "green";
    if (score >= 50) return "amber";
    return "red";
  }, [overview]);

  const counts = overview?.counts || { individuos: 0, mediciones: 0, imagenes: 0 };

  return (
    <main className="adminMain guideMain">
      <section className="guideHero">
        <div>
          <p className="eyebrow">Fase 7 · modo intuitivo</p>
          <h2>Empecemos por lo importante: cargar, revisar y explorar.</h2>
          <p>
            Este inicio traduce el backend a un flujo de trabajo: datos primero,
            imágenes después, curaduría antes de análisis.
          </p>
        </div>
        <div className="guideHeroActions">
          <button className="primary" onClick={handleLoadDemo}>
            <Database size={18} /> Preparar demo completa
          </button>
          <button className="secondary" onClick={handleSyncImages}>
            <Images size={18} /> Sincronizar imágenes
          </button>
          <button className="secondary" onClick={refresh}>
            <RefreshCw size={18} /> Actualizar
          </button>
        </div>
      </section>

      {status && <p className="status">{status}</p>}

      <section className="guideStats">
        <StatCard label="individuos" value={counts.individuos} />
        <StatCard label="mediciones" value={counts.mediciones} />
        <StatCard label="imágenes" value={counts.imagenes} />
        <StatCard label="calidad" value={`${overview?.quality?.score ?? 0}%`} tone={qualityTone} />
      </section>

      <section className="guideGrid">
        <div className="panel">
          <h2><Route size={18} /> Próximos pasos</h2>
          <div className="guideSteps">
            {(overview?.next_steps || []).map((step) => (
              <StepCard key={step.id} step={step} />
            ))}
          </div>
        </div>

        <div className="panel">
          <h2><UploadCloud size={18} /> Acciones claras</h2>
          <div className="quickActions">
            <button className="secondary" onClick={() => window.open(apiUrl("/docs"), "_blank")}>
              <FileSpreadsheet size={17} /> Abrir Swagger
            </button>
            <button className="secondary" onClick={() => onNavigate?.("administracion")}>
              <AlertTriangle size={17} /> Ir a Curaduría
            </button>
            <button className="secondary" onClick={() => onNavigate?.("visualizacion")}>
              <Search size={17} /> Explorar grafo
            </button>
            <button className="secondary" onClick={downloadDataset}>
              <Download size={17} /> Descargar respaldo
            </button>
          </div>

          <div className="guideNote">
            <strong>Carpeta de imágenes</strong>
            <code>{overview?.storage?.images_dir || "backend/data/imagenes"}</code>
            <p>Copia imágenes dentro de `caso_1`, `caso_2`, etc. y luego presiona “Sincronizar imágenes”.</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="guideTableHeader">
          <div>
            <h2>Casos cargados</h2>
            <p className="hint">Vista rápida para saber qué falta antes de analizar.</p>
          </div>
          <div className="searchRow">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar caso, cuerpo o referencia..." />
            <button className="secondary small" onClick={refresh}>Buscar</button>
          </div>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Caso</th>
                <th>Cuerpo</th>
                <th>Mediciones</th>
                <th>Imágenes</th>
                <th>Curaduría</th>
                <th>Faltantes</th>
              </tr>
            </thead>
            <tbody>
              {casos.map((row) => (
                <CaseRow key={row.id_individuo} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
