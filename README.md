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


# ArqueoGraph Local — versión 0.8.0

Esta versión incorpora un dashboard analítico tipo Power BI, PCA multielemento y filtros normalizados para Morro 1 y Azapa 140.

## Qué cambia

- Nueva vista inicial **Dashboard** con filtros cruzados.
- Tarjetas KPI para química, paleopatologías, imágenes y dataciones.
- Comparación visual de Morro 1 y Azapa 140.
- PCA con selección de tres o más elementos y color por sexo o edad.
- Backend versionado como `0.8.0`.
- Nuevo endpoint agregado: `GET /dashboard/overview`.
- Endpoint PCA: `GET /analysis/morro1/pca`.
- Se mantienen las vistas Morro 1, Azapa y Administración.

## Ejecutar

Backend, desde una terminal:

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload
```

Frontend, desde otra terminal:

```bash
cd frontend
npm install
npm run dev
```

URLs:

- Frontend: `http://localhost:5173`
- Backend / Swagger: `http://127.0.0.1:8000/docs`
- Dashboard API: `http://127.0.0.1:8000/dashboard/overview`

## Flujo recomendado

1. Abrir el frontend; el Dashboard es la pantalla inicial.
2. Usar los segmentadores de sitio, sexo, edad, elemento y paleopatología.
3. Pulsar barras para aplicar filtros cruzados.
4. Abrir Morro 1 para grafos y PCA multielemento.
5. Abrir Azapa para sus grafos, matrices e imágenes.
6. Usar Administración para curaduría e importación.

## Documentación técnica

- Cambios PCA: `documentacion_cambios_pca/README.md`
- Dashboard 0.8: `documentacion_dashboard_0_8/README.md`
