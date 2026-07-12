from __future__ import annotations

import csv
import json
from pathlib import Path
import shutil
import uuid
import mimetypes
from io import StringIO
from typing import Optional
from fastapi import FastAPI, UploadFile, File, HTTPException, Response, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .database import init_db, reset_db, get_connection, rows_to_dicts, IMAGES_DIR
from .importer import import_individuos_csv, import_mediciones_csv, import_morro1_master_data, import_azapa_master_data
from .schemas import IndividuoUpdate, MedicionQuimicaUpdate, EstadoUpdate
from .graph_service import build_relational_graph, filter_individuos_by_patologia, build_relational_graph_by_patologia, build_relational_graph_all_patologias, build_azapa_reference_graph, build_azapa_element_graph, get_azapa_available_elements, get_azapa_reference_sex_options

BASE_DIR = Path(__file__).resolve().parents[1]
UPLOADS_DIR = BASE_DIR / "data" / "uploads"
SAMPLE_DIR = BASE_DIR / "sample_data"
CATALOGO_MOMIAS_PATH = BASE_DIR / "data" / "catalogo_momias.json"
PALEOPATOLOGIA_PATH = BASE_DIR / "data" / "morro1_paleopatologia.json"
APP_VERSION = "0.7.0"

VALID_ESTADOS = {"borrador", "revisar", "validado", "descartado"}
TEMPLATE_FILES = {
    "individuos.csv": BASE_DIR / "templates" / "individuos.csv",
    "mediciones_quimicas.csv": BASE_DIR / "templates" / "mediciones_quimicas.csv",
}

app = FastAPI(
    title="ArqueoGraph Local API",
    description="API local para administrar datos bioarqueológicos, mediciones químicas e imágenes.",
    version=APP_VERSION,
)

# Permitir que el frontend acceda a la API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/files/imagenes", StaticFiles(directory=IMAGES_DIR), name="imagenes")


@app.on_event("startup")
def startup_event():
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    init_db()


@app.get("/")
def root():
    return {
        "app": "ArqueoGraph Local API",
        "version": APP_VERSION,
        "docs": "/docs",
        "health": "/health",
        "dashboard": "/app/overview",
        "tutorial": "README_FASE7_TUTORIAL.md",
    }


def _quality_score(total_issues: int, total_records: int) -> int:
    if total_records <= 0:
        return 0
    penalty = min(100, round((total_issues / max(total_records, 1)) * 18))
    return max(0, 100 - penalty)


def _next_steps(counts: dict, total_issues: int, images_on_disk: int, registered_images: int) -> list[dict]:
    steps = []
    if counts["individuos"] == 0:
        steps.append({
            "id": "cargar_individuos",
            "title": "Carga individuos",
            "description": "Empieza con la demo o sube tu CSV de individuos.",
            "action": "POST /app/actions/load-demo o POST /admin/import/individuos/csv",
            "status": "pending",
        })
    if counts["mediciones"] == 0:
        steps.append({
            "id": "cargar_mediciones",
            "title": "Carga mediciones químicas",
            "description": "Las mediciones necesitan que los individuos existan antes.",
            "action": "POST /app/actions/load-demo o POST /admin/import/mediciones/csv",
            "status": "pending",
        })
    if images_on_disk > registered_images:
        steps.append({
            "id": "sincronizar_imagenes",
            "title": "Sincroniza imágenes copiadas por carpeta",
            "description": "Hay archivos en disco que todavía no están registrados en SQLite.",
            "action": "POST /admin/imagenes/sync",
            "status": "pending",
        })
    if counts["individuos"] > 0 and total_issues > 0:
        steps.append({
            "id": "curar_datos",
            "title": "Revisa advertencias de curaduría",
            "description": "Corrige campos vacíos y cambia estados a revisar/validado.",
            "action": "Abrir pestaña Curaduría",
            "status": "pending",
        })
    if counts["individuos"] > 0 and counts["mediciones"] > 0 and not steps:
        steps.append({
            "id": "explorar",
            "title": "Explora el grafo y exporta respaldo",
            "description": "Los datos están listos para visualización, clusters y exportación.",
            "action": "Abrir Visualización o GET /admin/export/dataset.json",
            "status": "ready",
        })
    return steps


def _normalize_case_key(value: Optional[str]) -> str:
    if not value:
        return ""
    raw = str(value).strip().lower()
    if raw.startswith("caso"):
        tail = raw[4:].strip().replace(" ", "").replace("_", "")
        return f"caso_{tail}"
    return raw.replace(" ", "_")


def _load_catalogo_momias() -> list[dict]:
    if not CATALOGO_MOMIAS_PATH.exists():
        return []
    try:
        with CATALOGO_MOMIAS_PATH.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
            if isinstance(data, list):
                return data
    except Exception:
        return []
    return []


def _load_paleopatologias() -> list[dict]:
    """Carga casos de patología del archivo JSON."""
    if not PALEOPATOLOGIA_PATH.exists():
        return []
    try:
        with PALEOPATOLOGIA_PATH.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
            # Extraer los casos del objeto morro1_paleopatologia
            if isinstance(data, dict) and "morro1_paleopatologia" in data:
                casos = data["morro1_paleopatologia"].get("casos", [])
                if isinstance(casos, list):
                    return casos
    except Exception:
        return []
    return []


def _extract_patologias() -> list[str]:
    """Extrae nombres de patologías con valores no-null del archivo JSON."""
    casos = _load_paleopatologias()
    patologias_set = set()
    
    for caso in casos:
        if not isinstance(caso, dict):
            continue
        paleo = caso.get("paleopatologia", {})
        if not isinstance(paleo, dict):
            continue
        
        for patologia_name, patologia_value in paleo.items():
            # Solo agregar patologías que tienen al menos un valor no-null
            if patologia_value is not None:
                patologias_set.add(patologia_name)
    
    return sorted(list(patologias_set))


def _catalogo_momias_images_for_case(case_value: str, id_individuo: Optional[str] = None) -> list[dict]:
    normalized_target = _normalize_case_key(case_value)
    if id_individuo is None:
        with get_connection() as conn:
            row = conn.execute(
                "SELECT id_individuo FROM individuos WHERE id_documento = ?",
                (case_value,),
            ).fetchone()
            if row:
                id_individuo = row["id_individuo"]

    images = []
    for record in _load_catalogo_momias():
        if _normalize_case_key(record.get("id_documento")) != normalized_target:
            continue
        for rel_path in record.get("imagenes_rutas_locales", []):
            rel = str(rel_path).lstrip("./").lstrip("/")
            full = IMAGES_DIR / rel
            if not full.exists() or not full.is_file():
                continue
            image_id = _normalize_case_key(f"{id_individuo or case_value}_{full.name}")
            rel_path_fixed = rel.replace('\\', '/')
            images.append({
                "id_imagen": image_id,
                "id_individuo": id_individuo or case_value,
                "filename_original": full.name,
                "filename_saved": full.name,
                "relative_path": rel_path_fixed,
                "url": f"/files/imagenes/{rel_path_fixed}",
                "content_type": mimetypes.guess_type(full.name)[0] or "image/jpeg",
                "mime_type": mimetypes.guess_type(full.name)[0] or "image/jpeg",
                "label": full.name,
                "titulo": full.name,
                "descripcion": f"Imagen vinculada desde catalogo_momias.json para {case_value}",
                "tipo_imagen": "catalogo",
                "fecha_imagen": None,
                "estado": "validado",
            })
    return images


def _catalogo_momias_images_for_individuo(id_individuo: str) -> list[dict]:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id_documento FROM individuos WHERE id_individuo = ?",
            (id_individuo,),
        ).fetchone()
        if not row:
            return []
        id_documento = row["id_documento"]
    return _catalogo_momias_images_for_case(id_documento, id_individuo=id_individuo)


def _safe_upload_filename(filename: Optional[str], expected_extension: str = ".csv") -> str:
    name = Path(filename or "").name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="El archivo debe tener nombre")
    if name.startswith(".") or name.startswith("._"):
        raise HTTPException(status_code=400, detail="Nombre de archivo no permitido")
    if Path(name).suffix.lower() != expected_extension:
        raise HTTPException(status_code=400, detail=f"El archivo debe ser {expected_extension}")
    safe_stem = "".join(ch if ch.isalnum() or ch in {"-", "_"} else "_" for ch in Path(name).stem)
    return f"{safe_stem}_{uuid.uuid4().hex[:8]}{expected_extension}"


