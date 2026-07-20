# Contrato del endpoint PCA

## Ruta

```http
GET /analysis/morro1/pca
```

## Parámetros

| Parámetro | Obligatorio | Descripción |
|---|---:|---|
| `elements` | Sí | Lista separada por comas; mínimo tres elementos. |
| `sexo` | No | `femenino`, `masculino` o `indeterminado`. |
| `edad` | No | `adulto`, `subadulto` o `indeterminado`. |

Ejemplo:

```http
GET /analysis/morro1/pca?elements=As,B,Li&sexo=femenino&edad=adulto
```

## Respuesta exitosa

```json
{
  "elements": ["As", "B", "Li"],
  "points": [
    {
      "id": "Morro1_001",
      "label": "T1C1",
      "type": "individuo",
      "sexo": "femenino",
      "edad": "adulto",
      "pc1": 1.23,
      "pc2": -0.45,
      "mediciones": {
        "As": {"valor": 0.8},
        "B": {"valor": 72.1},
        "Li": {"valor": 1.9}
      }
    }
  ],
  "loadings": [
    {"elemento": "As", "pc1": 0.5, "pc2": -0.2}
  ],
  "explained_variance": {
    "pc1": 0.46,
    "pc2": 0.32
  },
  "summary": {
    "complete_cases": 39,
    "incomplete_cases": 0,
    "standardization": "z-score",
    "duplicate_measurements": "mean"
  },
  "warnings": []
}
```

## Errores esperados

Menos de tres elementos:

```json
{
  "detail": "Selecciona al menos tres elementos para calcular el PCA"
}
```

Muestra insuficiente:

```json
{
  "detail": "Se necesitan al menos tres casos con mediciones completas para los elementos seleccionados"
}
```

Elemento inexistente:

```json
{
  "detail": "Elemento no disponible: nombre"
}
```

## Decisiones metodológicas

- Se usan únicamente casos completos para los elementos seleccionados.
- Las variables se estandarizan mediante z-score.
- Los duplicados por caso y elemento se agregan mediante promedio.
- PC1 y PC2 se calculan usando SVD.
- Las cargas indican la contribución de cada elemento a los componentes.
- Una muestra menor a diez casos genera una advertencia, no un error.

