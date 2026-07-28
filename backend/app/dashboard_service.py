from __future__ import annotations

import json
import math
from collections import Counter, defaultdict
from pathlib import Path
from statistics import mean, median
from typing import Any, Optional

from .config import (
    AZAPA_ANALYSIS_PATHS,
    AZAPA_DATACIONES_PATH,
    AZAPA_REFERENCE_PATH,
    MORRO1_ANALYSIS_PATHS,
    MORRO1_REFERENCE_PATH,
    PALEOPATOLOGIA_PATH,
)
from .database import IMAGES_DIR


IMAGE_EXTENSIONS = {".gif", ".jpeg", ".jpg", ".png", ".tif", ".tiff", ".webp"}
NEGATIVE_VALUES = {
    "", "0", "absente", "ausente", "false", "falso", "n/a", "negativo",
    "no", "none", "null",
}
MISSING_MEASUREMENTS = {"", "-", "na", "nan", "n/d", "n.d.", "nd", "none", "null"}
SITE_COORDINATES = {
    "Morro 1": {"lat": -18.508333, "lng": -70.266667},
    "Azapa 140": {"lat": -18.528267, "lng": -70.179785},
}


def _load_cases(path: Path) -> list[dict[str, Any]]:
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


def _chemistry_by_case(paths: list[Path]) -> dict[str, dict[str, list[float]]]:
    chemistry: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    for path in paths:
        for case in _load_cases(path):
            case_id = str(case.get("id") or "").strip().lower()
            if not case_id:
                continue
            elements = (case.get("analisis_quimicos") or {}).get("elementos") or {}
            if not isinstance(elements, dict):
                continue
            for element, raw_value in elements.items():
                number = _numeric_measurement(raw_value)
                if element and number is not None:
                    chemistry[case_id][str(element)].append(number)
    return chemistry


def _pathologies_by_case() -> dict[str, list[str]]:
    output: dict[str, list[str]] = {}
    for case in _load_cases(PALEOPATOLOGIA_PATH):
        case_id = str(case.get("id") or "").strip().lower()
        positives = []
        for pathology, value in ((case.get("paleopatologia") or {}).items()):
            if value is None:
                continue
            if isinstance(value, str) and value.strip().lower() in NEGATIVE_VALUES:
                continue
            positives.append(str(pathology))
        if case_id:
            output[case_id] = sorted(positives)
    return output


def _dated_azapa_cases() -> set[str]:
    dated = set()
    for case in _load_cases(AZAPA_DATACIONES_PATH):
        case_id = str(case.get("id") or "").strip().lower()
        dating = case.get("datacion_radiocarbono") or {}
        calibrated = dating.get("rango_calibrado_AD") or {}
        has_value = any([
            dating.get("muestra"),
            dating.get("fechado_1sigma_AD"),
            dating.get("interceptos_AD"),
            calibrated.get("min") if isinstance(calibrated, dict) else None,
            calibrated.get("max") if isinstance(calibrated, dict) else None,
        ])
        if case_id and has_value:
            dated.add(case_id)
    return dated


def _image_counts(case_ids: set[str]) -> Counter:
    counts: Counter = Counter()
    lookup = {case_id.lower(): case_id.lower() for case_id in case_ids}
    if not IMAGES_DIR.exists():
        return counts
    for file_path in IMAGES_DIR.rglob("*"):
        if not file_path.is_file() or file_path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        for parent in reversed(file_path.parts[:-1]):
            normalized = parent.lower()
            if normalized in lookup:
                counts[lookup[normalized]] += 1
                break
    return counts


def _build_records() -> list[dict[str, Any]]:
    morro_chemistry = _chemistry_by_case(list(MORRO1_ANALYSIS_PATHS))
    azapa_chemistry = _chemistry_by_case(list(AZAPA_ANALYSIS_PATHS))
    pathologies = _pathologies_by_case()
    dated_azapa = _dated_azapa_cases()
    raw_records: list[dict[str, Any]] = []

    for site, reference_path, chemistry in [
        ("Morro 1", MORRO1_REFERENCE_PATH, morro_chemistry),
        ("Azapa 140", AZAPA_REFERENCE_PATH, azapa_chemistry),
    ]:
        for case in _load_cases(reference_path):
            case_id = str(case.get("id") or "").strip()
            if not case_id:
                continue
            key = case_id.lower()
            individual = case.get("individuo") or {}
            raw_records.append({
                "id": case_id,
                "label": _display_value(case.get("tumba") or case.get("referencia"), case_id),
                "sitio": site,
                "sexo": _canonical_sex(individual.get("sexo")),
                "edad": _canonical_age(individual.get("grupo_edad") or individual.get("edad")),
                "cultura": _display_value(case.get("cultura")),
                "conservacion": _display_value(individual.get("conservacion")),
                "chemistry": chemistry.get(key, {}),
                "pathologies": pathologies.get(key, []),
                "has_dating": key in dated_azapa,
            })

    counts = _image_counts({record["id"] for record in raw_records})
    for record in raw_records:
        record["image_count"] = counts[record["id"].lower()]
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
    for site_name in ["Morro 1", "Azapa 140"]:
        site_records = [record for record in all_records if record["sitio"] == site_name]
        cultures = Counter(record["cultura"] for record in site_records if record["cultura"] != "Sin dato")
        site_portals.append({
            "sitio": site_name,
            "individuos": len(site_records),
            "con_quimica": sum(bool(record["chemistry"]) for record in site_records),
            "con_patologia": sum(bool(record["pathologies"]) for record in site_records),
            "con_imagenes": sum(record["image_count"] > 0 for record in site_records),
            "con_datacion": sum(record["has_dating"] for record in site_records),
            "culturas": [label for label, _ in cultures.most_common(3)],
            "view": "visualizacion" if site_name == "Morro 1" else "clusters",
            "coordinates": SITE_COORDINATES[site_name],
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
            "sitios": ["Morro 1", "Azapa 140"],
            "sexos": ["femenino", "masculino", "indeterminado"],
            "edades": ["adulto", "subadulto", "indeterminado"],
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
