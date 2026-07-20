from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

import numpy as np

from .database import rows_to_dicts

from .config import (
    AZAPA_ANALYSIS_PATHS,
    AZAPA_REFERENCE_PATH,
    MORRO1_ANALYSIS_PATHS,
    MORRO1_REFERENCE_PATH,
    PALEOPATOLOGIA_PATH,
    CATALOGO_MOMIAS_PATH,
    MORRO1_PALEOPATOLOGIA_PATHS,
)

BASE_DIR = Path(__file__).resolve().parents[1]
# PALEOPATOLOGIA_PATH = BASE_DIR / "data" / "morro1_paleopatologia.json"
REFERENCE_PATH = BASE_DIR / "data" / "morro1_referencia.json"

# Archivos de análisis de Morro1 (solo uno por ahora)
MORRO1_ANALISIS_PATH = BASE_DIR / "data" / "morro1_analisis_quimicos_Mn_costilla.json"
# NUEVO ARCHIVIO PARA ANALISIS
MORRO1_ANALISIS_PATH_2 = BASE_DIR / "data" / "morro1_analisis_quimicos_B_As_Li_costilla.json",


def _load_morro1_analysis_metadata() -> dict[str, dict[str, str]]:
    """Carga el JSON de análisis de Morro1 y devuelve metadatos por id de caso."""
    if not MORRO1_ANALISIS_PATH.exists():
        return {}
    try:
        with MORRO1_ANALISIS_PATH.open("r", encoding="utf-8") as fh:
            payload = json.load(fh)
        cases = []
        if isinstance(payload, dict):
            for value in payload.values():
                if isinstance(value, dict) and isinstance(value.get("casos"), list):
                    cases = value["casos"]
                    break
        metadata = {}
        for case in cases:
            if not isinstance(case, dict):
                continue
            case_id = str(case.get("id") or "").strip()
            tumba = str(case.get("tumba") or "").strip()
            if not case_id:
                continue
            analisis = case.get("analisis_quimicos") or {}
            if not isinstance(analisis, dict):
                continue
            ref = analisis.get("referencia_datos")
            mat = analisis.get("matriz")
            if ref or mat:
                metadata[case_id] = {}
                if ref:
                    metadata[case_id]["referencia_datos"] = ref
                if mat:
                    metadata[case_id]["matriz"] = mat
                if tumba and tumba != case_id:
                    metadata[tumba] = metadata[case_id].copy()
        return metadata
    except Exception:
        return {}

def _load_azapa_analysis_metadata(analysis_paths: Optional[list[Path]] = None) -> dict[str, dict[str, str]]:
    """Carga todos los JSON de análisis de AZAPA y devuelve metadatos por id de caso."""
    if not analysis_paths:
        analysis_paths = AZAPA_ANALYSIS_PATHS
    metadata = {}
    for path in analysis_paths:
        for case in _load_azapa_analysis_cases(path):
            case_id = str(case.get("id") or "").strip()
            if not case_id:
                continue
            analisis = case.get("analisis_quimicos") or {}
            if not isinstance(analisis, dict):
                continue
            ref = analisis.get("referencia_datos")
            mat = analisis.get("matriz")
            if ref or mat:
                if case_id not in metadata:
                    metadata[case_id] = {}
                if ref:
                    if "referencia_datos" in metadata[case_id]:
                        metadata[case_id]["referencia_datos"] += " | " + ref
                    else:
                        metadata[case_id]["referencia_datos"] = ref
                if mat:
                    if "matriz" in metadata[case_id]:
                        metadata[case_id]["matriz"] += " | " + mat
                    else:
                        metadata[case_id]["matriz"] = mat
    return metadata


def _normalize_filter_value(value: Optional[str]) -> str:
    if value is None:
        return ""
    return str(value).strip().lower().replace(" ", "").replace("_", "").replace("-", "")


def _load_paleopatologia_cases() -> list[dict[str, Any]]:
    all_cases = []
    for path in MORRO1_PALEOPATOLOGIA_PATHS:
        if not path.exists():
            continue
        try:
            with path.open("r", encoding="utf-8") as fh:
                payload = json.load(fh)
        except Exception:
            continue
        # Búsqueda genérica de 'casos': directo, bajo "casos", o anidado un
        # nivel más adentro bajo CUALQUIER clave envolvente (no solo
        # "morro1_paleopatologia" literal). Así funciona igual que el
        # loader de análisis químicos, sin importar cómo se llame la
        # clave de nivel superior de un JSON subido desde el frontend.
        if isinstance(payload, list):
            all_cases.extend([caso for caso in payload if isinstance(caso, dict)])
            continue
        if not isinstance(payload, dict):
            continue
        if isinstance(payload.get("casos"), list):
            all_cases.extend([caso for caso in payload["casos"] if isinstance(caso, dict)])
            continue
        for value in payload.values():
            if isinstance(value, dict) and isinstance(value.get("casos"), list):
                all_cases.extend([caso for caso in value["casos"] if isinstance(caso, dict)])
                break
    return all_cases


def _load_reference_map() -> dict[str, str]:
    """Carga `morro1_referencia.json` y devuelve un mapa id -> tumba.
    """
    if not REFERENCE_PATH.exists():
        return {}
    try:
        with REFERENCE_PATH.open("r", encoding="utf-8") as fh:
            payload = json.load(fh)
            # The JSON structure may vary; try common keys
            root = None
            if isinstance(payload, dict):
                # either { "morro_1": { "casos": [...] } } or { "casos": [...] }
                if "morro_1" in payload and isinstance(payload["morro_1"], dict):
                    root = payload["morro_1"].get("casos", [])
                elif "casos" in payload:
                    root = payload.get("casos", [])
                else:
                    root = []
            if not isinstance(root, list):
                return {}
            m = {}
            for case in root:
                if not isinstance(case, dict):
                    continue
                cid = case.get("id")
                tumba = case.get("tumba") or case.get("referencia")
                if cid and tumba:
                    m[str(cid)] = str(tumba)
            return m
    except Exception:
        return {}


def _pathology_present(case: dict[str, Any], patologia_name: str) -> bool:
    paleo = case.get("paleopatologia", {}) or {}
    if not isinstance(paleo, dict):
        return False
    value = paleo.get(patologia_name)
    if value is None:
        return False
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"", "none", "null", "no", "negativo", "absente", "ausente", "false", "falso", "0"}:
            return False
    return True


def _load_azapa_reference_cases(reference_path: Optional[Path] = None) -> list[dict[str, Any]]:
    path = reference_path or BASE_DIR / "data" / "azapa140_referencia.json"
    if not path.exists():
        return []
    try:
        with path.open("r", encoding="utf-8") as fh:
            payload = json.load(fh)
        if isinstance(payload, dict):
            if isinstance(payload.get("azapa_140"), dict) and isinstance(payload["azapa_140"].get("casos"), list):
                return [case for case in payload["azapa_140"]["casos"] if isinstance(case, dict)]
            if isinstance(payload.get("casos"), list):
                return [case for case in payload["casos"] if isinstance(case, dict)]
    except Exception:
        return []
    return []


def _normalize_azapa_sexo_filter(value: Optional[str]) -> str:
    if value is None:
        return ""
    return _normalize_filter_value(str(value))


def _filter_azapa_cases_by_sexo(cases: list[dict[str, Any]], sexo: Optional[str] = None) -> list[dict[str, Any]]:
    normalized_sexo = _normalize_azapa_sexo_filter(sexo)
    if not normalized_sexo:
        return cases
    filtered: list[dict[str, Any]] = []
    for case in cases:
        if not isinstance(case, dict):
            continue
        individuo_data = case.get("individuo") or {}
        if not isinstance(individuo_data, dict):
            continue
        case_sexo = str(individuo_data.get("sexo") or "").strip().lower()
        if _normalize_azapa_sexo_filter(case_sexo) == normalized_sexo:
            filtered.append(case)
    return filtered


def _normalize_azapa_edad_filter(value: Optional[str]) -> str:
    if value is None:
        return ""
    return _normalize_filter_value(str(value))


def _filter_azapa_cases_by_edad(cases: list[dict[str, Any]], edad: Optional[str] = None) -> list[dict[str, Any]]:
    normalized_edad = _normalize_azapa_edad_filter(edad)
    if not normalized_edad:
        return cases
    filtered: list[dict[str, Any]] = []
    for case in cases:
        if not isinstance(case, dict):
            continue
        individuo_data = case.get("individuo") or {}
        if not isinstance(individuo_data, dict):
            continue
        case_edad = str(individuo_data.get("grupo_edad") or individuo_data.get("edad") or "").strip()
        if _normalize_azapa_edad_filter(case_edad) == normalized_edad:
            filtered.append(case)
    return filtered


def get_azapa_reference_sex_options(reference_path: Optional[Path] = None) -> list[str]:
    sex_options: list[str] = []
    seen: set[str] = set()
    for case in _load_azapa_reference_cases(reference_path):
        individuo_data = case.get("individuo") or {}
        if not isinstance(individuo_data, dict):
            continue
        value = str(individuo_data.get("sexo") or "").strip()
        normalized = _normalize_azapa_sexo_filter(value)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        sex_options.append(value)
    return sorted(sex_options, key=lambda item: str(item).lower())


def _normalize_azapa_matriz_filter(value: Optional[str]) -> str:
    if value is None:
        return ""
    return _normalize_filter_value(str(value))


def _filter_azapa_analysis_cases_by_matriz(cases: list[dict[str, Any]], matriz: Optional[str] = None) -> list[dict[str, Any]]:
    normalized_matriz = _normalize_azapa_matriz_filter(matriz)
    if not normalized_matriz:
        return cases
    filtered: list[dict[str, Any]] = []
    for case in cases:
        if not isinstance(case, dict):
            continue
        analisis = case.get("analisis_quimicos") or {}
        if not isinstance(analisis, dict):
            continue
        case_matriz = str(analisis.get("matriz") or "").strip()
        if _normalize_azapa_matriz_filter(case_matriz) == normalized_matriz:
            filtered.append(case)
    return filtered


def get_azapa_analysis_matriz_options(analysis_paths: Optional[list[Path]] = None) -> list[str]:
    if not analysis_paths:
        analysis_paths = AZAPA_ANALYSIS_PATHS
    options: list[str] = []
    seen: set[str] = set()
    for path in analysis_paths:
        for case in _load_azapa_analysis_cases(path):
            analisis = case.get("analisis_quimicos") or {}
            if not isinstance(analisis, dict):
                continue
            value = str(analisis.get("matriz") or "").strip()
            normalized = _normalize_azapa_matriz_filter(value)
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            options.append(value)
    return sorted(options, key=lambda item: str(item).lower())


