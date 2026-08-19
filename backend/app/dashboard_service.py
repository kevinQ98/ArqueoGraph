from __future__ import annotations

import json
import math
from collections import Counter, defaultdict
from pathlib import Path
from statistics import mean, median
from typing import Any, Optional

from .database import get_connection, rows_to_dicts
from .sqlite_migration import ensure_sqlite_sources


IMAGE_EXTENSIONS = {".gif", ".jpeg", ".jpg", ".png", ".tif", ".tiff", ".webp"}
NEGATIVE_VALUES = {
    "", "0", "absente", "ausente", "false", "falso", "n/a", "negativo",
    "no", "none", "null",
}
MISSING_MEASUREMENTS = {"", "-", "na", "nan", "n/d", "n.d.", "nd", "none", "null"}


def _load_cases(path: Path) -> list[dict[str, Any]]:
    """Compatibilidad para utilidades legacy que aún respaldan desde JSON."""
    if not path.exists():
        return []
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if not isinstance(payload, dict):
        return []
    if isinstance(payload.get("casos"), list):
        return [item for item in payload["casos"] if isinstance(item, dict)]
    for value in payload.values():
        if isinstance(value, dict) and isinstance(value.get("casos"), list):
            return [item for item in value["casos"] if isinstance(item, dict)]
    return []


def _compact(value: Any) -> str:
    return str(value or "").strip().lower().replace(" ", "").replace("_", "").replace("-", "")


def _canonical_sex(value: Any) -> str:
    normalized = _compact(value)
    if "femenin" in normalized:
        return "femenino"
    if "masculin" in normalized:
        return "masculino"
    if "indeterminado" in normalized or normalized in {"desconocido", "pendiente"}:
        return "indeterminado"
    return str(value or "sin dato").strip().lower()


def _canonical_age(value: Any) -> str:
    normalized = _compact(value)
    if normalized == "adulto":
        return "adulto"
    if normalized == "subadulto":
        return "subadulto"
    if normalized in {"", "indeterminado", "desconocido"}:
        return "indeterminado"
    return str(value).strip().lower()


def _display_value(value: Any, fallback: str = "Sin dato") -> str:
    text = str(value or "").strip()
    if not text or text.lower() in {"null", "none"}:
        return fallback
    return text


def _numeric_measurement(value: Any) -> Optional[float]:
    if isinstance(value, dict):
        value = value.get("valor")
    if str(value or "").strip().lower() in MISSING_MEASUREMENTS:
        return None
    try:
        number = float(str(value).replace(",", "."))
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _build_records() -> list[dict[str, Any]]:
    ensure_sqlite_sources()
    with get_connection() as conn:
        individuals = rows_to_dicts(conn.execute(
            """
            SELECT i.id_individuo, i.id_documento, i.numero_cuerpo, i.sexo, i.edad,
                   i.sitio, i.referencia_bibliografica, i.notas, i.fuente,
                   s.nombre AS sitio_nombre, s.area, s.lat, s.lng, s.view
            FROM individuos i
            LEFT JOIN sitios s ON s.id_sitio = i.fuente OR s.nombre = i.sitio
            ORDER BY i.sitio, i.id_documento
            """
        ).fetchall())
        measurements = rows_to_dicts(conn.execute(
            """
            SELECT id_individuo, elemento, concentracion
            FROM mediciones_quimicas
            WHERE concentracion IS NOT NULL
            """
        ).fetchall())
        pathologies = rows_to_dicts(conn.execute(
            """
            SELECT id_individuo, patologia
            FROM paleopatologias
            WHERE presente = 1
            """
        ).fetchall())
        image_counts = {
            row["id_individuo"]: row["n"]
            for row in conn.execute(
                "SELECT id_individuo, COUNT(*) AS n FROM imagenes GROUP BY id_individuo"
            ).fetchall()
        }
        dated = {
            row["id_individuo"]
            for row in conn.execute("SELECT DISTINCT id_individuo FROM dataciones").fetchall()
        }

    chemistry_by_case: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    for row in measurements:
        number = _numeric_measurement(row.get("concentracion"))
        if row.get("id_individuo") and row.get("elemento") and number is not None:
            chemistry_by_case[row["id_individuo"]][str(row["elemento"])].append(number)

    pathologies_by_case: dict[str, list[str]] = defaultdict(list)
    for row in pathologies:
        if row.get("id_individuo") and row.get("patologia"):
            pathologies_by_case[row["id_individuo"]].append(str(row["patologia"]))

    raw_records: list[dict[str, Any]] = []
    for row in individuals:
        case_id = str(row.get("id_individuo") or "").strip()
        if not case_id:
            continue
        raw_payload: dict[str, Any] = {}
        if row.get("notas"):
            try:
                parsed = json.loads(row["notas"])
                if isinstance(parsed, dict):
                    raw_payload = parsed
            except (TypeError, ValueError):
                raw_payload = {}
        individual = raw_payload.get("individuo") if isinstance(raw_payload.get("individuo"), dict) else {}
        site_name = _display_value(row.get("sitio_nombre") or row.get("sitio"))
        raw_records.append({
            "id": case_id,
            "label": _display_value(row.get("numero_cuerpo") or row.get("id_documento"), case_id),
            "sitio": site_name,
            "sexo": _canonical_sex(row.get("sexo")),
            "edad": _canonical_age(row.get("edad")),
            "cultura": _display_value(raw_payload.get("cultura") or row.get("referencia_bibliografica")),
            "conservacion": _display_value(individual.get("conservacion")),
            "chemistry": chemistry_by_case.get(case_id, {}),
            "pathologies": sorted(set(pathologies_by_case.get(case_id, []))),
            "has_dating": case_id in dated,
            "image_count": image_counts.get(case_id, 0),
            "site_view": row.get("view") or "",
            "site_coordinates": (
                {"lat": row["lat"], "lng": row["lng"]}
                if row.get("lat") is not None and row.get("lng") is not None
                else None
            ),
        })
    return raw_records


