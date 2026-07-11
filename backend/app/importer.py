from __future__ import annotations

import json
from pathlib import Path
import pandas as pd
from .database import get_connection

INDIVIDUOS_COLUMNS = [
    "id_individuo", "id_documento", "numero_cuerpo", "sexo", "edad", "sitio",
    "cementerio", "cronologia", "estilo_momificacion", "referencia_bibliografica"
]

MEDICIONES_COLUMNS = [
    "id_medicion", "id_individuo", "tipo_muestra", "elemento", "concentracion", "unidad",
    "metodo", "laboratorio", "fecha", "observaciones"
]


def _clean(value):
    if pd.isna(value):
        return None
    if isinstance(value, str):
        value = value.strip()
        return value if value else None
    return value


def import_individuos_csv(path: Path) -> dict:
    df = pd.read_csv(path)
    missing = [c for c in ["id_individuo", "id_documento"] if c not in df.columns]
    if missing:
        return {
            "inserted": 0,
            "updated": 0,
            "skipped": 0,
            "rows_total": len(df),
            "errors": ["Faltan columnas: " + ", ".join(missing)],
        }

    inserted, updated, errors = 0, 0, []
    with get_connection() as conn:
        for idx, row in df.iterrows():
            data = {col: _clean(row[col]) if col in row else None for col in INDIVIDUOS_COLUMNS}
            if not data["id_individuo"] or not data["id_documento"]:
                errors.append(f"Fila {idx + 2}: id_individuo e id_documento son obligatorios")
                continue
            exists = conn.execute("SELECT 1 FROM individuos WHERE id_individuo = ?", (data["id_individuo"],)).fetchone()
            conn.execute('''
                INSERT INTO individuos (
                    id_individuo, id_documento, numero_cuerpo, sexo, edad, sitio,
                    cementerio, cronologia, estilo_momificacion, referencia_bibliografica
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    updated_at = CURRENT_TIMESTAMP
            ''', tuple(data[c] for c in INDIVIDUOS_COLUMNS))
            updated += 1 if exists else 0
            inserted += 0 if exists else 1
    return {
        "inserted": inserted,
        "updated": updated,
        "skipped": len(errors),
        "rows_total": len(df),
        "errors": errors,
    }


def _insert_mediciones_rows(conn, rows: list[dict]) -> dict:
    inserted, updated, skipped = 0, 0, 0
    for row in rows:
        if not row.get("id_medicion") or not row.get("id_individuo") or not row.get("elemento"):
            skipped += 1
            continue
        exists = conn.execute("SELECT 1 FROM mediciones_quimicas WHERE id_medicion = ?", (row["id_medicion"],)).fetchone()
        conn.execute('''
            INSERT INTO mediciones_quimicas (
                id_medicion, id_individuo, tipo_muestra, elemento, concentracion, unidad,
                metodo, laboratorio, fecha, observaciones
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                updated_at = CURRENT_TIMESTAMP
        ''', (
            row["id_medicion"], row["id_individuo"], row.get("tipo_muestra"), row["elemento"],
            row["concentracion"], row.get("unidad") or "ppm", row.get("metodo"), row.get("laboratorio"),
            row.get("fecha"), row.get("observaciones")
        ))
        updated += 1 if exists else 0
        inserted += 0 if exists else 1
    return {
        "inserted": inserted,
        "updated": updated,
        "skipped": skipped,
    }


