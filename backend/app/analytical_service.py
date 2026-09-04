from __future__ import annotations

from collections import defaultdict
from typing import Any, Optional

from .analytical_migration import ensure_analytical_model
from .database import get_connection, rows_to_dicts


def _source(value: Optional[str]) -> str:
    return str(value or "morro1").strip().lower()


def _values(rows: list[dict[str, Any]], key: str) -> list[str]:
    return sorted(
        {
            str(row.get(key) or "").strip()
            for row in rows
            if str(row.get(key) or "").strip()
        },
        key=str.casefold,
    )


def _measurement_filter_sql(
    source: str,
    matrix: Optional[str] = None,
    reference: Optional[str] = None,
    sex: Optional[str] = None,
    age: Optional[str] = None,
    element: Optional[str] = None,
    pathology: Optional[str] = None,
) -> tuple[str, list[Any]]:
    sql = "WHERE lower(COALESCE(mu.fuente, i.fuente, '')) = ?"
    params: list[Any] = [source]
    if matrix:
        sql += " AND (lower(mx.codigo) = ? OR lower(mx.id_matriz) = ?)"
        normalized = matrix.strip().lower()
        params.extend([normalized, normalized])
    if reference:
        sql += " AND lower(COALESCE(a.id_referencia, '')) = ?"
        params.append(reference.strip().lower())
    if sex:
        sql += " AND lower(COALESCE(i.sexo, '')) = ?"
        params.append(sex.strip().lower())
    if age:
        sql += " AND lower(COALESCE(i.edad, '')) = ?"
        params.append(age.strip().lower())
    if element:
        sql += " AND lower(COALESCE(me.elemento, '')) = ?"
        params.append(element.strip().lower())
    if pathology:
        sql += """
            AND EXISTS (
                SELECT 1 FROM paleopatologias p
                WHERE p.id_individuo = i.id_individuo
                  AND lower(COALESCE(p.fuente, i.fuente, '')) = ?
                  AND lower(COALESCE(p.patologia, '')) = ?
                  AND COALESCE(p.presente, 0) = 1
            )
        """
        params.extend([source, pathology.strip().lower()])
    return sql, params


