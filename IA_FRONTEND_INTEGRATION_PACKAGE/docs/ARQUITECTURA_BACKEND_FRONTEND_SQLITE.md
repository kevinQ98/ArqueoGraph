# Arquitectura ArqueoGraph: frontend, backend y SQLite

Este documento explica como se conecta ArqueoGraph de punta a punta.

## 1. Resumen general

```text
React/Vite frontend
  |
  | HTTP JSON
  v
FastAPI backend
  |
  | sqlite3
  v
backend/data/arqueograph.sqlite
```

El frontend nunca lee SQLite directamente. Siempre llama al backend.

El backend:

- inicializa SQLite;
- importa CSV/JSON;
- normaliza datos;
- expone endpoints de dashboard, filtros, grafos, tablas, PCA e imagenes.

El frontend:

- consume endpoints HTTP;
- guarda estado de filtros;
- renderiza dashboard;
- renderiza grafo;
- renderiza tabla;
- renderiza PCA;
- renderiza detalle de caso e imagenes.

## 2. Rutas y archivos clave

Backend:

```text
backend/app/main.py              FastAPI, endpoints
backend/app/database.py          conexion SQLite y esquema
backend/app/importer.py          importadores CSV/JSON
backend/app/dashboard_service.py dashboard general
backend/scripts/site_package.py  crear, validar e importar paquetes CSV
backend/data/arqueograph.sqlite  base local
backend/data/imagenes/           imagenes servidas por API
```

Frontend:

```text
frontend/src/App.jsx
frontend/src/lib/api.js
frontend/src/components/DashboardPanel.jsx
frontend/src/components/GraphSvg.jsx
frontend/src/components/PcaChart.jsx
frontend/src/components/ImagePanel.jsx
frontend/src/components/dashboard/Header.jsx
frontend/src/components/dashboard/UnifiedSidebar.jsx
frontend/src/components/dashboard/morro/MorroMain.jsx
frontend/src/components/dashboard/azapa/AzapaMain.jsx
frontend/src/style.css
```

## 3. Como se crea la base SQLite

El archivo:

```text
backend/app/database.py
```

define:

```python
BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "arqueograph.sqlite"
IMAGES_DIR = DATA_DIR / "imagenes"
```

Conexion:

```python
def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn
```

El backend crea tablas si no existen con `init_db()`.

Para el frontend, lo importante es:

```text
No conectar directo a SQLite.
Usar siempre FastAPI.
```

## 4. Como cargar CSV a SQLite

Usar:

```bash
python3 backend/scripts/site_package.py validate --id sitio_demo_csv --package-dir IA_FRONTEND_INTEGRATION_PACKAGE/csv/sitio_demo_csv
```

Luego:

```bash
python3 backend/scripts/site_package.py import --id sitio_demo_csv --package-dir IA_FRONTEND_INTEGRATION_PACKAGE/csv/sitio_demo_csv
```

El importador respeta:

```text
sitios -> individuos -> mediciones -> paleopatologias -> dataciones -> imagenes
```

## 5. Como iniciar backend

Desde la raiz:

```bash
PYTHONPATH=backend backend/.venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Validar:

```bash
curl http://127.0.0.1:8000/health
```

Docs:

```text
http://127.0.0.1:8000/docs
```

## 6. Como iniciar frontend

```bash
cd frontend
npm install
npm run dev
```

Abrir:

```text
http://127.0.0.1:5173
```

El frontend usa:

```js
const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";
```

Si se necesita cambiar puerto/backend:

```bash
VITE_API_BASE=http://127.0.0.1:8000 npm run dev
```

## 7. Flujo del dashboard

```text
DashboardPage
  -> GET /dashboard/overview
  -> recibe kpis, filter_options, site_portals, cases
  -> muestra indicadores, mapa, filtros y tarjetas de sitios
