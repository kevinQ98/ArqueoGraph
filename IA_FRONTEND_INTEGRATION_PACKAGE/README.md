# Paquete para IA: integracion frontend ArqueoGraph

Este paquete contiene archivos de contexto para que una IA pueda redisenar o integrar el frontend de ArqueoGraph sin romper el backend.

## Contenido

```text
IA_FRONTEND_INTEGRATION_PACKAGE/
  README.md
  csv/
    sitio_demo_csv/
      sitios.csv
      individuos.csv
      mediciones_quimicas.csv
      paleopatologias.csv
      dataciones.csv
      imagenes.csv
  docs/
    ARQUITECTURA_BACKEND_FRONTEND_SQLITE.md
    API_CONTRACTS.md
    SQLITE_SCHEMA.sql
    FORMULAS_Y_REGLAS.md
    SNIPPETS_FRONTEND.md
```

## Sitio de prueba incluido

```text
Nombre visible: Sitio Demo CSV
fuente/id_sitio: sitio_demo_csv
```

Este sitio sirve para probar:

- dashboard;
- carga SQLite;
- filtros dinamicos;
- grafos por sitio;
- red de elementos;
- paleopatologias;
- tabla;
- PCA;
- detalle de caso;
- imagenes.

## Comandos rapidos

Desde la raiz del proyecto:

```bash
python3 backend/scripts/site_package.py validate --id sitio_demo_csv --package-dir IA_FRONTEND_INTEGRATION_PACKAGE/csv/sitio_demo_csv
```

```bash
python3 backend/scripts/site_package.py import --id sitio_demo_csv --package-dir IA_FRONTEND_INTEGRATION_PACKAGE/csv/sitio_demo_csv
```

Backend:

```bash
PYTHONPATH=backend backend/.venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend:

```bash
cd frontend
npm run dev
```

Abrir:

```text
http://127.0.0.1:5173
```
