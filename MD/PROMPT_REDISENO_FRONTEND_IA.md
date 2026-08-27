# Prompt para IA: redisenar el frontend de ArqueoGraph

Copia y pega este prompt en otra IA para pedirle que proponga o implemente una nueva estructura frontend para ArqueoGraph.

---

## Prompt

Actua como un/a senior frontend engineer y product designer especializado/a en aplicaciones cientificas, dashboards de datos y visualizacion interactiva de grafos.

Necesito que redisenes la estructura frontend de una aplicacion llamada **ArqueoGraph**. La app ya tiene backend funcional en FastAPI y una base SQLite. Tu tarea es **cambiar/mejorar el frontend**, no rehacer el backend.

### Objetivo principal

Crear una nueva arquitectura frontend mas ordenada, escalable y facil de mantener para una aplicacion de colecciones bioarqueologicas.

La app debe permitir:

- ver un dashboard general de la coleccion;
- navegar por sitios arqueologicos;
- abrir visualizaciones por sitio;
- filtrar por sexo, edad, elemento quimico, paleopatologia y matriz cuando exista;
- visualizar grafos interactivos;
- ver PCA multielemento;
- ver tabla de mediciones filtradas;
- ver detalle de individuos/casos;
- ver imagenes asociadas a un individuo;
- exportar tabla/grafo;
- soportar sitios dinamicos cargados desde SQLite/CSV usando `fuente`.

### Stack actual

Frontend:

```text
React
Vite
D3
Lucide React
Leaflet
CSS propio en src/style.css
```

Backend:

```text
FastAPI
SQLite
```

No cambies el backend salvo que sea estrictamente necesario. El rediseño debe consumir las APIs existentes.

### Estructura frontend actual

Archivos principales:

```text
frontend/src/App.jsx
frontend/src/lib/api.js
frontend/src/style.css
frontend/src/components/DashboardPanel.jsx
frontend/src/components/ArchaeologicalMap.jsx
frontend/src/components/GraphSvg.jsx
frontend/src/components/PcaChart.jsx
frontend/src/components/ImagePanel.jsx
frontend/src/components/dashboard/Header.jsx
frontend/src/components/dashboard/UnifiedSidebar.jsx
frontend/src/components/dashboard/DataTable.jsx
frontend/src/components/dashboard/DetailPanel.jsx
frontend/src/components/dashboard/morro/MorroMain.jsx
frontend/src/components/dashboard/azapa/AzapaMain.jsx
frontend/src/hooks/useGraphPathologyData.js
```

Problema actual:

- `App.jsx` concentra demasiada logica de estado, carga de datos, navegacion y renderizado.
- Hay vistas especiales para Morro 1 y Azapa 140, pero tambien sitios dinamicos nuevos.
- La UI ha ido creciendo por capas y necesita una estructura mas clara.
- Queremos que los sitios nuevos funcionen sin crear componentes o endpoints especiales por cada sitio.

### Concepto clave: `fuente`

`fuente` es el identificador interno del sitio. Es distinto del nombre visible.

Ejemplo:

```text
Nombre visible: Sitio Demo CSV
fuente/id_sitio: sitio_demo_csv
```

La UI puede mostrar `Sitio Demo CSV`, pero las llamadas API deben usar:

```text
sitio_demo_csv
```

Los sitios dinamicos deben consumir endpoints genericos:

```text
/graph/site/{fuente}/reference
/graph/site/{fuente}/elemento/{elemento}
/graph/site/{fuente}/elements
/graph/site/{fuente}/patologias
/graph/site/{fuente}/patologia/{patologia}
/graph/site/{fuente}/table
/graph/site/{fuente}/case/{case_id}/relation
/analysis/site/{fuente}/pca
```

### API base actual

El frontend usa:

```js
const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";
```

Funciones importantes actuales:

```js
export async function getDashboardOverview(params = {}) {
  const url = new URL(`${API_BASE}/dashboard/overview`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando el dashboard arqueologico");
  return res.json();
}
```

Funciones para sitios dinamicos:

```js
function siteApiUrl(fuente, suffix = "") {
  return new URL(`${API_BASE}/graph/site/${encodeURIComponent(fuente)}${suffix}`);
}

function addSearchParams(url, params = {}) {
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });
  return url;
}

export async function getSiteGraphReference(fuente, { sexo = "", edad = "", patologia = "" } = {}) {
  const url = addSearchParams(siteApiUrl(fuente, "/reference"), { sexo, edad, patologia });
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando grafo de sitio");
  return res.json();
}

export async function getSiteGraphElemento(fuente, elemento, { sexo = "", edad = "", matriz = "" } = {}) {
  const url = addSearchParams(siteApiUrl(fuente, `/elemento/${encodeURIComponent(elemento)}`), { sexo, edad, matriz });
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando grafo de sitio por elemento");
  return res.json();
}

export async function getSiteGraphElements(fuente, { sexo = "", edad = "", matriz = "" } = {}) {
  const url = addSearchParams(siteApiUrl(fuente, "/elements"), { sexo, edad, matriz });
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando red completa del sitio");
  return res.json();
}

export async function getSiteGraphPatologias(fuente, { sexo = "", edad = "" } = {}) {
  const url = addSearchParams(siteApiUrl(fuente, "/patologias"), { sexo, edad });
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando patologias del sitio");
  return res.json();
}

export async function getSiteGraphPatologia(fuente, patologia, { sexo = "", edad = "" } = {}) {
  const url = addSearchParams(siteApiUrl(fuente, `/patologia/${encodeURIComponent(patologia)}`), { sexo, edad });
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando patologia del sitio");
  return res.json();
}

export async function getSiteTableRows(fuente, params = {}) {
  const url = addSearchParams(siteApiUrl(fuente, "/table"), params);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando tabla del sitio");
  return res.json();
}

export async function getSitePca(fuente, { elements = [], sexo = "", edad = "" } = {}) {
  const url = new URL(`${API_BASE}/analysis/site/${encodeURIComponent(fuente)}/pca`);
  url.searchParams.set("elements", elements.join(","));
  addSearchParams(url, { sexo, edad });
  const res = await fetch(url);
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.detail || "Error calculando PCA del sitio");
  }
  return res.json();
}

export async function getSiteCaseRelation(fuente, caseId) {
  const res = await fetch(`${API_BASE}/graph/site/${encodeURIComponent(fuente)}/case/${encodeURIComponent(caseId)}/relation`);
  if (!res.ok) throw new Error("Error cargando relacion del sitio");
  return res.json();
}
```

### Navegacion actual

La app distingue:

```text
dashboard
visualizacion  -> Morro 1
clusters       -> Azapa 140
new_sitio      -> sitios dinamicos por fuente
administracion
```

En `App.jsx` existe esta idea:

```js
const usesGenericSiteApi = morroSource !== "morro1";
```

Y al abrir sitios:

```js
const openSite = useCallback((site) => {
  const siteName = typeof site === "string" ? site : site?.sitio;
  const siteSource = typeof site === "object" && site?.fuente ? site.fuente : "";

  if (siteName === "Morro 1") {
    setMorroSource("morro1");
    setMorroSiteName("Morro 1");
    setView("visualizacion");
    return;
  }

  if (siteName === "Azapa 140") {
    setView("clusters");
    return;
  }

  if (siteName) {
    setActiveGenericSite(siteName);
    setMorroSource(siteSource || String(siteName).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""));
    setMorroSiteName(siteName);
    setView("new_sitio");
  }
}, []);
```

Puedes cambiar esta arquitectura si propones algo mejor, pero debes preservar:

- Morro 1 funcionando;
- Azapa 140 funcionando;
- sitios dinamicos por `fuente` funcionando.

### Formas esperadas de datos

Dashboard:

```js
{
  kpis: {
    individuos: number,
    sitios: number,
    con_patologia: number,
    con_quimica: number,
    cobertura_quimica_pct: number,
    con_imagenes: number
  },
  filter_options: {
    sitios: string[],
    sexos: string[],
    edades: string[],
    elementos: string[],
    patologias: string[]
  },
  site_portals: [
    {
      sitio: "Morro 1",
      fuente: "morro1",
      individuos: number,
      con_quimica: number,
      con_imagenes: number,
      culturas: string[]
    }
  ],
  cases: []
}
```

Grafo:

```js
{
  mode: "reference" | "relational",
  nodes: [
    {
      id: string,
      label: string,
      type: "individuo" | "elemento" | "patologia" | "imagen",
      sexo?: string,
      edad?: string,
      id_individuo?: string,
      numero_cuerpo?: string,
      elemento?: string,
      patologia?: string
    }
  ],
  edges: [
    {
      source: string,
      target: string,
      label?: string,
      elemento?: string,
      concentracion?: number
    }
  ],
  summary?: object
}
```

PCA:

```js
{
  elements: ["As", "B", "Li"],
  points: [
    {
      id: string,
      label: string,
      sexo: string,
      edad: string,
      pc1: number,
      pc2: number,
      mediciones: object
    }
  ],
  loadings: [
    {
      elemento: string,
      pc1: number,
      pc2: number
    }
  ],
  explained_variance: {
    pc1: number,
    pc2: number
  },
  summary: {
    complete_cases: number,
    incomplete_cases: number
  }
}
```

Detalle de caso:

```js
{
  case: object,
  images: [
    {
      id_imagen: string,
      url: string,
      label: string,
      descripcion: string
    }
  ],
  measurements: []
}
```

### Requisitos del nuevo frontend

Propone e implementa una nueva estructura como esta, o una mejor:

```text
frontend/src/
  app/
    App.jsx
    routes.js
    providers/
  api/
    client.js
    dashboard.js
    sites.js
    morro.js
    azapa.js
  features/
    dashboard/
      DashboardPage.jsx
      components/
    site-explorer/
      SiteExplorerPage.jsx
      SiteSidebar.jsx
      SiteGraphView.jsx
      SitePcaView.jsx
      SiteTableView.jsx
      SiteDetailPanel.jsx
      hooks/
        useSiteExplorer.js
        useSiteFilters.js
        useSiteGraph.js
        useSitePca.js
    azapa/
    morro/
    admin/
  components/
    layout/
      AppHeader.jsx
      Shell.jsx
    ui/
      Button.jsx
      Select.jsx
      Toggle.jsx
      Tabs.jsx
      Stat.jsx
      EmptyState.jsx
      LoadingState.jsx
  lib/
    exportUtils.js
    graphUtils.js
```

### UX deseada

La aplicacion debe sentirse como una herramienta profesional de analisis, no como landing page.

Prioridades:

- interfaz densa pero ordenada;
- dashboard claro;
- navegacion por sitio obvia;
- filtros persistentes y faciles de entender;
- panel lateral compacto;
- visualizacion principal amplia;
- tabla y detalle accesibles;
- PCA como modo o tab claro;
- estados vacios utiles;
- loading/error states visibles;
- responsive para desktop y notebook;
- evitar textos explicativos largos dentro de la interfaz;
- evitar tarjetas anidadas innecesarias;
- evitar decoracion excesiva.

### Restricciones importantes

No romper:

- `GraphSvg`;
- `PcaChart`;
- `ImagePanel`;
- endpoints existentes;
- compatibilidad con `fuente`;
- Morro 1;
- Azapa 140;
- sitios CSV/SQLite dinamicos.

No usar datos mock como reemplazo de la API. Solo se permite mock temporal si la API falla, y debe quedar claramente separado.

No crear una landing page. La primera pantalla debe ser el dashboard operativo.

No transformar todo en una sola mega pagina. La meta es modularizar.

### Tareas esperadas

1. Analiza el frontend actual.
2. Propone una nueva arquitectura de carpetas.
3. Identifica que logica debe salir de `App.jsx`.
4. Crea hooks para:
   - cargar dashboard;
   - cargar opciones de filtro;
   - cargar grafo de sitio;
   - cargar tabla;
   - cargar PCA;
   - cargar detalle/imagenes de caso.
5. Crea una vista unica `SiteExplorerPage` que pueda servir para:
   - Morro 1;
   - sitios dinamicos por `fuente`;
   - eventualmente Azapa si se puede adaptar sin romper su logica especial.
6. Mantiene o adapta vistas especiales de Azapa si su modelo de datos lo requiere.
7. Mejora el layout visual sin cambiar el contrato de datos.
8. Entrega codigo completo por archivos.
9. Explica que archivos reemplazar, crear o mover.
10. Incluye checklist de pruebas manuales.

### Resultado esperado

Quiero que respondas con:

1. Diagnostico breve de la estructura actual.
2. Propuesta de nueva arquitectura.
3. Plan de migracion por pasos pequenos.
4. Codigo de los archivos nuevos o modificados.
5. Lista de endpoints usados.
6. Riesgos o puntos donde debo tener cuidado.
7. Comandos para probar:

```bash
cd frontend
npm install
npm run build
npm run dev
```

Y para el backend:

```bash
PYTHONPATH=backend backend/.venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Criterio de exito

El rediseño es exitoso si:

- el dashboard carga;
- Morro 1 abre y muestra grafo, filtros, tabla, detalle, imagenes y PCA;
- Azapa 140 abre y mantiene su grafo/filtros/PCA;
- un sitio dinamico como `sitio_demo_csv` o `prueba_test` abre usando `/graph/site/{fuente}/...`;
- los filtros actualizan la visualizacion;
- la tabla exporta CSV;
- el grafo exporta JSON;
- `npm run build` termina sin errores.

---

## Contexto corto para pegar si la IA tiene limite de tokens

Rediseña el frontend React/Vite de ArqueoGraph, una app bioarqueologica con FastAPI/SQLite. No rehagas backend. Debe consumir APIs existentes. Mantener dashboard, Morro 1, Azapa 140 y sitios dinamicos por `fuente`. Sitios dinamicos usan endpoints `/graph/site/{fuente}/reference`, `/elements`, `/elemento/{elemento}`, `/patologias`, `/patologia/{patologia}`, `/table`, `/case/{case_id}/relation`, y `/analysis/site/{fuente}/pca`. La app actual concentra demasiada logica en `App.jsx`; quiero modularizar en `features/dashboard`, `features/site-explorer`, `api`, `components/ui`, `components/layout` y hooks. Entrega codigo por archivos, plan de migracion, endpoints usados y checklist de pruebas. No crear landing page; primera pantalla debe ser dashboard operativo. Mantener `GraphSvg`, `PcaChart`, `ImagePanel` o adaptarlos sin romperlos.
