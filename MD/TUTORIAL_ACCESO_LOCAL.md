# Tutorial de acceso local a ArqueoGraph 0.8

Esta es la copia nueva descargada desde GitHub:

```bash
/Users/arn/Documents/app_unir/ArqueoGraph-latest
```

Rama descargada:

```text
feature/dashboard-pca-v0.8
```

Commit validado:

```text
7ccf37b
```

Estado comprobado el 28 de julio de 2026:

- Backend `0.8.0` funcionando en `http://127.0.0.1:8000`.
- Frontend funcionando en `http://localhost:5173`.
- Dashboard API funcionando en `http://127.0.0.1:8000/dashboard/overview`.
- PCA funcionando en `http://127.0.0.1:8000/analysis/morro1/pca`.
- Backup funcionando con `POST /admin/backup`.

## 1. Iniciar backend

Abre una terminal:

```bash
cd /Users/arn/Documents/app_unir/ArqueoGraph-latest/backend
source .venv/bin/activate
uvicorn app.main:app --reload --reload-dir app
```

URLs del backend:

```text
http://127.0.0.1:8000
http://127.0.0.1:8000/docs
http://127.0.0.1:8000/health
http://127.0.0.1:8000/dashboard/overview
```

## 2. Iniciar frontend

Abre otra terminal:

```bash
cd /Users/arn/Documents/app_unir/ArqueoGraph-latest/frontend
npm run dev
```

Abre la app:

```text
http://localhost:5173
```

## 3. Si falta instalar dependencias

Backend:

```bash
cd /Users/arn/Documents/app_unir/ArqueoGraph-latest/backend
python3 -m venv .venv
source .venv/bin/activate
python -m ensurepip --upgrade
pip install -r requirements.txt
```

Frontend:

```bash
cd /Users/arn/Documents/app_unir/ArqueoGraph-latest/frontend
npm install
```

## 4. Flujo recomendado

1. Abre `http://localhost:5173`.
2. Revisa el Dashboard inicial.
3. Usa filtros de sitio, sexo, edad, elemento y paleopatología.
4. Entra a Morro 1 para grafos y PCA multielemento.
5. Entra a Azapa 140 para grafos, matrices e imágenes.
6. Usa Administración para importación, curaduría y respaldos.

## 5. Endpoints útiles

```text
GET  /health
GET  /dashboard/overview
GET  /analysis/morro1/pca?elements=As,B,Li
POST /admin/backup
GET  /docs
```

## 6. Notas importantes

- Esta copia reemplaza el uso anterior de `/Users/arn/Documents/app_unir/arqueov10/ArqueoGraph`.
- La carpeta vieja `ArqueoGraph-v0.8` tenía cambios locales sin commit, por eso no fue sobrescrita.
- Si un puerto está ocupado, detén el proceso anterior o usa otro puerto.
