# Guía de integración para otra copia de ArqueoGraph

## Antes de comenzar

El colega debe crear una rama y comprobar que su repositorio esté limpio:

```bash
git switch -c feature/pca-multielemento
git status
```

No se recomienda copiar encima de `App.jsx`, `main.py` o `graph_service.py`
porque podrían existir diferencias entre versiones.

## Paso 1: dependencia del backend

Agregar a `backend/requirements.txt`:

```text
numpy==2.0.2
```

Instalar dependencias:

```bash
cd backend
source .venv/bin/activate
pip install -r requirements.txt
```

## Paso 2: correcciones de edad y sexo

En `backend/app/graph_service.py`, trasladar las funciones:

```text
_canonical_morro1_sexo
_canonical_morro1_edad
get_morro1_reference_age_options
```

Actualizar los filtros de Morro 1 para que usen estas funciones. El objetivo es
que los siguientes valores sean equivalentes:

```text
sub adulto == subadulto
PENDindeterminadoENTE == indeterminado
```

En `backend/app/main.py`, ajustar `filter_options` para que, cuando
`fuente=morro1`, sexo y edad provengan del JSON de referencia y no dependan de
que SQLite tenga registros.

## Paso 3: servicio PCA

Trasladar `build_morro1_pca` a `backend/app/graph_service.py` e importar NumPy:

```python
import numpy as np
```

La función depende de estas funciones existentes:

```text
build_morro1_table_rows
get_morro1_available_elements
_normalize_filter_value
```

Si la otra aplicación tiene nombres diferentes, se deben adaptar esas llamadas.

## Paso 4: endpoint PCA

En `backend/app/main.py`:

1. Importar `build_morro1_pca`.
2. Agregar el endpoint `analysis_morro1_pca`.
3. Mantener la conversión de `ValueError` a `HTTPException(400)`.

Comprobarlo antes de modificar el frontend:

```bash
curl 'http://127.0.0.1:8000/analysis/morro1/pca?elements=As,B,Li'
```

## Paso 5: cliente API del frontend

Copiar la función `getMorroPca` a `frontend/src/lib/api.js`.

La función espera un objeto:

```javascript
{
  elements: ["As", "B", "Li"],
  sexo: "femenino",
  edad: "adulto"
}
```

## Paso 6: componente nuevo

Copiar el archivo completo:

```text
frontend/src/components/PcaChart.jsx
```

No requiere una biblioteca de gráficos externa. Utiliza React y SVG nativo.

## Paso 7: integración en `App.jsx`

Agregar la importación:

```javascript
import { PcaChart } from "./components/PcaChart";
```

Agregar `getMorroPca` a las importaciones de `lib/api`.

Integrar los cuatro estados y las funciones indicadas en
`MANIFIESTO_ARCHIVOS.md`. Después, colocar el bloque visual del PCA en la vista
de Morro 1, cerca del selector de elementos químicos.

La selección individual existente puede reutilizarse:

```jsx
<PcaChart
  data={pcaData}
  onSelect={handleSelectNode}
  colorBy={pcaColorBy}
/>
```

## Paso 8: estilos

Copiar las clases con prefijo `pca` desde `frontend/src/style.css`.

Al utilizar un prefijo propio, estas reglas tienen bajo riesgo de colisionar con
otros estilos de la aplicación.

## Paso 9: pruebas

Copiar:

```text
backend/tests/test_morro1_filters.py
```

Ejecutar desde `backend`:

```bash
.venv/bin/python -m pytest -q tests/test_morro1_filters.py
```

## Paso 10: compilación y revisión

```bash
cd frontend
npm install
npm run build
```

Revisar manualmente:

1. Seleccionar As, B y Li.
2. Calcular el PCA.
3. Cambiar color de Sexo a Edad.
4. Aplicar filtros de adulto y subadulto.
5. Pulsar un punto y revisar el detalle del individuo.

