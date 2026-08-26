# Crear paquete compartible de ArqueoGraph

El paquete compartible se genera con:

```bash
python3 scripts/package_app.py
```

Resultado:

```text
releases/ArqueoGraph_lite_FECHA/
releases/ArqueoGraph_lite_FECHA.zip
```

## Modo lite

Comando:

```bash
python3 scripts/package_app.py
```

Incluye:

- backend FastAPI;
- frontend compilado en `frontend/dist`;
- base `backend/data/arqueograph.sqlite`;
- JSON legacy necesarios para vistas especializadas;
- plantillas CSV;
- tutoriales;
- scripts de arranque.

No incluye las carpetas pesadas de imagenes. Es el modo recomendado para enviar
por correo, Drive o pendrive pequeno.

## Modo full

Comando:

```bash
python3 scripts/package_app.py --full
```

Incluye tambien `backend/data/imagenes` completo. Actualmente esa carpeta pesa
cerca de 1.6 GB, por lo que el ZIP resultante sera mucho mas grande.

## Abrir un paquete recibido

En macOS/Linux:

```bash
./start.sh
```

En macOS tambien se puede abrir:

```text
start.command
```

En Windows:

```bat
start.bat
```

La primera ejecucion crea `.runtime-venv` e instala dependencias Python.
Luego abre:

```text
http://127.0.0.1:5174/
```

## Validacion recomendada antes de compartir

```bash
python3 scripts/package_app.py
cd releases/ArqueoGraph_lite_FECHA
python3 start_arqueograph.py
```

Revisar:

- dashboard abre;
- Morro 1 abre;
- Azapa 140 abre;
- `prueba. test` abre;
- filtros dinamicos aparecen;
- API responde en `http://127.0.0.1:8000/docs`.
