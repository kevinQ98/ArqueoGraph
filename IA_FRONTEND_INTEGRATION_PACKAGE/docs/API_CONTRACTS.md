# Contratos API para frontend

Base URL:

```js
const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";
```

## Salud

```http
GET /health
```

Respuesta:

```json
{
  "ok": true,
  "app": "ArqueoGraph Local API",
  "version": "0.8.0",
  "database": ".../backend/data/arqueograph.sqlite",
  "uploads_dir": ".../backend/data/uploads"
}
```

## Dashboard general

```http
GET /dashboard/overview
GET /dashboard/overview?sitio=Sitio%20Demo%20CSV
GET /dashboard/overview?sexo=femenino&edad=adulto&elemento=As&patologia=periostitis
```

Forma esperada:

```json
{
  "kpis": {
    "individuos": 0,
    "sitios": 0,
    "con_patologia": 0,
    "con_quimica": 0,
    "cobertura_quimica_pct": 0,
    "con_imagenes": 0
  },
  "filter_options": {
    "sitios": [],
    "sexos": [],
    "edades": [],
    "elementos": [],
    "patologias": []
  },
  "site_portals": [
    {
      "sitio": "Sitio Demo CSV",
      "fuente": "sitio_demo_csv",
      "individuos": 5,
      "con_quimica": 5,
      "con_imagenes": 2,
      "culturas": []
    }
  ],
  "cases": []
}
```

## Opciones de filtros

```http
GET /filters/options
GET /filters/options?fuente=sitio_demo_csv
```

Respuesta:

```json
{
  "sitios": ["Morro 1", "Azapa 140", "Sitio Demo CSV"],
  "sexos": ["femenino", "masculino", "indeterminado"],
  "edades": ["adulto", "subadulto", "indeterminado"],
  "elementos": ["As", "B", "Li", "Mn", "Zn"],
  "patologias": ["periostitis", "patologia_dental"]
}
```

## Sitios dinamicos por fuente

Regla:

```text
fuente = sitios.id_sitio
```

Ejemplo:

```text
Nombre visible: Sitio Demo CSV
fuente: sitio_demo_csv
```

### Grafo de referencia

```http
GET /graph/site/{fuente}/reference
GET /graph/site/sitio_demo_csv/reference?sexo=femenino&edad=adulto
```

### Grafo por elemento

```http
GET /graph/site/{fuente}/elemento/{elemento}
GET /graph/site/sitio_demo_csv/elemento/As
```

### Red completa de elementos

```http
GET /graph/site/{fuente}/elements
```

### Grafo de todas las patologias positivas

```http
GET /graph/site/{fuente}/patologias
```

### Grafo por patologia

```http
GET /graph/site/{fuente}/patologia/{patologia}
```

### Tabla

```http
GET /graph/site/{fuente}/table
GET /graph/site/sitio_demo_csv/table?elemento=As&sexo=femenino&edad=adulto
GET /graph/site/sitio_demo_csv/table?patologia=periostitis
```

### Detalle de caso e imagenes

```http
GET /graph/site/{fuente}/case/{case_id}/relation
GET /graph/site/sitio_demo_csv/case/sitio_demo_csv_001/relation
```

### PCA

```http
GET /analysis/site/{fuente}/pca?elements=As,B,Li
GET /analysis/site/sitio_demo_csv/pca?elements=As,B,Li&sexo=femenino
```

## Forma de grafo

```json
{
  "mode": "reference",
  "nodes": [
    {
      "id": "sitio_demo_csv_001",
      "label": "SDC1",
      "type": "individuo",
      "sexo": "femenino",
      "edad": "adulto",
      "id_individuo": "sitio_demo_csv_001",
      "numero_cuerpo": "SDC1"
    }
  ],
  "edges": [
    {
      "source": "sitio_demo_csv:site",
      "target": "sitio_demo_csv_001",
      "label": "presenta"
    }
  ],
  "summary": {
    "fuente": "sitio_demo_csv",
    "sitio": "Sitio Demo CSV",
    "individuos": 5
  }
}
```

## Forma de tabla

```json
[
  {
    "id_caso": "sitio_demo_csv_001",
    "caso": "SDC1",
    "sexo": "femenino",
    "edad": "adulto",
    "elemento": "As",
    "concentracion": 1.2,
    "unidad": "ppm",
    "matriz": "costilla"
  }
]
```

## Forma de PCA

```json
{
  "elements": ["As", "B", "Li"],
  "points": [
    {
      "id": "sitio_demo_csv_001",
      "id_individuo": "sitio_demo_csv_001",
      "label": "SDC1",
      "caso": "SDC1",
      "type": "individuo",
      "sexo": "femenino",
      "edad": "adulto",
      "pc1": 0.1,
      "pc2": -0.4,
      "mediciones": {
        "As": { "valor": 1.2 },
        "B": { "valor": 72.5 },
        "Li": { "valor": 0.82 }
      }
    }
  ],
  "loadings": [
    { "elemento": "As", "pc1": 0.4, "pc2": 0.2 }
  ],
  "explained_variance": {
    "pc1": 0.65,
    "pc2": 0.22
  },
  "summary": {
    "complete_cases": 4,
    "incomplete_cases": 1,
    "standardization": "z-score",
    "duplicate_measurements": "mean"
  },
  "warnings": []
}
```