def _load_azapa_analysis_cases(analysis_path: Optional[Path] = None) -> list[dict[str, Any]]:
    if not analysis_path or not analysis_path.exists():
        return []
    try:
        with analysis_path.open("r", encoding="utf-8") as fh:
            payload = json.load(fh)
    except Exception:
        return []
    if isinstance(payload, dict):
        for value in payload.values():
            if isinstance(value, dict) and isinstance(value.get("casos"), list):
                return [case for case in value["casos"] if isinstance(case, dict)]
    return []


def _normalize_azapa_element_filter(value: Optional[str]) -> str:
    if value is None:
        return ""
    return str(value).strip().lower().replace(" ", "").replace("_", "").replace("-", "")


def _azapa_measurement_has_value(measurement: Any) -> bool:
    if measurement is None:
        return False
    if isinstance(measurement, dict):
        raw_value = measurement.get("valor")
        if raw_value is None:
            return False
        return _azapa_value_is_present(raw_value)
    return _azapa_value_is_present(measurement)


def _azapa_value_is_present(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, (int, float)):
        return not (isinstance(value, float) and value != value)
    if isinstance(value, str):
        normalized = value.strip().lower()
        if not normalized:
            return False
        if normalized in {"nd", "n.d.", "n/d", "none", "null", "na", "nan", "no data", "sin dato", "sin datos"}:
            return False
        return True
    return True


def get_azapa_available_elements(analysis_paths: Optional[list[Path]] = None) -> list[str]:
    if not analysis_paths:
        analysis_paths = AZAPA_ANALYSIS_PATHS

    available_elements: list[str] = []
    for path in analysis_paths:
        for case in _load_azapa_analysis_cases(path):
            case_id = str(case.get("id") or "").strip()
            if not case_id:
                continue
            analisis = case.get("analisis_quimicos") or {}
            elementos = analisis.get("elementos") or {}
            if not isinstance(elementos, dict):
                continue
            for elemento_name in elementos.keys():
                if not elemento_name:
                    continue
                name = str(elemento_name)
                if name not in available_elements:
                    available_elements.append(name)
    return available_elements


def build_azapa_table_rows(
    reference_path: Optional[Path] = None,
    analysis_paths: Optional[list[Path]] = None,
    sexo: Optional[str] = None,
    edad: Optional[str] = None,
    matriz: Optional[str] = None,
    elemento: Optional[str] = None,
) -> list[dict[str, Any]]:
    """Construye filas de tabla independientes para AZAPA basadas en los JSON de análisis y referencia."""
    if not analysis_paths:
        analysis_paths = AZAPA_ANALYSIS_PATHS

    cases = _filter_azapa_cases_by_edad(
        _filter_azapa_cases_by_sexo(_load_azapa_reference_cases(reference_path), sexo),
        edad,
    )
    case_lookup = {str(case.get("id") or "").strip(): case for case in cases if isinstance(case, dict) and str(case.get("id") or "").strip()}

    rows: list[dict[str, Any]] = []
    for path in analysis_paths:
        for analysis_case in _filter_azapa_analysis_cases_by_matriz(_load_azapa_analysis_cases(path), matriz):
            if not isinstance(analysis_case, dict):
                continue
            case_id = str(analysis_case.get("id") or "").strip()
            if not case_id:
                continue
            reference_case = case_lookup.get(case_id)
            if not isinstance(reference_case, dict):
                continue
            individuo_data = reference_case.get("individuo") or {}
            if not isinstance(individuo_data, dict):
                individuo_data = {}
            analisis = analysis_case.get("analisis_quimicos") or {}
            if not isinstance(analisis, dict):
                continue
            matriz_value = str(analisis.get("matriz") or "").strip()
            elementos = analisis.get("elementos") or {}
            if not isinstance(elementos, dict):
                continue
            for nombre_elemento, elemento_data in elementos.items():
                if not nombre_elemento:
                    continue
                element_name = str(nombre_elemento)
                if elemento and _normalize_azapa_element_filter(element_name) != _normalize_azapa_element_filter(elemento):
                    continue
                if isinstance(elemento_data, dict):
                    value = elemento_data.get("valor")
                    unit = elemento_data.get("unidad") or "ppm"
                else:
                    value = elemento_data
                    unit = "ppm"
                if not _azapa_measurement_has_value(elemento_data if isinstance(elemento_data, dict) else value):
                    continue
                rows.append({
                    "id_caso": case_id,
                    "caso": str(reference_case.get("tumba") or reference_case.get("referencia") or case_id),
                    "sexo": str(individuo_data.get("sexo") or "").strip() or "",
                    "edad": str(individuo_data.get("grupo_edad") or individuo_data.get("edad") or "").strip() or "",
                    "elemento": element_name,
                    "concentracion": value,
                    "unidad": unit,
                    "matriz": matriz_value,
                    "cultura": str(reference_case.get("cultura") or "").strip() or "",
                })
    return rows


def build_azapa_pca(
    elements: list[str],
    sexo: Optional[str] = None,
    edad: Optional[str] = None,
    matriz: Optional[str] = None,
) -> dict[str, Any]:
    """Calcula PC1/PC2 para casos de AZAPA con todos los elementos pedidos.

    Las concentraciones se estandarizan con z-score para que elementos con
    escalas distintas aporten de forma comparable. Si hay mediciones repetidas
    para un caso/elemento se usa su promedio.
    """
    selected: list[str] = []
    available_lookup = {
        _normalize_filter_value(name): name
        for name in get_azapa_available_elements(AZAPA_ANALYSIS_PATHS)
    }
    for raw_element in elements:
        normalized = _normalize_filter_value(raw_element)
        if normalized and normalized not in {
            _normalize_filter_value(item) for item in selected
        }:
            if normalized not in available_lookup:
                raise ValueError(f"Elemento no disponible: {raw_element}")
            selected.append(available_lookup[normalized])

    if len(selected) < 3:
        raise ValueError("Selecciona al menos tres elementos para calcular el PCA")

    rows = build_azapa_table_rows(sexo=sexo, edad=edad, matriz=matriz)
    values_by_case: dict[str, dict[str, list[float]]] = {}
    case_metadata: dict[str, dict[str, str]] = {}
    selected_set = set(selected)
    for row in rows:
        element = row.get("elemento")
        if element not in selected_set:
            continue
        try:
            value = float(row.get("concentracion"))
        except (TypeError, ValueError):
            continue
        if not np.isfinite(value):
            continue
        case_id = str(row.get("id_caso") or "").strip()
        if not case_id:
            continue
        values_by_case.setdefault(case_id, {}).setdefault(element, []).append(value)
        case_metadata[case_id] = {
            "caso": str(row.get("caso") or case_id),
            "sexo": str(row.get("sexo") or ""),
            "edad": str(row.get("edad") or ""),
        }

    complete_cases = [
        case_id
        for case_id, measurements in values_by_case.items()
        if all(measurements.get(element) for element in selected)
    ]
    complete_cases.sort(key=lambda case_id: case_metadata[case_id]["caso"].lower())
    if len(complete_cases) < 3:
        raise ValueError(
            "Se necesitan al menos tres casos con mediciones completas para los elementos seleccionados"
        )

    matrix = np.asarray([
        [float(np.mean(values_by_case[case_id][element])) for element in selected]
        for case_id in complete_cases
    ], dtype=float)
    means = matrix.mean(axis=0)
    standard_deviations = matrix.std(axis=0)
    constant_elements = [
        selected[index]
        for index, value in enumerate(standard_deviations)
        if np.isclose(value, 0.0)
    ]
    if constant_elements:
        raise ValueError(
            "No se puede calcular el PCA: no hay variacion en " + ", ".join(constant_elements)
        )

    standardized = (matrix - means) / standard_deviations
    left, singular_values, components = np.linalg.svd(standardized, full_matrices=False)
    scores = left * singular_values
    variances = (singular_values ** 2) / max(len(complete_cases) - 1, 1)
    total_variance = float(variances.sum())
    explained = variances / total_variance if total_variance else np.zeros_like(variances)

    points = []
    for index, case_id in enumerate(complete_cases):
        meta = case_metadata[case_id]
        points.append({
            "id": case_id,
            "id_individuo": case_id,
            "label": meta["caso"],
            "caso": meta["caso"],
            "type": "individuo",
            "sexo": meta["sexo"],
            "edad": meta["edad"],
            "pc1": float(scores[index, 0]),
            "pc2": float(scores[index, 1]),
            "mediciones": {
                element: {"valor": float(matrix[index, element_index])}
                for element_index, element in enumerate(selected)
            },
        })

    loadings = [
        {
            "elemento": element,
            "pc1": float(components[0, index]),
            "pc2": float(components[1, index]),
        }
        for index, element in enumerate(selected)
    ]
    warnings = []
    if len(complete_cases) < 10:
        warnings.append(
            "La muestra tiene menos de 10 casos completos; interpreta el patrón con cautela."
        )

    return {
        "elements": selected,
        "points": points,
        "loadings": loadings,
        "explained_variance": {
            "pc1": float(explained[0]),
            "pc2": float(explained[1]),
        },
        "summary": {
            "complete_cases": len(complete_cases),
            "incomplete_cases": len(values_by_case) - len(complete_cases),
            "standardization": "z-score",
            "duplicate_measurements": "mean",
        },
        "warnings": warnings,
    }


# def build_azapa_element_graph(
#     elemento: Optional[str] = None,
#     reference_path: Optional[Path] = None,
#     analysis_paths: Optional[list[Path]] = None,
#     sexo: Optional[str] = None,
#     edad: Optional[str] = None,
#     matriz: Optional[str] = None,
# ) -> dict[str, Any]:
#     """Construye un grafo de AZAPA filtrado por elemento químico.

#     - Ninguna / vacío: devuelve la vista de referencia de AZAPA sin nodo central.
#     - As / B / Li: muestra las tumbas vinculadas a ese elemento.
#     - Red completa: muestra todos los elementos disponibles y sus conexiones.
#     """
#     if not analysis_paths:
#         analysis_paths = [
#             BASE_DIR / "data" / "azapa140_analisis_quimicos_As_cabello.json",
#             BASE_DIR / "data" / "azapa140_analisis_quimicos_As_B_Li_costilla.json",
#         ]

