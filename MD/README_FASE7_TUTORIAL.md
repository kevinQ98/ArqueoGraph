Cómo iniciar arqueograph_claude
1. Backend (FastAPI + Python)

cd /Volumes/Transcend/datos_proyecto_unir/app_grapho/arqueograph_claude/backend

# Crear entorno virtual (solo la primera vez)
python3 -m venv .venv

# Activar entorno
source .venv/bin/activate

# Instalar dependencias (solo la primera vez)
pip install -r requirements.txt

# Iniciar servidor
uvicorn app.main:app --reload
Backend disponible en: http://127.0.0.1:8000
Swagger/docs: http://127.0.0.1:8000/docs

2. Frontend (React + Vite) — en otra terminal

cd /Volumes/Transcend/datos_proyecto_unir/app_grapho/arqueograph_claude/frontend

# Instalar dependencias (solo la primera vez)
npm install

# Iniciar servidor de desarrollo
npm run dev
Frontend disponible en: http://localhost:5173

Nota: El script run.sh de la raíz solo funciona para las fases numeradas (fase_1 a fase_7), no para arqueograph_claude. Para esa carpeta hay que arrancarlo manualmente como se indica arriba.
¿Quieres que verifique si hay dependencias ya instaladas o que compruebe el estado de los archivos antes de intentar iniciarlo?









# Tutorial ArqueoGraph — Fase 7 intuitiva

La fase 7 reorganiza la app alrededor de un flujo más humano:

```text
Cargar → Revisar → Asociar imágenes → Explorar → Exportar
```

## 1. Arrancar

```bash
./run.sh 7
```

Abre:

- `http://localhost:5173`
- `http://127.0.0.1:8000/docs`

## 2. Usar Inicio guiado

En el frontend verás la pestaña **Inicio guiado**.

Desde ahí puedes:

- Preparar la demo completa.
- Sincronizar imágenes copiadas a carpetas.
- Revisar conteos de individuos, mediciones e imágenes.
- Ver calidad de datos.
- Abrir curaduría.
- Abrir visualización.
- Descargar respaldo completo JSON.

## 3. Preparar demo completa

Presiona:

```text
Preparar demo completa
```

Esto ejecuta en backend:

```text
POST /app/actions/load-demo
```

La acción:

1. Carga individuos demo.
2. Carga mediciones demo.
3. Sincroniza imágenes existentes en `backend/data/imagenes/`.
4. Devuelve un resumen actualizado.

## 4. Revisar casos

La tabla **Casos cargados** muestra:

- Caso.
- Cuerpo.
- Número de mediciones.
- Número de imágenes.
- Estado de curaduría.
- Campos faltantes.

También puedes consultar desde API:

```text
GET /app/casos
GET /app/casos?q=Caso 1
GET /app/casos?con_imagenes=true
GET /app/casos/caso_1
```

## 5. Subir o copiar imágenes

Opción A: subir desde Swagger:

```text
POST /admin/individuos/{id_individuo}/imagenes
```

Opción B: copiar manualmente:

```text
backend/data/imagenes/caso_1/
backend/data/imagenes/caso_2/
backend/data/imagenes/caso_3/
```

Luego presiona **Sincronizar imágenes** en Inicio guiado, o ejecuta:

```text
POST /admin/imagenes/sync
```

## 6. Curaduría

Presiona:

```text
Ir a Curaduría
```

Ahí puedes:

- Editar individuos.
- Editar mediciones.
- Cambiar estados.
- Revisar auditoría.
- Eliminar registros si corresponde.

## 7. Explorar

Presiona:

```text
Explorar grafo
```

Modos disponibles:

- Categorías.
- Distancia radial.
- Similitud química.
- Clusters.

## 8. Exportar respaldo

Desde Inicio guiado:

```text
Descargar respaldo
```

Endpoint:

```text
GET /admin/export/dataset.json
```

También siguen disponibles:

```text
GET /admin/export/individuos.csv
GET /admin/export/mediciones.csv
GET /admin/export/imagenes.csv
GET /export/graphml
```