def _distribution(records: list[dict[str, Any]], field: str) -> list[dict[str, Any]]:
    counts = Counter(str(record.get(field) or "Sin dato") for record in records)
    return [
        {"label": label, "value": value}
        for label, value in sorted(counts.items(), key=lambda item: (-item[1], item[0].lower()))
    ]


def _chemical_coverage(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    coverage = Counter()
    for record in records:
        coverage.update(record["chemistry"].keys())
    return [
        {"label": element, "value": count}
        for element, count in sorted(coverage.items(), key=lambda item: (-item[1], item[0].lower()))
    ]


def _pathology_distribution(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    counts = Counter()
    for record in records:
        counts.update(record["pathologies"])
    return [
        {"label": pathology, "value": count}
        for pathology, count in sorted(counts.items(), key=lambda item: (-item[1], item[0].lower()))
    ]


def _chemical_summary(records: list[dict[str, Any]], element: str) -> list[dict[str, Any]]:
    by_site: dict[str, list[float]] = defaultdict(list)
    for record in records:
        values = record["chemistry"].get(element, [])
        by_site[record["sitio"]].extend(values)
    summaries = []
    for site, values in sorted(by_site.items()):
        if not values:
            continue
        summaries.append({
            "sitio": site,
            "n": len(values),
            "min": min(values),
            "median": median(values),
            "mean": mean(values),
            "max": max(values),
        })
    return summaries


def build_dashboard_data(
    sitio: Optional[str] = None,
    sexo: Optional[str] = None,
    edad: Optional[str] = None,
    elemento: Optional[str] = None,
    patologia: Optional[str] = None,
) -> dict[str, Any]:
    all_records = _build_records()
    all_elements = sorted({element for record in all_records for element in record["chemistry"]})
    all_pathologies = sorted({item for record in all_records for item in record["pathologies"]})

    site_filter = str(sitio or "").strip().lower()
    sex_filter = _canonical_sex(sexo) if sexo else ""
    age_filter = _canonical_age(edad) if edad else ""
    element_filter = next((item for item in all_elements if item.lower() == str(elemento or "").lower()), "")
    pathology_filter = next((item for item in all_pathologies if item.lower() == str(patologia or "").lower()), "")

    records = []
    for record in all_records:
        if site_filter and record["sitio"].lower() != site_filter:
            continue
        if sex_filter and record["sexo"] != sex_filter:
            continue
        if age_filter and record["edad"] != age_filter:
            continue
        if element_filter and element_filter not in record["chemistry"]:
            continue
        if pathology_filter and pathology_filter not in record["pathologies"]:
            continue
        records.append(record)

    total = len(records)
    with_chemistry = sum(bool(record["chemistry"]) for record in records)
    with_pathology = sum(bool(record["pathologies"]) for record in records)
    with_images = sum(record["image_count"] > 0 for record in records)
    with_dating = sum(record["has_dating"] for record in records)
    sites_in_selection = len({record["sitio"] for record in records})

    site_portals = []
    for site_name in sorted({record["sitio"] for record in all_records}):
        site_records = [record for record in all_records if record["sitio"] == site_name]
        representative = next((record for record in site_records if record.get("site_coordinates")), None)
        cultures = Counter(record["cultura"] for record in site_records if record["cultura"] != "Sin dato")
        site_portals.append({
            "sitio": site_name,
            "individuos": len(site_records),
            "con_quimica": sum(bool(record["chemistry"]) for record in site_records),
            "con_patologia": sum(bool(record["pathologies"]) for record in site_records),
            "con_imagenes": sum(record["image_count"] > 0 for record in site_records),
            "con_datacion": sum(record["has_dating"] for record in site_records),
            "culturas": [label for label, _ in cultures.most_common(3)],
            "view": representative.get("site_view") if representative else "",
            "coordinates": representative.get("site_coordinates") if representative else None,
        })

    case_rows = []
    for record in sorted(records, key=lambda item: (item["sitio"], item["label"].lower()))[:100]:
        case_rows.append({
            "id": record["id"],
            "label": record["label"],
            "sitio": record["sitio"],
            "sexo": record["sexo"],
            "edad": record["edad"],
            "cultura": record["cultura"],
            "conservacion": record["conservacion"],
            "elementos": sorted(record["chemistry"].keys()),
            "patologias": record["pathologies"],
            "imagenes": record["image_count"],
            "datacion": record["has_dating"],
        })

    return {
        "version": "0.8.0",
        "applied_filters": {
            "sitio": sitio or "",
            "sexo": sexo or "",
            "edad": edad or "",
            "elemento": element_filter,
            "patologia": pathology_filter,
        },
        "filter_options": {
            "sitios": sorted({record["sitio"] for record in all_records}),
            "sexos": sorted({record["sexo"] for record in all_records if record["sexo"]}),
            "edades": sorted({record["edad"] for record in all_records if record["edad"]}),
            "elementos": all_elements,
            "patologias": all_pathologies,
        },
        "kpis": {
            "individuos": total,
            "sitios": sites_in_selection,
            "con_quimica": with_chemistry,
            "con_patologia": with_pathology,
            "con_imagenes": with_images,
            "con_datacion": with_dating,
            "cobertura_quimica_pct": round((with_chemistry / total) * 100, 1) if total else 0,
        },
        "distributions": {
            "sitio": _distribution(records, "sitio"),
            "sexo": _distribution(records, "sexo"),
            "edad": _distribution(records, "edad"),
            "cultura": _distribution(records, "cultura")[:8],
            "conservacion": _distribution(records, "conservacion")[:8],
        },
        "chemical_coverage": _chemical_coverage(records),
        "chemical_summary": _chemical_summary(records, element_filter) if element_filter else [],
        "pathology_distribution": _pathology_distribution(records),
        "availability": [
            {"label": "Referencia", "value": total, "total": total},
            {"label": "Química", "value": with_chemistry, "total": total},
            {"label": "Paleopatología", "value": with_pathology, "total": total},
            {"label": "Imágenes", "value": with_images, "total": total},
            {"label": "Datación", "value": with_dating, "total": total},
        ],
        "site_portals": site_portals,
        "cases": case_rows,
        "warnings": [
            "Zn corresponde a un conjunto simulado de solo tres casos de Morro 1.",
            "Las comparaciones químicas deben controlar la matriz de análisis (cabello/costilla).",
        ],
    }
