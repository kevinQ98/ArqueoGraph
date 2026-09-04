from __future__ import annotations

import json
import math
import re
from pathlib import Path
from typing import Any

from .config import (
    AZAPA_ANALYSIS_PATHS,
    AZAPA_DATACIONES_PATH,
    AZAPA_REFERENCE_PATH,
    MORRO1_ANALYSIS_PATHS,
    MORRO1_PALEOPATOLOGIA_PATHS,
    MORRO1_REFERENCE_PATH,
)
from .database import IMAGES_DIR, get_connection, init_db


IMAGE_EXTENSIONS = {".gif", ".jpeg", ".jpg", ".png", ".tif", ".tiff", ".webp"}
NEGATIVE_VALUES = {
    "",
    "0",
    "absente",
    "ausente",
    "false",
    "falso",
    "n/a",
    "negativo",
    "no",
    "none",
    "null",
}
MISSING_MEASUREMENTS = {"", "-", "na", "nan", "n/d", "n.d.", "nd", "none", "null"}

SITE_DEFINITIONS = [
    {
        "id_sitio": "morro1",
        "nombre": "Morro 1",
        "area": "ARICA",
        "lat": -18.508333,
        "lng": -70.266667,
        "view": "visualizacion",
        "reference_path": MORRO1_REFERENCE_PATH,
        "analysis_paths": MORRO1_ANALYSIS_PATHS,
        "paleopathology_paths": MORRO1_PALEOPATOLOGIA_PATHS,
        "dating_paths": [],
        "image_dirs": [IMAGES_DIR / "imagenes_morro1"],
    },
    {
        "id_sitio": "azapa",
        "nombre": "Azapa 140",
        "area": "AZAPA",
        "lat": -18.528267,
        "lng": -70.179785,
        "view": "clusters",
        "reference_path": AZAPA_REFERENCE_PATH,
        "analysis_paths": AZAPA_ANALYSIS_PATHS,
        "paleopathology_paths": [],
        "dating_paths": [AZAPA_DATACIONES_PATH],
        "image_dirs": [IMAGES_DIR / "imagenes_azapa140"],
    },
]


def _load_cases(path: Path) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """
    Carga casos desde un archivo JSON legacy, soportando estructuras anidadas.

    Busca la clave "casos" en el nivel superior o en cualquier valor envolvente.

    Args:
        path (Path): Ruta al archivo JSON.

    Returns:
        tuple: (lista de casos, el objeto raíz del JSON).
    """

    if not path.exists():
        return [], {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return [], {}
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)], {}
    if not isinstance(payload, dict):
        return [], {}
    if isinstance(payload.get("casos"), list):
        return [item for item in payload["casos"] if isinstance(item, dict)], payload
    for value in payload.values():
        if isinstance(value, dict) and isinstance(value.get("casos"), list):
            return [item for item in value["casos"] if isinstance(item, dict)], value
    return [], {}


def _clean(value: Any) -> Any:
    """
    Limpia un valor: elimina espacios, convierte NaN a None, etc.

    Args:
        value (Any): Valor a limpiar.

    Returns:
        Any: Valor limpio o None.
    """

    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


def _compact(value: Any) -> str:
    return (
        str(value or "")
        .strip()
        .lower()
        .replace(" ", "")
        .replace("_", "")
        .replace("-", "")
    )


def _canonical_sex(value: Any) -> str:
    """
    Normaliza el campo sexo a 'femenino', 'masculino' o 'indeterminado'.

    Args:
        value (Any): Valor original (ej. "F", "femenino", "M").

    Returns:
        str: Sexo normalizado.
    """

    normalized = _compact(value)
    if "femenin" in normalized:
        return "femenino"
    if "masculin" in normalized:
        return "masculino"
    if "indeterminado" in normalized or normalized in {"desconocido", "pendiente"}:
        return "indeterminado"
    return str(value or "sin dato").strip().lower()