def build_analysis_context(
    fuente: str,
    matriz: Optional[str] = None,
    referencia: Optional[str] = None,
    sexo: Optional[str] = None,
    edad: Optional[str] = None,
    elemento: Optional[str] = None,
    patologia: Optional[str] = None,
) -> dict[str, Any]:
    """
    Construye el contexto analítico de un sitio con los filtros activos.

    Devuelve:
        - Matrices disponibles con sus alias, elementos, unidades y referencias.
        - Referencias disponibles con matrices, elementos y unidades.
        - Elementos con conteos de mediciones y unidades.
        - Advertencias (muestras inferidas, conflictos de unidades).

    Args:
        fuente (str): Identificador del sitio (ej. "morro1").
        matriz (Optional[str]): Filtrar por código de matriz.
        referencia (Optional[str]): Filtrar por id_referencia.
        sexo (Optional[str]): Filtrar por sexo del individuo.
        edad (Optional[str]): Filtrar por edad del individuo.
        elemento (Optional[str]): Filtrar por elemento químico.
        patologia (Optional[str]): Filtrar por patología presente.

    Returns:
        dict: Contexto analítico con summary, elementos, matrices y referencias.
    """

    ensure_analytical_model()
    source = _source(fuente)
    with get_connection() as conn:
        matrix_rows = rows_to_dicts(
            conn.execute(
                """
            SELECT
                mx.*,
                COUNT(DISTINCT mu.id_muestra) AS muestras,
                COUNT(DISTINCT mu.id_individuo) AS individuos,
                COUNT(DISTINCT a.id_analisis) AS analisis,
                COUNT(DISTINCT me.id_medicion) AS mediciones
            FROM matrices mx
            JOIN muestras mu ON mu.id_matriz = mx.id_matriz
            JOIN individuos i ON i.id_individuo = mu.id_individuo
            LEFT JOIN analisis_quimicos a ON a.id_muestra = mu.id_muestra
            LEFT JOIN mediciones_quimicas me ON me.id_analisis = a.id_analisis
            WHERE lower(COALESCE(mu.fuente, i.fuente, '')) = ?
            GROUP BY mx.id_matriz
            ORDER BY mx.nombre
            """,
                (source,),
            ).fetchall()
        )
        aliases_by_matrix: dict[str, list[str]] = defaultdict(list)
        for row in rows_to_dicts(
            conn.execute(
                """
            SELECT DISTINCT mu.id_matriz, me.tipo_muestra AS alias_original
            FROM muestras mu
            JOIN individuos i ON i.id_individuo = mu.id_individuo
            JOIN analisis_quimicos a ON a.id_muestra = mu.id_muestra
            JOIN mediciones_quimicas me ON me.id_analisis = a.id_analisis
            WHERE lower(COALESCE(mu.fuente, i.fuente, '')) = ?
              AND me.tipo_muestra IS NOT NULL
            ORDER BY me.tipo_muestra
            """,
                (source,),
            ).fetchall()
        ):
            aliases_by_matrix[row["id_matriz"]].append(row["alias_original"])

        for matrix_row in matrix_rows:
            matrix_id = matrix_row["id_matriz"]
            details = rows_to_dicts(
                conn.execute(
                    """
                SELECT me.elemento, me.unidad, a.id_referencia
                FROM muestras mu
                JOIN individuos i ON i.id_individuo = mu.id_individuo
                JOIN analisis_quimicos a ON a.id_muestra = mu.id_muestra
                JOIN mediciones_quimicas me ON me.id_analisis = a.id_analisis
                WHERE lower(COALESCE(mu.fuente, i.fuente, '')) = ?
                  AND mu.id_matriz = ?
                """,
                    (source, matrix_id),
                ).fetchall()
            )
            matrix_row["aliases"] = aliases_by_matrix.get(matrix_id, [])
            matrix_row["elementos"] = _values(details, "elemento")
            matrix_row["unidades"] = _values(details, "unidad")
            matrix_row["referencias"] = _values(details, "id_referencia")

        reference_rows = rows_to_dicts(
            conn.execute(
                """
            SELECT
                r.*,
                COUNT(DISTINCT a.id_analisis) AS analisis,
                COUNT(DISTINCT a.id_muestra) AS muestras,
                COUNT(DISTINCT mu.id_individuo) AS individuos,
                COUNT(DISTINCT me.id_medicion) AS mediciones
            FROM referencias_analiticas r
            JOIN analisis_quimicos a ON a.id_referencia = r.id_referencia
            JOIN muestras mu ON mu.id_muestra = a.id_muestra
            JOIN individuos i ON i.id_individuo = mu.id_individuo
            LEFT JOIN mediciones_quimicas me ON me.id_analisis = a.id_analisis
            WHERE lower(COALESCE(a.fuente, mu.fuente, i.fuente, '')) = ?
            GROUP BY r.id_referencia
            ORDER BY r.titulo
            """,
                (source,),
            ).fetchall()
        )
        for reference_row in reference_rows:
            details = rows_to_dicts(
                conn.execute(
                    """
                SELECT DISTINCT mx.codigo AS matriz, me.elemento, me.unidad
                FROM analisis_quimicos a
                JOIN muestras mu ON mu.id_muestra = a.id_muestra
                JOIN matrices mx ON mx.id_matriz = mu.id_matriz
                JOIN mediciones_quimicas me ON me.id_analisis = a.id_analisis
                WHERE a.id_referencia = ?
                """,
                    (reference_row["id_referencia"],),
                ).fetchall()
            )
            reference_row["matrices"] = _values(details, "matriz")
            reference_row["elementos"] = _values(details, "elemento")
            reference_row["unidades"] = _values(details, "unidad")

        filter_sql, filter_params = _measurement_filter_sql(
            source,
            matriz,
            referencia,
            sexo,
            edad,
            elemento,
            patologia,
        )
        summary = dict(
            conn.execute(
                f"""
            SELECT
                COUNT(DISTINCT mu.id_muestra) AS muestras,
                COUNT(DISTINCT mu.id_individuo) AS individuos,
                COUNT(DISTINCT a.id_analisis) AS analisis,
                COUNT(DISTINCT me.id_medicion) AS mediciones,
                COUNT(DISTINCT me.elemento) AS elementos
            FROM muestras mu
            JOIN matrices mx ON mx.id_matriz = mu.id_matriz
            JOIN individuos i ON i.id_individuo = mu.id_individuo
            LEFT JOIN analisis_quimicos a ON a.id_muestra = mu.id_muestra
            LEFT JOIN mediciones_quimicas me ON me.id_analisis = a.id_analisis
            {filter_sql}
            """,
                filter_params,
            ).fetchone()
        )
        element_rows = rows_to_dicts(
            conn.execute(
                f"""
            SELECT
                me.elemento,
                COUNT(DISTINCT me.id_medicion) AS mediciones,
                COUNT(DISTINCT mu.id_muestra) AS muestras,
                GROUP_CONCAT(DISTINCT me.unidad) AS unidades
            FROM muestras mu
            JOIN matrices mx ON mx.id_matriz = mu.id_matriz
            JOIN individuos i ON i.id_individuo = mu.id_individuo
            JOIN analisis_quimicos a ON a.id_muestra = mu.id_muestra
            JOIN mediciones_quimicas me ON me.id_analisis = a.id_analisis
            {filter_sql}
            GROUP BY me.elemento
            ORDER BY me.elemento
            """,
                filter_params,
            ).fetchall()
        )
        for element_row in element_rows:
            element_row["unidades"] = sorted(
                {
                    unit.strip()
                    for unit in str(element_row.get("unidades") or "").split(",")
                    if unit.strip()
                },
                key=str.casefold,
            )
        inferred = conn.execute(
            f"""
            SELECT COUNT(DISTINCT mu.id_muestra) AS n
            FROM muestras mu
            JOIN matrices mx ON mx.id_matriz = mu.id_matriz
            JOIN individuos i ON i.id_individuo = mu.id_individuo
            LEFT JOIN analisis_quimicos a ON a.id_muestra = mu.id_muestra
            LEFT JOIN mediciones_quimicas me ON me.id_analisis = a.id_analisis
            {filter_sql} AND mu.es_inferida = 1
            """,
            filter_params,
        ).fetchone()["n"]
        unit_conflicts = rows_to_dicts(
            conn.execute(
                f"""
            SELECT
                mu.id_muestra,
                me.elemento,
                GROUP_CONCAT(DISTINCT me.unidad) AS unidades
            FROM muestras mu
            JOIN matrices mx ON mx.id_matriz = mu.id_matriz
            JOIN individuos i ON i.id_individuo = mu.id_individuo
            JOIN analisis_quimicos a ON a.id_muestra = mu.id_muestra
            JOIN mediciones_quimicas me ON me.id_analisis = a.id_analisis
            {filter_sql}
            GROUP BY mu.id_muestra, me.elemento
            HAVING COUNT(DISTINCT lower(COALESCE(me.unidad, ''))) > 1
            ORDER BY mu.id_muestra, me.elemento
            """,
                filter_params,
            ).fetchall()
        )

    warnings = []
    if inferred:
        warnings.append(
            {
                "code": "inferred_samples",
                "severity": "info",
                "count": inferred,
                "message": f"{inferred} muestras fueron reconstruidas desde mediciones historicas y requieren validar su codigo fisico.",
            }
        )
    if unit_conflicts:
        warnings.append(
            {
                "code": "mixed_units",
                "severity": "warning",
                "count": len(unit_conflicts),
                "message": "Existen combinaciones muestra-elemento con unidades distintas; no se promedian entre si.",
                "items": unit_conflicts[:25],
            }
        )
    return {
        "fuente": source,
        "selected": {
            "matriz": matriz or "",
            "referencia": referencia or "",
            "sexo": sexo or "",
            "edad": edad or "",
            "elemento": elemento or "",
            "patologia": patologia or "",
        },
        "summary": summary,
        "elementos": element_rows,
        "matrices": matrix_rows,
        "referencias": reference_rows,
        "warnings": warnings,
    }


