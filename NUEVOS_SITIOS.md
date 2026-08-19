# Tutorial: crear nuevos sitios en ArqueoGraph

Este flujo crea un paquete CSV normalizado, lo valida y lo importa a SQLite.
La regla principal es simple: el `id_sitio` debe ser igual al campo `fuente` en
individuos, mediciones, paleopatologias, dataciones e imagenes.

## Herramienta

Script principal:

```bash
PYTHONPATH=backend python3 backend/scripts/site_package.py --help
```

Operaciones disponibles:

- `create`: crea la carpeta CSV del sitio.
- `validate`: fiscaliza columnas, ids duplicados y relaciones internas.
- `import`: carga el paquete CSV a SQLite.
- `status`: muestra conteos actuales del sitio en SQLite.

## Opcion A: crear un sitio vacio para completar a mano

Desde la carpeta `ArqueoGraph-sqlite-migration`:

```bash
PYTHONPATH=backend python3 backend/scripts/site_package.py create \
  --id caleta_vitor \
  --nombre "Caleta Vitor" \
  --area "Arica y Parinacota" \
  --descripcion "Sitio costero de prueba" \
  --lat -18.7500 \
  --lng -70.3200
```

Esto crea:

```text
backend/sample_data/caleta_vitor/
  sitios.csv
  individuos.csv
  mediciones_quimicas.csv
  paleopatologias.csv
  dataciones.csv
  imagenes.csv
```

Despues se completan los CSV con los datos reales.

## Opcion B: crear un sitio clonado para pruebas

Sirve para probar visualizaciones, filtros y graficos sin escribir datos desde
cero. Copia la estructura de un sitio existente y cambia los IDs.

```bash
PYTHONPATH=backend python3 backend/scripts/site_package.py create \
  --id ensayo_morro \
  --nombre "Ensayo Morro" \
  --clone-from morro1 \
  --prefix EM \
  --overwrite
```

Para crear e importar en una sola pasada:

```bash
PYTHONPATH=backend python3 backend/scripts/site_package.py create \
  --id ensayo_morro \
  --nombre "Ensayo Morro" \
  --clone-from morro1 \
  --prefix EM \
  --overwrite \
  --import-now \
  --replace
```

`--replace` borra antes los datos existentes del mismo `id_sitio`.

## Como completar cada CSV

### sitios.csv

Una fila por sitio.

Columnas clave:

- `id_sitio`: ID interno estable. Usar minusculas y guion bajo, ejemplo `caleta_vitor`.
- `nombre`: nombre visible en la app.
- `lat` / `lng`: coordenadas opcionales para el mapa.
- `view`: usar `visualizacion` para abrir la interfaz tipo Morro.
- `estado`: normalmente `validado`.

### individuos.csv

Una fila por individuo/caso.

Columnas clave:

- `id_individuo`: ID unico, ejemplo `caleta_vitor_001`.
- `id_documento`: codigo documental visible.
- `numero_cuerpo`: etiqueta corta para el grafo.
- `sexo`: valores como `femenino`, `masculino`, `indeterminado`.
- `edad`: valores como `adulto`, `subadulto`, `indeterminado`.
- `sitio`: nombre visible del sitio.
- `fuente`: debe ser igual a `id_sitio`.

### mediciones_quimicas.csv

Una fila por medicion quimica.

Columnas clave:

- `id_medicion`: ID unico, ejemplo `caleta_vitor_med_001`.
- `id_individuo`: debe existir en `individuos.csv`.
- `tipo_muestra`: ejemplo `costilla`, `cabello`, `diente`.
- `elemento`: ejemplo `Mn`, `As`, `B`, `Li`, `Zn`.
- `concentracion`: numero; usar punto decimal.
- `unidad`: normalmente `ppm`.
- `fuente`: debe ser igual a `id_sitio`.

Los botones dinamicos de elementos salen desde esta tabla.

### paleopatologias.csv