def _canonical_age(value: Any) -> str:
    """
    Normaliza el campo edad a 'adulto', 'subadulto' o 'indeterminado'.

    Args:
        value (Any): Valor original (ej. "adulto", "sub adulto").

    Returns:
        str: Edad normalizada.
    """

    normalized = _compact(value)
    if normalized == "adulto":
        return "adulto"
    if normalized in {"subadulto", "subadult"}:
        return "subadulto"
    if normalized in {"", "indeterminado", "desconocido"}:
        return "indeterminado"
    return str(value or "sin dato").strip().lower()


def _numeric_measurement(value: Any) -> float | None:
    if isinstance(value, dict):
        value = value.get("valor")
    if str(value or "").strip().lower() in MISSING_MEASUREMENTS:
        return None
    try:
        number = float(str(value).replace(",", "."))
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _safe_id(value: Any) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9_.-]+", "_", str(value or "").strip())
    return normalized.strip("_") or "sin_id"


def _text(value: Any) -> str | None:
    value = _clean(value)
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def _present(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str) and value.strip().lower() in NEGATIVE_VALUES:
        return False
    return True


def _insert_site(conn, site: dict[str, Any]) -> None:
    conn.execute(
        """
        INSERT INTO sitios (id_sitio, nombre, area, lat, lng, view)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id_sitio) DO UPDATE SET
            nombre = excluded.nombre,
            area = excluded.area,
            lat = excluded.lat,
            lng = excluded.lng,
            view = excluded.view,
            updated_at = CURRENT_TIMESTAMP
        """,
        (
            site["id_sitio"],
            site["nombre"],
            site.get("area"),
            site.get("lat"),
            site.get("lng"),
            site.get("view"),
        ),
    )


def _insert_reference_cases(conn, site: dict[str, Any]) -> dict[str, int]:
    cases, root = _load_cases(site["reference_path"])
    inserted = updated = skipped = 0
    for raw in cases:
        case_id = _clean(raw.get("id"))
        if not case_id:
            skipped += 1
            continue
        individual = raw.get("individuo") or {}
        label = _clean(raw.get("referencia") or raw.get("tumba") or case_id)
        number = _clean(raw.get("tumba") or raw.get("referencia") or case_id)
        exists = conn.execute(
            "SELECT 1 FROM individuos WHERE id_individuo = ?", (case_id,)
        ).fetchone()
        conn.execute(
            """
            INSERT INTO individuos (
                id_individuo, id_documento, numero_cuerpo, sexo, edad, sitio,
                cementerio, cronologia, estilo_momificacion, referencia_bibliografica,
                fuente, estado, notas
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'validado', ?)
            ON CONFLICT(id_individuo) DO UPDATE SET
                id_documento = excluded.id_documento,
                numero_cuerpo = excluded.numero_cuerpo,
                sexo = excluded.sexo,
                edad = excluded.edad,
                sitio = excluded.sitio,
                cementerio = excluded.cementerio,
                cronologia = excluded.cronologia,
                estilo_momificacion = excluded.estilo_momificacion,
                referencia_bibliografica = excluded.referencia_bibliografica,
                fuente = excluded.fuente,
                estado = excluded.estado,
                notas = excluded.notas,
                updated_at = CURRENT_TIMESTAMP
            """,
            (
                case_id,
                label,
                number,
                _canonical_sex(individual.get("sexo")),
                _canonical_age(individual.get("grupo_edad") or individual.get("edad")),
                site["nombre"],
                _clean(root.get("sitio") or root.get("area") or site["nombre"]),
                _clean(raw.get("cronologia")),
                _clean(raw.get("tipo_momificacion") or raw.get("estilo_momificacion")),
                _clean(raw.get("cultura")),
                site["id_sitio"],
                json.dumps(raw, ensure_ascii=False),
            ),
        )
        updated += 1 if exists else 0
        inserted += 0 if exists else 1
    return {"inserted": inserted, "updated": updated, "skipped": skipped}