def list_samples(
    fuente: str,
    matriz: Optional[str] = None,
    referencia: Optional[str] = None,
    sexo: Optional[str] = None,
    edad: Optional[str] = None,
    elemento: Optional[str] = None,
    patologia: Optional[str] = None,
    limit: int = 500,
    sample_id: Optional[str] = None,
) -> dict[str, Any]:
    """
    Lista las muestras (muestras físicas) de un sitio, con filtros.

    Cada muestra incluye su matriz, individuo asociado, análisis y mediciones.

    Args:
        fuente (str): Identificador del sitio.
        matriz (Optional[str]): Filtrar por matriz.
        referencia (Optional[str]): Filtrar por referencia.
        sexo (Optional[str]): Filtrar por sexo del individuo.
        edad (Optional[str]): Filtrar por edad.
        elemento (Optional[str]): Filtrar por elemento.
        patologia (Optional[str]): Filtrar por patología presente.
        limit (int): Máximo de muestras a devolver.
        sample_id (Optional[str]): Si se proporciona, solo devuelve esa muestra.

    Returns:
        dict: Total de muestras y lista de items con detalles.
    """

    ensure_analytical_model()
    source = _source(fuente)
    sql = """
        SELECT
            mu.*,
            mx.codigo AS matriz_codigo,
            mx.nombre AS matriz_nombre,
            mx.categoria AS matriz_categoria,
            i.id_documento,
            i.numero_cuerpo,
            i.sexo,
            i.edad,
            i.sitio
        FROM muestras mu
        JOIN matrices mx ON mx.id_matriz = mu.id_matriz
        JOIN individuos i ON i.id_individuo = mu.id_individuo
        WHERE lower(COALESCE(mu.fuente, i.fuente, '')) = ?
    """
    params: list[Any] = [source]
    if sample_id:
        sql += " AND mu.id_muestra = ?"
        params.append(sample_id)
    if matriz:
        sql += " AND (lower(mx.codigo) = ? OR lower(mx.id_matriz) = ?)"
        normalized = matriz.strip().lower()
        params.extend([normalized, normalized])
    if sexo:
        sql += " AND lower(COALESCE(i.sexo, '')) = ?"
        params.append(sexo.strip().lower())
    if edad:
        sql += " AND lower(COALESCE(i.edad, '')) = ?"
        params.append(edad.strip().lower())
    if referencia:
        sql += " AND EXISTS (SELECT 1 FROM analisis_quimicos a WHERE a.id_muestra = mu.id_muestra AND lower(COALESCE(a.id_referencia, '')) = ?)"
        params.append(referencia.strip().lower())
    if elemento:
        sql += """
            AND EXISTS (
                SELECT 1
                FROM analisis_quimicos a
                JOIN mediciones_quimicas me ON me.id_analisis = a.id_analisis
                WHERE a.id_muestra = mu.id_muestra
                  AND lower(COALESCE(me.elemento, '')) = ?
            )
        """
        params.append(elemento.strip().lower())
    if patologia:
        sql += """
            AND EXISTS (
                SELECT 1 FROM paleopatologias p
                WHERE p.id_individuo = i.id_individuo
                  AND lower(COALESCE(p.fuente, i.fuente, '')) = ?
                  AND lower(COALESCE(p.patologia, '')) = ?
                  AND COALESCE(p.presente, 0) = 1
            )
        """
        params.extend([source, patologia.strip().lower()])
    count_sql = f"SELECT COUNT(*) AS n FROM ({sql}) AS filtered_samples"
    count_params = list(params)
    sql += " ORDER BY COALESCE(i.numero_cuerpo, i.id_documento, i.id_individuo), mx.nombre LIMIT ?"
    params.append(max(1, min(limit, 1000)))

    with get_connection() as conn:
        total = conn.execute(count_sql, count_params).fetchone()["n"]
        sample_rows = rows_to_dicts(conn.execute(sql, params).fetchall())
        sample_ids = [row["id_muestra"] for row in sample_rows]
        analyses_by_sample: dict[str, list[dict[str, Any]]] = defaultdict(list)
        measurements_by_analysis: dict[str, list[dict[str, Any]]] = defaultdict(list)
        if sample_ids:
            placeholders = ",".join("?" for _ in sample_ids)
            analysis_sql = f"""
                SELECT a.*, r.titulo AS referencia_titulo
                FROM analisis_quimicos a
                LEFT JOIN referencias_analiticas r ON r.id_referencia = a.id_referencia
                WHERE a.id_muestra IN ({placeholders})
            """
            analysis_params: list[Any] = list(sample_ids)
            if referencia:
                analysis_sql += " AND lower(COALESCE(a.id_referencia, '')) = ?"
                analysis_params.append(referencia.strip().lower())
            if elemento:
                analysis_sql += """
                    AND EXISTS (
                        SELECT 1 FROM mediciones_quimicas me
                        WHERE me.id_analisis = a.id_analisis
                          AND lower(COALESCE(me.elemento, '')) = ?
                    )
                """
                analysis_params.append(elemento.strip().lower())
            analysis_sql += " ORDER BY a.dataset_origen, a.id_analisis"
            analyses = rows_to_dicts(
                conn.execute(analysis_sql, analysis_params).fetchall()
            )
            for analysis in analyses:
                analyses_by_sample[analysis["id_muestra"]].append(analysis)
            analysis_ids = [row["id_analisis"] for row in analyses]
            if analysis_ids:
                analysis_placeholders = ",".join("?" for _ in analysis_ids)
                measurement_sql = f"""
                    SELECT * FROM mediciones_quimicas
                    WHERE id_analisis IN ({analysis_placeholders})
                """
                measurement_params: list[Any] = list(analysis_ids)
                if elemento:
                    measurement_sql += " AND lower(COALESCE(elemento, '')) = ?"
                    measurement_params.append(elemento.strip().lower())
                measurement_sql += " ORDER BY elemento, id_medicion"
                measurements = rows_to_dicts(
                    conn.execute(
                        measurement_sql,
                        measurement_params,
                    ).fetchall()
                )
                for measurement in measurements:
                    measurements_by_analysis[measurement["id_analisis"]].append(
                        measurement
                    )

    items = []
    for row in sample_rows:
        analyses = analyses_by_sample.get(row["id_muestra"], [])
        measurements = [
            measurement
            for analysis in analyses
            for measurement in measurements_by_analysis.get(analysis["id_analisis"], [])
        ]
        items.append(
            {
                "id_muestra": row["id_muestra"],
                "codigo_muestra": row["codigo_muestra"],
                "tipo_muestra_original": row.get("tipo_muestra_original"),
                "elemento_anatomico": row.get("elemento_anatomico"),
                "lateralidad": row.get("lateralidad"),
                "ubicacion_anatomica": row.get("ubicacion_anatomica"),
                "fecha_muestreo": row.get("fecha_muestreo"),
                "estado_conservacion": row.get("estado_conservacion"),
                "observaciones": row.get("observaciones"),
                "es_inferida": bool(row.get("es_inferida")),
                "estado": row.get("estado"),
                "matriz": {
                    "id_matriz": row["id_matriz"],
                    "codigo": row["matriz_codigo"],
                    "nombre": row["matriz_nombre"],
                    "categoria": row["matriz_categoria"],
                },
                "individuo": {
                    "id_individuo": row["id_individuo"],
                    "id_documento": row.get("id_documento"),
                    "numero_cuerpo": row.get("numero_cuerpo"),
                    "sexo": row.get("sexo"),
                    "edad": row.get("edad"),
                    "sitio": row.get("sitio"),
                },
                "analisis": len(analyses),
                "mediciones": len(measurements),
                "elementos": _values(measurements, "elemento"),
                "unidades": _values(measurements, "unidad"),
                "referencias": [
                    {"id_referencia": reference_id, "titulo": title}
                    for reference_id, title in sorted(
                        {
                            (
                                analysis.get("id_referencia"),
                                analysis.get("referencia_titulo"),
                            )
                            for analysis in analyses
                            if analysis.get("id_referencia")
                        },
                        key=lambda item: str(item[1] or "").casefold(),
                    )
                ],
            }
        )
    return {
        "fuente": source,
        "total": total,
        "items": items,
    }