def _write_csv_response(filename: str, rows: list[dict]) -> Response:
    output = StringIO()
    if rows:
        fieldnames = list(rows[0].keys())
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    return Response(
        content=output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _table_counts(conn) -> dict:
    return {
        "individuos": conn.execute("SELECT COUNT(*) AS n FROM individuos").fetchone()["n"],
        "mediciones": conn.execute("SELECT COUNT(*) AS n FROM mediciones_quimicas").fetchone()["n"],
        "imagenes": conn.execute("SELECT COUNT(*) AS n FROM imagenes").fetchone()["n"],
    }


@app.get("/health")
def health_check():
    with get_connection() as conn:
        counts = _table_counts(conn)
    return {
        "ok": True,
        "app": "ArqueoGraph Local API",
        "version": APP_VERSION,
        "database": str(BASE_DIR / "data" / "arqueograph.sqlite"),
        "uploads_dir": str(UPLOADS_DIR),
        "images_dir": str(IMAGES_DIR),
        "allowed_image_extensions": sorted(ALLOWED_IMAGE_EXTENSIONS),
        "counts": counts,
    }


@app.get("/admin/resumen")
def admin_resumen():
    with get_connection() as conn:
        counts = _table_counts(conn)
        individuos_estado = rows_to_dicts(conn.execute(
            "SELECT estado, COUNT(*) AS n FROM individuos GROUP BY estado ORDER BY estado"
        ).fetchall())
        mediciones_estado = rows_to_dicts(conn.execute(
            "SELECT estado, COUNT(*) AS n FROM mediciones_quimicas GROUP BY estado ORDER BY estado"
        ).fetchall())
        mediciones_elemento = rows_to_dicts(conn.execute(
            "SELECT elemento, COUNT(*) AS n, AVG(concentracion) AS promedio FROM mediciones_quimicas GROUP BY elemento ORDER BY elemento"
        ).fetchall())
        imagenes_individuo = rows_to_dicts(conn.execute(
            """
            SELECT i.id_individuo, i.id_documento, COUNT(img.id_imagen) AS imagenes
            FROM individuos i
            LEFT JOIN imagenes img ON img.id_individuo = i.id_individuo
            GROUP BY i.id_individuo, i.id_documento
            HAVING imagenes > 0
            ORDER BY imagenes DESC, i.id_documento
            """
        ).fetchall())

    return {
        "version": APP_VERSION,
        "counts": counts,
        "individuos_por_estado": individuos_estado,
        "mediciones_por_estado": mediciones_estado,
        "mediciones_por_elemento": mediciones_elemento,
        "imagenes_por_individuo": imagenes_individuo,
    }


@app.get("/app/overview")
def app_overview():
    audit = auditoria_datos()
    storage = _scan_image_storage()
    with get_connection() as conn:
        counts = _table_counts(conn)
        elementos = rows_to_dicts(conn.execute(
            """
            SELECT elemento, COUNT(*) AS mediciones, ROUND(AVG(concentracion), 3) AS promedio
            FROM mediciones_quimicas
            GROUP BY elemento
            ORDER BY elemento
            """
        ).fetchall())
        ultimos_casos = rows_to_dicts(conn.execute(
            """
            SELECT
                i.id_individuo,
                i.id_documento,
                i.numero_cuerpo,
                i.estado,
                COUNT(DISTINCT m.id_medicion) AS mediciones,
                COUNT(DISTINCT img.id_imagen) AS imagenes
            FROM individuos i
            LEFT JOIN mediciones_quimicas m ON m.id_individuo = i.id_individuo
            LEFT JOIN imagenes img ON img.id_individuo = i.id_individuo
            GROUP BY i.id_individuo
            ORDER BY i.updated_at DESC, i.id_documento
            LIMIT 6
            """
        ).fetchall())

    total_records = counts["individuos"] + counts["mediciones"] + counts["imagenes"]
    registered_images = counts["imagenes"]
    return {
        "version": APP_VERSION,
        "counts": counts,
        "quality": {
            "score": _quality_score(audit["total_issues"], total_records),
            "issues": audit["total_issues"],
            "records": total_records,
        },
        "storage": {
            "images_dir": storage["images_dir"],
            "files_total": storage["files_total"],
            "registered_images": registered_images,
            "orphan_folders": storage["orphan_folders"],
            "ignored_files": storage["ignored_files"],
        },
        "elementos": elementos,
        "ultimos_casos": ultimos_casos,
        "next_steps": _next_steps(
            counts,
            audit["total_issues"],
            storage["files_total"],
            registered_images,
        ),
        "quick_links": {
            "swagger": "/docs",
            "templates": "/admin/templates",
            "dataset_json": "/admin/export/dataset.json",
            "storage": "/admin/storage",
        },
    }


@app.post("/app/actions/load-demo")
def app_load_demo(sync_images: bool = True):
    individuos = import_individuos_demo()
    mediciones = import_mediciones_demo()
    synced = sync_imagenes_desde_disco() if sync_images else None
    return {
        "ok": True,
        "message": "Demo cargada y lista para explorar",
        "individuos": individuos,
        "mediciones": mediciones,
        "imagenes_sync": synced,
        "overview": app_overview(),
    }


@app.get("/app/casos")
def app_casos(q: Optional[str] = None, estado: Optional[str] = None, con_imagenes: Optional[bool] = None):
    sql = """
        SELECT
            i.*,
            COUNT(DISTINCT m.id_medicion) AS mediciones_count,
            COUNT(DISTINCT img.id_imagen) AS imagenes_count,
            GROUP_CONCAT(DISTINCT m.elemento) AS elementos
        FROM individuos i
        LEFT JOIN mediciones_quimicas m ON m.id_individuo = i.id_individuo
        LEFT JOIN imagenes img ON img.id_individuo = i.id_individuo
        WHERE 1=1
    """
    params: list = []
    if estado:
        sql += " AND i.estado = ?"
        params.append(estado)
    if q:
        sql += """
            AND (
                i.id_individuo LIKE ?
                OR i.id_documento LIKE ?
                OR i.numero_cuerpo LIKE ?
                OR i.referencia_bibliografica LIKE ?
            )
        """
        like = f"%{q}%"
        params.extend([like, like, like, like])
    sql += " GROUP BY i.id_individuo"
    if con_imagenes is True:
        sql += " HAVING imagenes_count > 0"
    elif con_imagenes is False:
        sql += " HAVING imagenes_count = 0"
    sql += " ORDER BY i.id_documento"

    with get_connection() as conn:
        rows = rows_to_dicts(conn.execute(sql, params).fetchall())

    for row in rows:
        missing = [
            label
            for key, label in [
                ("sexo", "sexo"),
                ("edad", "edad"),
                ("sitio", "sitio"),
                ("referencia_bibliografica", "referencia"),
            ]
            if not row.get(key)
        ]
        row["elementos"] = sorted((row.get("elementos") or "").split(",")) if row.get("elementos") else []
        row["faltantes"] = missing
        row["estado_curaduria"] = "listo" if not missing and row["mediciones_count"] > 0 else "revisar"
    return rows


@app.get("/app/casos/{id_individuo}")
def app_caso_detalle(id_individuo: str):
    individuo = get_individuo(id_individuo)
    with get_connection() as conn:
        mediciones = rows_to_dicts(conn.execute(
            """
            SELECT *
            FROM mediciones_quimicas
            WHERE id_individuo = ?
            ORDER BY elemento, id_medicion
            """,
            (id_individuo,),
        ).fetchall())
    imagenes = list_imagenes_individuo(id_individuo)
    return {
        "individuo": individuo,
        "mediciones": mediciones,
        "imagenes": imagenes,
        "resumen": {
            "mediciones": len(mediciones),
            "imagenes": len(imagenes),
            "elementos": sorted({m["elemento"] for m in mediciones}),
        },
    }


@app.get("/admin/templates")
def list_templates():
    return {
        "templates": [
            {
                "name": name,
                "download_url": f"/admin/templates/{name}",
                "exists": path.exists(),
            }
            for name, path in TEMPLATE_FILES.items()
        ]
    }


@app.get("/admin/templates/{template_name}")
def download_template(template_name: str):
    if template_name not in TEMPLATE_FILES:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada")
    path = TEMPLATE_FILES[template_name]
    if not path.exists():
        raise HTTPException(status_code=404, detail="Archivo de plantilla no existe en disco")
    return FileResponse(path, media_type="text/csv", filename=template_name)


@app.get("/admin/export/dataset.json")
def export_dataset_json():
    with get_connection() as conn:
        payload = {
            "version": APP_VERSION,
            "individuos": rows_to_dicts(conn.execute("SELECT * FROM individuos ORDER BY id_documento").fetchall()),
            "mediciones": rows_to_dicts(conn.execute("SELECT * FROM mediciones_quimicas ORDER BY elemento, id_medicion").fetchall()),
            "imagenes": rows_to_dicts(conn.execute("SELECT * FROM imagenes ORDER BY created_at DESC").fetchall()),
        }
    return Response(
        content=json.dumps(payload, ensure_ascii=False, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="arqueograph_dataset.json"'},
    )


@app.get("/admin/export/{dataset}.csv")
def export_dataset_csv(dataset: str):
    queries = {
        "individuos": "SELECT * FROM individuos ORDER BY id_documento",
        "mediciones": "SELECT * FROM mediciones_quimicas ORDER BY elemento, id_medicion",
        "imagenes": "SELECT * FROM imagenes ORDER BY created_at DESC",
    }
    if dataset not in queries:
        raise HTTPException(status_code=404, detail="Dataset no soportado. Usa individuos, mediciones o imagenes")
    with get_connection() as conn:
        rows = rows_to_dicts(conn.execute(queries[dataset]).fetchall())
    return _write_csv_response(f"arqueograph_{dataset}.csv", rows)


@app.post("/admin/reset-db")
def reset_database(delete_images: bool = False):
    reset_db()
    if delete_images and IMAGES_DIR.exists():
        shutil.rmtree(IMAGES_DIR)
        IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    return {
        "ok": True,
        "message": "Base de datos reiniciada",
        "delete_images": delete_images,
    }


@app.post("/admin/import/individuos/demo")
def import_individuos_demo():
    path = SAMPLE_DIR / "individuos_demo.csv"
    if not path.exists():
        raise HTTPException(status_code=404, detail="No existe sample_data/individuos_demo.csv")
    return import_individuos_csv(path)


@app.post("/admin/import/mediciones/demo")
def import_mediciones_demo():
    path = SAMPLE_DIR / "mediciones_quimicas_demo.csv"
    if not path.exists():
        raise HTTPException(status_code=404, detail="No existe sample_data/mediciones_quimicas_demo.csv")
    return import_mediciones_csv(path)


@app.post("/admin/import/individuos/csv")
def import_individuos_file(file: UploadFile = File(...)):
    dest = UPLOADS_DIR / _safe_upload_filename(file.filename)
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)

    result = import_individuos_csv(dest)
    result["uploaded_file"] = dest.name
    return result


@app.post("/admin/import/mediciones/csv")
def import_mediciones_file(file: UploadFile = File(...)):
    dest = UPLOADS_DIR / _safe_upload_filename(file.filename)
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)

    result = import_mediciones_csv(dest)
    result["uploaded_file"] = dest.name
    return result