def _insert_chemical_measurements(conn, site: dict[str, Any]) -> dict[str, int]:
    inserted = updated = skipped = 0
    for path in site["analysis_paths"]:
        cases, _ = _load_cases(path)
        source = path.stem
        for raw in cases:
            case_id = _clean(raw.get("id"))
            if not case_id:
                skipped += 1
                continue
            if not conn.execute(
                "SELECT 1 FROM individuos WHERE id_individuo = ?", (case_id,)
            ).fetchone():
                skipped += 1
                continue
            analysis = raw.get("analisis_quimicos") or {}
            matrix = _clean(analysis.get("matriz"))
            elements = analysis.get("elementos") or {}
            if not isinstance(elements, dict):
                continue
            for element, element_data in elements.items():
                if not element:
                    continue
                value = _numeric_measurement(element_data)
                if value is None:
                    skipped += 1
                    continue
                unit = "ppm"
                method = laboratory = date = observations = None
                if isinstance(element_data, dict):
                    unit = _clean(element_data.get("unidad")) or "ppm"
                    method = _clean(element_data.get("metodo"))
                    laboratory = _clean(element_data.get("laboratorio"))
                    date = _clean(element_data.get("fecha"))
                    observations = _clean(element_data.get("observaciones"))
                measurement_id = _safe_id(
                    f"{case_id}_{element}_{matrix or 'muestra'}_{source}"
                )
                exists = conn.execute(
                    "SELECT 1 FROM mediciones_quimicas WHERE id_medicion = ?",
                    (measurement_id,),
                ).fetchone()
                conn.execute(
                    """
                    INSERT INTO mediciones_quimicas (
                        id_medicion, id_individuo, tipo_muestra, elemento, concentracion,
                        unidad, metodo, laboratorio, fecha, observaciones, fuente, estado
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'validado')
                    ON CONFLICT(id_medicion) DO UPDATE SET
                        id_individuo = excluded.id_individuo,
                        tipo_muestra = excluded.tipo_muestra,
                        elemento = excluded.elemento,
                        concentracion = excluded.concentracion,
                        unidad = excluded.unidad,
                        metodo = excluded.metodo,
                        laboratorio = excluded.laboratorio,
                        fecha = excluded.fecha,
                        observaciones = excluded.observaciones,
                        fuente = excluded.fuente,
                        estado = excluded.estado,
                        updated_at = CURRENT_TIMESTAMP
                    """,
                    (
                        measurement_id,
                        case_id,
                        matrix,
                        str(element),
                        value,
                        unit,
                        method,
                        laboratory,
                        date,
                        observations,
                        site["id_sitio"],
                    ),
                )
                updated += 1 if exists else 0
                inserted += 0 if exists else 1
    return {"inserted": inserted, "updated": updated, "skipped": skipped}


def _insert_paleopathologies(conn, site: dict[str, Any]) -> dict[str, int]:
    inserted = updated = skipped = 0
    for path in site["paleopathology_paths"]:
        cases, _ = _load_cases(path)
        source = path.stem
        for raw in cases:
            case_id = _clean(raw.get("id"))
            pathologies = raw.get("paleopatologia") or {}
            if not case_id or not isinstance(pathologies, dict):
                skipped += 1
                continue
            if not conn.execute(
                "SELECT 1 FROM individuos WHERE id_individuo = ?", (case_id,)
            ).fetchone():
                skipped += 1
                continue
            for pathology, value in pathologies.items():
                if value is None:
                    skipped += 1
                    continue
                pathology_id = _safe_id(f"{case_id}_{pathology}_{source}")
                exists = conn.execute(
                    "SELECT 1 FROM paleopatologias WHERE id_paleopatologia = ?",
                    (pathology_id,),
                ).fetchone()
                conn.execute(
                    """
                    INSERT INTO paleopatologias (
                        id_paleopatologia, id_individuo, patologia, valor, presente, fuente, estado
                    ) VALUES (?, ?, ?, ?, ?, ?, 'validado')
                    ON CONFLICT(id_paleopatologia) DO UPDATE SET
                        id_individuo = excluded.id_individuo,
                        patologia = excluded.patologia,
                        valor = excluded.valor,
                        presente = excluded.presente,
                        fuente = excluded.fuente,
                        estado = excluded.estado,
                        updated_at = CURRENT_TIMESTAMP
                    """,
                    (
                        pathology_id,
                        case_id,
                        str(pathology),
                        str(value),
                        1 if _present(value) else 0,
                        site["id_sitio"],
                    ),
                )
                updated += 1 if exists else 0
                inserted += 0 if exists else 1
    return {"inserted": inserted, "updated": updated, "skipped": skipped}


