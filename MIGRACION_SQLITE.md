# Migracion SQLite normalizada

Carpeta de trabajo: `ArqueoGraph-sqlite-migration`

## Objetivo

Usar SQLite como fuente principal para los datos curatoriales y analiticos:

- `sitios`
- `individuos`
- `mediciones_quimicas`
- `paleopatologias`
- `dataciones`
- `imagenes`

## Estado implementado

- El esquema SQLite fue ampliado en `backend/app/database.py`.
- Se agrego el migrador idempotente `backend/app/sqlite_migration.py`.
- El arranque de la API ejecuta `ensure_sqlite_sources()`.
- Existe endpoint manual `POST /admin/migrate/sqlite`.
- `GET /dashboard/overview` ahora lee desde SQLite.
- `GET /filters/options` ahora obtiene opciones desde SQLite, incluyendo `fuente=morro1` y `fuente=azapa`.
- `GET /health` y `GET /admin/resumen` incluyen conteos de tablas nuevas.
- `GET /admin/export/dataset.json` exporta todas las tablas normalizadas.
- `GET /admin/export/{dataset}.csv` soporta `sitios`, `individuos`, `mediciones`, `paleopatologias`, `dataciones` e `imagenes`.
- `POST /admin/backup` copia la base `arqueograph.sqlite` completa.

## Datos migrados actualmente

Resultado de `PYTHONPATH=backend python3 -m app.sqlite_migration`:

- Sitios: 2
- Individuos: 338
- Mediciones quimicas: 779
- Paleopatologias: 514
- Dataciones: 18
- Imagenes: 289

## Validacion realizada

Validaciones directas ejecutadas:

- Compilacion Python: `PYTHONPATH=backend python3 -m compileall backend/app`
- Dashboard completo: 338 individuos y 2 sitios.
- Filtros por sitio/fuente: Morro 1 y Azapa devuelven elementos desde SQLite.
- Filtro cruzado: `sitio=Morro 1`, `sexo=femenino`, `edad=subadulto` devuelve 10 individuos.
- Filtro por elemento `Mn` devuelve resumen quimico.
- Export JSON incluye `sitios`, `paleopatologias` y `dataciones`.
- Backup genera copia completa de SQLite.

`pytest` no se pudo ejecutar porque la copia no incluye `.venv` y el entorno disponible no tiene `pytest` instalado.

## Deuda tecnica detectada

Estas partes aun conservan logica legacy basada en JSON:

- `backend/app/graph_service.py`: grafos especializados, PCA y tablas Morro/Azapa.
- Algunos endpoints de `backend/app/main.py` que llaman funciones especializadas de `graph_service.py`.
- Endpoints de carga JSON legacy para Morro/Azapa, que siguen registrando archivos en `config.py`.
- El helper `_load_cases()` en `dashboard_service.py` se mantiene solo por compatibilidad legacy.

## Proximo paso recomendado

Migrar `graph_service.py` por capas:

1. Crear consultas SQLite equivalentes para referencia, analisis, matriz, sexo y edad.
2. Reemplazar loaders JSON internos por funciones SQL con el mismo formato de salida.
3. Mantener las mismas rutas API para no tocar el frontend.
4. Comparar respuestas JSON antes/despues para Morro 1 y Azapa 140.
5. Recien despues agregar nuevos sitios desde SQLite sin crear nuevas ramas de codigo por sitio.

## Carga CSV de nuevos sitios

Se implemento la opcion 2: cargar un sitio nuevo mediante CSVs normalizados.

Tutorial operativo:

- `NUEVOS_SITIOS.md`

Automatizacion local:

- `backend/scripts/site_package.py`

Comandos base:

```bash
PYTHONPATH=backend python3 backend/scripts/site_package.py create --id caleta_vitor --nombre "Caleta Vitor"
PYTHONPATH=backend python3 backend/scripts/site_package.py validate --id caleta_vitor
PYTHONPATH=backend python3 backend/scripts/site_package.py import --id caleta_vitor
```

Plantillas disponibles:

- `backend/templates/sitios.csv`
- `backend/templates/individuos.csv`
- `backend/templates/mediciones_quimicas.csv`
- `backend/templates/paleopatologias.csv`
- `backend/templates/dataciones.csv`
- `backend/templates/imagenes.csv`

Endpoints de carga:

- `POST /admin/import/sitios/csv`
- `POST /admin/import/individuos/csv`
- `POST /admin/import/mediciones/csv`
- `POST /admin/import/paleopatologias/csv`
- `POST /admin/import/dataciones/csv`
- `POST /admin/import/imagenes/csv`

Orden recomendado:

1. Sitios
2. Individuos
3. Mediciones quimicas
4. Paleopatologias
5. Dataciones
6. Imagenes

Datos demo creados:

- Carpeta: `backend/sample_data/prueba_test/`
- Sitio visible: `prueba. test`
- ID interno/fuente: `prueba_test`
- Generador: `backend/scripts/generate_prueba_test_from_morro.py`

Endpoint demo:

- `POST /admin/import/prueba-test/demo`

Resultado actual de la carga demo:

- 1 sitio
- 181 individuos clonados desde Morro 1
- 169 mediciones quimicas clonadas desde Morro 1
- 514 registros de paleopatologia clonados desde Morro 1
- 0 dataciones, porque Morro 1 no tiene dataciones migradas en SQLite
- 192 imagenes registradas desde referencias de Morro 1

Conteos finales despues de importar `prueba. test` como clon de Morro 1:

- Sitios: 3
- Individuos: 519
- Mediciones quimicas: 948
- Paleopatologias: 1028
- Dataciones: 18
- Imagenes: 481

Nota: las imagenes del sitio `prueba. test` referencian las mismas rutas fisicas que Morro 1 para validar conteos y filtros sin duplicar archivos.