#     normalized_element = _normalize_azapa_element_filter(elemento)
#     if normalized_element in {"", "ninguna", "none", "null", "no"}:
#         return build_azapa_reference_graph(reference_path=reference_path, sexo=sexo, edad=edad, matriz=matriz)

#     cases = _filter_azapa_cases_by_edad(
#         _filter_azapa_cases_by_sexo(_load_azapa_reference_cases(reference_path), sexo),
#         edad,
#     )
#     nodes: list[dict[str, Any]] = []
#     edges: list[dict[str, Any]] = []
#     seen_nodes: set[str] = set()

#     is_red_completa = normalized_element == "redcompleta"

#     def add_node(node: dict[str, Any]) -> None:
#         node_id = node["id"]
#         if node_id in seen_nodes:
#             return
#         seen_nodes.add(node_id)
#         nodes.append(node)

#     analysis_map: dict[str, dict[str, dict[str, Any]]] = {}
#     available_elements: list[str] = []
#     for path in analysis_paths:
#         for case in _filter_azapa_analysis_cases_by_matriz(_load_azapa_analysis_cases(path), matriz):
#             case_id = str(case.get("id") or "").strip()
#             if not case_id:
#                 continue
#             analisis = case.get("analisis_quimicos") or {}
#             elementos = analisis.get("elementos") or {}
#             if not isinstance(elementos, dict):
#                 continue
#             case_measurements = analysis_map.setdefault(case_id, {})
#             for elemento_name, elemento_data in elementos.items():
#                 if not elemento_name:
#                     continue
#                 name = str(elemento_name)
#                 if name not in available_elements:
#                     available_elements.append(name)
#                 if isinstance(elemento_data, dict):
#                     value = elemento_data.get("valor")
#                     unit = elemento_data.get("unidad") or "ppm"
#                 else:
#                     value = elemento_data
#                     unit = "ppm"
#                 if not _azapa_measurement_has_value(elemento_data if isinstance(elemento_data, dict) else value):
#                     continue
#                 case_measurements[name] = {
#                     "valor": value,
#                     "unidad": unit,
#                 }

#     if is_red_completa:
#         selected_elements = available_elements
#     else:
#         selected_elements = [str(elemento).strip()]

#     for idx, case in enumerate(cases, start=1):
#         if not isinstance(case, dict):
#             continue
#         case_id = str(case.get("id") or "").strip() or f"azapa_case_{idx}"
#         tumba = case.get("tumba") or case.get("referencia") or case_id
#         individuo_data = case.get("individuo") or {}
#         if not isinstance(individuo_data, dict):
#             individuo_data = {}

#         measurements = analysis_map.get(case_id, {})
#         valid_edges_for_case: list[dict[str, Any]] = []
#         for elemento_name in selected_elements:
#             if elemento_name not in measurements:
#                 continue
#             element_id = f"elemento:{elemento_name}"
#             add_node({
#                 "id": element_id,
#                 "label": elemento_name,
#                 "type": "elemento",
#                 "elemento": elemento_name,
#             })
#             measure = measurements[elemento_name]
#             valid_edges_for_case.append({
#                 "source": case_id,
#                 "target": element_id,
#                 "label": "mide",
#                 "elemento": elemento_name,
#                 "concentracion": measure.get("valor"),
#                 "unidad": measure.get("unidad"),
#             })

#         if not valid_edges_for_case:
#             continue

#         add_node({
#             "id": case_id,
#             "tumba": str(tumba),
#             "label": str(tumba),
#             "type": "individuo",
#             "sexo": individuo_data.get("sexo"),
#             "edad": individuo_data.get("grupo_edad") or individuo_data.get("edad"),
#             "cultura": case.get("cultura"),
#             "id_documento": case_id,
#             "numero_cuerpo": str(tumba),
#             "id_individuo": case_id,
#         })
#         edges.extend(valid_edges_for_case)

#     return {
#         "mode": "relational",
#         "nodes": nodes,
#         "edges": edges,
#         "summary": {
#             "individuos": len(cases),
#             "tumbas": len(cases),
#             "elementos": len(selected_elements),
#         },
#     }

def build_azapa_element_graph(
    elemento: Optional[str] = None,
    reference_path: Optional[Path] = None,
    analysis_paths: Optional[list[Path]] = None,
    sexo: Optional[str] = None,
    edad: Optional[str] = None,
    matriz: Optional[str] = None,
) -> dict[str, Any]:
    """Construye un grafo de AZAPA filtrado por elemento químico.

    - Ninguna / vacío: devuelve la vista de referencia de AZAPA sin nodo central.
    - As / B / Li: muestra las tumbas vinculadas a ese elemento.
    - Red completa: muestra todos los elementos disponibles y sus conexiones.
    """
    if not analysis_paths:
        analysis_paths = AZAPA_ANALYSIS_PATHS

    normalized_element = _normalize_azapa_element_filter(elemento)
    if normalized_element in {"", "ninguna", "none", "null", "no"}:
        return build_azapa_reference_graph(reference_path=reference_path, sexo=sexo, edad=edad, matriz=matriz)

    cases = _filter_azapa_cases_by_edad(
        _filter_azapa_cases_by_sexo(_load_azapa_reference_cases(reference_path), sexo),
        edad,
    )
    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []
    seen_nodes: set[str] = set()

    is_red_completa = normalized_element == "redcompleta"

    def add_node(node: dict[str, Any]) -> None:
        node_id = node["id"]
        if node_id in seen_nodes:
            return
        seen_nodes.add(node_id)
        nodes.append(node)

    # Diccionarios para acumular metadatos
    analysis_map: dict[str, dict[str, dict[str, Any]]] = {}  # case_id -> {elemento: {valor, unidad}}
    case_metadata: dict[str, dict[str, str]] = {}             # case_id -> {referencia_datos, matriz}
    element_metadata: dict[str, dict[str, set[str]]] = {}     # elemento -> {referencias: set, matrices: set}

    available_elements: list[str] = []

    # Primer pase: leer todos los archivos de análisis y recolectar datos
    for path in analysis_paths:
        for case in _filter_azapa_analysis_cases_by_matriz(_load_azapa_analysis_cases(path), matriz):
            case_id = str(case.get("id") or "").strip()
            if not case_id:
                continue

            analisis = case.get("analisis_quimicos") or {}
            if not isinstance(analisis, dict):
                continue

            # Guardar metadatos del caso
            ref_data = analisis.get("referencia_datos")
            mat = analisis.get("matriz")
            if ref_data or mat:
                case_metadata.setdefault(case_id, {})
                if ref_data:
                    case_metadata[case_id]["referencia_datos"] = ref_data
                if mat:
                    case_metadata[case_id]["matriz"] = mat

            elementos = analisis.get("elementos") or {}
            if not isinstance(elementos, dict):
                continue

            case_measurements = analysis_map.setdefault(case_id, {})
            for elemento_name, elemento_data in elementos.items():
                if not elemento_name:
                    continue
                name = str(elemento_name)
                if name not in available_elements:
                    available_elements.append(name)

                # Inicializar metadatos del elemento
                if name not in element_metadata:
                    element_metadata[name] = {"referencias": set(), "matrices": set()}
                if ref_data:
                    element_metadata[name]["referencias"].add(ref_data)
                if mat:
                    element_metadata[name]["matrices"].add(mat)

                if isinstance(elemento_data, dict):
                    value = elemento_data.get("valor")
                    unit = elemento_data.get("unidad") or "ppm"
                else:
                    value = elemento_data
                    unit = "ppm"

                if not _azapa_measurement_has_value(elemento_data if isinstance(elemento_data, dict) else value):
                    continue

                case_measurements[name] = {
                    "valor": value,
                    "unidad": unit,
                }

    if is_red_completa:
        selected_elements = available_elements
    else:
        selected_elements = [str(elemento).strip()]

    # Segundo pase: construir nodos y aristas
    for idx, case in enumerate(cases, start=1):
        if not isinstance(case, dict):
            continue
        case_id = str(case.get("id") or "").strip() or f"azapa_case_{idx}"
        tumba = case.get("tumba") or case.get("referencia") or case_id
        individuo_data = case.get("individuo") or {}
        if not isinstance(individuo_data, dict):
            individuo_data = {}

        measurements = analysis_map.get(case_id, {})
        meta = case_metadata.get(case_id, {})

        valid_edges_for_case: list[dict[str, Any]] = []
        for elemento_name in selected_elements:
            if elemento_name not in measurements:
                continue

            # Obtener o crear nodo elemento con metadatos
            element_id = f"elemento:{elemento_name}"
            if element_id not in seen_nodes:
                meta_elem = element_metadata.get(elemento_name, {})
                refs = " | ".join(sorted(meta_elem.get("referencias", [])))
                mats = " | ".join(sorted(meta_elem.get("matrices", [])))
                add_node({
                    "id": element_id,
                    "label": elemento_name,
                    "type": "elemento",
                    "elemento": elemento_name,
                    "referencia_datos": refs or None,
                    "matriz": mats or None,
                })

            measure = measurements[elemento_name]
            valid_edges_for_case.append({
                "source": case_id,
                "target": element_id,
                "label": "mide",
                "elemento": elemento_name,
                "concentracion": measure.get("valor"),
                "unidad": measure.get("unidad"),
                "referencia_datos": meta.get("referencia_datos"),
                "matriz": meta.get("matriz"),
            })

        if not valid_edges_for_case:
            continue

        meta = case_metadata.get(case_id, {})
        add_node({
            "id": case_id,
            "tumba": str(tumba),
            "label": str(tumba),
            "type": "individuo",
            "sexo": individuo_data.get("sexo"),
            "edad": individuo_data.get("grupo_edad") or individuo_data.get("edad"),
            "cultura": case.get("cultura"),
            "id_documento": case_id,
            "numero_cuerpo": str(tumba),
            "id_individuo": case_id,
            "referencia_datos": meta.get("referencia_datos"),   # <-- añadir
            "matriz": meta.get("matriz"), 
        })
        edges.extend(valid_edges_for_case)

    return {
        "mode": "relational",
        "nodes": nodes,
        "edges": edges,
        "summary": {
            "individuos": len(cases),
            "tumbas": len(cases),
            "elementos": len(selected_elements),
        },
    }


