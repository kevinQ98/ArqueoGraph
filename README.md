# 🚀 Guía de uso del repositorio

Esta guía explica cómo configurar el proyecto por primera vez y el flujo de trabajo diario para colaborar en el repositorio.

---

## 1. Instalar Git (si aún no lo tienes)

Descarga e instala Git desde su sitio oficial.

Una vez instalado, abre una terminal (PowerShell, CMD o Git Bash) y verifica que la instalación fue correcta:

```bash
git --version
```

---

## 2. Clonar el repositorio

Ubícate en la carpeta donde quieras guardar el proyecto y ejecuta:

```bash
git clone https://github.com/kevinQ98/ArqueoGraph.git
```

Esto creará una carpeta llamada **ArqueoGraph** con todo el código del proyecto.

Luego ingresa al directorio:

```bash
cd ArqueoGraph
```
---

## 3. Configurar Git (solo la primera vez)

Configura tu nombre y correo asociados a tu cuenta de GitHub.

```bash
git config --global user.name "Tu Nombre"
git config --global user.email "tu_correo@ejemplo.com"
```
---

## 4. Verificar la conexión con el repositorio

Comprueba que el repositorio remoto quedó configurado correctamente:

```bash
git remote -v
```

Deberías obtener una salida similar a esta:

```text
origin  https://github.com/kevinQ98/ArqueoGraph.git (fetch)
origin  https://github.com/kevinQ98/ArqueoGraph.git (push)
```
---
```text
La instalacion y ejecucion del proyecto es como se ha hecho anteriormente
README_FASE7_TUTORIAL.md
```
---

# 💻 Flujo de trabajo diario

Cada vez que vayas a trabajar en el proyecto, sigue este proceso.

## 1. Actualizar tu copia local

Antes de comenzar, descarga los cambios más recientes del repositorio.

```bash
git pull origin main
```

---

## 2. Realizar tus cambios

Modifica los archivos necesarios del proyecto (frontend, backend).

---

## 3. Revisar los archivos modificados

```bash
git status
```

Este comando mostrará todos los archivos que fueron modificados, agregados o eliminados.

---

## 4. Agregar los cambios

```bash
git add .
```
---

## 5. Crear un commit

Guarda tus cambios con un mensaje descriptivo.

```bash
git commit -m "Descripción clara de los cambios realizados"
```
---

## 6. Subir los cambios a GitHub

```bash
git push origin main
```

Una vez finalizado el proceso, los cambios estarán disponibles en GitHub para que el resto del equipo pueda descargarlos.
---

> 💡 **Recomendación:** Antes de comenzar a trabajar, ejecuta siempre `git pull origin main` para evitar conflictos y asegurarte de trabajar sobre la versión más reciente del proyecto.


# ArqueoGraph Local --- INSTALACION ---
# ArqueoGraph Local — Fase 7: versión intuitiva (readme respaldo)

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
