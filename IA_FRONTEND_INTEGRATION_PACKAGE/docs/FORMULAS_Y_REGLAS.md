# Formulas y reglas de negocio

## Regla central: fuente

```text
sitios.id_sitio = individuos.fuente = mediciones_quimicas.fuente = paleopatologias.fuente = dataciones.fuente = imagenes.fuente
```

Ejemplo:

```text
id_sitio: sitio_demo_csv
nombre visible: Sitio Demo CSV
fuente en todos los otros CSV: sitio_demo_csv
```

El frontend debe mostrar `nombre`, pero llamar APIs con `fuente`.

## Orden de importacion CSV

Por claves foraneas:

```text
1. sitios.csv
2. individuos.csv
3. mediciones_quimicas.csv
4. paleopatologias.csv
5. dataciones.csv
6. imagenes.csv
```

## Reglas para IDs

Usar IDs estables y unicos.

```text
sitio_demo_csv_001
sitio_demo_csv_m001
sitio_demo_csv_p001
sitio_demo_csv_d001
sitio_demo_csv_i001
```

No usar espacios en IDs. Usar minusculas, numeros y guion bajo.

## Reglas para filtros

Filtros comunes:

```text
sexo
edad
elemento
patologia
matriz
fuente
```

Los filtros vacios no deben enviarse o deben enviarse como string vacio. El backend ignora valores vacios.

## PCA

Condiciones:

```text
minimo 3 elementos seleccionados
minimo 3 individuos con mediciones completas para esos mismos elementos
```

Si hay mediciones duplicadas para un mismo individuo y elemento, el backend usa el promedio.

### Matriz

Para cada individuo completo:

```text
X[i, j] = promedio de concentracion del individuo i para el elemento j
```

Ejemplo con elementos:

```text
As, B, Li
```

Matriz:

```text
            As      B      Li
caso_001    1.20    72.5   0.82
caso_002    0.95    68.1   0.67
caso_003    1.85    81.2   1.05
```

### Estandarizacion z-score

El backend estandariza por columna:

```text
Z[i, j] = (X[i, j] - mean(X[:, j])) / std(X[:, j])
```

Si un elemento no tiene variacion, el PCA falla porque `std = 0`.

### SVD

El backend calcula:

```text
Z = U * S * Vt
```

Scores:

```text
scores = U * S
```

Loadings:

```text
components = Vt
```

Varianza explicada:

```text
variance[k] = S[k]^2 / (n - 1)
explained[k] = variance[k] / sum(variance)
```

## Grafos

Tipos de nodo:

```text
individuo
elemento
patologia
imagen
```

Grafo de referencia:

```text
sitio -> individuo
```

Grafo por elemento:

```text
individuo -> elemento
```

Grafo por patologia:

```text
patologia -> individuo
```

## Imagenes

`imagenes.relative_path` es relativo a:

```text
backend/data/imagenes
```

El backend devuelve URL publica:

```text
/files/imagenes/{relative_path}
```

El frontend debe mostrar:

```js
`${API_BASE}${image.url}`
```

si la URL viene relativa.