def build_azapa_reference_graph(reference_path: Optional[Path] = None, sexo: Optional[str] = None, edad: Optional[str] = None, matriz: Optional[str] = None) -> dict[str, Any]:
    """Construye un grafo simple a partir del JSON de referencia de Azapa.

    Usa el campo `tumba` de cada caso como etiqueta del nodo para mostrar los 140 registros.
    """
    cases = _filter_azapa_cases_by_edad(
        _filter_azapa_cases_by_sexo(_load_azapa_reference_cases(reference_path), sexo),
        edad,
    )

      # Cargar metadatos de todos los análisis para enriquecer
    azapa_metadata = _load_azapa_analysis_metadata()  # <-- nuevo

    if matriz:
        normalized_matriz = _normalize_azapa_matriz_filter(matriz)
        allowed_case_ids: set[str] = set()
        for path in AZAPA_ANALYSIS_PATHS:
            for analysis_case in _filter_azapa_analysis_cases_by_matriz(_load_azapa_analysis_cases(path), matriz):
                case_id = str(analysis_case.get("id") or "").strip()
                if case_id:
                    allowed_case_ids.add(case_id)
        filtered_cases: list[dict[str, Any]] = []
        for case in cases:
            if not isinstance(case, dict):
                continue
            case_id = str(case.get("id") or "").strip()
            if not case_id:
                continue
            if normalized_matriz and case_id in allowed_case_ids:
                filtered_cases.append(case)
        cases = filtered_cases
    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []
    seen_nodes: set[str] = set()

    def add_node(node: dict[str, Any]) -> None:
        node_id = node["id"]
        if node_id in seen_nodes:
            return
        seen_nodes.add(node_id)
        nodes.append(node)

    site_id = "azapa:site"
    add_node({
        "id": site_id,
        "label": "AZAPA140",
        "type": "patologia",
        "patologia": "AZAPA",
    })

    for index, case in enumerate(cases, start=1):
        if not isinstance(case, dict):
            continue
        case_id = str(case.get("id") or "").strip() or f"azapa_case_{index}"
        tumba = case.get("tumba") or case.get("referencia") or case_id
        individuo_data = case.get("individuo") or {}
        meta = azapa_metadata.get(case_id, {})
        if not isinstance(individuo_data, dict):
            individuo_data = {}
        add_node({
            "id": case_id,
            "tumba": str(tumba),
            "label": str(tumba),
            "type": "individuo",
            "sexo": individuo_data.get("sexo"),
            "edad": individuo_data.get("grupo_edad") or individuo_data.get("edad"),
            "cultura": case.get("cultura"),
            "id_documento": case_id,
            "numero_cuerpo": str(tumba),
            "id_individuo": case_id,
            "referencia_datos": meta.get("referencia_datos"),   # <-- añadir
            "matriz": meta.get("matriz"),                       # <-- añadir
        })
        edges.append({
            "source": site_id,
            "target": case_id,
            "label": "presenta",
            "tumba": str(tumba),
        })

    return {
        "mode": "relational",
        "nodes": nodes,
        "edges": edges,
        "summary": {
            "individuos": len(cases),
            "tumbas": len(cases),
        },
    }


def filter_individuos_by_patologia(individuos: list[dict[str, Any]], patologia_name: Optional[str] = None) -> list[dict[str, Any]]:
    if not patologia_name:
        return individuos

    matching_aliases: set[str] = set()
    for case in _load_paleopatologia_cases():
        if not _pathology_present(case, patologia_name):
            continue
        for alias in [
            case.get("id"),
            case.get("referencia_normalizada"),
            case.get("referencia"),
            case.get("tumba"),
        ]:
            normalized = _normalize_filter_value(alias)
            if normalized:
                matching_aliases.add(normalized)

    if not matching_aliases:
        return []

    filtered: list[dict[str, Any]] = []
    for individuo in individuos:
        for field in ("id_individuo", "id_documento", "numero_cuerpo"):
            if _normalize_filter_value(individuo.get(field)) in matching_aliases:
                filtered.append(individuo)
                break
    return filtered


def build_relational_graph_from_rows(
    individuos: list[dict[str, Any]],
    mediciones: list[dict[str, Any]],
    imagenes: list[dict[str, Any]],
    elemento: Optional[str] = None,
    edad: Optional[str] = None,
    caso: Optional[str] = None,
    sexo: Optional[str] = None,
    patologia: Optional[str] = None,
    fuente: Optional[str] = None,
) -> dict[str, Any]:
    """Convierte tablas relacionales en un grafo de nodos y aristas."""
    # load reference map id -> tumba for labeling
    reference_map = _load_reference_map()
    morro1_metadata = _load_morro1_analysis_metadata()
    if caso:
        case_value = caso.strip()
        individuos = [
            i for i in individuos
            if i.get("id_documento") == case_value or i.get("id_individuo") == case_value
        ]
        allowed_ids = {i["id_individuo"] for i in individuos}
        mediciones = [m for m in mediciones if m.get("id_individuo") in allowed_ids]
        imagenes = [img for img in imagenes if img.get("id_individuo") in allowed_ids]

    if fuente:
        fuente_norm = str(fuente).strip().lower()
        individuos = [i for i in individuos if str(i.get("fuente") or "").strip().lower() == fuente_norm]
        allowed_ids = {i["id_individuo"] for i in individuos if i.get("id_individuo")}
        mediciones = [m for m in mediciones if str(m.get("fuente") or "").strip().lower() == fuente_norm]
        imagenes = [img for img in imagenes if str(img.get("fuente") or "").strip().lower() == fuente_norm]
        if allowed_ids:
            mediciones = [m for m in mediciones if m.get("id_individuo") in allowed_ids]
            imagenes = [img for img in imagenes if img.get("id_individuo") in allowed_ids]

    # Filtrar por sexo (usa el campo `sexo` de la tabla `individuos`,
    # que al importar Morro1 proviene de `sexo_normalizado`).
    if sexo:
        s_norm = str(sexo).strip().lower()
        individuos = [i for i in individuos if (i.get("sexo") or "").strip().lower() == s_norm]
        allowed_ids = {i["id_individuo"] for i in individuos}
        mediciones = [m for m in mediciones if m.get("id_individuo") in allowed_ids]
        imagenes = [img for img in imagenes if img.get("id_individuo") in allowed_ids]

    # Filtrar por edad
    if edad:
        individuos = [i for i in individuos if i.get("edad") == edad]
        allowed_ids = {i["id_individuo"] for i in individuos}
        mediciones = [m for m in mediciones if m.get("id_individuo") in allowed_ids]
        imagenes = [img for img in imagenes if img.get("id_individuo") in allowed_ids]

    if patologia:
        individuos = filter_individuos_by_patologia(individuos, patologia)
        allowed_ids = {i["id_individuo"] for i in individuos}
        mediciones = [m for m in mediciones if m.get("id_individuo") in allowed_ids]
        imagenes = [img for img in imagenes if img.get("id_individuo") in allowed_ids]

    # En build_relational_graph_from_rows
    filtered_mediciones = [
        m for m in mediciones
        # Si elemento es None, "", "ninguno" o "ninguna", no filtrar
        if not elemento or elemento.lower() in ["ninguna", "ninguno", "all"] or m.get("elemento") == elemento
    ]

    # Solo mantener individuos que tienen mediciones del elemento seleccionado
    # y que tienen valor numérico (no null)
    # Si no hay un elemento específico seleccionado, no deberías filtrar individuos
    if elemento and elemento.lower() not in ["ninguna", "ninguno", "all"]:
        individuos_with_measurements = {
            m.get("id_individuo") for m in filtered_mediciones 
            if m.get("concentracion") is not None
        }
        individuos = [i for i in individuos if i.get("id_individuo") in individuos_with_measurements]
    
    # Actualizar imagenes para solo las de individuos con mediciones
    allowed_ids = {i["id_individuo"] for i in individuos}
    imagenes = [img for img in imagenes if img.get("id_individuo") in allowed_ids]

    individuos_by_id = {i["id_individuo"]: i for i in individuos if i.get("id_individuo")}
    images_by_person: dict[str, list[dict[str, Any]]] = {}
    for image in imagenes:
        person_id = image.get("id_individuo")
        if person_id:
            images_by_person.setdefault(person_id, []).append(image)

    # ---- Recolectar metadatos por elemento (para Morro1) ----
    # Elemento -> {referencias: set, matrices: set}
    element_metadata: dict[str, dict[str, set[str]]] = {}
    for medicion in filtered_mediciones:
        elem = medicion.get("elemento")
        if not elem:
            continue
        if elem not in element_metadata:
            element_metadata[elem] = {"referencias": set(), "matrices": set()}
        # Usar observaciones como referencia_datos; tipo_muestra como matriz
        ref = medicion.get("observaciones")
        mat = medicion.get("tipo_muestra") or medicion.get("metodo")
        if ref:
            element_metadata[elem]["referencias"].add(str(ref))
        if mat:
            element_metadata[elem]["matrices"].add(str(mat))

    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []
    seen_nodes: set[str] = set()

    def add_node(node: dict[str, Any]) -> None:
        node_id = node["id"]
        if node_id in seen_nodes:
            return
        seen_nodes.add(node_id)
        nodes.append(node)

    for individuo in individuos:
        person_id = individuo.get("id_individuo")
        if not person_id:
            continue
        if person_id not in individuos_by_id:
            continue
        # prefer `tumba` from reference map when available; use empty label otherwise
        tumba_val = reference_map.get(person_id)
        meta = morro1_metadata.get(person_id) or morro1_metadata.get(individuo.get("numero_cuerpo")) or {}
        add_node({
            "id": person_id,
            "tumba": tumba_val,
            "label": tumba_val or "",
            "type": "individuo",
            "sexo": individuo.get("sexo"),
            "edad": individuo.get("edad"),
            "estilo_momificacion": individuo.get("estilo_momificacion"),
            "estado": individuo.get("estado"),
            "id_documento": individuo.get("id_documento"),
            "numero_cuerpo": individuo.get("numero_cuerpo"),
            "referencia_datos": meta.get("referencia_datos"),   # <-- añadir
            "matriz": meta.get("matriz"),
        })

    element_ids: set[str] = set()
    for medicion in filtered_mediciones:
        elemento_name = medicion.get("elemento")
        person_id = medicion.get("id_individuo")
        if elemento_name:
            element_id = f"elemento:{elemento_name}"
            if element_id not in element_ids:
                # Obtener metadatos acumulados para este elemento
                meta = element_metadata.get(elemento_name, {})
                refs = " | ".join(sorted(meta.get("referencias", [])))
                mats = " | ".join(sorted(meta.get("matrices", [])))
                add_node({
                    "id": element_id,
                    "label": elemento_name,
                    "type": "elemento",
                    "elemento": elemento_name,
                    "referencia_datos": refs or None,
                    "matriz": mats or None,
                })
                element_ids.add(element_id)
        if person_id and elemento_name:
            # Solo crear arista si hay valor de concentración (no null)
            if medicion.get("concentracion") is not None:
                # Obtener referencia y matriz de esta medición específica
                ref_med = medicion.get("observaciones")
                mat_med = medicion.get("tipo_muestra") or medicion.get("metodo")
                meta = morro1_metadata.get(person_id, {})
                edges.append({
                    "source": person_id,
                    "target": f"elemento:{elemento_name}",
                    "label": "mide",
                    "elemento": elemento_name,
                    "concentracion": medicion.get("concentracion"),
                    "unidad": medicion.get("unidad"),
                    "estado": medicion.get("estado"),
                    "referencia_datos": ref_med,
                    "matriz": mat_med,
                })

    for person_id, person_images in images_by_person.items():
        if not person_id:
            continue
        for image in person_images:
            image_id = image.get("id_imagen") or f"imagen:{person_id}:{len(person_images)}"
            image_url = image.get("url") or image.get("relative_path")
            if image_url and not image_url.startswith("/"):
                image_url = f"/files/imagenes/{image_url}"
            add_node({
                "id": image_id,
                "label": image.get("titulo") or image.get("filename_original") or "Imagen",
                "type": "imagen",
                "url": image_url,
                "id_individuo": person_id,
            })
            edges.append({
                "source": person_id,
                "target": image_id,
                "label": "tiene_imagen",
                "url": image_url,
            })

    return {
        "mode": "relational",
        "nodes": nodes,
        "edges": edges,
        "summary": {
            "individuos": len(individuos),
            "mediciones": len(filtered_mediciones),
            "imagenes": len(imagenes),
        },
    }