def _extract_mediciones_from_analisis_json(path: Path) -> tuple[list[dict], list[str]]:
    cases, _ = _load_json_cases(path)
    mediciones: list[dict] = []
    errors: list[str] = []
    existing_ids: set[str] = set()

    for idx, raw in enumerate(cases):
        if not isinstance(raw, dict):
            continue
        case_id = _clean(raw.get("id"))
        if not case_id:
            errors.append(f"Fila {idx + 2}: falta el id del caso")
            continue

        analisis = raw.get("analisis_quimicos") or {}
        tipo_muestra = _clean(analisis.get("matriz"))
        elementos = analisis.get("elementos") or {}
        if not isinstance(elementos, dict):
            continue

        for elemento_name, elemento_data in elementos.items():
            if not elemento_name:
                continue
            if isinstance(elemento_data, dict):
                valor = elemento_data.get("valor")
                unidad = _clean(elemento_data.get("unidad"))
                metodo = _clean(elemento_data.get("metodo"))
                laboratorio = _clean(elemento_data.get("laboratorio"))
                fecha = _clean(elemento_data.get("fecha"))
                observaciones = _clean(elemento_data.get("observaciones"))
            else:
                valor = elemento_data
                unidad = None
                metodo = None
                laboratorio = None
                fecha = None
                observaciones = None

            if valor is None:
                # Importar mediciones incluso con valor null para mantener registro completo
                concentracion = None
                unidad = unidad or "ppm"
            else:
                try:
                    concentracion = float(valor)
                except Exception:
                    errors.append(f"Fila {idx + 2}: valor no numérico para {elemento_name}")
                    continue
                unidad = unidad or "ppm"

            base_id = f"{case_id}_{elemento_name}_{tipo_muestra or 'muestra'}"
            medida_id = base_id
            counter = 1
            while medida_id in existing_ids:
                counter += 1
                medida_id = f"{base_id}_{counter}"
            existing_ids.add(medida_id)

            mediciones.append({
                "id_medicion": medida_id,
                "id_individuo": case_id,
                "tipo_muestra": tipo_muestra,
                "elemento": elemento_name,
                "concentracion": concentracion,
                "unidad": unidad or "ppm",
                "metodo": metodo,
                "laboratorio": laboratorio,
                "fecha": fecha,
                "observaciones": observaciones,
            })
    return mediciones, errors

def import_mediciones_csv(path: Path) -> dict:
    df = pd.read_csv(path)
    missing = [c for c in ["id_medicion", "id_individuo", "elemento", "concentracion"] if c not in df.columns]
    if missing:
        return {
            "inserted": 0,
            "updated": 0,
            "skipped": 0,
            "rows_total": len(df),
            "errors": ["Faltan columnas: " + ", ".join(missing)],
        }

    inserted, updated, errors = 0, 0, []
    with get_connection() as conn:
        for idx, row in df.iterrows():
            data = {col: _clean(row[col]) if col in row else None for col in MEDICIONES_COLUMNS}
            if not data["id_medicion"] or not data["id_individuo"] or not data["elemento"]:
                errors.append(f"Fila {idx + 2}: id_medicion, id_individuo y elemento son obligatorios")
                continue
            try:
                data["concentracion"] = float(data["concentracion"])
            except Exception:
                errors.append(f"Fila {idx + 2}: concentracion debe ser numérica")
                continue
            individuo = conn.execute("SELECT 1 FROM individuos WHERE id_individuo = ?", (data["id_individuo"],)).fetchone()
            if not individuo:
                errors.append(f"Fila {idx + 2}: id_individuo no existe: {data['id_individuo']}")
                continue
            exists = conn.execute("SELECT 1 FROM mediciones_quimicas WHERE id_medicion = ?", (data["id_medicion"],)).fetchone()
            conn.execute('''
                INSERT INTO mediciones_quimicas (
                    id_medicion, id_individuo, tipo_muestra, elemento, concentracion, unidad,
                    metodo, laboratorio, fecha, observaciones
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    updated_at = CURRENT_TIMESTAMP
            ''', (
                data["id_medicion"], data["id_individuo"], data["tipo_muestra"], data["elemento"],
                data["concentracion"], data["unidad"] or "ppm", data["metodo"], data["laboratorio"],
                data["fecha"], data["observaciones"]
            ))
            updated += 1 if exists else 0
            inserted += 0 if exists else 1
    return {
        "inserted": inserted,
        "updated": updated,
        "skipped": len(errors),
        "rows_total": len(df),
        "errors": errors,
    }


def _load_json_cases(path: Path) -> tuple[list[dict], dict]:
    with path.open(encoding="utf-8") as fh:
        payload = json.load(fh)

    if isinstance(payload, dict):
        for value in payload.values():
            if isinstance(value, dict) and isinstance(value.get("casos"), list):
                return value["casos"], value
    return [], {}


