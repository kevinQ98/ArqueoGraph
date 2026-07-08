# ArqueoGraph Local — Fase 7: versión intuitiva

Esta versión conserva el frontend visual que ya funcionaba bien, pero agrega una entrada más clara: **Inicio guiado**.

## Qué cambia

- Nueva pantalla inicial para cargar demo, sincronizar imágenes, revisar calidad y navegar sin depender de Swagger.
- Backend versionado como `0.7.0`.
- Nuevos endpoints de experiencia:
  - `GET /app/overview`
  - `POST /app/actions/load-demo`
  - `GET /app/casos`
  - `GET /app/casos/{id_individuo}`
- Sigue existiendo todo lo anterior: administración, grafos, clusters, imágenes, GraphML, CSV y JSON.
- El backend ahora expone una visión más cercana al trabajo real: casos, calidad, próximos pasos y acciones rápidas.

## Ejecutar

Desde la raíz del proyecto:

```bash
./run.sh 7
```

URLs:

- Frontend: `http://localhost:5173`
- Backend / Swagger: `http://127.0.0.1:8000/docs`
- Estado guiado: `http://127.0.0.1:8000/app/overview`

## Flujo recomendado

1. Abrir el frontend.
2. Entrar a **Inicio guiado**.
3. Presionar **Preparar demo completa**.
4. Revisar las tarjetas de calidad y próximos pasos.
5. Ir a **Curaduría** para revisar advertencias.
6. Ir a **Visualización** o **Clusters** para explorar.
7. Descargar respaldo desde **Inicio guiado**.

## Tutorial

Lee:

```text
README_FASE7_TUTORIAL.md
```
