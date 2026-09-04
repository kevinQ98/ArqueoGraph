from __future__ import annotations

import hashlib
import re
import unicodedata
from typing import Any

from .database import get_connection, init_db
from .sqlite_migration import SITE_DEFINITIONS, _load_cases, _safe_id


MATRIX_SPECS = {
    "cabello": {
        "codigo": "cabello",
        "nombre": "Cabello",
        "categoria": "Tejido queratinizado",
        "elemento_anatomico": "Cabello",
    },
    "costilla": {
        "codigo": "costilla",
        "nombre": "Costilla",
        "categoria": "Tejido oseo",
        "elemento_anatomico": "Costilla",
    },
    "costillas": {
        "codigo": "costilla",
        "nombre": "Costilla",
        "categoria": "Tejido oseo",
        "elemento_anatomico": "Costilla",
    },
    "diente": {
        "codigo": "diente",
        "nombre": "Diente",
        "categoria": "Tejido dental",
        "elemento_anatomico": "Diente",
    },
    "dientes": {
        "codigo": "diente",
        "nombre": "Diente",
        "categoria": "Tejido dental",
        "elemento_anatomico": "Diente",
    },
}


def _normalized_text(value: Any) -> str:
    """
    Normaliza texto eliminando acentos y caracteres no alfanuméricos.

    Args:
        value (Any): Texto a normalizar.

    Returns:
        str: Texto normalizado en minúsculas con guiones bajos.
    """

    text = unicodedata.normalize("NFKD", str(value or "").strip().lower())
    text = "".join(char for char in text if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", "_", text).strip("_")


def _matrix_spec(value: Any) -> dict[str, str]:
    alias = _normalized_text(value) or "sin_especificar"
    if alias in MATRIX_SPECS:
        return MATRIX_SPECS[alias]
    name = str(value or "Sin especificar").strip() or "Sin especificar"
    return {
        "codigo": alias,
        "nombre": name[:1].upper() + name[1:],
        "categoria": "Sin clasificar",
        "elemento_anatomico": name,
    }


def _stable_digest(*parts: Any) -> str:
    raw = "|".join(str(part or "").strip().lower() for part in parts)
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:12]


def _reference_title(
    citation: str | None, dataset: str, laboratory: str | None, method: str | None
) -> str:
    if citation:
        return citation if len(citation) <= 110 else citation[:107].rstrip() + "..."
    if laboratory and method:
        return f"{laboratory} - {method}"
    if laboratory:
        return laboratory
    if method:
        return method
    return f"Datos analiticos: {dataset}"


def _citation_links(citation: str | None) -> tuple[str | None, str | None]:
    if not citation:
        return None, None
    url_match = re.search(r"https?://[^\s]+", citation)
    url = url_match.group(0).rstrip(".,;)") if url_match else None
    doi_match = re.search(r"10\.\d{4,9}/[^\s]+", citation, flags=re.IGNORECASE)
    doi = doi_match.group(0).rstrip(".,;)") if doi_match else None
    return doi, url


def _legacy_dataset_catalog() -> dict[str, list[dict[str, Any]]]:
    catalog: dict[str, list[dict[str, Any]]] = {}
    for site in SITE_DEFINITIONS:
        source = site["id_sitio"]
        for path in site.get("analysis_paths", []):
            cases, _ = _load_cases(path)
            metadata: dict[str, Any] = {
                "dataset": path.stem,
                "citation": None,
                "matrix": None,
                "method": None,
                "laboratory": None,
                "date": None,
            }
            for case in cases:
                analysis = case.get("analisis_quimicos") or {}
                if not isinstance(analysis, dict):
                    continue
                metadata["citation"] = metadata["citation"] or analysis.get(
                    "referencia_datos"
                )
                metadata["matrix"] = metadata["matrix"] or analysis.get("matriz")
                metadata["method"] = metadata["method"] or analysis.get("metodo")
                metadata["laboratory"] = metadata["laboratory"] or analysis.get(
                    "laboratorio"
                )
                metadata["date"] = metadata["date"] or analysis.get("fecha")
                if metadata["citation"] and metadata["matrix"]:
                    break
            catalog.setdefault(source, []).append(metadata)
    for datasets in catalog.values():
        datasets.sort(key=lambda item: len(item["dataset"]), reverse=True)
    return catalog


