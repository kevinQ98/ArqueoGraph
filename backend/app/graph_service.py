from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

from .database import rows_to_dicts

BASE_DIR = Path(__file__).resolve().parents[1]
PALEOPATOLOGIA_PATH = BASE_DIR / "data" / "morro1_paleopatologia.json"
REFERENCE_PATH = BASE_DIR / "data" / "morro1_referencia.json"


def _normalize_filter_value(value: Optional[str]) -> str:
    if value is None:
        return ""
    return str(value).strip().lower().replace(" ", "").replace("_", "").replace("-", "")


def _load_paleopatologia_cases() -> list[dict[str, Any]]:
    if not PALEOPATOLOGIA_PATH.exists():
        return []
    try:
        with PALEOPATOLOGIA_PATH.open("r", encoding="utf-8") as fh:
            payload = json.load(fh)
            if isinstance(payload, dict) and isinstance(payload.get("morro1_paleopatologia"), dict):
                casos = payload["morro1_paleopatologia"].get("casos", [])
                return [caso for caso in casos if isinstance(caso, dict)]
    except Exception:
        return []
    return []


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
) -> dict[str, Any]:
    """Convierte tablas relacionales en un grafo de nodos y aristas."""
    # load reference map id -> tumba for labeling
    reference_map = _load_reference_map()
    if caso:
        case_value = caso.strip()
        individuos = [
            i for i in individuos
            if i.get("id_documento") == case_value or i.get("id_individuo") == case_value
        ]
        allowed_ids = {i["id_individuo"] for i in individuos}
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

    filtered_mediciones = [
        m for m in mediciones
        if not elemento or m.get("elemento") == elemento
    ]

    # Solo mantener individuos que tienen mediciones del elemento seleccionado
    # y que tienen valor numérico (no null)
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
        })

    element_ids: set[str] = set()
    for medicion in filtered_mediciones:
        elemento_name = medicion.get("elemento")
        person_id = medicion.get("id_individuo")
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
            # Solo crear arista si hay valor de concentración (no null)
            if medicion.get("concentracion") is not None:
                edges.append({
                    "source": person_id,
                    "target": f"elemento:{elemento_name}",
                    "label": "mide",
                    "elemento": elemento_name,
                    "concentracion": medicion.get("concentracion"),
                    "unidad": medicion.get("unidad"),
                    "estado": medicion.get("estado"),
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
) -> dict[str, Any]:
    """Convierte tablas relacionales en un grafo con patología como nodo central."""
    reference_map = _load_reference_map()
    
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
) -> dict[str, Any]:
    individuos = rows_to_dicts(
        conn.execute(
            "SELECT id_individuo, id_documento, numero_cuerpo, sexo, edad, estilo_momificacion, estado FROM individuos ORDER BY id_documento"
        ).fetchall()
    )
    mediciones = rows_to_dicts(
        conn.execute(
            "SELECT id_individuo, elemento, concentracion, unidad, estado FROM mediciones_quimicas ORDER BY elemento, id_individuo"
        ).fetchall()
    )
    imagenes = rows_to_dicts(
        conn.execute(
            "SELECT id_imagen, id_individuo, filename_original, titulo, relative_path FROM imagenes ORDER BY created_at DESC"
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
    )


def build_relational_graph_by_patologia(
    conn,
    patologia: str,
    edad: Optional[str] = None,
    sexo: Optional[str] = None,
    extra_imagenes: Optional[list[dict[str, Any]]] = None,
) -> dict[str, Any]:
    individuos = rows_to_dicts(
        conn.execute(
            "SELECT id_individuo, id_documento, numero_cuerpo, sexo, edad, estilo_momificacion, estado FROM individuos ORDER BY id_documento"
        ).fetchall()
    )
    mediciones = rows_to_dicts(
        conn.execute(
            "SELECT id_individuo, elemento, concentracion, unidad, estado FROM mediciones_quimicas ORDER BY elemento, id_individuo"
        ).fetchall()
    )
    imagenes = rows_to_dicts(
        conn.execute(
            "SELECT id_imagen, id_individuo, filename_original, titulo, relative_path FROM imagenes ORDER BY created_at DESC"
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
    )


def build_relational_graph_all_patologias(
    conn,
    edad: Optional[str] = None,
    sexo: Optional[str] = None,
) -> dict[str, Any]:
    """Construye un grafo con todas las patologías como nodos centrales."""
    individuos = rows_to_dicts(
        conn.execute(
            "SELECT id_individuo, id_documento, numero_cuerpo, sexo, edad, estilo_momificacion, estado FROM individuos ORDER BY id_documento"
        ).fetchall()
    )
    mediciones = rows_to_dicts(
        conn.execute(
            "SELECT id_individuo, elemento, concentracion, unidad, estado FROM mediciones_quimicas ORDER BY elemento, id_individuo"
        ).fetchall()
    )
    imagenes = rows_to_dicts(
        conn.execute(
            "SELECT id_imagen, id_individuo, filename_original, titulo, relative_path FROM imagenes ORDER BY created_at DESC"
        ).fetchall()
    )

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
