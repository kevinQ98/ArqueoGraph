# Snippets frontend para integrar ArqueoGraph

Estos snippets son una guia para otra IA. Pueden copiarse a archivos reales y adaptarse.

## api/client.js

```js
export const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

export function buildUrl(path, params = {}) {
  const url = new URL(`${API_BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });
  return url;
}

export async function getJson(path, params = {}) {
  const url = buildUrl(path, params);
  const response = await fetch(url);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

export function resolveFileUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE}${url.startsWith("/") ? url : `/${url}`}`;
}
```

## api/dashboard.js

```js
import { getJson } from "./client";

export function getDashboardOverview(params = {}) {
  return getJson("/dashboard/overview", params);
}

export function getFilterOptions(params = {}) {
  return getJson("/filters/options", params);
}
```

## api/sites.js

```js
import { getJson } from "./client";

function sitePath(fuente, suffix) {
  return `/graph/site/${encodeURIComponent(fuente)}${suffix}`;
}

export function getSiteReference(fuente, filters = {}) {
  return getJson(sitePath(fuente, "/reference"), filters);
}

export function getSiteElements(fuente, filters = {}) {
  return getJson(sitePath(fuente, "/elements"), filters);
}

export function getSiteElement(fuente, elemento, filters = {}) {
  return getJson(sitePath(fuente, `/elemento/${encodeURIComponent(elemento)}`), filters);
}

export function getSitePathologies(fuente, filters = {}) {
  return getJson(sitePath(fuente, "/patologias"), filters);
}

export function getSitePathology(fuente, patologia, filters = {}) {
  return getJson(sitePath(fuente, `/patologia/${encodeURIComponent(patologia)}`), filters);
}

export function getSiteTable(fuente, filters = {}) {
  return getJson(sitePath(fuente, "/table"), filters);
}

export function getSiteCaseRelation(fuente, caseId) {
  return getJson(sitePath(fuente, `/case/${encodeURIComponent(caseId)}/relation`));
}

export function getSitePca(fuente, { elements = [], sexo = "", edad = "" } = {}) {
  return getJson(`/analysis/site/${encodeURIComponent(fuente)}/pca`, {
    elements: elements.join(","),
    sexo,
    edad,
  });
}
```

## useSiteExplorer.js