def _upsert_matrix(conn, raw_matrix: Any) -> tuple[str, dict[str, str]]:
    """
    Inserta o actualiza una matriz biológica en la tabla matrices.

    Si el alias (raw_matrix) ya existe, se reutiliza. Si no, se crea.

    Args:
        conn: Conexión SQLite.
        raw_matrix (Any): Nombre de la matriz (ej. "costilla", "cabello").

    Returns:
        tuple: (id_matriz, spec dict con código, nombre, categoría)
    """

    alias = _normalized_text(raw_matrix) or "sin_especificar"
    spec = _matrix_spec(raw_matrix)
    matrix_id = f"matriz_{_safe_id(spec['codigo']).lower()}"
    conn.execute(
        """
        INSERT INTO matrices (id_matriz, codigo, nombre, categoria, descripcion, estado)
        VALUES (?, ?, ?, ?, ?, 'validado')
        ON CONFLICT(id_matriz) DO UPDATE SET
            codigo = excluded.codigo,
            nombre = excluded.nombre,
            categoria = excluded.categoria,
            updated_at = CURRENT_TIMESTAMP
        """,
        (matrix_id, spec["codigo"], spec["nombre"], spec["categoria"], None),
    )
    conn.execute(
        """
        INSERT INTO matrices_aliases (alias_normalizado, alias_original, id_matriz)
        VALUES (?, ?, ?)
        ON CONFLICT(alias_normalizado) DO UPDATE SET
            alias_original = excluded.alias_original,
            id_matriz = excluded.id_matriz
        """,
        (
            alias,
            str(raw_matrix or "Sin especificar").strip() or "Sin especificar",
            matrix_id,
        ),
    )
    return matrix_id, spec


def _upsert_reference(
    conn,
    *,
    source: str,
    dataset: str,
    citation: str | None,
    laboratory: str | None,
    method: str | None,
    date: str | None,
) -> str:
    """
    Inserta o actualiza una referencia analítica (bibliográfica o de laboratorio).

    Args:
        conn: Conexión SQLite.
        source (str): Fuente del sitio (ej. "morro1").
        dataset (str): Nombre del dataset original.
        citation (str | None): Cita bibliográfica.
        laboratory (str | None): Laboratorio que realizó el análisis.
        method (str | None): Método analítico.
        date (str | None): Fecha del análisis.

    Returns:
        str: id_referencia generado o existente.
    """

    reference_key = (
        _normalized_text(citation)
        if citation
        else _normalized_text(f"{source}_{dataset}_{laboratory}_{method}_{date}")
    )
    reference_key = reference_key or f"{source}_sin_referencia"
    reference_id = (
        f"ref_{_safe_id(source).lower()}_{_stable_digest(source, reference_key)}"
    )
    doi, url = _citation_links(citation)
    title = _reference_title(citation, dataset, laboratory, method)
    conn.execute(
        """
        INSERT INTO referencias_analiticas (
            id_referencia, clave, titulo, cita, doi, url, laboratorio, metodo,
            fecha, dataset_origen, fuente, estado
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'validado')
        ON CONFLICT(id_referencia) DO UPDATE SET
            titulo = excluded.titulo,
            cita = COALESCE(excluded.cita, referencias_analiticas.cita),
            doi = COALESCE(excluded.doi, referencias_analiticas.doi),
            url = COALESCE(excluded.url, referencias_analiticas.url),
            laboratorio = COALESCE(excluded.laboratorio, referencias_analiticas.laboratorio),
            metodo = COALESCE(excluded.metodo, referencias_analiticas.metodo),
            fecha = COALESCE(excluded.fecha, referencias_analiticas.fecha),
            updated_at = CURRENT_TIMESTAMP
        """,
        (
            reference_id,
            f"{source}:{reference_key}",
            title,
            citation,
            doi,
            url,
            laboratory,
            method,
            date,
            dataset,
            source,
        ),
    )
    return reference_id


def _match_dataset(
    measurement_id: str, datasets: list[dict[str, Any]]
) -> dict[str, Any] | None:
    normalized_id = measurement_id.lower()
    return next(
        (
            metadata
            for metadata in datasets
            if metadata["dataset"].lower() in normalized_id
        ),
        None,
    )


