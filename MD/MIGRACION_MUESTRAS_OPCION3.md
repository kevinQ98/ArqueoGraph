# Migracion de muestras y trazabilidad analitica

## Objetivo

Separar de forma explicita el individuo, la muestra fisica, la matriz biologica,
el analisis y cada medicion elemental. La migracion debe conservar todos los
datos existentes y mantener compatibles las rutas actuales mientras el
frontend adopta el modelo normalizado.

## Modelo de datos

1. `matrices`: catalogo canonico de materiales biologicos.
2. `matrices_aliases`: equivalencias de nombres historicos, por ejemplo
   `costillas` -> `costilla`.
3. `muestras`: muestras fisicas asociadas a un individuo y una matriz.
4. `referencias_analiticas`: citas, DOI, URL y procedencia documental.
5. `analisis_quimicos`: evento analitico aplicado a una muestra, con metodo,
   laboratorio, fecha, lote y referencia.
6. `mediciones_quimicas.id_analisis`: vinculo aditivo entre la medicion
   historica y el analisis normalizado.

## Etapas y verificacion

- [x] Crear las tablas e indices sin eliminar ni renombrar columnas actuales.
- [x] Respaldar la base antes de ejecutar la migracion.
- [x] Normalizar matrices y conservar los nombres originales como aliases.
- [x] Crear una muestra estable por individuo y matriz canonica.
- [x] Recuperar referencias desde los JSON originales y desde los CSV.
- [x] Crear analisis separados por muestra y procedencia de datos.
- [x] Vincular todas las mediciones existentes con un `id_analisis`.
- [x] Ejecutar la migracion dos veces y comprobar que no duplica registros.
- [x] Exponer contexto, matrices, referencias y muestras mediante API generica.
- [x] Hacer que tabla, grafo y PCA respeten los mismos filtros analiticos.
- [x] Incorporar la vista `Muestras` y el contexto analitico en el frontend.
- [x] Mostrar matriz, muestra, metodo, laboratorio y referencia en el detalle.
- [x] Verificar Morro 1, Azapa 140 y un sitio dinamico.
- [x] Verificar escritorio, movil, compilacion, lint y pruebas de backend.

## Reglas de integridad

- Una muestra pertenece a un individuo y a una matriz canonica.
- Una medicion pertenece a un unico analisis.
- Un analisis pertenece a una unica muestra.
- Las unidades originales nunca se modifican silenciosamente.
- No se promedian registros de matrices, referencias o unidades diferentes.
- Los datos de prueba deben continuar identificados por su fuente y estado.
- `costilla` y `costillas` se consultan como una matriz canonica, pero se
  conserva el valor original para auditoria.

## Criterios de aceptacion

1. El numero de mediciones anterior y posterior a la migracion es identico.
2. Ninguna medicion queda sin `id_analisis`.
3. Todas las muestras apuntan a individuos y matrices existentes.
4. Todos los analisis apuntan a muestras existentes.
5. La interfaz diferencia individuos, muestras y mediciones.
6. El contexto visible informa matriz, referencia, unidades y cobertura.
7. El PCA declara y aplica la matriz y referencia seleccionadas.
8. Una combinacion incompatible genera una advertencia, no un promedio oculto.

## Reversion

La migracion es aditiva. Para revertir durante el desarrollo se restaura el
respaldo SQLite creado antes de la ejecucion. No se borran las columnas
historicas `tipo_muestra`, `metodo`, `laboratorio`, `fecha` ni `observaciones`.

## API generica resultante

Todas las rutas usan `fuente`, el identificador estable del sitio, por ejemplo
`morro1`, `azapa` o `sitio_demo_csv`.

1. `GET /analysis/site/{fuente}/context`
   Devuelve matrices, referencias, unidades, cobertura y advertencias.
2. `GET /analysis/site/{fuente}/samples`
   Lista las muestras con individuo, matriz, elementos, unidades y referencias.
3. `GET /analysis/site/{fuente}/sample/{id_muestra}`
   Devuelve la muestra, sus analisis y las mediciones agrupadas por procedencia.
4. `GET /analysis/site/{fuente}/pca?elements=As,B,Li`
   Calcula el PCA por muestra y declara matriz, referencias y unidades usadas.
5. `GET /graph/site/{fuente}/reference`
   Devuelve el grafo base con los filtros activos.
6. `GET /graph/site/{fuente}/elemento/{elemento}`
   Devuelve el grafo quimico filtrado por contexto analitico.
7. `GET /graph/site/{fuente}/table`
   Devuelve mediciones con muestra, analisis, matriz y referencia.
8. `GET /admin/analytical-model/audit`
   Comprueba enlaces incompletos, huerfanos y conflictos de unidades.

Los parametros compatibles son `sexo`, `edad`, `matriz`, `referencia`,
`elemento` y `patologia`, segun la ruta. `matriz` usa el codigo canonico y
`referencia` usa `id_referencia`.

## Uso de los filtros

1. `Matriz biologica` selecciona el material fisico canonico. Los aliases
   historicos siguen visibles en la ficha, pero `costilla` y `costillas` se
   consultan como la misma matriz.
2. `Fuente analitica` selecciona el conjunto documental o procedimiento del
   que provienen los valores. Las opciones se limitan a las compatibles con la
   matriz elegida.
3. La banda `Contexto analitico` muestra matriz, fuente, unidades y cobertura
   de los filtros activos.
4. La pestana `Muestras` separa la muestra fisica del individuo y permite abrir
   su procedencia completa.
5. `Reconstruida` indica que la muestra fue inferida desde datos historicos y
   que su codigo fisico debe validarse posteriormente.
6. El PCA no mezcla matrices. Tampoco promedia una misma variable cuando sus
   referencias o unidades son incompatibles; en ese caso devuelve un mensaje
   solicitando una seleccion mas especifica.

## Comandos de verificacion

Desde la raiz del repositorio:

```bash
curl -s http://127.0.0.1:8000/admin/analytical-model/audit | python3 -m json.tool
PYTHONPATH=.:backend backend/.venv/bin/python -m pytest -q backend/tests
cd frontend && npm run build
cd frontend && npx eslint src
```

Resultado validado el 24 de agosto de 2026:

- 801 mediciones antes y despues de migrar.
- 204 muestras, 360 analisis, 6 referencias y 3 matrices canonicas.
- 0 mediciones sin analisis y 0 enlaces huerfanos.
- 43 conflictos historicos muestra-elemento con unidades diferentes,
  conservados y mostrados como advertencia.
- 24 pruebas de backend superadas.
- Compilacion de produccion completada.
- ESLint con 0 errores; quedan 34 advertencias historicas fuera de esta tarea.
- Morro 1, Azapa 140 y Sitio Demo CSV verificados en navegador sin errores de
  consola ni desbordamiento horizontal.
- Escritorio verificado en 1440 x 1000 y movil en 390 x 844.

El respaldo previo a la migracion es
`backend/data/respaldo_20260824_095252_092338.sqlite`.