```js
import { useCallback, useEffect, useMemo, useState } from "react";
import { getFilterOptions } from "../api/dashboard";
import {
  getSiteReference,
  getSiteElements,
  getSiteElement,
  getSitePathologies,
  getSitePathology,
  getSiteTable,
  getSiteCaseRelation,
  getSitePca,
} from "../api/sites";

const EMPTY_FILTERS = {
  sexo: "",
  edad: "",
  elemento: "Ninguna",
  patologia: "",
  matriz: "",
};

export function useSiteExplorer({ fuente }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [options, setOptions] = useState({ sexos: [], edades: [], elementos: [], patologias: [] });
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [caseRelation, setCaseRelation] = useState(null);
  const [pca, setPca] = useState(null);
  const [status, setStatus] = useState("");

  const queryFilters = useMemo(() => ({
    sexo: filters.sexo,
    edad: filters.edad,
    matriz: filters.matriz,
  }), [filters.sexo, filters.edad, filters.matriz]);

  const updateFilter = useCallback((key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  }, []);

  const loadOptions = useCallback(async () => {
    const data = await getFilterOptions({ fuente });
    setOptions({
      ...data,
      elementos: ["Ninguna", "Red Completa", ...(data.elementos || [])],
    });
  }, [fuente]);

  const loadGraphAndTable = useCallback(async () => {
    setStatus("Cargando...");
    try {
      let nextGraph;
      let tableParams = { ...queryFilters };

      if (filters.patologia === "RED_COMPLETA") {
        nextGraph = await getSitePathologies(fuente, queryFilters);
      } else if (filters.patologia) {
        nextGraph = await getSitePathology(fuente, filters.patologia, queryFilters);
        tableParams.patologia = filters.patologia;
      } else if (filters.elemento === "Ninguna") {
        nextGraph = await getSiteReference(fuente, queryFilters);
      } else if (filters.elemento === "Red Completa") {
        nextGraph = await getSiteElements(fuente, queryFilters);
      } else {
        nextGraph = await getSiteElement(fuente, filters.elemento, queryFilters);
        tableParams.elemento = filters.elemento;
      }

      const nextRows = await getSiteTable(fuente, tableParams);
      setGraph(nextGraph || { nodes: [], edges: [] });
      setRows(Array.isArray(nextRows) ? nextRows : []);
      setStatus("");
    } catch (error) {
      setStatus(error.message || "No fue posible cargar el sitio.");
      setGraph({ nodes: [], edges: [] });
      setRows([]);
    }
  }, [fuente, filters.elemento, filters.patologia, queryFilters]);

  const selectNode = useCallback(async (node) => {
    setSelected(node);
    setCaseRelation(null);
    const caseId = node?.id_individuo || (node?.type === "individuo" ? node.id : "");
    if (!caseId) return;
    const data = await getSiteCaseRelation(fuente, caseId);
    setCaseRelation(data);
  }, [fuente]);

  const calculatePca = useCallback(async (elements) => {
    const data = await getSitePca(fuente, {
      elements,
      sexo: filters.sexo,
      edad: filters.edad,
    });
    setPca(data);
    return data;
  }, [fuente, filters.sexo, filters.edad]);

  useEffect(() => {
    if (!fuente) return;
    loadOptions();
  }, [fuente, loadOptions]);

  useEffect(() => {
    if (!fuente) return;
    loadGraphAndTable();
  }, [fuente, loadGraphAndTable]);

  return {
    filters,
    updateFilter,
    options,
    graph,
    rows,
    selected,
    caseRelation,
    pca,
    status,
    selectNode,
    calculatePca,
    reload: loadGraphAndTable,
  };
}
```

## SiteExplorerPage.jsx

```jsx
import GraphSvg from "../../components/GraphSvg";
import PcaChart from "../../components/PcaChart";
import ImagePanel from "../../components/ImagePanel";
import { resolveFileUrl } from "../../api/client";
import { useSiteExplorer } from "./useSiteExplorer";

export function SiteExplorerPage({ site }) {
  const explorer = useSiteExplorer({ fuente: site.fuente });
  const images = explorer.caseRelation?.images || [];

  return (
    <main className="siteExplorer">
      <aside className="siteSidebar">
        <h2>{site.sitio}</h2>

        <label>
          Sexo
          <select
            value={explorer.filters.sexo}
            onChange={(event) => explorer.updateFilter("sexo", event.target.value)}
          >
            <option value="">Todos</option>
            {(explorer.options.sexos || []).map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>

        <label>
          Edad
          <select
            value={explorer.filters.edad}
            onChange={(event) => explorer.updateFilter("edad", event.target.value)}
          >
            <option value="">Todas</option>
            {(explorer.options.edades || []).map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>

        <label>
          Elemento
          <select
            value={explorer.filters.elemento}
            onChange={(event) => explorer.updateFilter("elemento", event.target.value)}
          >
            {(explorer.options.elementos || ["Ninguna"]).map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>

        <button type="button" onClick={explorer.reload}>Actualizar</button>
      </aside>

      <section className="siteMain">
        {explorer.status && <p>{explorer.status}</p>}
        <GraphSvg
          data={explorer.graph}
          onSelectNode={explorer.selectNode}
        />
      </section>

      <aside className="siteDetail">
        <h3>Detalle</h3>
        {explorer.selected ? (
          <pre>{JSON.stringify(explorer.selected, null, 2)}</pre>
        ) : (
          <p>Selecciona un nodo.</p>
        )}
        <ImagePanel
          images={images.map((image) => ({
            ...image,
            url: resolveFileUrl(image.url),
          }))}
        />
      </aside>
    </main>
  );
}
```

## Exportar tabla CSV

```js
export function rowsToCsv(rows) {
  if (!rows?.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value) => {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replaceAll('"', '""')}"`;
  };
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n");
}

export function downloadText(filename, text, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
```