def _get_or_create_sample(
    conn, row: dict[str, Any], matrix_id: str, spec: dict[str, str]
) -> str:
    existing = conn.execute(
        """
        SELECT id_muestra
        FROM muestras
        WHERE id_individuo = ? AND id_matriz = ?
        ORDER BY es_inferida, created_at
        LIMIT 1
        """,
        (row["id_individuo"], matrix_id),
    ).fetchone()
    if existing:
        return existing["id_muestra"]

    sample_id = _safe_id(f"muestra_{row['id_individuo']}_{spec['codigo']}")
    sample_code = _safe_id(f"{row['id_individuo']}_{spec['codigo']}_01")
    conn.execute(
        """
        INSERT INTO muestras (
            id_muestra, id_individuo, id_matriz, codigo_muestra,
            tipo_muestra_original, elemento_anatomico, observaciones,
            es_inferida, fuente, estado
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, 'validado')
        """,
        (
            sample_id,
            row["id_individuo"],
            matrix_id,
            sample_code,
            row.get("tipo_muestra"),
            spec["elemento_anatomico"],
            "Muestra inferida desde mediciones historicas; requiere validacion del codigo fisico.",
            row.get("fuente"),
        ),
    )
    return sample_id


def _get_or_create_analysis(
    conn,
    *,
    row: dict[str, Any],
    sample_id: str,
    reference_id: str,
    dataset: str,
    method: str | None,
    laboratory: str | None,
    date: str | None,
) -> str:
    digest = _stable_digest(
        sample_id,
        dataset,
        reference_id,
        method,
        laboratory,
        date,
        row.get("unidad"),
    )
    analysis_id = _safe_id(f"analisis_{row.get('fuente')}_{digest}")
    conn.execute(
        """
        INSERT INTO analisis_quimicos (
            id_analisis, id_muestra, id_referencia, codigo_analisis,
            dataset_origen, metodo, laboratorio, fecha, unidad_declarada,
            observaciones, es_inferido, fuente, estado
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'validado')
        ON CONFLICT(id_analisis) DO UPDATE SET
            id_referencia = COALESCE(excluded.id_referencia, analisis_quimicos.id_referencia),
            metodo = COALESCE(excluded.metodo, analisis_quimicos.metodo),
            laboratorio = COALESCE(excluded.laboratorio, analisis_quimicos.laboratorio),
            fecha = COALESCE(excluded.fecha, analisis_quimicos.fecha),
            observaciones = COALESCE(excluded.observaciones, analisis_quimicos.observaciones),
            updated_at = CURRENT_TIMESTAMP
        """,
        (
            analysis_id,
            sample_id,
            reference_id,
            analysis_id,
            dataset,
            method,
            laboratory,
            date,
            row.get("unidad"),
            row.get("observaciones"),
            row.get("fuente"),
        ),
    )
    return analysis_id


def analytical_model_audit(conn=None) -> dict[str, Any]:
    """
    Audita la integridad del modelo analítico.

    Revisa:
        - Conteos de tablas (matrices, muestras, referencias, análisis, mediciones).
        - Mediciones sin id_analisis.
        - Análisis huérfanos (id_analisis no existe).
        - Conflictos de unidades para una misma muestra y elemento.

    Returns:
        dict: Estadísticas de auditoría.
    """
    
    owns_connection = conn is None
    if owns_connection:
        conn = get_connection()
    try:
        counts = {
            table: conn.execute(f"SELECT COUNT(*) AS n FROM {table}").fetchone()["n"]
            for table in [
                "matrices",
                "matrices_aliases",
                "muestras",
                "referencias_analiticas",
                "analisis_quimicos",
                "mediciones_quimicas",
            ]
        }
        unlinked = conn.execute(
            "SELECT COUNT(*) AS n FROM mediciones_quimicas WHERE id_analisis IS NULL OR TRIM(id_analisis) = ''"
        ).fetchone()["n"]
        orphaned = conn.execute(
            """
            SELECT COUNT(*) AS n
            FROM mediciones_quimicas m
            LEFT JOIN analisis_quimicos a ON a.id_analisis = m.id_analisis
            WHERE m.id_analisis IS NOT NULL AND a.id_analisis IS NULL
            """
        ).fetchone()["n"]
        mixed_units = conn.execute(
            """
            SELECT COUNT(*) AS n FROM (
                SELECT mu.id_muestra, m.elemento
                FROM mediciones_quimicas m
                JOIN analisis_quimicos a ON a.id_analisis = m.id_analisis
                JOIN muestras mu ON mu.id_muestra = a.id_muestra
                GROUP BY mu.id_muestra, m.elemento
                HAVING COUNT(DISTINCT lower(COALESCE(m.unidad, ''))) > 1
            )
            """
        ).fetchone()["n"]
        return {
            "counts": counts,
            "unlinked_measurements": unlinked,
            "orphaned_analysis_links": orphaned,
            "sample_element_unit_conflicts": mixed_units,
            "ok": unlinked == 0 and orphaned == 0,
        }
    finally:
        if owns_connection:
            conn.close()


