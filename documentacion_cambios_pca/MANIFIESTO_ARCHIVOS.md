# Manifiesto de archivos

## Archivos nuevos

### `frontend/src/components/PcaChart.jsx`

Componente React que dibuja el PCA como SVG.

Responsabilidades:

- representar PC1 y PC2;
- calcular escalas visuales para los ejes;
- mostrar cuadrícula, ejes y porcentajes de varianza;
- dibujar puntos interactivos;
- mostrar información del caso mediante `title`;
- permitir seleccionar un individuo;
- colorear por `sexo` o `edad`;
- generar una leyenda dinámica.

Símbolos principales para buscar:

```text
SEX_COLORS
AGE_COLORS
PcaChart
normalizedCategory
```

### `backend/tests/test_morro1_filters.py`

Pruebas automatizadas para las correcciones y el PCA.

Comprueba:

- equivalencia entre `sub adulto` y `subadulto`;
- normalización del sexo;
- opciones de filtros obtenidas desde los JSON;
- PCA con tres elementos;
- rechazo de selecciones con menos de tres elementos.

## Archivos modificados

### `backend/app/graph_service.py`

Es el archivo con la mayor parte de la lógica nueva.

Funciones añadidas:

```text
_canonical_morro1_sexo
_canonical_morro1_edad
get_morro1_reference_age_options
build_morro1_pca
```

Funciones ajustadas:

```text
build_morro1_reference_graph
_filter_morro1_cases_by_sexo
_filter_morro1_cases_by_edad
get_morro1_reference_sex_options
build_morro1_table_rows
build_morro1_element_graph
```

El PCA realiza:

1. Validación de un mínimo de tres elementos.
2. Selección de casos con todas las mediciones solicitadas.
3. Promedio de mediciones duplicadas por caso y elemento.
4. Estandarización z-score.
5. Descomposición SVD con NumPy.
6. Cálculo de PC1, PC2, cargas y varianza explicada.
7. Advertencia cuando hay menos de diez casos completos.

### `backend/app/main.py`

Cambios principales:

- importa `build_morro1_pca` y `get_morro1_reference_age_options`;
- obtiene sexo y edad desde el JSON de referencia cuando `fuente=morro1`;
- expone `GET /analysis/morro1/pca`;
- transforma errores de validación en respuestas HTTP 400.

Símbolos para buscar:

```text
filter_options
analysis_morro1_pca
/analysis/morro1/pca
```

### `backend/requirements.txt`

Dependencia añadida:

```text
numpy==2.0.2
```

### `frontend/src/lib/api.js`

Función añadida:

```text
getMorroPca
```

Construye la consulta al endpoint, envía elementos, sexo y edad, y recupera el
mensaje de error enviado por FastAPI.

### `frontend/src/App.jsx`

Estados añadidos:

```text
pcaElements
pcaData
pcaStatus
pcaColorBy
```

Funciones añadidas:

```text
togglePcaElement
loadPca
```

Interfaz añadida:

- botones de selección múltiple;
- botón `Calcular PCA`;
- resumen de casos completos;
- porcentajes de PC1 y PC2;
- lista de cargas;
- selector `Sexo / Edad`;
- componente `PcaChart`.

También se invalida el PCA anterior cuando cambian los filtros globales de sexo
o edad, evitando mostrar un resultado desactualizado.

### `frontend/src/style.css`

Clases principales añadidas:

```text
pcaControls
pcaTitle
pcaElementButtons
pcaRunButton
pcaPanel
pcaHeader
pcaVariance
pcaDashboardControls
pcaWarning
pcaChartWrap
pcaChart
pcaGridLine
pcaZeroLine
pcaTick
pcaAxisLabel
pcaPoint
pcaLegend
pcaLoadings
```

## Archivos de datos no modificados

No se cambiaron:

```text
backend/data/*.json
backend/data/imagenes/**
backend/data/arqueograph.sqlite
```