@app.post("/admin/import/morro1")
def import_morro1_master():
    reference_path = BASE_DIR / "data" / "morro1_referencia.json"
    paleopatologia_path = BASE_DIR / "data" / "morro1_paleopatologia.json"
    analisis_path = BASE_DIR / "data" / "morro1_analisis_quimicos_Mn_costilla.json"
    catalog_path = UPLOADS_DIR / "catalogo_momias_version_explicada.csv"
    mediciones_path = UPLOADS_DIR / "mediciones_quimicas_demo.csv"
    result = import_morro1_master_data(
        reference_path,
        paleopatologia_path=paleopatologia_path,
        catalog_path=catalog_path,
        analisis_path=analisis_path,
        mediciones_path=mediciones_path,
    )
    return {
        **result,
        "reference_file": str(reference_path),
        "paleopatologia_file": str(paleopatologia_path),
        "catalog_file": str(catalog_path),
        "mediciones_file": str(mediciones_path),
    }


@app.post("/admin/import/azapa")
def import_azapa_master():
    reference_path = BASE_DIR / "data" / "azapa140_referencia.json"
    dataciones_path = BASE_DIR / "data" / "azapa140_dataciones_radiocarbono_Cassman_1997.json"
    analisis_as_cabello_path = BASE_DIR / "data" / "azapa140_analisis_quimicos_As_cabello.json"
    analisis_as_b_li_costilla_path = BASE_DIR / "data" / "azapa140_analisis_quimicos_As_B_Li_costilla.json"
    analisis_li_s_b_pb_as_cabello_ref_dulasiri_path = BASE_DIR / "data" / "azapa140_analisis_quimicos_Li_S_B_Pb_As_cabello_ref_dulasiri.json"
    analisis_mn_costilla_path = BASE_DIR / "data" / "azapa140_analisis_quimicos_Mn_costilla.json"
    result = import_azapa_master_data(
        reference_path,
        dataciones_path=dataciones_path,
        analisis_as_cabello_path=analisis_as_cabello_path,
        analisis_as_b_li_costilla_path=analisis_as_b_li_costilla_path,
        analisis_li_s_b_pb_as_cabello_ref_dulasiri_path=analisis_li_s_b_pb_as_cabello_ref_dulasiri_path,
        analisis_mn_costilla_path=analisis_mn_costilla_path,
    )
    return {
        **result,
        "reference_file": str(reference_path),
        "dataciones_file": str(dataciones_path),
        "analisis_as_cabello_file": str(analisis_as_cabello_path),
        "analisis_as_b_li_costilla_file": str(analisis_as_b_li_costilla_path),
        "analisis_li_s_b_pb_as_cabello_ref_dulasiri_file": str(analisis_li_s_b_pb_as_cabello_ref_dulasiri_path),
        "analisis_mn_costilla_file": str(analisis_mn_costilla_path),
    }


@app.get("/individuos")
def list_individuos(
    sexo: Optional[str] = None,
    sitio: Optional[str] = None,
    estilo: Optional[str] = None,
    estado: Optional[str] = None,
    q: Optional[str] = None,
):
    sql = "SELECT * FROM individuos WHERE 1=1"
    params: list[str] = []

    if sexo:
        sql += " AND sexo = ?"
        params.append(sexo)
    if sitio:
        sql += " AND sitio = ?"
        params.append(sitio)
    if estilo:
        sql += " AND estilo_momificacion = ?"
        params.append(estilo)
    if estado:
        sql += " AND estado = ?"
        params.append(estado)
    if q:
        sql += " AND (id_documento LIKE ? OR numero_cuerpo LIKE ? OR edad LIKE ? OR referencia_bibliografica LIKE ?)"
        like = f"%{q}%"
        params.extend([like, like, like, like])

    sql += " ORDER BY id_documento"

    with get_connection() as conn:
        rows = conn.execute(sql, params).fetchall()
    return rows_to_dicts(rows)


@app.get("/individuos/{id_individuo}")
def get_individuo(id_individuo: str):
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM individuos WHERE id_individuo = ?", (id_individuo,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Individuo no encontrado")
    return dict(row)