def _insert_datings(conn, site: dict[str, Any]) -> dict[str, int]:
    inserted = updated = skipped = 0
    for path in site["dating_paths"]:
        cases, _ = _load_cases(path)
        source = path.stem
        for raw in cases:
            case_id = _clean(raw.get("id"))
            dating = raw.get("datacion_radiocarbono") or {}
            if not case_id or not isinstance(dating, dict):
                skipped += 1
                continue
            if not conn.execute(
                "SELECT 1 FROM individuos WHERE id_individuo = ?", (case_id,)
            ).fetchone():
                skipped += 1
                continue
            calibrated = dating.get("rango_calibrado_AD") or {}
            if not isinstance(calibrated, dict):
                calibrated = {}
            has_value = any(
                [
                    dating.get("muestra"),
                    dating.get("fechado_1sigma_AD"),
                    dating.get("interceptos_AD"),
                    calibrated.get("min"),
                    calibrated.get("max"),
                ]
            )
            if not has_value:
                skipped += 1
                continue
            dating_id = _safe_id(f"{case_id}_{source}")
            exists = conn.execute(
                "SELECT 1 FROM dataciones WHERE id_datacion = ?", (dating_id,)
            ).fetchone()
            conn.execute(
                """
                INSERT INTO dataciones (
                    id_datacion, id_individuo, muestra, fecha_bp, fecha_1sigma_ad,
                    interceptos_ad, rango_calibrado_min, rango_calibrado_max,
                    referencia_datos, fuente, estado
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'validado')
                ON CONFLICT(id_datacion) DO UPDATE SET
                    id_individuo = excluded.id_individuo,
                    muestra = excluded.muestra,
                    fecha_bp = excluded.fecha_bp,
                    fecha_1sigma_ad = excluded.fecha_1sigma_ad,
                    interceptos_ad = excluded.interceptos_ad,
                    rango_calibrado_min = excluded.rango_calibrado_min,
                    rango_calibrado_max = excluded.rango_calibrado_max,
                    referencia_datos = excluded.referencia_datos,
                    fuente = excluded.fuente,
                    estado = excluded.estado,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (
                    dating_id,
                    case_id,
                    _text(dating.get("muestra")),
                    _text(dating.get("fechado_bp") or dating.get("fecha_bp")),
                    _text(dating.get("fechado_1sigma_AD")),
                    _text(dating.get("interceptos_AD")),
                    calibrated.get("min"),
                    calibrated.get("max"),
                    _text(dating.get("referencia_datos")),
                    site["id_sitio"],
                ),
            )
            updated += 1 if exists else 0
            inserted += 0 if exists else 1
    return {"inserted": inserted, "updated": updated, "skipped": skipped}


def _insert_images(conn, site: dict[str, Any]) -> dict[str, int]:
    inserted = updated = skipped = 0
    known_ids = {
        row["id_individuo"].lower(): row["id_individuo"]
        for row in conn.execute(
            "SELECT id_individuo FROM individuos WHERE fuente = ?", (site["id_sitio"],)
        ).fetchall()
    }
    for image_dir in site["image_dirs"]:
        if not image_dir.exists():
            continue
        for file_path in image_dir.rglob("*"):
            if (
                not file_path.is_file()
                or file_path.suffix.lower() not in IMAGE_EXTENSIONS
            ):
                continue
            case_id = None
            for parent in reversed(file_path.parts[:-1]):
                lookup = known_ids.get(parent.lower())
                if lookup:
                    case_id = lookup
                    break
            if not case_id:
                skipped += 1
                continue
            relative_path = file_path.relative_to(IMAGES_DIR).as_posix()
            image_id = _safe_id(f"{case_id}_{relative_path}")
            exists = conn.execute(
                "SELECT 1 FROM imagenes WHERE id_imagen = ?", (image_id,)
            ).fetchone()
            conn.execute(
                """
                INSERT INTO imagenes (
                    id_imagen, id_individuo, filename_original, filename_saved,
                    relative_path, content_type, label, descripcion, fuente, estado
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'validado')
                ON CONFLICT(id_imagen) DO UPDATE SET
                    id_individuo = excluded.id_individuo,
                    filename_original = excluded.filename_original,
                    filename_saved = excluded.filename_saved,
                    relative_path = excluded.relative_path,
                    content_type = excluded.content_type,
                    label = excluded.label,
                    descripcion = excluded.descripcion,
                    fuente = excluded.fuente,
                    estado = excluded.estado,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (
                    image_id,
                    case_id,
                    file_path.name,
                    file_path.name,
                    relative_path,
                    None,
                    file_path.stem,
                    None,
                    site["id_sitio"],
                ),
            )
            updated += 1 if exists else 0
            inserted += 0 if exists else 1
    return {"inserted": inserted, "updated": updated, "skipped": skipped}