def import_azapa_master_data(reference_path: Path, dataciones_path: Path | None = None, analisis_as_cabello_path: Path | None = None, analisis_as_b_li_costilla_path: Path | None = None) -> dict:
    if not reference_path.exists():
        return {"inserted": 0, "updated": 0, "skipped": 0, "rows_total": 0, "errors": ["No existe el archivo JSON de referencia de AZAPA"]}

    reference_cases, reference_root = _load_json_cases(reference_path)
    if not reference_cases:
        return {"inserted": 0, "updated": 0, "skipped": 0, "rows_total": 0, "errors": ["El JSON de referencia de AZAPA no contiene casos"]}

    inserted, updated, skipped, errors = 0, 0, 0, []
    with get_connection() as conn:
        for idx, raw in enumerate(reference_cases):
            if not isinstance(raw, dict):
                continue

            case_id = _clean(raw.get("id"))
            if not case_id:
                errors.append(f"Fila {idx + 2}: falta el id del caso")
                continue

            case_individuo = raw.get("individuo") or {}
            sexo = _clean(case_individuo.get("sexo"))
            edad = _clean(case_individuo.get("grupo_edad") or case_individuo.get("edad"))
            sitio = _clean(reference_root.get("sitio") or reference_root.get("area") or raw.get("tumba"))
            cementerio = sitio
            numero_cuerpo = _clean(raw.get("tumba"))
            cultura = _clean(raw.get("cultura"))
            referencia = _clean(raw.get("referencia") or raw.get("tumba") or case_id)
            notas_parts = []
            if cultura:
                notas_parts.append(f"cultura={cultura}")
            notas = "; ".join(notas_parts) if notas_parts else None

            exists = conn.execute("SELECT 1 FROM individuos WHERE id_individuo = ?", (case_id,)).fetchone()
            conn.execute('''
                INSERT INTO individuos (
                    id_individuo, id_documento, numero_cuerpo, sexo, edad, sitio,
                    cementerio, cronologia, estilo_momificacion, referencia_bibliografica, notas, fuente
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    notas = COALESCE(excluded.notas, notas),
                    fuente = COALESCE(excluded.fuente, fuente),
                    updated_at = CURRENT_TIMESTAMP
            ''', (
                case_id, referencia, numero_cuerpo, sexo, edad, sitio,
                cementerio, None, None, referencia, notas, "azapa"
            ))
            updated += 1 if exists else 0
            inserted += 0 if exists else 1

            if dataciones_path and dataciones_path.exists():
                dataciones_cases, _ = _load_json_cases(dataciones_path)
                for dat_case in dataciones_cases:
                    if not isinstance(dat_case, dict):
                        continue
                    if str(dat_case.get("id") or "").strip() != case_id:
                        continue
                    datacion = dat_case.get("datacion_radiocarbono") or {}
                    if isinstance(datacion, dict) and datacion.get("referencia_datos"):
                        conn.execute(
                            "UPDATE individuos SET notas = COALESCE(notas, '') || ? WHERE id_individuo = ?",
                            (f"Datación radiocarbónica: {datacion['referencia_datos']}; ", case_id),
                        )
                    break

        def _append_measurements(path: Path | None, source_name: str) -> None:
            nonlocal inserted, updated, skipped
            if not path or not path.exists():
                return
            cases, _ = _load_json_cases(path)
            existing_ids: set[str] = set()
            for idx, raw in enumerate(cases):
                if not isinstance(raw, dict):
                    continue
                case_id = _clean(raw.get("id"))
                if not case_id:
                    errors.append(f"Fila {idx + 2}: falta el id del caso en {source_name}")
                    continue
                analisis = raw.get("analisis_quimicos") or {}
                tipo_muestra = _clean(analisis.get("matriz"))
                elementos = analisis.get("elementos") or {}
                if not isinstance(elementos, dict):
                    continue
                for elemento_name, elemento_data in elementos.items():
                    if not elemento_name:
                        continue
                    if isinstance(elemento_data, dict):
                        valor = elemento_data.get("valor")
                        unidad = _clean(elemento_data.get("unidad"))
                        metodo = _clean(elemento_data.get("metodo"))
                        laboratorio = _clean(elemento_data.get("laboratorio"))
                        fecha = _clean(elemento_data.get("fecha"))
                        observaciones = _clean(elemento_data.get("observaciones"))
                    else:
                        valor = elemento_data
                        unidad = None
                        metodo = None
                        laboratorio = None
                        fecha = None
                        observaciones = None

                    if valor is None:
                        concentracion = None
                        unidad = unidad or "ppm"
                    else:
                        try:
                            concentracion = float(valor)
                        except Exception:
                            errors.append(f"Fila {idx + 2}: valor no numérico para {elemento_name} en {source_name}")
                            continue
                        unidad = unidad or "ppm"

                    base_id = f"{case_id}_{elemento_name}_{tipo_muestra or 'muestra'}"
                    medida_id = base_id
                    counter = 1
                    while medida_id in existing_ids:
                        counter += 1
                        medida_id = f"{base_id}_{counter}"
                    existing_ids.add(medida_id)

                    row = {
                        "id_medicion": medida_id,
                        "id_individuo": case_id,
                        "tipo_muestra": tipo_muestra,
                        "elemento": elemento_name,
                        "concentracion": concentracion,
                        "unidad": unidad or "ppm",
                        "metodo": metodo,
                        "laboratorio": laboratorio,
                        "fecha": fecha,
                        "observaciones": observaciones,
                    }
                    exists = conn.execute("SELECT 1 FROM mediciones_quimicas WHERE id_medicion = ?", (row["id_medicion"],)).fetchone()
                    conn.execute('''
                        INSERT INTO mediciones_quimicas (
                            id_medicion, id_individuo, tipo_muestra, elemento, concentracion, unidad,
                            metodo, laboratorio, fecha, observaciones, fuente
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                            fuente = COALESCE(excluded.fuente, fuente),
                            updated_at = CURRENT_TIMESTAMP
                    ''', (
                        row["id_medicion"], row["id_individuo"], row.get("tipo_muestra"), row["elemento"],
                        row["concentracion"], row.get("unidad") or "ppm", row.get("metodo"), row.get("laboratorio"),
                        row.get("fecha"), row.get("observaciones"), "azapa"
                    ))
                    updated += 1 if exists else 0
                    inserted += 0 if exists else 1

        _append_measurements(analisis_as_cabello_path, "analisis_as_cabello")
        _append_measurements(analisis_as_b_li_costilla_path, "analisis_as_b_li_costilla")

    return {
        "inserted": inserted,
        "updated": updated,
        "skipped": skipped,
        "rows_total": len(reference_cases),
        "errors": errors,
    }