def build_relational_graph_from_patologia(
    individuos: list[dict[str, Any]],
    mediciones: list[dict[str, Any]],
    imagenes: list[dict[str, Any]],
    patologia: str,
    edad: Optional[str] = None,
    sexo: Optional[str] = None,
    fuente: Optional[str] = None,
) -> dict[str, Any]:
    """Convierte tablas relacionales en un grafo con patología como nodo central."""
    reference_map = _load_reference_map()
    morro1_metadata = _load_morro1_analysis_metadata()  # <-- nuevo

    if fuente:
        fuente_norm = str(fuente).strip().lower()
        individuos = [i for i in individuos if str(i.get("fuente") or "").strip().lower() == fuente_norm]
        allowed_ids = {i["id_individuo"] for i in individuos if i.get("id_individuo")}
        mediciones = [m for m in mediciones if str(m.get("fuente") or "").strip().lower() == fuente_norm]
        imagenes = [img for img in imagenes if str(img.get("fuente") or "").strip().lower() == fuente_norm]
        if allowed_ids:
            mediciones = [m for m in mediciones if m.get("id_individuo") in allowed_ids]
            imagenes = [img for img in imagenes if img.get("id_individuo") in allowed_ids]
    
    # Filtrar individuos por patología
    individuos = filter_individuos_by_patologia(individuos, patologia)
    allowed_ids = {i["id_individuo"] for i in individuos}
    mediciones = [m for m in mediciones if m.get("id_individuo") in allowed_ids]
    imagenes = [img for img in imagenes if img.get("id_individuo") in allowed_ids]

    # Filtrar por sexo
    if sexo:
        s_norm = str(sexo).strip().lower()
        individuos = [i for i in individuos if (i.get("sexo") or "").strip().lower() == s_norm]
        allowed_ids = {i["id_individuo"] for i in individuos}
        mediciones = [m for m in mediciones if m.get("id_individuo") in allowed_ids]
        imagenes = [img for img in imagenes if img.get("id_individuo") in allowed_ids]

    # Filtrar por edad
    if edad:
        individuos = [i for i in individuos if i.get("edad") == edad]
        allowed_ids = {i["id_individuo"] for i in individuos}
        mediciones = [m for m in mediciones if m.get("id_individuo") in allowed_ids]
        imagenes = [img for img in imagenes if img.get("id_individuo") in allowed_ids]

    individuos_by_id = {i["id_individuo"]: i for i in individuos if i.get("id_individuo")}
    images_by_person: dict[str, list[dict[str, Any]]] = {}
    for image in imagenes:
        person_id = image.get("id_individuo")
        if person_id:
            images_by_person.setdefault(person_id, []).append(image)

    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []
    seen_nodes: set[str] = set()

    def add_node(node: dict[str, Any]) -> None:
        node_id = node["id"]
        if node_id in seen_nodes:
            return
        seen_nodes.add(node_id)
        nodes.append(node)

    # Agregar nodo central de patología
    patologia_id = f"patologia:{patologia}"
    add_node({
        "id": patologia_id,
        "label": patologia,
        "type": "patologia",
        "patologia": patologia,
    })

    # Agregar nodos de individuos
    for individuo in individuos:
        person_id = individuo.get("id_individuo")
        if not person_id:
            continue
        if person_id not in individuos_by_id:
            continue
        tumba_val = reference_map.get(person_id)
        meta = morro1_metadata.get(person_id) or morro1_metadata.get(individuo.get("numero_cuerpo")) or {}
        add_node({
            "id": person_id,
            "tumba": tumba_val,
            "label": tumba_val or "",
            "type": "individuo",
            "sexo": individuo.get("sexo"),
            "edad": individuo.get("edad"),
            "estilo_momificacion": individuo.get("estilo_momificacion"),
            "estado": individuo.get("estado"),
            "id_documento": individuo.get("id_documento"),
            "numero_cuerpo": individuo.get("numero_cuerpo"),
            "referencia_datos": meta.get("referencia_datos"),
            "matriz": meta.get("matriz"),
        })
        # Conectar individuo a patología
        edges.append({
            "source": patologia_id,
            "target": person_id,
            "label": "presenta",
        })

    # Agregar mediciones (elementos) y conectarlos a individuos
    element_ids: set[str] = set()
    for medicion in mediciones:
        elemento_name = medicion.get("elemento")
        person_id = medicion.get("id_individuo")
        meta = morro1_metadata.get(person_id, {})
        if elemento_name:
            element_id = f"elemento:{elemento_name}"
            if element_id not in element_ids:
                add_node({
                    "id": element_id,
                    "label": elemento_name,
                    "type": "elemento",
                    "elemento": elemento_name,
                })
                element_ids.add(element_id)
        if person_id and elemento_name:
            if medicion.get("concentracion") is not None:
                edges.append({
                    "source": person_id,
                    "target": f"elemento:{elemento_name}",
                    "label": "mide",
                    "elemento": elemento_name,
                    "concentracion": medicion.get("concentracion"),
                    "unidad": medicion.get("unidad"),
                    "estado": medicion.get("estado"),
                    "referencia_datos": meta.get("referencia_datos"),
                    "matriz": meta.get("matriz"),
                })

    # Agregar imágenes
    for person_id, person_images in images_by_person.items():
        if not person_id:
            continue
        for image in person_images:
            image_id = image.get("id_imagen") or f"imagen:{person_id}:{len(person_images)}"
            image_url = image.get("url") or image.get("relative_path")
            if image_url and not image_url.startswith("/"):
                image_url = f"/files/imagenes/{image_url}"
            add_node({
                "id": image_id,
                "label": image.get("titulo") or image.get("filename_original") or "Imagen",
                "type": "imagen",
                "url": image_url,
                "id_individuo": person_id,
            })
            edges.append({
                "source": person_id,
                "target": image_id,
                "label": "tiene_imagen",
                "url": image_url,
            })

    return {
        "mode": "relational",
        "nodes": nodes,
        "edges": edges,
        "summary": {
            "individuos": len(individuos),
            "mediciones": len(mediciones),
            "imagenes": len(imagenes),
        },
    }


def build_relational_graph(
    conn,
    elemento: Optional[str] = None,
    edad: Optional[str] = None,
    caso: Optional[str] = None,
    extra_imagenes: Optional[list[dict[str, Any]]] = None,
    sexo: Optional[str] = None,
    patologia: Optional[str] = None,
    fuente: Optional[str] = None,
) -> dict[str, Any]:
    individuos = rows_to_dicts(
        conn.execute(
            "SELECT id_individuo, id_documento, numero_cuerpo, sexo, edad, estilo_momificacion, estado, fuente FROM individuos ORDER BY id_documento"
        ).fetchall()
    )
    mediciones = rows_to_dicts(
        conn.execute(
            "SELECT id_individuo, elemento, concentracion, unidad, estado, fuente FROM mediciones_quimicas ORDER BY elemento, id_individuo"
        ).fetchall()
    )
    imagenes = rows_to_dicts(
        conn.execute(
            "SELECT id_imagen, id_individuo, filename_original, titulo, relative_path, fuente FROM imagenes ORDER BY created_at DESC"
        ).fetchall()
    )
    if extra_imagenes:
        imagenes.extend(extra_imagenes)
    return build_relational_graph_from_rows(
        individuos=individuos,
        mediciones=mediciones,
        imagenes=imagenes,
        elemento=elemento,
        edad=edad,
        caso=caso,
        sexo=sexo,
        patologia=patologia,
        fuente=fuente,
    )


def build_relational_graph_by_patologia(
    conn,
    patologia: str,
    edad: Optional[str] = None,
    sexo: Optional[str] = None,
    extra_imagenes: Optional[list[dict[str, Any]]] = None,
    fuente: Optional[str] = None,
) -> dict[str, Any]:
    if fuente and fuente.strip().lower() == "morro1":
        # Usar datos desde JSON
        return build_morro1_patologia_graph(patologia, sexo, edad)
    individuos = rows_to_dicts(
        conn.execute(
            "SELECT id_individuo, id_documento, numero_cuerpo, sexo, edad, estilo_momificacion, estado, fuente FROM individuos ORDER BY id_documento"
        ).fetchall()
    )
    mediciones = rows_to_dicts(
        conn.execute(
            "SELECT id_individuo, elemento, concentracion, unidad, estado, fuente FROM mediciones_quimicas ORDER BY elemento, id_individuo"
        ).fetchall()
    )
    imagenes = rows_to_dicts(
        conn.execute(
            "SELECT id_imagen, id_individuo, filename_original, titulo, relative_path, fuente FROM imagenes ORDER BY created_at DESC"
        ).fetchall()
    )
    if extra_imagenes:
        imagenes.extend(extra_imagenes)
    return build_relational_graph_from_patologia(
        individuos=individuos,
        mediciones=mediciones,
        imagenes=imagenes,
        patologia=patologia,
        edad=edad,
        sexo=sexo,
        fuente=fuente,
    )


