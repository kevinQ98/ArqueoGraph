# ArqueoGraph 0.8.0 — Dashboard analítico

La versión 0.8.0 agrega una vista inicial estilo Power BI sin eliminar las
visualizaciones existentes de Morro 1, Azapa y PCA.

El encabezado funciona como panel general de la **Colección Bioarqueológica
IAI**. Incluye un mapa geográfico interactivo construido con Leaflet y
OpenStreetMap.

Coordenadas configuradas:

```text
Morro 1:  -18.508333, -70.266667
Azapa 140: -18.528267, -70.179785
```

Los marcadores filtran el panel y muestran estadísticas del sitio. Camarones no
se representa hasta contar con coordenadas verificadas.

## Archivos nuevos

- `backend/app/dashboard_service.py`: integración y agregación de las fuentes.
- `backend/tests/test_dashboard_service.py`: pruebas de filtros cruzados.
- `frontend/src/components/DashboardPanel.jsx`: interfaz completa del dashboard.
- `frontend/src/components/ArchaeologicalMap.jsx`: mapa real y marcadores.

## Archivos modificados para esta versión

- `backend/app/main.py`: versión 0.8.0 y endpoint `/dashboard/overview`.
- `frontend/src/lib/api.js`: función `getDashboardOverview`.
- `frontend/src/App.jsx`: navegación y Dashboard como vista inicial.
- `frontend/src/style.css`: diseño responsive del panel.
- `frontend/package.json` y `frontend/package-lock.json`: dependencia Leaflet.
- `README.md`: instrucciones de ejecución y descripción actualizadas.

## Segmentadores

- Sitio.
- Sexo.
- Edad.
- Elemento químico.
- Paleopatología.

Cada cambio vuelve a consultar el endpoint y actualiza todas las tarjetas,
gráficos y registros de la vista.

## Indicadores

- Individuos.
- Casos con química.
- Casos con paleopatología positiva.
- Casos con imágenes asociadas.
- Casos con datación efectiva.
- Porcentaje de cobertura química.

## Visualizaciones

- distribución por sitio;
- distribución por sexo;
- grupos de edad;
- cobertura por elemento químico;
- resumen químico por sitio;
- frecuencia de paleopatologías;
- disponibilidad por modalidad;
- contexto cultural;
- estado de conservación;
- tabla buscable de casos.

Las tarjetas de Morro 1 y Azapa 140 permiten filtrar el panel o abrir
directamente la interfaz especializada de cada sitio.

## Fuentes utilizadas

El dashboard consulta directamente los JSON de referencia y análisis. No
requiere que la base SQLite esté poblada.

## Verificación

```bash
cd backend
.venv/bin/python -m pytest -q tests/test_dashboard_service.py

cd ../frontend
npm run build
```

Valores de referencia sin filtros:

```text
338 individuos
157 con química
48 con paleopatología positiva
82 con imágenes asociadas por identificador
18 con datación efectiva
```

## Precauciones

- Zn utiliza un conjunto simulado de tres casos.
- La química debe interpretarse controlando la matriz cabello/costilla.
- Las categorías se normalizan para filtrar, pero los JSON originales no se
  modifican.