def import_morro1_master_data(reference_path: Path, paleopatologia_path: Path | None = None, catalog_path: Path | None = None, analisis_path: Path | None = None, mediciones_path: Path | None = None) -> dict:
    if not reference_path.exists():
        return {"inserted": 0, "updated": 0, "skipped": 0, "rows_total": 0, "errors": ["No existe el archivo JSON de referencia"]}

    reference_cases, reference_root = _load_json_cases(reference_path)
    if not reference_cases:
        return {"inserted": 0, "updated": 0, "skipped": 0, "rows_total": 0, "errors": ["El JSON de referencia no contiene casos"]}

    paleopath_cases: list[dict] = []
    paleopath_root: dict = {}
    if paleopatologia_path and paleopatologia_path.exists():
        paleopath_cases, paleopath_root = _load_json_cases(paleopatologia_path)

    paleopath_by_id = {
        str(case.get("id") or "").strip(): case
        for case in paleopath_cases
        if isinstance(case, dict) and case.get("id")
    }

    inserted, updated, skipped, errors = 0, 0, 0, []
    with get_connection() as conn:
        for idx, raw in enumerate(reference_cases):
            if not isinstance(raw, dict):
                continue

            case_id = _clean(raw.get("id"))
            if not case_id:
                errors.append(f"Fila {idx + 2}: falta el id del caso")
                continue

            paleo = paleopath_by_id.get(case_id, {})
            case_individuo = raw.get("individuo") or {}
            paleo_individuo = paleo.get("individuo") or {}
            contexto = paleo.get("contexto_funerario") or {}
            referencia = _clean(raw.get("referencia") or paleo.get("referencia") or paleo.get("referencia_normalizada") or raw.get("tumba"))

            id_individuo = case_id
            id_documento = referencia or case_id
            numero_cuerpo = _clean(raw.get("tumba") or raw.get("referencia") or case_id)
            sexo = _clean(case_individuo.get("sexo") or paleo_individuo.get("sexo"))
            edad = _clean(
                case_individuo.get("grupo_edad") or case_individuo.get("edad") or
                paleo_individuo.get("grupo_edad") or paleo_individuo.get("edad")
            )
            sitio = _clean(reference_root.get("sitio") or reference_root.get("area") or paleo.get("sitio") or paleo.get("area"))
            cementerio = sitio
            cronologia = None
            estilo_momificacion = _clean(contexto.get("tipo_momificacion"))

            notations = []
            if paleo.get("referencia_normalizada"):
                notations.append(f"ref_norm={paleo['referencia_normalizada']}")
            if contexto:
                for key, value in contexto.items():
                    if _clean(value):
                        notations.append(f"{key}={value}")
            if isinstance(paleo.get("paleopatologia"), dict):
                for key, value in paleo["paleopatologia"].items():
                    if _clean(value):
                        notations.append(f"{key}={value}")
            notas = "; ".join(notations) if notations else None

            if not id_documento:
                errors.append(f"Fila {idx + 2}: falta id_documento para el caso {case_id}")
                continue

            exists = conn.execute("SELECT 1 FROM individuos WHERE id_individuo = ?", (id_individuo,)).fetchone()
            conn.execute('''
                INSERT INTO individuos (
                    id_individuo, id_documento, numero_cuerpo, sexo, edad, sitio,
                    cementerio, cronologia, estilo_momificacion, referencia_bibliografica, notas, fuente
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    notas = COALESCE(excluded.notas, notas),
                    fuente = COALESCE(excluded.fuente, fuente),
                    updated_at = CURRENT_TIMESTAMP
            ''', (
                id_individuo, id_documento, numero_cuerpo, sexo, edad, sitio,
                cementerio, cronologia, estilo_momificacion, referencia, notas, "morro1"
            ))
            updated += 1 if exists else 0
            inserted += 0 if exists else 1

        if catalog_path and catalog_path.exists():
            catalog_df = pd.read_csv(catalog_path)
            catalog_columns = {"id_individuo_catalogo", "id_key", "descripcion_sintetica"}
            if catalog_columns.issubset(set(catalog_df.columns)):
                for _, row in catalog_df.iterrows():
                    case_id = _clean(row.get("id_individuo_catalogo") or row.get("id_key") or row.get("id_documento"))
                    if not case_id:
                        continue
                    record_id = str(case_id).strip().replace("individuo_caso_", "caso_")
                    conn.execute(
                        "UPDATE individuos SET notas = COALESCE(notas, '') || ? WHERE id_individuo = ?",
                        (f"Catalogo: {row.get('descripcion_sintetica') or ''}; ", record_id),
                    )

        if analisis_path and analisis_path.exists():
            mediciones_rows, mediciones_errors = _extract_mediciones_from_analisis_json(analisis_path)
            errors.extend(mediciones_errors)
            if mediciones_rows:
                mediciones_result = _insert_mediciones_rows(conn, mediciones_rows)
                inserted += mediciones_result["inserted"]
                updated += mediciones_result["updated"]
                skipped += mediciones_result["skipped"]

    if mediciones_path and mediciones_path.exists():
        mediciones_result = import_mediciones_csv(mediciones_path)
        inserted += mediciones_result["inserted"]
        updated += mediciones_result["updated"]
        skipped += mediciones_result["skipped"]
        errors.extend(mediciones_result["errors"])

    return {
        "inserted": inserted,
        "updated": updated,
        "skipped": skipped,
        "rows_total": len(reference_cases),
        "errors": errors,
    }