def get_sample_detail(fuente: str, sample_id: str) -> dict[str, Any] | None:
    """
    Obtiene el detalle completo de una muestra física.

    Incluye:
        - Datos de la muestra (matriz, individuo, etc.)
        - Lista de análisis con sus mediciones y referencias.

    Args:
        fuente (str): Identificador del sitio.
        sample_id (str): ID de la muestra (id_muestra).

    Returns:
        dict | None: Detalle de la muestra o None si no existe.
    """

    result = list_samples(fuente, limit=1, sample_id=sample_id)
    sample = result["items"][0] if result["items"] else None
    if not sample:
        return None
    with get_connection() as conn:
        analyses = rows_to_dicts(
            conn.execute(
                """
            SELECT a.*, r.titulo AS referencia_titulo, r.cita, r.doi, r.url
            FROM analisis_quimicos a
            LEFT JOIN referencias_analiticas r ON r.id_referencia = a.id_referencia
            WHERE a.id_muestra = ?
            ORDER BY a.dataset_origen, a.id_analisis
            """,
                (sample_id,),
            ).fetchall()
        )
        for analysis in analyses:
            analysis["mediciones"] = rows_to_dicts(
                conn.execute(
                    """
                SELECT id_medicion, elemento, concentracion, unidad, estado
                FROM mediciones_quimicas
                WHERE id_analisis = ?
                ORDER BY elemento, id_medicion
                """,
                    (analysis["id_analisis"],),
                ).fetchall()
            )
    sample["analisis_detalle"] = analyses
    return sample
