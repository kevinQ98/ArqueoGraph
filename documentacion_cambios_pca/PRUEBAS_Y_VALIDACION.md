# Pruebas y validación

## Pruebas automatizadas específicas

Desde `backend`:

```bash
.venv/bin/python -m pytest -q tests/test_morro1_filters.py
```

Resultado obtenido durante el desarrollo:

```text
5 passed
```

## Compilación del frontend

Desde `frontend`:

```bash
npm run build
```

Resultado obtenido:

```text
build correcto
2314 módulos transformados
```

## Casos comprobados

| Elementos | Casos completos | Resultado |
|---|---:|---|
| As + B + Li | 39 | PCA correcto; PC1+PC2 explican aproximadamente 78,5 %. |
| As + B + Li + Mn | 37 | PCA correcto. |
| As + B + Li + Mn + Zn | 3 | PCA calculado con advertencia de muestra pequeña. |

## Filtros comprobados

```text
adulto: 102 casos
subadulto: 70 casos
femenino: 53 casos
masculino: 62 casos
indeterminado: 66 casos normalizados
femenino + subadulto: 10 casos de referencia
```

La cantidad disponible para un PCA puede ser menor porque el PCA exige que el
caso tenga mediciones de todos los elementos seleccionados.

## Lista de revisión manual

- [ ] Los filtros de sexo tienen opciones aunque SQLite esté vacía.
- [ ] `sub adulto` responde también al filtro `subadulto`.
- [ ] No se puede calcular PCA con menos de tres elementos.
- [ ] El gráfico muestra PC1 y PC2.
- [ ] Se muestran los porcentajes de varianza explicada.
- [ ] Los puntos cambian de color al alternar Sexo y Edad.
- [ ] La leyenda cambia junto con el color.
- [ ] Al pulsar un punto se abre el detalle del individuo.
- [ ] Cambiar edad o sexo invalida el PCA anterior.
- [ ] Una muestra menor a diez casos muestra advertencia.

## Precauciones sobre los datos

- `Zn` proviene de un archivo marcado como `fake` y solo tiene tres casos.
- No se deben interpretar juntos cabello y costilla sin distinguir la matriz.
- Existen variantes originales como `costilla/costillas` y
  `sub adulto/subadulto`.
- La normalización cambia la presentación y el filtrado, pero no modifica los
  JSON originales.