@app.patch("/admin/individuos/{id_individuo}")
def update_individuo(id_individuo: str, payload: IndividuoUpdate):
    data = payload.model_dump(exclude_unset=True)
    if not data:
        return get_individuo(id_individuo)

    if "estado" in data and data["estado"] not in VALID_ESTADOS:
        raise HTTPException(status_code=400, detail="Estado inválido")

    fields = []
    params = []
    for key, value in data.items():
        fields.append(f"{key} = ?")
        params.append(value)

    fields.append("updated_at = CURRENT_TIMESTAMP")
    params.append(id_individuo)

    with get_connection() as conn:
        existing = conn.execute("SELECT 1 FROM individuos WHERE id_individuo = ?", (id_individuo,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Individuo no encontrado")
        conn.execute(f"UPDATE individuos SET {', '.join(fields)} WHERE id_individuo = ?", params)

    return get_individuo(id_individuo)


@app.patch("/admin/individuos/{id_individuo}/estado")
def update_individuo_estado(id_individuo: str, payload: EstadoUpdate):
    return update_individuo(id_individuo, IndividuoUpdate(estado=payload.estado))


@app.delete("/admin/individuos/{id_individuo}")
def delete_individuo(id_individuo: str):
    with get_connection() as conn:
        existing = conn.execute("SELECT 1 FROM individuos WHERE id_individuo = ?", (id_individuo,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Individuo no encontrado")
        conn.execute("DELETE FROM individuos WHERE id_individuo = ?", (id_individuo,))
    return {"ok": True, "deleted": id_individuo}


@app.get("/mediciones")
def list_mediciones(
    elemento: Optional[str] = None,
    sexo: Optional[str] = None,
    edad: Optional[str] = None,
    q: Optional[str] = None,
    patologia: Optional[str] = None,
    fuente: Optional[str] = None,
):
    sql = '''
        SELECT
            m.*,
            i.id_documento,
            i.numero_cuerpo,
            i.sexo,
            i.edad,
            i.sitio,
            i.cementerio,
            i.estilo_momificacion,
            i.referencia_bibliografica
        FROM mediciones_quimicas m
        JOIN individuos i ON i.id_individuo = m.id_individuo
        WHERE 1=1
    '''
    params: list[str] = []

    if elemento:
        sql += " AND m.elemento = ?"
        params.append(elemento)
    if fuente:
        sql += " AND COALESCE(m.fuente, i.fuente, 'morro1') = ?"
        params.append(str(fuente).strip().lower())
    if sexo:
        sql += " AND i.sexo = ?"
        params.append(sexo)
    if edad:
        sql += " AND i.edad = ?"
        params.append(edad)
    if q:
        sql += " AND (i.id_documento LIKE ? OR i.numero_cuerpo LIKE ? OR m.elemento LIKE ? OR m.tipo_muestra LIKE ?)"
        like = f"%{q}%"
        params.extend([like, like, like, like])

    sql += " ORDER BY m.elemento, m.concentracion DESC"

    with get_connection() as conn:
        rows = conn.execute(sql, params).fetchall()

    rows = rows_to_dicts(rows)
    if patologia:
        matching_individuos = filter_individuos_by_patologia(rows, patologia)
        allowed_ids = {item["id_individuo"] for item in matching_individuos}
        rows = [row for row in rows if row.get("id_individuo") in allowed_ids]

    return rows


@app.get("/mediciones/{id_medicion}")
def get_medicion(id_medicion: str):
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM mediciones_quimicas WHERE id_medicion = ?", (id_medicion,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Medición no encontrada")
    return dict(row)


@app.patch("/admin/mediciones/{id_medicion}")
def update_medicion(id_medicion: str, payload: MedicionQuimicaUpdate):
    data = payload.model_dump(exclude_unset=True)
    if not data:
        return get_medicion(id_medicion)

    if "estado" in data and data["estado"] not in VALID_ESTADOS:
        raise HTTPException(status_code=400, detail="Estado inválido")
    if "concentracion" in data and data["concentracion"] is not None and data["concentracion"] < 0:
        raise HTTPException(status_code=400, detail="La concentración no puede ser negativa")

    with get_connection() as conn:
        existing = conn.execute("SELECT 1 FROM mediciones_quimicas WHERE id_medicion = ?", (id_medicion,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Medición no encontrada")

        if "id_individuo" in data and data["id_individuo"]:
            individual = conn.execute("SELECT 1 FROM individuos WHERE id_individuo = ?", (data["id_individuo"],)).fetchone()
            if not individual:
                raise HTTPException(status_code=400, detail="El id_individuo no existe")

        fields = []
        params = []
        for key, value in data.items():
            fields.append(f"{key} = ?")
            params.append(value)

        fields.append("updated_at = CURRENT_TIMESTAMP")
        params.append(id_medicion)

        conn.execute(f"UPDATE mediciones_quimicas SET {', '.join(fields)} WHERE id_medicion = ?", params)

    return get_medicion(id_medicion)


@app.patch("/admin/mediciones/{id_medicion}/estado")
def update_medicion_estado(id_medicion: str, payload: EstadoUpdate):
    return update_medicion(id_medicion, MedicionQuimicaUpdate(estado=payload.estado))


@app.delete("/admin/mediciones/{id_medicion}")
def delete_medicion(id_medicion: str):
    with get_connection() as conn:
        existing = conn.execute("SELECT 1 FROM mediciones_quimicas WHERE id_medicion = ?", (id_medicion,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Medición no encontrada")
        conn.execute("DELETE FROM mediciones_quimicas WHERE id_medicion = ?", (id_medicion,))
    return {"ok": True, "deleted": id_medicion}


@app.get("/admin/auditoria")
def auditoria_datos():
    issues = []

    with get_connection() as conn:
        individuos = rows_to_dicts(conn.execute("SELECT * FROM individuos").fetchall())
        mediciones = rows_to_dicts(conn.execute("SELECT * FROM mediciones_quimicas").fetchall())

    for i in individuos:
        if not i.get("sexo"):
            issues.append({"tipo": "individuo", "id": i["id_individuo"], "severidad": "media", "mensaje": "Individuo sin sexo"})
        if not i.get("edad"):
            issues.append({"tipo": "individuo", "id": i["id_individuo"], "severidad": "media", "mensaje": "Individuo sin edad"})
        if not i.get("referencia_bibliografica"):
            issues.append({"tipo": "individuo", "id": i["id_individuo"], "severidad": "baja", "mensaje": "Individuo sin referencia bibliográfica"})
        if i.get("estado") == "borrador":
            issues.append({"tipo": "individuo", "id": i["id_individuo"], "severidad": "baja", "mensaje": "Individuo en estado borrador"})

    for m in mediciones:
        if m.get("concentracion") is None:
            issues.append({"tipo": "medicion", "id": m["id_medicion"], "severidad": "alta", "mensaje": "Medición sin concentración"})
        elif m["concentracion"] < 0:
            issues.append({"tipo": "medicion", "id": m["id_medicion"], "severidad": "alta", "mensaje": "Concentración negativa"})
        if not m.get("unidad"):
            issues.append({"tipo": "medicion", "id": m["id_medicion"], "severidad": "media", "mensaje": "Medición sin unidad"})
    return {
        "total_issues": len(issues),
        "issues": issues,
    }


@app.get("/resumen/quimica")
def resumen_quimica():
    sql = '''
        SELECT
            elemento,
            COUNT(*) AS n,
            AVG(concentracion) AS promedio,
            MIN(concentracion) AS minimo,
            MAX(concentracion) AS maximo
        FROM mediciones_quimicas
        GROUP BY elemento
        ORDER BY elemento
    '''
    with get_connection() as conn:
        rows = conn.execute(sql).fetchall()
    return rows_to_dicts(rows)


@app.get("/graph/elemento/{elemento}")
def graph_by_elemento(elemento: str, edad: Optional[str] = None, caso: Optional[str] = None, sexo: Optional[str] = None, patologia: Optional[str] = None, fuente: Optional[str] = None):
        with get_connection() as conn:
            extra_images = []
            if caso:
                extra_images = _catalogo_momias_images_for_case(caso)
            return build_relational_graph(conn, elemento=elemento, edad=edad, caso=caso, extra_imagenes=extra_images, sexo=sexo, patologia=patologia, fuente=fuente)


@app.get("/graph/patologia/{patologia}")
def graph_by_patologia(patologia: str, edad: Optional[str] = None, sexo: Optional[str] = None, fuente: Optional[str] = None):
        with get_connection() as conn:
            return build_relational_graph_by_patologia(conn, patologia=patologia, edad=edad, sexo=sexo, fuente=fuente)


@app.get("/graph/patologias")
def graph_all_patologias(edad: Optional[str] = None, sexo: Optional[str] = None, fuente: Optional[str] = None):
        with get_connection() as conn:
            return build_relational_graph_all_patologias(conn, edad=edad, sexo=sexo, fuente=fuente)


@app.get("/graph/relational")
def graph_relational(
    elemento: Optional[str] = None,
    edad: Optional[str] = None,
    caso: Optional[str] = None,
    sexo: Optional[str] = None,
    patologia: Optional[str] = None,
    fuente: Optional[str] = None,
):
    with get_connection() as conn:
        extra_images = []
        if caso:
            extra_images = _catalogo_momias_images_for_case(caso)
        return build_relational_graph(conn, elemento=elemento, edad=edad, caso=caso, extra_imagenes=extra_images, sexo=sexo, patologia=patologia, fuente=fuente)


@app.get("/graph/azapa/reference")
def graph_azapa_reference(sexo: Optional[str] = None):
    reference_path = BASE_DIR / "data" / "azapa140_referencia.json"
    return build_azapa_reference_graph(reference_path=reference_path, sexo=sexo)


@app.get("/graph/azapa/elemento/{elemento}")
def graph_azapa_elemento(elemento: str, sexo: Optional[str] = None):
    reference_path = BASE_DIR / "data" / "azapa140_referencia.json"
    analysis_paths = [
        BASE_DIR / "data" / "azapa140_analisis_quimicos_As_cabello.json",
        BASE_DIR / "data" / "azapa140_analisis_quimicos_As_B_Li_costilla.json",
        BASE_DIR / "data" / "azapa140_analisis_quimicos_Li_S_B_Pb_As_cabello_ref_dulasiri.json",
        BASE_DIR / "data" / "azapa140_analisis_quimicos_Mn_costilla.json",
    ]
    return build_azapa_element_graph(
        elemento=elemento,
        reference_path=reference_path,
        analysis_paths=analysis_paths,
        sexo=sexo,
    )


@app.get("/graph/azapa/elements")
def graph_azapa_elements(sexo: Optional[str] = None):
    reference_path = BASE_DIR / "data" / "azapa140_referencia.json"
    analysis_paths = [
        BASE_DIR / "data" / "azapa140_analisis_quimicos_As_cabello.json",
        BASE_DIR / "data" / "azapa140_analisis_quimicos_As_B_Li_costilla.json",
        BASE_DIR / "data" / "azapa140_analisis_quimicos_Li_S_B_Pb_As_cabello_ref_dulasiri.json",
        BASE_DIR / "data" / "azapa140_analisis_quimicos_Mn_costilla.json",
    ]
    return build_azapa_element_graph(
        elemento="red_completa",
        reference_path=reference_path,
        analysis_paths=analysis_paths,
        sexo=sexo,
    )


@app.get("/graph/azapa/sex-options")
def graph_azapa_sex_options():
    reference_path = BASE_DIR / "data" / "azapa140_referencia.json"
    return {"sexos": get_azapa_reference_sex_options(reference_path=reference_path)}


# ============================================================
# FASE 3: filtros y grafos analíticos
# ============================================================

@app.get("/filters/options")
def filter_options(fuente: Optional[str] = None):
    fuente_norm = (fuente or "").strip().lower()
    with get_connection() as conn:
        sexos = [r["sexo"] for r in conn.execute("SELECT DISTINCT sexo FROM individuos WHERE sexo IS NOT NULL ORDER BY sexo").fetchall()]
        sitios = [r["sitio"] for r in conn.execute("SELECT DISTINCT sitio FROM individuos WHERE sitio IS NOT NULL ORDER BY sitio").fetchall()]
        estilos = [r["estilo_momificacion"] for r in conn.execute("SELECT DISTINCT estilo_momificacion FROM individuos WHERE estilo_momificacion IS NOT NULL ORDER BY estilo_momificacion").fetchall()]
        if fuente_norm == "morro1":
            elementos = ["Mn"]
        elif fuente_norm == "azapa":
            elementos = get_azapa_available_elements([
                BASE_DIR / "data" / "azapa140_analisis_quimicos_As_cabello.json",
                BASE_DIR / "data" / "azapa140_analisis_quimicos_As_B_Li_costilla.json",
                BASE_DIR / "data" / "azapa140_analisis_quimicos_Li_S_B_Pb_As_cabello_ref_dulasiri.json",
                BASE_DIR / "data" / "azapa140_analisis_quimicos_Mn_costilla.json",
            ])
        else:
            elementos = [r["elemento"] for r in conn.execute("SELECT DISTINCT elemento FROM mediciones_quimicas ORDER BY elemento").fetchall()]
        edades = [r["edad"] for r in conn.execute("SELECT DISTINCT edad FROM individuos WHERE edad IS NOT NULL ORDER BY edad").fetchall()]
        casos_documento = [r["id_documento"] for r in conn.execute("SELECT DISTINCT id_documento FROM individuos WHERE id_documento IS NOT NULL ORDER BY id_documento").fetchall()]
        casos_id = [r["id_individuo"] for r in conn.execute("SELECT DISTINCT id_individuo FROM individuos WHERE id_individuo IS NOT NULL ORDER BY id_individuo").fetchall()]
    casos_catalogo = [r.get("id_documento") for r in _load_catalogo_momias() if r.get("id_documento")]
    casos = sorted(set(casos_documento + casos_id + casos_catalogo), key=lambda x: str(x).lower())
    patologias = _extract_patologias()
    return {
        "sexos": sexos,
        "sitios": sitios,
        "estilos": estilos,
        "elementos": elementos,
        "casos": casos,
        "edades": edades,
        "patologias": patologias,
        "estados": sorted(list(VALID_ESTADOS)),
    }


def _split_elements(elements: Optional[str]) -> list[str]:
    if not elements:
        return ["Mn", "As", "Ba"]
    parsed = [e.strip() for e in elements.split(",") if e.strip()]
    return parsed or ["Mn", "As", "Ba"]


@app.get("/graph/similarity")
def graph_similarity(
    elements: Optional[str] = None,
    min_similarity: float = 0.55,
    sexo: Optional[str] = None,
    edad: Optional[str] = None,
    caso: Optional[str] = None,
    patologia: Optional[str] = None,
    fuente: Optional[str] = None,
):
    selected_elements = _split_elements(elements)

    placeholders = ",".join(["?"] * len(selected_elements))
    sql = f"""
        SELECT
            i.id_individuo,
            i.id_documento,
            i.numero_cuerpo,
            i.sexo,
            i.edad,
            i.sitio,
            i.cementerio,
            i.estilo_momificacion,
            i.estado AS estado_individuo,
            m.elemento,
            m.concentracion,
            m.estado AS estado_medicion
        FROM mediciones_quimicas m
        JOIN individuos i ON i.id_individuo = m.id_individuo
        WHERE m.elemento IN ({placeholders})
    """
    params: list = list(selected_elements)

    if sexo:
        sql += " AND i.sexo = ?"
        params.append(sexo)
    if edad:
        sql += " AND i.edad = ?"
        params.append(edad)
    if fuente:
        sql += " AND COALESCE(m.fuente, i.fuente, 'morro1') = ?"
        params.append(str(fuente).strip().lower())
    if caso:
        sql += " AND i.id_documento = ?"
        params.append(caso)

    with get_connection() as conn:
        rows = rows_to_dicts(conn.execute(sql, params).fetchall())

    if patologia:
        matching_individuos = filter_individuos_by_patologia(rows, patologia)
        allowed_ids = {item["id_individuo"] for item in matching_individuos}
        rows = [row for row in rows if row.get("id_individuo") in allowed_ids]

    profiles: dict[str, dict] = {}
    values_by_element: dict[str, list[float]] = {e: [] for e in selected_elements}

    for r in rows:
        pid = r["id_individuo"]
        if pid not in profiles:
            profiles[pid] = {
                "id_individuo": pid,
                "id_documento": r["id_documento"],
                "numero_cuerpo": r["numero_cuerpo"],
                "sexo": r["sexo"],
                "edad": r["edad"],
                "sitio": r["sitio"],
                "cementerio": r["cementerio"],
                "estilo_momificacion": r["estilo_momificacion"],
                "estado": r["estado_individuo"],
                "mediciones": {},
            }
        conc = float(r["concentracion"])
        profiles[pid]["mediciones"][r["elemento"]] = {
            "valor": conc,
        }
        if r["elemento"] in values_by_element:
            values_by_element[r["elemento"]].append(conc)

    stats = {}
    for e, vals in values_by_element.items():
        if vals:
            avg = sum(vals) / len(vals)
            var = sum((v - avg) ** 2 for v in vals) / len(vals)
            std = var ** 0.5
            stats[e] = {"avg": avg, "std": std if std > 0 else 1.0}
        else:
            stats[e] = {"avg": 0.0, "std": 1.0}

    complete = []
    for p in profiles.values():
        if all(e in p["mediciones"] for e in selected_elements):
            vector = []
            for e in selected_elements:
                raw = p["mediciones"][e]["valor"]
                z = (raw - stats[e]["avg"]) / stats[e]["std"]
                vector.append(z)
            p["vector"] = vector
            complete.append(p)

    nodes = []
    for p in complete:
        label = p["id_individuo"]
        nodes.append({
            "id": p["id_individuo"],
            "label": label,
            "type": "individuo",
            "sexo": p["sexo"],
            "edad": p["edad"],
            "sitio": p["sitio"],
            "cementerio": p["cementerio"],
            "estilo_momificacion": p["estilo_momificacion"],
            "estado": p["estado"],
            "mediciones": p["mediciones"],
        })

    edges = []
    for i in range(len(complete)):
        for j in range(i + 1, len(complete)):
            a = complete[i]
            b = complete[j]
            dist_sq = sum((x - y) ** 2 for x, y in zip(a["vector"], b["vector"]))
            dist = dist_sq ** 0.5
            similarity = 1 / (1 + dist)
            if similarity >= min_similarity:
                edges.append({
                    "source": a["id_individuo"],
                    "target": b["id_individuo"],
                    "label": "similitud_quimica",
                    "similarity": round(similarity, 4),
                    "distance": round(dist, 4),
                    "elements": selected_elements,
                })

    return {
        "mode": "similarity",
        "elements": selected_elements,
        "min_similarity": min_similarity,
        "nodes": nodes,
        "edges": edges,
        "stats": stats,
    }



# ============================================================
# FASE 4: distancias, clustering jerárquico y exportación GraphML
# ============================================================

def _chemical_profiles(
    elements: Optional[str] = None,
    sexo: Optional[str] = None,
    estado: Optional[str] = None,
):
    selected_elements = _split_elements(elements)
    placeholders = ",".join(["?"] * len(selected_elements))
    sql = f"""
        SELECT
            i.id_individuo,
            i.id_documento,
            i.numero_cuerpo,
            i.sexo,
            i.edad,
            i.sitio,
            i.cementerio,
            i.estilo_momificacion,
            i.estado AS estado_individuo,
            m.elemento,
            m.concentracion,
            m.estado AS estado_medicion
        FROM mediciones_quimicas m
        JOIN individuos i ON i.id_individuo = m.id_individuo
        WHERE m.elemento IN ({placeholders})
    """
    params: list = list(selected_elements)

    if sexo:
        sql += " AND i.sexo = ?"
        params.append(sexo)
    if estado:
        sql += " AND m.estado = ?"
        params.append(estado)

    with get_connection() as conn:
        rows = rows_to_dicts(conn.execute(sql, params).fetchall())

    profiles: dict[str, dict] = {}
    values_by_element: dict[str, list[float]] = {e: [] for e in selected_elements}

    for r in rows:
        pid = r["id_individuo"]
        if pid not in profiles:
            profiles[pid] = {
                "id_individuo": pid,
                "id_documento": r["id_documento"],
                "numero_cuerpo": r["numero_cuerpo"],
                "sexo": r["sexo"],
                "edad": r["edad"],
                "sitio": r["sitio"],
                "cementerio": r["cementerio"],
                "estilo_momificacion": r["estilo_momificacion"],
                "estado": r["estado_individuo"],
                "mediciones": {},
            }
        conc = float(r["concentracion"])
        profiles[pid]["mediciones"][r["elemento"]] = {
            "valor": conc,
            "categoria": r["categoria"],
        }
        if r["elemento"] in values_by_element:
            values_by_element[r["elemento"]].append(conc)

    stats = {}
    for e, vals in values_by_element.items():
        if vals:
            avg = sum(vals) / len(vals)
            var = sum((v - avg) ** 2 for v in vals) / len(vals)
            std = var ** 0.5
            stats[e] = {"avg": avg, "std": std if std > 0 else 1.0}
        else:
            stats[e] = {"avg": 0.0, "std": 1.0}

    complete = []
    for p in profiles.values():
        if all(e in p["mediciones"] for e in selected_elements):
            raw_vector = [p["mediciones"][e]["valor"] for e in selected_elements]
            z_vector = []
            for e in selected_elements:
                raw = p["mediciones"][e]["valor"]
                z = (raw - stats[e]["avg"]) / stats[e]["std"]
                z_vector.append(z)
            p["raw_vector"] = raw_vector
            p["vector"] = z_vector
            complete.append(p)

    return {
        "elements": selected_elements,
        "stats": stats,
        "profiles": complete,
    }


def _euclidean(a: list[float], b: list[float]) -> float:
    return sum((x - y) ** 2 for x, y in zip(a, b)) ** 0.5


def _distance_matrix(profiles: list[dict]) -> list[list[float]]:
    matrix = []
    for a in profiles:
        row = []
        for b in profiles:
            row.append(round(_euclidean(a["vector"], b["vector"]), 6))
        matrix.append(row)
    return matrix


def _cluster_distance(cluster_a: list[int], cluster_b: list[int], matrix: list[list[float]], linkage: str = "average") -> float:
    distances = [matrix[i][j] for i in cluster_a for j in cluster_b]
    if not distances:
        return 0.0
    if linkage == "single":
        return min(distances)
    if linkage == "complete":
        return max(distances)
    return sum(distances) / len(distances)


def _agglomerative_clusters(profiles: list[dict], k: int = 3, linkage: str = "average"):
    n = len(profiles)
    matrix = _distance_matrix(profiles)

    clusters: dict[int, list[int]] = {i: [i] for i in range(n)}
    next_id = n
    merges = []

    while len(clusters) > max(1, k):
        ids = list(clusters.keys())
        best_pair = None
        best_distance = None

        for idx_a in range(len(ids)):
            for idx_b in range(idx_a + 1, len(ids)):
                a_id = ids[idx_a]
                b_id = ids[idx_b]
                dist = _cluster_distance(clusters[a_id], clusters[b_id], matrix, linkage)
                if best_distance is None or dist < best_distance:
                    best_distance = dist
                    best_pair = (a_id, b_id)

        if best_pair is None:
            break

        a_id, b_id = best_pair
        merged_members = clusters[a_id] + clusters[b_id]
        merges.append({
            "left": a_id,
            "right": b_id,
            "new_cluster": next_id,
            "distance": round(float(best_distance), 6),
            "size": len(merged_members),
            "members": [profiles[i]["id_individuo"] for i in merged_members],
        })

        del clusters[a_id]
        del clusters[b_id]
        clusters[next_id] = merged_members
        next_id += 1

    cluster_list = []
    for cluster_number, (cluster_id, members) in enumerate(sorted(clusters.items(), key=lambda item: min(item[1])), start=1):
        cluster_profiles = [profiles[i] for i in members]
        cluster_list.append({
            "cluster_id": cluster_number,
            "internal_id": cluster_id,
            "size": len(members),
            "members": [
                {
                    "id_individuo": p["id_individuo"],
                    "id_documento": p["id_documento"],
                    "numero_cuerpo": p["numero_cuerpo"],
                    "sexo": p["sexo"],
                    "edad": p["edad"],
                    "sitio": p["sitio"],
                    "estilo_momificacion": p["estilo_momificacion"],
                    "mediciones": p["mediciones"],
                }
                for p in cluster_profiles
            ],
        })

    assignment = {}
    for cluster in cluster_list:
        for member in cluster["members"]:
            assignment[member["id_individuo"]] = cluster["cluster_id"]

    return {
        "matrix": matrix,
        "clusters": cluster_list,
        "assignment": assignment,
        "merges": merges,
        "linkage": linkage,
        "k": k,
    }


@app.get("/analysis/profiles")
def analysis_profiles(
    elements: Optional[str] = None,
    sexo: Optional[str] = None,
    estado: Optional[str] = None,
):
    data = _chemical_profiles(elements, sexo, estado)
    return {
        "elements": data["elements"],
        "stats": data["stats"],
        "profiles": [
            {
                "id_individuo": p["id_individuo"],
                "id_documento": p["id_documento"],
                "numero_cuerpo": p["numero_cuerpo"],
                "sexo": p["sexo"],
                "edad": p["edad"],
                "sitio": p["sitio"],
                "estilo_momificacion": p["estilo_momificacion"],
                "raw_vector": p["raw_vector"],
                "vector": [round(v, 6) for v in p["vector"]],
                "mediciones": p["mediciones"],
            }
            for p in data["profiles"]
        ],
    }


@app.get("/analysis/distance-matrix")
def analysis_distance_matrix(
    elements: Optional[str] = None,
    sexo: Optional[str] = None,
    estado: Optional[str] = None,
):
    data = _chemical_profiles(elements, sexo, estado)
    profiles = data["profiles"]
    matrix = _distance_matrix(profiles)
    return {
        "elements": data["elements"],
        "labels": [f"{p['id_documento']} / {p['numero_cuerpo']}" for p in profiles],
        "ids": [p["id_individuo"] for p in profiles],
        "matrix": matrix,
    }


@app.get("/analysis/clusters")
def analysis_clusters(
    elements: Optional[str] = None,
    k: int = 3,
    linkage: str = "average",
    sexo: Optional[str] = None,
    estado: Optional[str] = None,
):
    if k < 1:
        raise HTTPException(status_code=400, detail="k debe ser mayor o igual a 1")
    if linkage not in {"average", "single", "complete"}:
        raise HTTPException(status_code=400, detail="linkage debe ser average, single o complete")

    data = _chemical_profiles(elements, sexo, estado)
    profiles = data["profiles"]
    if not profiles:
        return {
            "elements": data["elements"],
            "k": k,
            "linkage": linkage,
            "clusters": [],
            "assignment": {},
            "merges": [],
            "matrix": [],
            "labels": [],
        }

    k = min(k, len(profiles))
    result = _agglomerative_clusters(profiles, k, linkage)
    result.update({
        "elements": data["elements"],
        "labels": [f"{p['id_documento']} / {p['numero_cuerpo']}" for p in profiles],
        "ids": [p["id_individuo"] for p in profiles],
    })
    return result


def _xml_escape(value) -> str:
    text = "" if value is None else str(value)
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


@app.get("/export/graphml")
def export_graphml(
    mode: str = "similarity",
    elements: Optional[str] = None,
    min_similarity: float = 0.55,
    k: int = 3,
    sexo: Optional[str] = None,
    estado: Optional[str] = None,
):
    """Exporta un grafo en GraphML compatible con Gephi/Cytoscape.

    mode:
    - similarity: individuo-individuo por similitud química
    - cluster: individuo-cluster
    """
    nodes = []
    edges = []

    if mode == "cluster":
        data = _chemical_profiles(elements, sexo, estado)
        profiles = data["profiles"]
        k = min(max(k, 1), max(len(profiles), 1))
        clusters = _agglomerative_clusters(profiles, k, "average") if profiles else {"clusters": []}

        for cluster in clusters["clusters"]:
            cluster_node_id = f"cluster_{cluster['cluster_id']}"
            nodes.append({
                "id": cluster_node_id,
                "label": f"Cluster {cluster['cluster_id']}",
                "type": "cluster",
                "size": cluster["size"],
            })
            for member in cluster["members"]:
                person_id = member["id_individuo"]
                nodes.append({
                    "id": person_id,
                    "label": f"{member['id_documento']} / {member['numero_cuerpo']}",
                    "type": "individuo",
                    "sexo": member["sexo"],
                    "edad": member["edad"],
                    "estilo_momificacion": member["estilo_momificacion"],
                })
                edges.append({
                    "source": person_id,
                    "target": cluster_node_id,
                    "label": "pertenece_a_cluster",
                    "weight": 1,
                })
    else:
        sim = graph_similarity(elements=elements, min_similarity=min_similarity, sexo=sexo, estado=estado)
        nodes = sim["nodes"]
        edges = sim["edges"]

    graphml = ['<?xml version="1.0" encoding="UTF-8"?>']
    graphml.append('<graphml xmlns="http://graphml.graphdrawing.org/xmlns">')
    graphml.append('  <key id="label" for="all" attr.name="label" attr.type="string"/>')
    graphml.append('  <key id="type" for="node" attr.name="type" attr.type="string"/>')
    graphml.append('  <key id="sexo" for="node" attr.name="sexo" attr.type="string"/>')
    graphml.append('  <key id="edad" for="node" attr.name="edad" attr.type="string"/>')
    graphml.append('  <key id="weight" for="edge" attr.name="weight" attr.type="double"/>')
    graphml.append('  <key id="similarity" for="edge" attr.name="similarity" attr.type="double"/>')
    graphml.append('  <graph id="ArqueoGraph" edgedefault="undirected">')

    seen = set()
    for node in nodes:
        node_id = node["id"]
        if node_id in seen:
            continue
        seen.add(node_id)
        graphml.append(f'    <node id="{_xml_escape(node_id)}">')
        graphml.append(f'      <data key="label">{_xml_escape(node.get("label", node_id))}</data>')
        graphml.append(f'      <data key="type">{_xml_escape(node.get("type", ""))}</data>')
        graphml.append(f'      <data key="sexo">{_xml_escape(node.get("sexo", ""))}</data>')
        graphml.append(f'      <data key="edad">{_xml_escape(node.get("edad", ""))}</data>')
        graphml.append('    </node>')

    for idx, edge in enumerate(edges):
        weight = edge.get("similarity", edge.get("weight", edge.get("concentracion", 1)))
        graphml.append(f'    <edge id="e{idx}" source="{_xml_escape(edge["source"])}" target="{_xml_escape(edge["target"])}">')
        graphml.append(f'      <data key="label">{_xml_escape(edge.get("label", ""))}</data>')
        graphml.append(f'      <data key="weight">{_xml_escape(weight)}</data>')
        graphml.append(f'      <data key="similarity">{_xml_escape(edge.get("similarity", ""))}</data>')
        graphml.append('    </edge>')

    graphml.append('  </graph>')
    graphml.append('</graphml>')

    return Response(
        content="\n".join(graphml),
        media_type="application/graphml+xml",
        headers={"Content-Disposition": 'attachment; filename="arqueograph.graphml"'},
    )




# ============================================================
# FASE 5: imágenes locales por individuo
# ============================================================

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".tif", ".tiff"}


def _is_allowed_local_image_file(path: Path) -> bool:
    return (
        path.is_file()
        and not path.name.startswith(".")
        and not path.name.startswith("._")
        and path.suffix.lower() in ALLOWED_IMAGE_EXTENSIONS
    )


def _safe_extension(filename: str) -> str:
    if Path(filename).name.startswith(".") or Path(filename).name.startswith("._"):
        raise HTTPException(status_code=400, detail="Nombre de imagen no permitido")
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Formato de imagen no permitido: {ext}. Usa jpg, png, webp, gif o tiff.",
        )
    return ext


def _image_row_to_dict(row):
    item = dict(row)
    if not item.get("filename_guardado"):
        item["filename_guardado"] = item.get("filename_saved")
    if not item.get("mime_type"):
        item["mime_type"] = item.get("content_type")
    if not item.get("titulo"):
        item["titulo"] = item.get("label")
    if not item.get("url") and item.get("relative_path"):
        item["relative_path"] = item["relative_path"].replace("\\", "/")
        item["url"] = f"/files/imagenes/{item['relative_path']}"
    file_path = IMAGES_DIR / item["relative_path"]
    item["exists_on_disk"] = file_path.exists()
    item["size_bytes"] = file_path.stat().st_size if file_path.exists() else None
    return item


def _sync_orphan_images(id_individuo: str) -> int:
    """
    Recupera imágenes que sí quedaron en disco pero no en DB (por errores previos de insert).
    Las carpetas de MORRO1 pueden venir nombradas con la tumba (por ejemplo T1C1) y no con el id del individuo.
    """
    possible_dirs = []
    case_dir = IMAGES_DIR / id_individuo
    if case_dir.exists():
        possible_dirs.append(case_dir)

    alt = IMAGES_DIR / "imagenes_morro1" / id_individuo
    if alt.exists():
        possible_dirs.append(alt)

    # Compatibilidad con estructuras legacy: si el id no coincide con una carpeta, intentar por tumba.
    # Primero buscar en la referencia de MORRO1 para traducir el id a tumba y luego buscar carpetas con ese nombre.
    try:
        reference_path = BASE_DIR / "data" / "morro1_referencia.json"
        if reference_path.exists():
            with reference_path.open("r", encoding="utf-8") as fh:
                payload = json.load(fh)
            cases = []
            if isinstance(payload, dict):
                if isinstance(payload.get("morro_1"), dict):
                    cases = payload["morro_1"].get("casos", [])
                elif isinstance(payload.get("casos"), list):
                    cases = payload.get("casos", [])
            for case in cases:
                if not isinstance(case, dict):
                    continue
                case_id = str(case.get("id") or "").strip()
                tumba = str(case.get("tumba") or case.get("referencia") or "").strip()
                if not tumba:
                    continue
                if case_id == id_individuo or str(case.get("individuo") or "") == id_individuo:
                    candidates = [IMAGES_DIR / "imagenes_morro1" / tumba, IMAGES_DIR / tumba, IMAGES_DIR / id_individuo / tumba]
                    for candidate in candidates:
                        if candidate.exists() and candidate not in possible_dirs:
                            possible_dirs.append(candidate)
    except Exception:
        pass

    target_dir = None
    for candidate in possible_dirs:
        if candidate.exists() and candidate.is_dir():
            target_dir = candidate
            break

    if target_dir is None:
        return 0

    case_dir = target_dir

    inserted = 0
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT relative_path, filename_saved, filename_guardado
            FROM imagenes
            WHERE id_individuo = ?
            """,
            (id_individuo,),
        ).fetchall()
        existing_rel = {r["relative_path"] for r in rows if r["relative_path"]}
        existing_names = {
            r["filename_saved"] for r in rows if r["filename_saved"]
        } | {
            r["filename_guardado"] for r in rows if r["filename_guardado"]
        }

        for path in sorted(case_dir.iterdir()):
            if not _is_allowed_local_image_file(path):
                continue

            # Construir la ruta relativa respecto a IMAGES_DIR para que el URL sea consistente
            rel = str(path.relative_to(IMAGES_DIR)).replace("\\", "/")
            if rel in existing_rel or path.name in existing_names:
                continue

            image_id = str(uuid.uuid4())
            mime_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"

            conn.execute(
                """
                INSERT INTO imagenes (
                    id_imagen,
                    id_individuo,
                    filename_original,
                    filename_saved,
                    filename_guardado,
                    relative_path,
                    content_type,
                    mime_type,
                    label,
                    titulo,
                    descripcion
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    image_id,
                    id_individuo,
                    path.name,
                    path.name,
                    path.name,
                    rel,
                    mime_type,
                    mime_type,
                    path.stem,
                    path.stem,
                    "Recuperada automáticamente desde carpeta local",
                ),
            )
            inserted += 1

    return inserted


def _known_individuo_ids() -> set[str]:
    with get_connection() as conn:
        rows = conn.execute("SELECT id_individuo FROM individuos").fetchall()
    return {row["id_individuo"] for row in rows}


def _scan_image_storage() -> dict:
    known_ids = _known_individuo_ids()
    folders = []
    files_total = 0
    ignored_files = 0
    orphan_folders = []

    if not IMAGES_DIR.exists():
        return {
            "images_dir": str(IMAGES_DIR),
            "folders": [],
            "files_total": 0,
            "ignored_files": 0,
            "orphan_folders": [],
        }

    for folder in sorted(IMAGES_DIR.iterdir()):
        # Si encontramos una carpeta de import legacy (imagenes_morro1), iteramos sus subcarpetas
        if folder.is_dir() and folder.name == "imagenes_morro1":
            for sub in sorted(folder.iterdir()):
                if not sub.is_dir() or sub.name.startswith(".") or sub.name.startswith("._"):
                    continue
                image_files = []
                ignored = 0
                for path in sorted(sub.iterdir()):
                    if _is_allowed_local_image_file(path):
                        rel = str(path.relative_to(IMAGES_DIR)).replace("\\", "/")
                        image_files.append({
                            "filename": path.name,
                            "size_bytes": path.stat().st_size,
                            "relative_path": rel,
                        })
                    elif path.is_file():
                        ignored += 1
                files_total += len(image_files)
                ignored_files += ignored
                item = {
                    "id_individuo": sub.name,
                    "known_individuo": sub.name in known_ids,
                    "files": image_files,
                    "files_count": len(image_files),
                    "ignored_files": ignored,
                }
                folders.append(item)
                if sub.name not in known_ids:
                    orphan_folders.append(sub.name)
            continue

        if not folder.is_dir() or folder.name.startswith(".") or folder.name.startswith("._"):
            continue
        image_files = []
        ignored = 0
        for path in sorted(folder.iterdir()):
            if _is_allowed_local_image_file(path):
                rel = str(path.relative_to(IMAGES_DIR)).replace("\\", "/")
                image_files.append({
                    "filename": path.name,
                    "size_bytes": path.stat().st_size,
                    "relative_path": rel,
                })
            elif path.is_file():
                ignored += 1
        files_total += len(image_files)
        ignored_files += ignored
        item = {
            "id_individuo": folder.name,
            "known_individuo": folder.name in known_ids,
            "files": image_files,
            "files_count": len(image_files),
            "ignored_files": ignored,
        }
        folders.append(item)
        if folder.name not in known_ids:
            orphan_folders.append(folder.name)

    return {
        "images_dir": str(IMAGES_DIR),
        "folders": folders,
        "files_total": files_total,
        "ignored_files": ignored_files,
        "orphan_folders": orphan_folders,
    }


@app.get("/admin/storage")
def admin_storage():
    scan = _scan_image_storage()
    with get_connection() as conn:
        registered = conn.execute("SELECT COUNT(*) AS n FROM imagenes").fetchone()["n"]
    scan["registered_images"] = registered
    return scan


@app.post("/admin/imagenes/sync")
def sync_imagenes_desde_disco(id_individuo: Optional[str] = None):
    known_ids = _known_individuo_ids()
    if id_individuo:
        if id_individuo not in known_ids:
            raise HTTPException(status_code=404, detail="Individuo no encontrado")
        targets = [id_individuo]
    else:
        targets = []
        if IMAGES_DIR.exists():
            for folder in sorted(IMAGES_DIR.iterdir()):
                if not folder.is_dir() or folder.name.startswith('.') or folder.name.startswith('._'):
                    continue
                # If we find a legacy container folder, include its subfolders
                if folder.name == "imagenes_morro1":
                    for sub in sorted(folder.iterdir()):
                        if sub.is_dir() and not sub.name.startswith('.') and not sub.name.startswith('._') and sub.name in known_ids:
                            targets.append(sub.name)
                    continue
                if folder.name in known_ids:
                    targets.append(folder.name)

    details = []
    total_inserted = 0
    for target in targets:
        inserted = _sync_orphan_images(target)
        total_inserted += inserted
        details.append({"id_individuo": target, "inserted": inserted})

    return {
        "ok": True,
        "inserted": total_inserted,
        "synced_individuos": len(targets),
        "details": details,
        "storage": _scan_image_storage(),
    }


@app.get("/individuos/{id_individuo}/imagenes")
def list_imagenes_individuo(id_individuo: str):
    with get_connection() as conn:
        individuo = conn.execute(
            "SELECT 1 FROM individuos WHERE id_individuo = ?",
            (id_individuo,),
        ).fetchone()
        if not individuo:
            raise HTTPException(status_code=404, detail="Individuo no encontrado")

    _sync_orphan_images(id_individuo)

    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM imagenes
            WHERE id_individuo = ?
            ORDER BY created_at DESC
            """,
            (id_individuo,),
        ).fetchall()

    db_images = [_image_row_to_dict(row) for row in rows]
    catalog_images = _catalogo_momias_images_for_individuo(id_individuo)

    existing_paths = {img.get("relative_path") for img in db_images}
    catalog_images = [img for img in catalog_images if img.get("relative_path") not in existing_paths]

    return db_images + catalog_images


@app.post("/admin/individuos/{id_individuo}/imagenes")
async def upload_imagen_individuo(
    id_individuo: str,
    files: list[UploadFile] = File(...),
    titulo: Optional[str] = Form(None),
    descripcion: Optional[str] = Form(None),
    tipo_imagen: Optional[str] = Form(None),
    fecha_imagen: Optional[str] = Form(None),
):
    with get_connection() as conn:
        individuo = conn.execute(
            "SELECT 1 FROM individuos WHERE id_individuo = ?",
            (id_individuo,),
        ).fetchone()
        if not individuo:
            raise HTTPException(status_code=404, detail="Individuo no encontrado")

    case_dir = IMAGES_DIR / id_individuo
    case_dir.mkdir(parents=True, exist_ok=True)

    saved = []
    with get_connection() as conn:
        for file in files:
            ext = _safe_extension(file.filename or "")
            image_id = str(uuid.uuid4())
            saved_name = f"{image_id}{ext}"
            dest = case_dir / saved_name

            with dest.open("wb") as f:
                shutil.copyfileobj(file.file, f)

            mime_type = file.content_type or mimetypes.guess_type(dest.name)[0] or "application/octet-stream"
            relative_path = f"{id_individuo}/{saved_name}"

            conn.execute(
                """
                INSERT INTO imagenes (
                    id_imagen,
                    id_individuo,
                    filename_original,
                    filename_saved,
                    filename_guardado,
                    relative_path,
                    content_type,
                    mime_type,
                    label,
                    titulo,
                    descripcion,
                    tipo_imagen,
                    fecha_imagen
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    image_id,
                    id_individuo,
                    file.filename or saved_name,
                    saved_name,
                    saved_name,
                    relative_path,
                    mime_type,
                    mime_type,
                    titulo,
                    titulo,
                    descripcion,
                    tipo_imagen,
                    fecha_imagen,
                ),
            )

            row = conn.execute(
                "SELECT * FROM imagenes WHERE id_imagen = ?",
                (image_id,),
            ).fetchone()
            saved.append(_image_row_to_dict(row))

    return {
        "inserted": len(saved),
        "imagenes": saved,
        "folder": str(case_dir),
    }


@app.patch("/admin/imagenes/{id_imagen}")
def update_imagen(
    id_imagen: str,
    titulo: Optional[str] = None,
    descripcion: Optional[str] = None,
    tipo_imagen: Optional[str] = None,
    fecha_imagen: Optional[str] = None,
):
    fields = []
    params = []

    for key, value in {
        "titulo": titulo,
        "descripcion": descripcion,
        "tipo_imagen": tipo_imagen,
        "fecha_imagen": fecha_imagen,
    }.items():
        if value is not None:
            fields.append(f"{key} = ?")
            params.append(value)

    if not fields:
        with get_connection() as conn:
            row = conn.execute("SELECT * FROM imagenes WHERE id_imagen = ?", (id_imagen,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Imagen no encontrada")
        return _image_row_to_dict(row)

    fields.append("updated_at = CURRENT_TIMESTAMP")
    params.append(id_imagen)

    with get_connection() as conn:
        row = conn.execute("SELECT * FROM imagenes WHERE id_imagen = ?", (id_imagen,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Imagen no encontrada")

        conn.execute(f"UPDATE imagenes SET {', '.join(fields)} WHERE id_imagen = ?", params)
        updated = conn.execute("SELECT * FROM imagenes WHERE id_imagen = ?", (id_imagen,)).fetchone()

    return _image_row_to_dict(updated)


@app.delete("/admin/imagenes/{id_imagen}")
def delete_imagen(id_imagen: str):
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM imagenes WHERE id_imagen = ?", (id_imagen,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Imagen no encontrada")

        relative_path = row["relative_path"]
        file_path = IMAGES_DIR / relative_path
        conn.execute("DELETE FROM imagenes WHERE id_imagen = ?", (id_imagen,))

    if file_path.exists():
        file_path.unlink()

    # Limpieza opcional: si la carpeta queda vacía, se conserva por claridad local.
    return {"ok": True, "deleted": id_imagen}


@app.get("/admin/imagenes")
def list_all_imagenes(id_individuo: Optional[str] = None):
    sql = """
        SELECT
            img.*,
            i.id_documento,
            i.numero_cuerpo,
            i.sexo,
            i.edad
        FROM imagenes img
        JOIN individuos i ON i.id_individuo = img.id_individuo
        WHERE 1=1
    """
    params = []
    if id_individuo:
        sql += " AND img.id_individuo = ?"
        params.append(id_individuo)
    sql += " ORDER BY img.created_at DESC"

    with get_connection() as conn:
        rows = conn.execute(sql, params).fetchall()

    return [_image_row_to_dict(row) for row in rows]