Una fila por patologia evaluada en un individuo.

Columnas clave:

- `id_paleopatologia`: ID unico.
- `id_individuo`: debe existir en `individuos.csv`.
- `patologia`: nombre normalizado, ejemplo `periostitis`.
- `valor`: texto descriptivo, ejemplo `leve`, `positivo`, `negativo`.
- `presente`: `1` para positivo, `0` para negativo.
- `fuente`: debe ser igual a `id_sitio`.

Los filtros dinamicos de patologia aparecen cuando hay registros con
`presente=1`.

### dataciones.csv

Opcional. Una fila por datacion.

Columnas clave:

- `id_datacion`: ID unico.
- `id_individuo`: debe existir en `individuos.csv`.
- `fecha_bp`: fecha radiocarbonica o descripcion.
- `rango_calibrado_min` / `rango_calibrado_max`: enteros si existen.
- `fuente`: debe ser igual a `id_sitio`.

### imagenes.csv

Opcional. Una fila por imagen.

Columnas clave:

- `id_imagen`: ID unico.
- `id_individuo`: debe existir en `individuos.csv`.
- `filename_original`: nombre del archivo original.
- `filename_saved`: nombre guardado.
- `relative_path`: ruta relativa dentro de `backend/data/imagenes`.
- `content_type`: ejemplo `image/jpeg`.
- `fuente`: debe ser igual a `id_sitio`.

Ejemplo de ruta:

```text
backend/data/imagenes/imagenes_caleta_vitor/caleta_vitor_001.jpg
```

En `imagenes.csv` se escribe solo:

```text
imagenes_caleta_vitor/caleta_vitor_001.jpg
```

## Fiscalizar antes de importar

```bash
PYTHONPATH=backend python3 backend/scripts/site_package.py validate --id caleta_vitor
```

La validacion revisa:

- que existan los seis CSV esperados;
- que esten las columnas obligatorias;
- que no existan IDs duplicados;
- que mediciones, patologias, dataciones e imagenes apunten a individuos existentes;
- que `fuente` coincida con el `id_sitio`;
- que las rutas de imagenes existan, como advertencia.

Si `ok` es `false`, corregir los errores antes de importar.

## Importar a SQLite

```bash
PYTHONPATH=backend python3 backend/scripts/site_package.py import --id caleta_vitor
```

Si ya importaste antes el mismo sitio y quieres reemplazarlo:

```bash
PYTHONPATH=backend python3 backend/scripts/site_package.py import --id caleta_vitor --replace
```

Orden interno de carga:

1. `sitios.csv`
2. `individuos.csv`
3. `mediciones_quimicas.csv`
4. `paleopatologias.csv`
5. `dataciones.csv`
6. `imagenes.csv`

## Revisar conteos

```bash
PYTHONPATH=backend python3 backend/scripts/site_package.py status --id caleta_vitor
```

Tambien se puede revisar desde la API:

```bash
curl "http://127.0.0.1:8001/dashboard/overview" | python3 -m json.tool
```

## Abrir en la app

1. Abrir `http://127.0.0.1:5174/`.
2. Hacer recarga dura si el navegador tenia cache.
3. Verificar que el nuevo sitio aparezca en la barra superior y en el dashboard.
4. Abrir el sitio.
5. Revisar filtros de sexo, edad, elementos, patologias, PCA, tabla e imagenes.

## Checklist minimo antes de dar por listo un sitio

- `sitios.csv` tiene `view=visualizacion`.
- Todos los CSV usan el mismo valor en `fuente`.
- Cada `id_individuo` es unico.
- Cada medicion tiene `concentracion` numerica.
- Cada patologia positiva tiene `presente=1`.
- Las imagenes existen fisicamente bajo `backend/data/imagenes`.
- `validate` devuelve `ok: true`.
- `status` muestra conteos esperados despues de importar.
- El sitio abre desde la app y muestra filtros dinamicos.