def build_relational_graph_all_patologias(
    conn,
    edad: Optional[str] = None,
    sexo: Optional[str] = None,
    fuente: Optional[str] = None,
) -> dict[str, Any]:
    if fuente and fuente.strip().lower() == "morro1":
        return build_morro1_all_patologias_graph(sexo, edad)
    """Construye un grafo con todas las patologías como nodos centrales."""
    individuos = rows_to_dicts(
        conn.execute(
            "SELECT id_individuo, id_documento, numero_cuerpo, sexo, edad, estilo_momificacion, estado, fuente FROM individuos ORDER BY id_documento"
        ).fetchall()
    )
    mediciones = rows_to_dicts(
        conn.execute(
            "SELECT id_individuo, elemento, concentracion, unidad, estado, fuente FROM mediciones_quimicas ORDER BY elemento, id_individuo"
        ).fetchall()
    )
    imagenes = rows_to_dicts(
        conn.execute(
            "SELECT id_imagen, id_individuo, filename_original, titulo, relative_path, fuente FROM imagenes ORDER BY created_at DESC"
        ).fetchall()
    )

    morro1_metadata = _load_morro1_analysis_metadata()  # <-- nuevo

    if fuente:
        fuente_norm = str(fuente).strip().lower()
        individuos = [i for i in individuos if str(i.get("fuente") or "").strip().lower() == fuente_norm]
        allowed_ids = {i["id_individuo"] for i in individuos if i.get("id_individuo")}
        mediciones = [m for m in mediciones if str(m.get("fuente") or "").strip().lower() == fuente_norm]
        imagenes = [img for img in imagenes if str(img.get("fuente") or "").strip().lower() == fuente_norm]
        if allowed_ids:
            mediciones = [m for m in mediciones if m.get("id_individuo") in allowed_ids]
            imagenes = [img for img in imagenes if img.get("id_individuo") in allowed_ids]

    # Filtrar por sexo
    if sexo:
        s_norm = str(sexo).strip().lower()
        individuos = [i for i in individuos if (i.get("sexo") or "").strip().lower() == s_norm]
        allowed_ids = {i["id_individuo"] for i in individuos}
        mediciones = [m for m in mediciones if m.get("id_individuo") in allowed_ids]
        imagenes = [img for img in imagenes if img.get("id_individuo") in allowed_ids]

    # Filtrar por edad
    if edad:
        individuos = [i for i in individuos if i.get("edad") == edad]
        allowed_ids = {i["id_individuo"] for i in individuos}
        mediciones = [m for m in mediciones if m.get("id_individuo") in allowed_ids]
        imagenes = [img for img in imagenes if img.get("id_individuo") in allowed_ids]

    reference_map = _load_reference_map()
    individuos_by_id = {i["id_individuo"]: i for i in individuos if i.get("id_individuo")}

    # Obtener todas las patologías disponibles
    patologia_cases = _load_paleopatologia_cases()
    patologias_set = set()
    for case in patologia_cases:
        paleo = case.get("paleopatologia", {}) or {}
        if not isinstance(paleo, dict):
            continue
        for patologia_name, value in paleo.items():
            if _pathology_present(case, patologia_name):
                patologias_set.add(patologia_name)
    
    patologias = sorted(list(patologias_set))

    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []
    seen_nodes: set[str] = set()

    def add_node(node: dict[str, Any]) -> None:
        node_id = node["id"]
        if node_id in seen_nodes:
            return
        seen_nodes.add(node_id)
        nodes.append(node)

    # Agregar nodos de patología centrales
    patologia_ids = []
    for patologia in patologias:
        patologia_id = f"patologia:{patologia}"
        patologia_ids.append(patologia_id)
        add_node({
            "id": patologia_id,
            "label": patologia,
            "type": "patologia",
            "patologia": patologia,
        })

    # Para cada patología, agregar individuos que la tienen
    for patologia in patologias:
        patologia_id = f"patologia:{patologia}"
        # Filtrar individuos que tienen esta patología
        filtered_individuos = filter_individuos_by_patologia(individuos, patologia)
        
        for individuo in filtered_individuos:
            person_id = individuo.get("id_individuo")
            if not person_id:
                continue
            if person_id not in individuos_by_id:
                continue
            tumba_val = reference_map.get(person_id)
            meta = morro1_metadata.get(person_id, {})
            add_node({
                "id": person_id,
                "tumba": tumba_val,
                "label": tumba_val or "",
                "type": "individuo",
                "sexo": individuo.get("sexo"),
                "edad": individuo.get("edad"),
                "estilo_momificacion": individuo.get("estilo_momificacion"),
                "estado": individuo.get("estado"),
                "id_documento": individuo.get("id_documento"),
                "numero_cuerpo": individuo.get("numero_cuerpo"),
                "referencia_datos": meta.get("referencia_datos"),
                "matriz": meta.get("matriz"),
            })
            # Conectar individuo a patología
            edges.append({
                "source": patologia_id,
                "target": person_id,
                "label": "presenta",
            })

    # Agregar mediciones (elementos)
    for medicion in mediciones:
        elemento_name = medicion.get("elemento")
        person_id = medicion.get("id_individuo")
        meta = morro1_metadata.get(person_id, {})
        if elemento_name:
            element_id = f"elemento:{elemento_name}"
            if element_id not in seen_nodes:
                add_node({
                    "id": element_id,
                    "label": elemento_name,
                    "type": "elemento",
                    "elemento": elemento_name,
                })
        if person_id and elemento_name:
            if medicion.get("concentracion") is not None:
                edges.append({
                    "source": person_id,
                    "target": f"elemento:{elemento_name}",
                    "label": "mide",
                    "elemento": elemento_name,
                    "concentracion": medicion.get("concentracion"),
                    "unidad": medicion.get("unidad"),
                    "estado": medicion.get("estado"),
                    "referencia_datos": meta.get("referencia_datos"),
                    "matriz": meta.get("matriz"),
                })

    return {
        "mode": "relational",
        "nodes": nodes,
        "edges": edges,
        "summary": {
            "patologias": len(patologias),
            "individuos": len(individuos_by_id),
            "mediciones": len(mediciones),
            "imagenes": len(imagenes),
        },
    }


def _load_morro1_reference_cases() -> list[dict[str, Any]]:
    """Carga los casos del archivo morro1_referencia.json."""
    path = BASE_DIR / "data" / "morro1_referencia.json"
    if not path.exists():
        return []
    try:
        with path.open("r", encoding="utf-8") as fh:
            payload = json.load(fh)
        if isinstance(payload, dict):
            if isinstance(payload.get("morro_1"), dict) and isinstance(payload["morro_1"].get("casos"), list):
                return payload["morro_1"]["casos"]
            if isinstance(payload.get("casos"), list):
                return payload["casos"]
    except Exception:
        return []
    return []


def build_morro1_reference_graph(
    sexo: Optional[str] = None,
    edad: Optional[str] = None,
    patologia: Optional[str] = None,
) -> dict[str, Any]:
    """
    Construye un grafo de referencia para Morro1 con un nodo central 'MORRO1'
    y aristas hacia cada caso (individuo) que cumpla los filtros.
    """
    cases = _load_morro1_reference_cases()
    if not cases:
        return {"mode": "reference", "nodes": [], "edges": [], "summary": {"individuos": 0}}

    # Cargar metadatos de análisis de Morro1 (referencia_datos, matriz)
    morro1_metadata = _load_morro1_analysis_metadata()

    # Los filtros deben usar la misma normalizacion que los grafos por elemento.
    # En los JSON existen variantes como "sub adulto"/"subadulto" y un valor
    # de sexo malformado que contiene "indeterminado".
    cases = _filter_morro1_cases_by_edad(
        _filter_morro1_cases_by_sexo(cases, sexo), edad
    )

    # Filtro por patología (usando paleopatologia)
    if patologia:
        paleo_cases = _load_paleopatologia_cases()
        pat_ids = set()
        for pc in paleo_cases:
            if _pathology_present(pc, patologia):
                pid = str(pc.get("id") or "").strip()
                if pid:
                    pat_ids.add(pid)
        if pat_ids:
            cases = [c for c in cases if str(c.get("id") or "").strip() in pat_ids]
        else:
            cases = []  # no hay casos con esa patología

    nodes = []
    edges = []
    seen = set()

    # Nodo central "MORRO1"
    site_id = "morro1:site"
    nodes.append({
        "id": site_id,
        "label": "MORRO1",
        "type": "patologia",   # se usa el mismo tipo que en Azapa para mantener compatibilidad
    })
    seen.add(site_id)

    for case in cases:
        case_id = str(case.get("id") or "").strip()
        if not case_id:
            continue
        tumba = case.get("tumba") or case.get("referencia") or case_id
        individuo = case.get("individuo") or {}

        # Obtener metadatos para este caso
        meta = morro1_metadata.get(case_id, {})

        nodes.append({
            "id": case_id,
            "label": str(tumba),
            "type": "individuo",
            "sexo": _canonical_morro1_sexo(individuo.get("sexo")),
            "edad": _canonical_morro1_edad(
                individuo.get("grupo_edad") or individuo.get("edad")
            ),
            "tumba": str(tumba),
            "id_documento": case_id,
            "numero_cuerpo": str(tumba),
            "id_individuo": case_id,
            # Añadir metadatos si existen
            "referencia_datos": meta.get("referencia_datos"),
            "matriz": meta.get("matriz"),
        })
        edges.append({
            "source": site_id,
            "target": case_id,
            "label": "presenta",
        })

    return {
        "mode": "reference",
        "nodes": nodes,
        "edges": edges,
        "summary": {
            "individuos": len(cases),
        },
    }