```

Cada `site_portal` debe traer:

```json
{
  "sitio": "Sitio Demo CSV",
  "fuente": "sitio_demo_csv"
}
```

La UI muestra `sitio`.

La API de sitio usa `fuente`.

## 8. Flujo para abrir un sitio

Pseudo logica:

```js
function openSite(site) {
  const siteName = site.sitio;
  const fuente = site.fuente;

  if (siteName === "Morro 1") {
    openMorro();
    return;
  }

  if (siteName === "Azapa 140") {
    openAzapa();
    return;
  }

  openGenericSite({
    title: siteName,
    fuente
  });
}
```

Para sitios dinamicos:

```text
GET /filters/options?fuente={fuente}
GET /graph/site/{fuente}/reference
GET /graph/site/{fuente}/table
```

## 9. Flujo de visualizacion de sitio generico

Estado minimo:

```js
{
  fuente: "sitio_demo_csv",
  siteName: "Sitio Demo CSV",
  filters: {
    sexo: "",
    edad: "",
    elemento: "Ninguna",
    patologia: "",
    matriz: ""
  },
  graph: { nodes: [], edges: [] },
  tableRows: [],
  selectedCase: null,
  images: [],
  pca: null
}
```

Reglas:

```text
elemento = "Ninguna" -> /reference
elemento = "Red Completa" -> /elements
elemento = "As" -> /elemento/As
patologia = "RED_COMPLETA" -> /patologias
patologia = "periostitis" -> /patologia/periostitis
```

## 10. Arquitectura frontend recomendada

```text
frontend/src/
  app/
    App.jsx
    routes.js
  api/
    client.js
    dashboard.js
    sites.js
    morro.js
    azapa.js
  features/
    dashboard/
      DashboardPage.jsx
      useDashboard.js
    site-explorer/
      SiteExplorerPage.jsx
      SiteSidebar.jsx
      SiteGraphPanel.jsx
      SitePcaPanel.jsx
      SiteTablePanel.jsx
      SiteDetailPanel.jsx
      useSiteExplorer.js
      useSiteOptions.js
      useSiteGraph.js
      useSitePca.js
  components/
    layout/
      Header.jsx
      Shell.jsx
    ui/
      Button.jsx
      Select.jsx
      Tabs.jsx
      EmptyState.jsx
      LoadingState.jsx
  lib/
    exportUtils.js
    graphUtils.js
```

## 11. Responsabilidades

`api/*`:

```text
Solo fetch, URLs, errores y JSON.
No React.
```

`features/site-explorer/*`:

```text
Estado de sitio, filtros, grafo, tabla, PCA, detalle.
```

`components/ui/*`:

```text
Botones, selects, toggles, tabs, estados vacios.
Sin conocimiento de ArqueoGraph.
```

`GraphSvg`, `PcaChart`, `ImagePanel`:

```text
Componentes visuales reutilizables.
Deben recibir datos por props.
```

## 12. Checklist de integracion

La IA debe verificar:

- `npm run build` termina sin errores.
- `GET /health` responde 200.
- `GET /dashboard/overview` responde con `site_portals`.
- El dashboard muestra sitios.
- Al abrir `Sitio Demo CSV`, se usa `fuente=sitio_demo_csv`.
- Grafo reference carga.
- Grafo elements carga.
- Tabla carga.
- PCA con `As,B,Li` carga.
- Click en individuo carga `/case/{id}/relation`.
- Imagenes usan `API_BASE + image.url` si vienen relativas.

## 13. Errores frecuentes

Error:

```text
El sitio aparece en el dashboard pero no abre datos.
```

Causa probable:

```text
El frontend usa nombre visible en vez de fuente.
```

Solucion:

```js
const fuente = site.fuente;
```

Error:

```text
PCA falla.
```

Causa probable:

```text
Menos de 3 elementos o menos de 3 casos completos.
```

Error:

```text
Imagen no carga.
```

Causa probable:

```text
relative_path no existe en backend/data/imagenes o la URL relativa no fue prefijada con API_BASE.
```