def migrate_analytical_model() -> dict[str, Any]:
    """
    Construye el modelo analítico a partir de mediciones existentes.

    Proceso:
        1. Recolecta todas las matrices únicas y las upserta.
        2. Crea un catálogo de datasets y referencias.
        3. Para cada medición sin id_analisis:
            - Crea o reutiliza una muestra (id_individuo + id_matriz).
            - Busca el dataset de origen y asigna referencia.
            - Crea un análisis (analisis_quimicos) y lo vincula a la medición.

    Returns:
        dict: Resumen de mediciones enlazadas y auditoría del modelo.
    """

    init_db()
    dataset_catalog = _legacy_dataset_catalog()
    linked = 0
    with get_connection() as conn:
        raw_matrices = conn.execute(
            "SELECT DISTINCT tipo_muestra FROM mediciones_quimicas"
        ).fetchall()
        for row in raw_matrices:
            _upsert_matrix(conn, row["tipo_muestra"])

        dataset_references: dict[tuple[str, str], str] = {}
        for source, datasets in dataset_catalog.items():
            for metadata in datasets:
                reference_id = _upsert_reference(
                    conn,
                    source=source,
                    dataset=metadata["dataset"],
                    citation=metadata.get("citation"),
                    laboratory=metadata.get("laboratory"),
                    method=metadata.get("method"),
                    date=metadata.get("date"),
                )
                dataset_references[(source, metadata["dataset"])] = reference_id

        measurements = [
            dict(row)
            for row in conn.execute(
                """
                SELECT *
                FROM mediciones_quimicas
                WHERE id_analisis IS NULL OR TRIM(id_analisis) = ''
                ORDER BY fuente, id_individuo, id_medicion
                """
            ).fetchall()
        ]
        for row in measurements:
            source = str(row.get("fuente") or "sin_fuente").strip().lower()
            matrix_id, matrix_spec = _upsert_matrix(conn, row.get("tipo_muestra"))
            sample_id = _get_or_create_sample(conn, row, matrix_id, matrix_spec)
            metadata = _match_dataset(
                str(row.get("id_medicion") or ""), dataset_catalog.get(source, [])
            )
            if metadata:
                dataset = metadata["dataset"]
                citation = metadata.get("citation")
                method = row.get("metodo") or metadata.get("method")
                laboratory = row.get("laboratorio") or metadata.get("laboratory")
                date = row.get("fecha") or metadata.get("date")
                reference_id = dataset_references[(source, dataset)]
            else:
                dataset = f"importacion_{source}"
                citation = None
                method = row.get("metodo")
                laboratory = row.get("laboratorio")
                date = row.get("fecha")
                reference_id = _upsert_reference(
                    conn,
                    source=source,
                    dataset=dataset,
                    citation=citation,
                    laboratory=laboratory,
                    method=method,
                    date=date,
                )
            analysis_id = _get_or_create_analysis(
                conn,
                row=row,
                sample_id=sample_id,
                reference_id=reference_id,
                dataset=dataset,
                method=method,
                laboratory=laboratory,
                date=date,
            )
            conn.execute(
                "UPDATE mediciones_quimicas SET id_analisis = ?, updated_at = CURRENT_TIMESTAMP WHERE id_medicion = ?",
                (analysis_id, row["id_medicion"]),
            )
            linked += 1

        audit = analytical_model_audit(conn)
    return {"linked_measurements": linked, "audit": audit}


def ensure_analytical_model() -> dict[str, Any]:
    init_db()
    with get_connection() as conn:
        pending = conn.execute(
            "SELECT COUNT(*) AS n FROM mediciones_quimicas WHERE id_analisis IS NULL OR TRIM(id_analisis) = ''"
        ).fetchone()["n"]
        has_catalog = (
            conn.execute("SELECT COUNT(*) AS n FROM matrices").fetchone()["n"] > 0
        )
        if pending == 0 and has_catalog:
            return {"linked_measurements": 0, "audit": analytical_model_audit(conn)}
    return migrate_analytical_model()