def build_morro1_patologia_graph(
    patologia: str,
    sexo: Optional[str] = None,
    edad: Optional[str] = None,
) -> dict[str, Any]:
    """Construye un grafo para Morro1 filtrado por una patología específica, usando solo JSON."""
    reference_cases = _load_morro1_reference_cases()
    paleo_cases = _load_paleopatologia_cases()

    # Encontrar IDs que tienen la patología
    matching_ids = set()
    for case in paleo_cases:
        if _pathology_present(case, patologia):
            pid = case.get("id")
            if pid:
                matching_ids.add(pid)

    if not matching_ids:
        return {"mode": "patologia", "nodes": [], "edges": [], "summary": {"individuos": 0}}

    # Filtrar casos de referencia y aplicar filtros de sexo/edad
    filtered_cases = []
    for case in reference_cases:
        case_id = case.get("id")
        if case_id not in matching_ids:
            continue
        individuo = case.get("individuo") or {}
        if sexo:
            if individuo.get("sexo", "").strip().lower() != sexo.strip().lower():
                continue
        if edad:
            case_edad = individuo.get("edad") or individuo.get("grupo_edad")
            if case_edad != edad:
                continue
        filtered_cases.append(case)

    # Cargar metadatos de análisis (referencia_datos, matriz) si existen
    morro1_metadata = _load_morro1_analysis_metadata()

    nodes = []
    edges = []
    seen_nodes = set()

    def add_node(node):
        if node["id"] in seen_nodes:
            return
        seen_nodes.add(node["id"])
        nodes.append(node)

    # Nodo central de patología
    patologia_id = f"patologia:{patologia}"
    add_node({
        "id": patologia_id,
        "label": patologia,
        "type": "patologia",
        "patologia": patologia,
    })

    # Nodos individuos y aristas
    for case in filtered_cases:
        case_id = case.get("id")
        tumba = case.get("tumba") or case.get("referencia") or case_id
        individuo = case.get("individuo") or {}
        meta = morro1_metadata.get(case_id, {})
        add_node({
            "id": case_id,
            "tumba": tumba,
            "label": tumba or "",
            "type": "individuo",
            "sexo": individuo.get("sexo"),
            "edad": individuo.get("edad") or individuo.get("grupo_edad"),
            "id_documento": case_id,
            "numero_cuerpo": tumba,
            "id_individuo": case_id,
            "referencia_datos": meta.get("referencia_datos"),
            "matriz": meta.get("matriz"),
            "estilo_momificacion": None,  # no disponible en JSON
            "estado": "borrador",         # valor por defecto
        })
        edges.append({
            "source": patologia_id,
            "target": case_id,
            "label": "presenta",
        })

    return {
        "mode": "patologia",
        "nodes": nodes,
        "edges": edges,
        "summary": {"individuos": len(filtered_cases)},
    }

def build_morro1_all_patologias_graph(
    sexo: Optional[str] = None,
    edad: Optional[str] = None,
) -> dict[str, Any]:
    """Construye un grafo para Morro1 con todas las patologías como nodos centrales, usando JSON."""
    reference_cases = _load_morro1_reference_cases()
    paleo_cases = _load_paleopatologia_cases()

    # Recolectar todas las patologías presentes
    patologias_set = set()
    for case in paleo_cases:
        paleo = case.get("paleopatologia", {}) or {}
        for pat_name, value in paleo.items():
            if _pathology_present(case, pat_name):
                patologias_set.add(pat_name)
    patologias = sorted(patologias_set)

    if not patologias:
        return {"mode": "patologias", "nodes": [], "edges": [], "summary": {"patologias": 0, "individuos": 0}}

    # Cargar metadatos de análisis
    morro1_metadata = _load_morro1_analysis_metadata()

    nodes = []
    edges = []
    seen_nodes = set()

    def add_node(node):
        if node["id"] in seen_nodes:
            return
        seen_nodes.add(node["id"])
        nodes.append(node)

    # Nodos centrales de patología
    patologia_ids = []
    for pat in patologias:
        pat_id = f"patologia:{pat}"
        patologia_ids.append(pat_id)
        add_node({
            "id": pat_id,
            "label": pat,
            "type": "patologia",
            "patologia": pat,
        })

    # Para cada patología, obtener los casos que la tienen
    for pat in patologias:
        matching_ids = set()
        for case in paleo_cases:
            if _pathology_present(case, pat):
                pid = case.get("id")
                if pid:
                    matching_ids.add(pid)
        if not matching_ids:
            continue
        # Filtrar casos de referencia por matching_ids y sexo/edad
        for case in reference_cases:
            case_id = case.get("id")
            if case_id not in matching_ids:
                continue
            individuo = case.get("individuo") or {}
            if sexo:
                if individuo.get("sexo", "").strip().lower() != sexo.strip().lower():
                    continue
            if edad:
                case_edad = individuo.get("edad") or individuo.get("grupo_edad")
                if case_edad != edad:
                    continue
            tumba = case.get("tumba") or case.get("referencia") or case_id
            meta = morro1_metadata.get(case_id, {})
            add_node({
                "id": case_id,
                "tumba": tumba,
                "label": tumba or "",
                "type": "individuo",
                "sexo": individuo.get("sexo"),
                "edad": individuo.get("edad") or individuo.get("grupo_edad"),
                "id_documento": case_id,
                "numero_cuerpo": tumba,
                "id_individuo": case_id,
                "referencia_datos": meta.get("referencia_datos"),
                "matriz": meta.get("matriz"),
                "estilo_momificacion": None,
                "estado": "borrador",
            })
            edges.append({
                "source": f"patologia:{pat}",
                "target": case_id,
                "label": "presenta",
            })

    return {
        "mode": "patologias",
        "nodes": nodes,
        "edges": edges,
        "summary": {
            "patologias": len(patologias),
            "individuos": len({n["id"] for n in nodes if n["type"] == "individuo"}),
        },
    }

# ============================================================
# MORRO1 - Grafo generalizado multi-elemento (espejo de AZAPA)
# ============================================================

def _load_morro1_analysis_cases(analysis_path: Optional[Path] = None) -> list[dict[str, Any]]:
    if not analysis_path or not analysis_path.exists():
        return []
    try:
        with analysis_path.open("r", encoding="utf-8") as fh:
            payload = json.load(fh)
    except Exception:
        return []
    if isinstance(payload, dict):
        for value in payload.values():
            if isinstance(value, dict) and isinstance(value.get("casos"), list):
                return [c for c in value["casos"] if isinstance(c, dict)]
    return []


def _canonical_morro1_sexo(value: Optional[str]) -> str:
    normalized = _normalize_filter_value(value)
    if "femenin" in normalized:
        return "femenino"
    if "masculin" in normalized:
        return "masculino"
    if "indeterminado" in normalized or normalized in {"desconocido", "pendiente"}:
        return "indeterminado"
    return str(value or "").strip().lower()


def _canonical_morro1_edad(value: Optional[str]) -> str:
    normalized = _normalize_filter_value(value)
    if normalized == "subadulto":
        return "subadulto"
    if normalized == "adulto":
        return "adulto"
    if normalized == "indeterminado":
        return "indeterminado"
    return str(value or "").strip().lower()


def _filter_morro1_cases_by_sexo(cases: list[dict[str, Any]], sexo: Optional[str] = None) -> list[dict[str, Any]]:
    normalized = _canonical_morro1_sexo(sexo)
    if not normalized:
        return cases
    out = []
    for case in cases:
        individuo = case.get("individuo") or {}
        if _canonical_morro1_sexo(individuo.get("sexo")) == normalized:
            out.append(case)
    return out


def _filter_morro1_cases_by_edad(cases: list[dict[str, Any]], edad: Optional[str] = None) -> list[dict[str, Any]]:
    normalized = _canonical_morro1_edad(edad)
    if not normalized:
        return cases
    out = []
    for case in cases:
        individuo = case.get("individuo") or {}
        case_edad = str(individuo.get("grupo_edad") or individuo.get("edad") or "").strip()
        if _canonical_morro1_edad(case_edad) == normalized:
            out.append(case)
    return out


def _filter_morro1_analysis_cases_by_matriz(cases: list[dict[str, Any]], matriz: Optional[str] = None) -> list[dict[str, Any]]:
    normalized = _normalize_filter_value(matriz)
    if not normalized:
        return cases
    out = []
    for case in cases:
        analisis = case.get("analisis_quimicos") or {}
        if _normalize_filter_value(analisis.get("matriz")) == normalized:
            out.append(case)
    return out


def get_morro1_reference_sex_options() -> list[str]:
    options, seen = [], set()
    for case in _load_morro1_reference_cases():
        individuo = case.get("individuo") or {}
        value = _canonical_morro1_sexo(individuo.get("sexo"))
        normalized = _normalize_filter_value(value)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        options.append(value)
    return sorted(options, key=lambda x: str(x).lower())


def get_morro1_reference_age_options() -> list[str]:
    options: set[str] = set()
    for case in _load_morro1_reference_cases():
        individuo = case.get("individuo") or {}
        value = _canonical_morro1_edad(
            individuo.get("grupo_edad") or individuo.get("edad")
        )
        if value:
            options.add(value)
    preferred_order = {"adulto": 0, "subadulto": 1, "indeterminado": 2}
    return sorted(options, key=lambda value: (preferred_order.get(value, 99), value))


def get_morro1_analysis_matriz_options(analysis_paths: Optional[list[Path]] = None) -> list[str]:
    if not analysis_paths:
        analysis_paths = MORRO1_ANALYSIS_PATHS
    options, seen = [], set()
    for path in analysis_paths:
        for case in _load_morro1_analysis_cases(path):
            analisis = case.get("analisis_quimicos") or {}
            value = str(analisis.get("matriz") or "").strip()
            normalized = _normalize_filter_value(value)
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            options.append(value)
    return sorted(options, key=lambda x: str(x).lower())


def get_morro1_available_elements(analysis_paths: Optional[list[Path]] = None) -> list[str]:
    if not analysis_paths:
        analysis_paths = MORRO1_ANALYSIS_PATHS
    elements: list[str] = []
    for path in analysis_paths:
        for case in _load_morro1_analysis_cases(path):
            elementos = (case.get("analisis_quimicos") or {}).get("elementos") or {}
            if not isinstance(elementos, dict):
                continue
            for name in elementos.keys():
                if name and str(name) not in elements:
                    elements.append(str(name))
    return elements