def migrate_json_sources_to_sqlite() -> dict[str, Any]:
    """
    Migra todos los JSON legacy definidos en config.py a SQLite.

    Proceso:
        1. Para cada sitio (morro1, azapa):
            - Inserta o actualiza la fila en sitios.
            - Procesa referencia (individuos), análisis químicos,
              paleopatologías, dataciones e imágenes.
        2. Usa ON CONFLICT para actualizar registros existentes.
        3. Retorna un resumen de inserciones/actualizaciones por tabla.

    Returns:
        dict: Conteos por sitio y totales en la base de datos.
    """

    init_db()
    result: dict[str, Any] = {"sites": {}, "totals": {}}
    with get_connection() as conn:
        for site in SITE_DEFINITIONS:
            _insert_site(conn, site)
            result["sites"][site["id_sitio"]] = {
                "referencia": _insert_reference_cases(conn, site),
                "mediciones_quimicas": _insert_chemical_measurements(conn, site),
                "paleopatologias": _insert_paleopathologies(conn, site),
                "dataciones": _insert_datings(conn, site),
                "imagenes": _insert_images(conn, site),
            }
        result["totals"] = {
            "sitios": conn.execute("SELECT COUNT(*) AS n FROM sitios").fetchone()["n"],
            "individuos": conn.execute(
                "SELECT COUNT(*) AS n FROM individuos"
            ).fetchone()["n"],
            "mediciones_quimicas": conn.execute(
                "SELECT COUNT(*) AS n FROM mediciones_quimicas"
            ).fetchone()["n"],
            "paleopatologias": conn.execute(
                "SELECT COUNT(*) AS n FROM paleopatologias"
            ).fetchone()["n"],
            "dataciones": conn.execute(
                "SELECT COUNT(*) AS n FROM dataciones"
            ).fetchone()["n"],
            "imagenes": conn.execute("SELECT COUNT(*) AS n FROM imagenes").fetchone()[
                "n"
            ],
        }
    return result


def ensure_sqlite_sources() -> dict[str, Any] | None:
    """
    Asegura que la base de datos tenga datos migrados.

    Si la tabla sitios está vacía, ejecuta migrate_json_sources_to_sqlite().

    Returns:
        dict | None: Resultado de la migración si se ejecutó, o None si ya había datos.
    """

    init_db()
    with get_connection() as conn:
        row = conn.execute("SELECT COUNT(*) AS n FROM sitios").fetchone()
        if row and row["n"] > 0:
            return None
    return migrate_json_sources_to_sqlite()


if __name__ == "__main__":
    print(json.dumps(migrate_json_sources_to_sqlite(), ensure_ascii=False, indent=2))