def build_morro1_table_rows(
    analysis_paths: Optional[list[Path]] = None,
    sexo: Optional[str] = None,
    edad: Optional[str] = None,
    matriz: Optional[str] = None,
    elemento: Optional[str] = None,
) -> list[dict[str, Any]]:
    if not analysis_paths:
        analysis_paths = MORRO1_ANALYSIS_PATHS
    cases = _filter_morro1_cases_by_edad(
        _filter_morro1_cases_by_sexo(_load_morro1_reference_cases(), sexo), edad
    )
    case_lookup = {str(c.get("id") or "").strip(): c for c in cases if str(c.get("id") or "").strip()}

    rows: list[dict[str, Any]] = []
    for path in analysis_paths:
        for analysis_case in _filter_morro1_analysis_cases_by_matriz(_load_morro1_analysis_cases(path), matriz):
            case_id = str(analysis_case.get("id") or "").strip()
            reference_case = case_lookup.get(case_id)
            if not case_id or not reference_case:
                continue
            individuo = reference_case.get("individuo") or {}
            analisis = analysis_case.get("analisis_quimicos") or {}
            matriz_value = str(analisis.get("matriz") or "").strip()
            elementos = analisis.get("elementos") or {}
            if not isinstance(elementos, dict):
                continue
            for nombre_elemento, elemento_data in elementos.items():
                if not nombre_elemento:
                    continue
                element_name = str(nombre_elemento)
                if elemento and _normalize_azapa_element_filter(element_name) != _normalize_azapa_element_filter(elemento):
                    continue
                if isinstance(elemento_data, dict):
                    value = elemento_data.get("valor")
                    unit = elemento_data.get("unidad") or "ppm"
                else:
                    value = elemento_data
                    unit = "ppm"
                if not _azapa_measurement_has_value(elemento_data if isinstance(elemento_data, dict) else value):
                    continue
                rows.append({
                    "id_caso": case_id,
                    "caso": str(reference_case.get("tumba") or reference_case.get("referencia") or case_id),
                    "sexo": _canonical_morro1_sexo(individuo.get("sexo")),
                    "edad": _canonical_morro1_edad(
                        individuo.get("grupo_edad") or individuo.get("edad")
                    ),
                    "elemento": element_name,
                    "concentracion": value,
                    "unidad": unit,
                    "matriz": matriz_value,
                })
    return rows


def build_morro1_pca(
    elements: list[str],
    sexo: Optional[str] = None,
    edad: Optional[str] = None,
) -> dict[str, Any]:
    """Calcula PC1/PC2 para casos de Morro1 con todos los elementos pedidos.

    Las concentraciones se estandarizan con z-score para que elementos con
    escalas distintas aporten de forma comparable. Si hay mediciones repetidas
    para un caso/elemento se usa su promedio.
    """
    selected: list[str] = []
    available_lookup = {
        _normalize_filter_value(name): name
        for name in get_morro1_available_elements(MORRO1_ANALYSIS_PATHS)
    }
    for raw_element in elements:
        normalized = _normalize_filter_value(raw_element)
        if normalized and normalized not in {
            _normalize_filter_value(item) for item in selected
        }:
            if normalized not in available_lookup:
                raise ValueError(f"Elemento no disponible: {raw_element}")
            selected.append(available_lookup[normalized])

    if len(selected) < 3:
        raise ValueError("Selecciona al menos tres elementos para calcular el PCA")

    rows = build_morro1_table_rows(sexo=sexo, edad=edad)
    values_by_case: dict[str, dict[str, list[float]]] = {}
    case_metadata: dict[str, dict[str, str]] = {}
    selected_set = set(selected)
    for row in rows:
        element = row.get("elemento")
        if element not in selected_set:
            continue
        try:
            value = float(row.get("concentracion"))
        except (TypeError, ValueError):
            continue
        if not np.isfinite(value):
            continue
        case_id = str(row.get("id_caso") or "").strip()
        if not case_id:
            continue
        values_by_case.setdefault(case_id, {}).setdefault(element, []).append(value)
        case_metadata[case_id] = {
            "caso": str(row.get("caso") or case_id),
            "sexo": str(row.get("sexo") or ""),
            "edad": str(row.get("edad") or ""),
        }

    complete_cases = [
        case_id
        for case_id, measurements in values_by_case.items()
        if all(measurements.get(element) for element in selected)
    ]
    complete_cases.sort(key=lambda case_id: case_metadata[case_id]["caso"].lower())
    if len(complete_cases) < 3:
        raise ValueError(
            "Se necesitan al menos tres casos con mediciones completas para los elementos seleccionados"
        )

    matrix = np.asarray([
        [float(np.mean(values_by_case[case_id][element])) for element in selected]
        for case_id in complete_cases
    ], dtype=float)
    means = matrix.mean(axis=0)
    standard_deviations = matrix.std(axis=0)
    constant_elements = [
        selected[index]
        for index, value in enumerate(standard_deviations)
        if np.isclose(value, 0.0)
    ]
    if constant_elements:
        raise ValueError(
            "No se puede calcular el PCA: no hay variacion en " + ", ".join(constant_elements)
        )

    standardized = (matrix - means) / standard_deviations
    left, singular_values, components = np.linalg.svd(standardized, full_matrices=False)
    scores = left * singular_values
    variances = (singular_values ** 2) / max(len(complete_cases) - 1, 1)
    total_variance = float(variances.sum())
    explained = variances / total_variance if total_variance else np.zeros_like(variances)

    points = []
    for index, case_id in enumerate(complete_cases):
        meta = case_metadata[case_id]
        points.append({
            "id": case_id,
            "id_individuo": case_id,
            "label": meta["caso"],
            "caso": meta["caso"],
            "type": "individuo",
            "sexo": meta["sexo"],
            "edad": meta["edad"],
            "pc1": float(scores[index, 0]),
            "pc2": float(scores[index, 1]),
            "mediciones": {
                element: {"valor": float(matrix[index, element_index])}
                for element_index, element in enumerate(selected)
            },
        })

    loadings = [
        {
            "elemento": element,
            "pc1": float(components[0, index]),
            "pc2": float(components[1, index]),
        }
        for index, element in enumerate(selected)
    ]
    warnings = []
    if len(complete_cases) < 10:
        warnings.append(
            "La muestra tiene menos de 10 casos completos; interpreta el patrón con cautela."
        )

    return {
        "elements": selected,
        "points": points,
        "loadings": loadings,
        "explained_variance": {
            "pc1": float(explained[0]),
            "pc2": float(explained[1]),
        },
        "summary": {
            "complete_cases": len(complete_cases),
            "incomplete_cases": len(values_by_case) - len(complete_cases),
            "standardization": "z-score",
            "duplicate_measurements": "mean",
        },
        "warnings": warnings,
    }


def build_morro1_element_graph(
    elemento: Optional[str] = None,
    analysis_paths: Optional[list[Path]] = None,
    sexo: Optional[str] = None,
    edad: Optional[str] = None,
    matriz: Optional[str] = None,
) -> dict[str, Any]:
    if not analysis_paths:
        analysis_paths = MORRO1_ANALYSIS_PATHS

    normalized_element = _normalize_azapa_element_filter(elemento)
    if normalized_element in {"", "ninguna", "none", "null", "no"}:
        return build_morro1_reference_graph(sexo=sexo, edad=edad)

    cases = _filter_morro1_cases_by_edad(
        _filter_morro1_cases_by_sexo(_load_morro1_reference_cases(), sexo), edad
    )
    nodes, edges, seen_nodes = [], [], set()

    def add_node(node):
        if node["id"] in seen_nodes:
            return
        seen_nodes.add(node["id"])
        nodes.append(node)

    is_red_completa = normalized_element == "redcompleta"

    analysis_map: dict[str, dict[str, dict[str, Any]]] = {}
    case_metadata: dict[str, dict[str, str]] = {}
    element_metadata: dict[str, dict[str, set]] = {}
    available_elements: list[str] = []

    for path in analysis_paths:
        for case in _filter_morro1_analysis_cases_by_matriz(_load_morro1_analysis_cases(path), matriz):
            case_id = str(case.get("id") or "").strip()
            if not case_id:
                continue
            analisis = case.get("analisis_quimicos") or {}
            ref_data = analisis.get("referencia_datos")
            mat = analisis.get("matriz")
            if ref_data or mat:
                case_metadata.setdefault(case_id, {})
                if ref_data:
                    case_metadata[case_id]["referencia_datos"] = ref_data
                if mat:
                    case_metadata[case_id]["matriz"] = mat
            elementos = analisis.get("elementos") or {}
            if not isinstance(elementos, dict):
                continue
            case_measurements = analysis_map.setdefault(case_id, {})
            for name, edata in elementos.items():
                if not name:
                    continue
                name = str(name)
                if name not in available_elements:
                    available_elements.append(name)
                element_metadata.setdefault(name, {"referencias": set(), "matrices": set()})
                if ref_data:
                    element_metadata[name]["referencias"].add(ref_data)
                if mat:
                    element_metadata[name]["matrices"].add(mat)
                if isinstance(edata, dict):
                    value = edata.get("valor")
                    unit = edata.get("unidad") or "ppm"
                else:
                    value = edata
                    unit = "ppm"
                if not _azapa_measurement_has_value(edata if isinstance(edata, dict) else value):
                    continue
                case_measurements[name] = {"valor": value, "unidad": unit}

    selected_elements = available_elements if is_red_completa else [str(elemento).strip()]

    for idx, case in enumerate(cases, start=1):
        case_id = str(case.get("id") or "").strip() or f"morro1_case_{idx}"
        tumba = case.get("tumba") or case.get("referencia") or case_id
        individuo = case.get("individuo") or {}
        measurements = analysis_map.get(case_id, {})
        meta = case_metadata.get(case_id, {})

        valid_edges = []
        for elemento_name in selected_elements:
            if elemento_name not in measurements:
                continue
            element_id = f"elemento:{elemento_name}"
            if element_id not in seen_nodes:
                meta_elem = element_metadata.get(elemento_name, {})
                refs = " | ".join(sorted(meta_elem.get("referencias", [])))
                mats = " | ".join(sorted(meta_elem.get("matrices", [])))
                add_node({
                    "id": element_id, "label": elemento_name, "type": "elemento",
                    "elemento": elemento_name, "referencia_datos": refs or None, "matriz": mats or None,
                })
            measure = measurements[elemento_name]
            valid_edges.append({
                "source": case_id, "target": element_id, "label": "mide",
                "elemento": elemento_name,
                "concentracion": measure.get("valor"), "unidad": measure.get("unidad"),
                "referencia_datos": meta.get("referencia_datos"), "matriz": meta.get("matriz"),
            })

        if not valid_edges:
            continue

        add_node({
            "id": case_id, "tumba": str(tumba), "label": str(tumba), "type": "individuo",
            "sexo": _canonical_morro1_sexo(individuo.get("sexo")),
            "edad": _canonical_morro1_edad(individuo.get("grupo_edad") or individuo.get("edad")),
            "id_documento": case_id, "numero_cuerpo": str(tumba), "id_individuo": case_id,
            "referencia_datos": meta.get("referencia_datos"), "matriz": meta.get("matriz"),
        })
        edges.extend(valid_edges)

    return {
        "mode": "relational",
        "nodes": nodes,
        "edges": edges,
        "summary": {"individuos": len(cases), "tumbas": len(cases), "elementos": len(selected_elements)},
    }