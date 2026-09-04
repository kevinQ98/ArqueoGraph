from __future__ import annotations

import argparse
import csv
import json
import re
import shlex
import sys
import unicodedata
from pathlib import Path
from typing import Any

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.database import get_connection, rows_to_dicts  # noqa: E402
from app.importer import (  # noqa: E402
    DATACIONES_COLUMNS,
    IMAGENES_COLUMNS,
    INDIVIDUOS_COLUMNS,
    MEDICIONES_COLUMNS,
    PALEOPATOLOGIAS_COLUMNS,
    SITIOS_COLUMNS,
    import_dataciones_csv,
    import_imagenes_csv,
    import_individuos_csv,
    import_mediciones_csv,
    import_paleopatologias_csv,
    import_sitios_csv,
)
from app.sqlite_migration import ensure_sqlite_sources  # noqa: E402


SAMPLE_DIR = BACKEND_DIR / "sample_data"
IMAGES_DIR = BACKEND_DIR / "data" / "imagenes"

CSV_SPECS = {
    "sitios": {
        "filename": "sitios.csv",
        "columns": SITIOS_COLUMNS,
        "required": ["id_sitio", "nombre"],
        "id_column": "id_sitio",
    },
    "individuos": {
        "filename": "individuos.csv",
        "columns": INDIVIDUOS_COLUMNS,
        "required": ["id_individuo", "id_documento"],
        "id_column": "id_individuo",
    },
    "mediciones": {
        "filename": "mediciones_quimicas.csv",
        "columns": MEDICIONES_COLUMNS,
        "required": ["id_medicion", "id_individuo", "elemento", "concentracion"],
        "id_column": "id_medicion",
    },
    "paleopatologias": {
        "filename": "paleopatologias.csv",
        "columns": PALEOPATOLOGIAS_COLUMNS,
        "required": ["id_paleopatologia", "id_individuo", "patologia"],
        "id_column": "id_paleopatologia",
    },
    "dataciones": {
        "filename": "dataciones.csv",
        "columns": DATACIONES_COLUMNS,
        "required": ["id_datacion", "id_individuo"],
        "id_column": "id_datacion",
    },
    "imagenes": {
        "filename": "imagenes.csv",
        "columns": IMAGENES_COLUMNS,
        "required": ["id_imagen", "id_individuo", "relative_path"],
        "id_column": "id_imagen",
    },
}

IMPORT_ORDER = [
    ("sitios", import_sitios_csv),
    ("individuos", import_individuos_csv),
    ("mediciones", import_mediciones_csv),
    ("paleopatologias", import_paleopatologias_csv),
    ("dataciones", import_dataciones_csv),
    ("imagenes", import_imagenes_csv),
]


def slugify(value: str) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-zA-Z0-9]+", "_", text).strip("_").lower()
    return text


def normalize_site_id(value: str) -> str:
    site_id = slugify(value)
    if not site_id:
        raise ValueError("El id del sitio no puede quedar vacio")
    return site_id


def package_dir_for(site_id: str, package_dir: str | None = None) -> Path:
    return (
        Path(package_dir).expanduser().resolve()
        if package_dir
        else SAMPLE_DIR / site_id
    )


def write_csv(
    path: Path, columns: list[str], rows: list[dict[str, Any]], overwrite: bool
) -> None:
    if path.exists() and not overwrite:
        raise FileExistsError(
            f"Ya existe {path}. Usa --overwrite si quieres reemplazarlo."
        )
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=columns)
        writer.writeheader()
        for row in rows:
            writer.writerow({column: row.get(column) for column in columns})


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    if not path.exists():
        return [], []
    with path.open(newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        return list(reader.fieldnames or []), list(reader)


def unique_id(base: str, used: set[str]) -> str:
    candidate = base
    counter = 2
    while candidate in used:
        candidate = f"{base}_{counter}"
        counter += 1
    used.add(candidate)
    return candidate


def target_case_id(
    source_id: str, target_site_id: str, source_site_id: str, used: set[str]
) -> str:
    source_text = str(source_id or "")
    source_prefix = f"{source_site_id.lower()}_"
    if source_text.lower().startswith(source_prefix):
        suffix = source_text[len(source_prefix) :]
    else:
        suffix = source_text
    suffix = slugify(suffix) or "caso"
    return unique_id(f"{target_site_id}_{suffix}", used)


def target_record_id(
    target_site_id: str, source_id: Any, fallback: str, used: set[str]
) -> str:
    suffix = slugify(str(source_id or fallback)) or fallback
    return unique_id(f"{target_site_id}_{suffix}", used)


def fetch_source_rows(source_site_id: str) -> dict[str, list[dict[str, Any]]]:
    ensure_sqlite_sources()
    with get_connection() as conn:
        source = source_site_id.strip().lower()
        individuals = rows_to_dicts(
            conn.execute(
                """
            SELECT *
            FROM individuos
            WHERE lower(COALESCE(fuente, '')) = ?
            ORDER BY id_individuo
            """,
                (source,),
            ).fetchall()
        )
        if not individuals:
            raise ValueError(
                f"No encontre individuos para la fuente '{source_site_id}'"
            )

        measurements = rows_to_dicts(
            conn.execute(
                """
            SELECT m.*
            FROM mediciones_quimicas m
            JOIN individuos i ON i.id_individuo = m.id_individuo
            WHERE lower(COALESCE(i.fuente, m.fuente, '')) = ?
            ORDER BY m.id_medicion
            """,
                (source,),
            ).fetchall()
        )
        pathologies = rows_to_dicts(
            conn.execute(
                """
            SELECT p.*
            FROM paleopatologias p
            JOIN individuos i ON i.id_individuo = p.id_individuo
            WHERE lower(COALESCE(i.fuente, p.fuente, '')) = ?
            ORDER BY p.id_paleopatologia
            """,
                (source,),
            ).fetchall()
        )
        datations = rows_to_dicts(
            conn.execute(
                """
            SELECT d.*
            FROM dataciones d
            JOIN individuos i ON i.id_individuo = d.id_individuo
            WHERE lower(COALESCE(i.fuente, d.fuente, '')) = ?
            ORDER BY d.id_datacion
            """,
                (source,),
            ).fetchall()
        )
        images = rows_to_dicts(
            conn.execute(
                """
            SELECT img.*
            FROM imagenes img
            JOIN individuos i ON i.id_individuo = img.id_individuo
            WHERE lower(COALESCE(i.fuente, img.fuente, '')) = ?
            ORDER BY img.id_imagen
            """,
                (source,),
            ).fetchall()
        )

    return {
        "individuos": individuals,
        "mediciones": measurements,
        "paleopatologias": pathologies,
        "dataciones": datations,
        "imagenes": images,
    }


def blank_rows(
    args: argparse.Namespace, site_id: str
) -> dict[str, list[dict[str, Any]]]:
    return {
        "sitios": [site_row(args, site_id)],
        "individuos": [],
        "mediciones": [],
        "paleopatologias": [],
        "dataciones": [],
        "imagenes": [],
    }


def site_row(args: argparse.Namespace, site_id: str) -> dict[str, Any]:
    return {
        "id_sitio": site_id,
        "nombre": args.nombre,
        "area": args.area,
        "descripcion": args.descripcion,
        "lat": args.lat,
        "lng": args.lng,
        "view": args.view or "visualizacion",
        "estado": args.estado or "validado",
    }


def cloned_rows(
    args: argparse.Namespace, site_id: str
) -> dict[str, list[dict[str, Any]]]:
    source_site_id = args.clone_from.strip().lower()
    source = fetch_source_rows(source_site_id)
    case_ids: set[str] = set()
    record_ids = {name: set() for name in CSV_SPECS}
    id_map = {
        row["id_individuo"]: target_case_id(
            row["id_individuo"], site_id, source_site_id, case_ids
        )
        for row in source["individuos"]
    }
    prefix = args.prefix or site_id.upper()

    individuals = []
    for row in source["individuos"]:
        original_ref = (
            row.get("id_documento") or row.get("numero_cuerpo") or row["id_individuo"]
        )
        individuals.append(
            {
                "id_individuo": id_map[row["id_individuo"]],
                "id_documento": f"{prefix}-{original_ref}",
                "numero_cuerpo": row.get("numero_cuerpo"),
                "sexo": row.get("sexo"),
                "edad": row.get("edad"),
                "sitio": args.nombre,
                "cementerio": args.nombre,
                "cronologia": row.get("cronologia"),
                "estilo_momificacion": row.get("estilo_momificacion"),
                "referencia_bibliografica": args.referencia
                or f"Clon desde {source_site_id}",
                "fuente": site_id,
                "estado": args.estado or "validado",
                "notas": f"Registro clonado desde {source_site_id} para preparar un nuevo sitio",
            }
        )

    measurements = []
    for row in source["mediciones"]:
        if row["id_individuo"] not in id_map:
            continue
        measurements.append(
            {
                "id_medicion": target_record_id(
                    site_id,
                    row.get("id_medicion"),
                    "medicion",
                    record_ids["mediciones"],
                ),
                "id_individuo": id_map[row["id_individuo"]],
                "tipo_muestra": row.get("tipo_muestra"),
                "elemento": row.get("elemento"),
                "concentracion": row.get("concentracion"),
                "unidad": row.get("unidad") or "ppm",
                "metodo": row.get("metodo"),
                "laboratorio": row.get("laboratorio"),
                "fecha": row.get("fecha"),
                "observaciones": f"Medicion clonada desde {source_site_id}",
                "fuente": site_id,
                "estado": args.estado or "validado",
            }
        )

    pathologies = []
    for row in source["paleopatologias"]:
        if row["id_individuo"] not in id_map:
            continue
        pathologies.append(
            {
                "id_paleopatologia": target_record_id(
                    site_id,
                    row.get("id_paleopatologia"),
                    "paleo",
                    record_ids["paleopatologias"],
                ),
                "id_individuo": id_map[row["id_individuo"]],
                "patologia": row.get("patologia"),
                "valor": row.get("valor"),
                "presente": row.get("presente"),
                "fuente": site_id,
                "estado": args.estado or "validado",
            }
        )

    datations = []
    for row in source["dataciones"]:
        if row["id_individuo"] not in id_map:
            continue
        datations.append(
            {
                "id_datacion": target_record_id(
                    site_id,
                    row.get("id_datacion"),
                    "datacion",
                    record_ids["dataciones"],
                ),
                "id_individuo": id_map[row["id_individuo"]],
                "muestra": row.get("muestra"),
                "fecha_bp": row.get("fecha_bp"),
                "fecha_1sigma_ad": row.get("fecha_1sigma_ad"),
                "interceptos_ad": row.get("interceptos_ad"),
                "rango_calibrado_min": row.get("rango_calibrado_min"),
                "rango_calibrado_max": row.get("rango_calibrado_max"),
                "referencia_datos": row.get("referencia_datos"),
                "fuente": site_id,
                "estado": args.estado or "validado",
            }
        )

    images = []
    for row in source["imagenes"]:
        if row["id_individuo"] not in id_map:
            continue
        images.append(
            {
                "id_imagen": target_record_id(
                    site_id, row.get("id_imagen"), "imagen", record_ids["imagenes"]
                ),
                "id_individuo": id_map[row["id_individuo"]],
                "filename_original": row.get("filename_original"),
                "filename_saved": row.get("filename_saved"),
                "relative_path": row.get("relative_path"),
                "content_type": row.get("content_type"),
                "label": row.get("label"),
                "descripcion": f"Imagen referenciada desde {source_site_id}",
                "fuente": site_id,
                "estado": args.estado or "validado",
            }
        )

    return {
        "sitios": [site_row(args, site_id)],
        "individuos": individuals,
        "mediciones": measurements,
        "paleopatologias": pathologies,
        "dataciones": datations,
        "imagenes": images,
    }


def create_package(args: argparse.Namespace) -> dict[str, Any]:
    """
    Crea un paquete CSV para un nuevo sitio.

    Puede ser en blanco (sin datos) o clonado desde un sitio existente.

    Args:
        args: Argumentos del parser (id, nombre, clone-from, etc.)

    Returns:
        dict: Resumen del paquete creado (ruta, archivos, filas).
    """

    site_id = normalize_site_id(args.id)
    output_dir = package_dir_for(site_id, args.package_dir)
    rows_by_name = (
        cloned_rows(args, site_id) if args.clone_from else blank_rows(args, site_id)
    )

    for name, spec in CSV_SPECS.items():
        write_csv(
            output_dir / spec["filename"],
            list(spec["columns"]),
            rows_by_name[name],
            overwrite=args.overwrite,
        )

    package_arg = (
        f" --package-dir {shlex.quote(str(output_dir))}" if args.package_dir else ""
    )
    summary = {
        "site_id": site_id,
        "site_name": args.nombre,
        "package_dir": str(output_dir),
        "mode": "clone" if args.clone_from else "blank",
        "clone_from": args.clone_from or None,
        "files": {
            name: {
                "path": str(output_dir / spec["filename"]),
                "rows": len(rows_by_name[name]),
            }
            for name, spec in CSV_SPECS.items()
        },
        "next": [
            f"PYTHONPATH=backend python3 backend/scripts/site_package.py validate --id {site_id}{package_arg}",
            f"PYTHONPATH=backend python3 backend/scripts/site_package.py import --id {site_id}{package_arg}",
        ],
    }
    return summary


def validate_package(site_id: str, output_dir: Path) -> dict[str, Any]:
    """
    Valida un paquete CSV antes de importarlo.

    Revisa:
        - Existencia de todos los CSVs.
        - Columnas requeridas.
        - IDs duplicados.
        - Relaciones (id_individuo existente).
        - Consistencia de fuente.

    Args:
        site_id (str): ID del sitio.
        output_dir (Path): Directorio donde se encuentran los CSVs.

    Returns:
        dict: ok (bool), errors, warnings, conteos.
    """

    errors: list[str] = []
    warnings: list[str] = []
    counts: dict[str, int] = {}
    ids_by_file: dict[str, set[str]] = {}

    for name, spec in CSV_SPECS.items():
        path = output_dir / spec["filename"]
        headers, rows = read_csv(path)
        counts[name] = len(rows)
        if not path.exists():
            errors.append(f"Falta {path}")
            continue
        missing = [column for column in spec["required"] if column not in headers]
        if missing:
            errors.append(f"{spec['filename']}: faltan columnas {', '.join(missing)}")
        row_ids = [str(row.get(spec["id_column"]) or "").strip() for row in rows]
        duplicate_ids = sorted(
            {row_id for row_id in row_ids if row_id and row_ids.count(row_id) > 1}
        )
        if duplicate_ids:
            errors.append(
                f"{spec['filename']}: ids duplicados {', '.join(duplicate_ids[:10])}"
            )
        ids_by_file[name] = {row_id for row_id in row_ids if row_id}

    site_rows = read_csv(output_dir / CSV_SPECS["sitios"]["filename"])[1]
    if not any(row.get("id_sitio") == site_id for row in site_rows):
        errors.append(f"sitios.csv debe incluir una fila con id_sitio={site_id}")

    individual_ids = ids_by_file.get("individuos", set())
    for name in ["mediciones", "paleopatologias", "dataciones", "imagenes"]:
        _, rows = read_csv(output_dir / CSV_SPECS[name]["filename"])
        unknown = sorted(
            {
                str(row.get("id_individuo") or "").strip()
                for row in rows
                if str(row.get("id_individuo") or "").strip()
                and str(row.get("id_individuo") or "").strip() not in individual_ids
            }
        )
        if unknown:
            errors.append(
                f"{CSV_SPECS[name]['filename']}: id_individuo no existe en individuos.csv: {', '.join(unknown[:10])}"
            )

    for name, spec in CSV_SPECS.items():
        _, rows = read_csv(output_dir / spec["filename"])
        for index, row in enumerate(rows, start=2):
            fuente = str(row.get("fuente") or "").strip()
            if fuente and fuente != site_id:
                warnings.append(
                    f"{spec['filename']} fila {index}: fuente={fuente}, esperado {site_id}"
                )

    _, image_rows = read_csv(output_dir / CSV_SPECS["imagenes"]["filename"])
    for index, row in enumerate(image_rows, start=2):
        relative_path = str(row.get("relative_path") or "").strip()
        if relative_path and not (IMAGES_DIR / relative_path).exists():
            warnings.append(
                f"imagenes.csv fila {index}: no existe backend/data/imagenes/{relative_path}"
            )

    return {
        "ok": not errors,
        "site_id": site_id,
        "package_dir": str(output_dir),
        "counts": counts,
        "errors": errors,
        "warnings": warnings,
    }


def delete_site_data(site_id: str) -> dict[str, int]:
    with get_connection() as conn:
        individual_ids = [
            row["id_individuo"]
            for row in conn.execute(
                "SELECT id_individuo FROM individuos WHERE lower(COALESCE(fuente, '')) = ?",
                (site_id,),
            ).fetchall()
        ]
        deleted = {}
        for table in [
            "imagenes",
            "dataciones",
            "paleopatologias",
            "mediciones_quimicas",
        ]:
            result = conn.execute(
                f"DELETE FROM {table} WHERE lower(COALESCE(fuente, '')) = ?", (site_id,)
            )
            deleted[table] = result.rowcount if result.rowcount is not None else 0
        if individual_ids:
            placeholders = ",".join("?" for _ in individual_ids)
            for table in [
                "imagenes",
                "dataciones",
                "paleopatologias",
                "mediciones_quimicas",
            ]:
                result = conn.execute(
                    f"DELETE FROM {table} WHERE id_individuo IN ({placeholders})",
                    individual_ids,
                )
                deleted[table] += result.rowcount if result.rowcount is not None else 0
        result = conn.execute(
            "DELETE FROM individuos WHERE lower(COALESCE(fuente, '')) = ?", (site_id,)
        )
        deleted["individuos"] = result.rowcount if result.rowcount is not None else 0
        result = conn.execute("DELETE FROM sitios WHERE id_sitio = ?", (site_id,))
        deleted["sitios"] = result.rowcount if result.rowcount is not None else 0
    return deleted


def db_counts(site_id: str) -> dict[str, int]:
    with get_connection() as conn:
        return {
            "sitios": conn.execute(
                "SELECT COUNT(*) AS n FROM sitios WHERE id_sitio = ?", (site_id,)
            ).fetchone()["n"],
            "individuos": conn.execute(
                "SELECT COUNT(*) AS n FROM individuos WHERE lower(COALESCE(fuente, '')) = ?",
                (site_id,),
            ).fetchone()["n"],
            "mediciones": conn.execute(
                "SELECT COUNT(*) AS n FROM mediciones_quimicas WHERE lower(COALESCE(fuente, '')) = ?",
                (site_id,),
            ).fetchone()["n"],
            "paleopatologias": conn.execute(
                "SELECT COUNT(*) AS n FROM paleopatologias WHERE lower(COALESCE(fuente, '')) = ?",
                (site_id,),
            ).fetchone()["n"],
            "dataciones": conn.execute(
                "SELECT COUNT(*) AS n FROM dataciones WHERE lower(COALESCE(fuente, '')) = ?",
                (site_id,),
            ).fetchone()["n"],
            "imagenes": conn.execute(
                "SELECT COUNT(*) AS n FROM imagenes WHERE lower(COALESCE(fuente, '')) = ?",
                (site_id,),
            ).fetchone()["n"],
        }


def import_package(args: argparse.Namespace) -> dict[str, Any]:
    """
    Importa un paquete CSV a SQLite.

    Si --replace está presente, borra todos los datos del sitio antes de importar.

    Args:
        args: Argumentos del parser.

    Returns:
        dict: Resultado de la importación, conteos y advertencias.
    """

    site_id = normalize_site_id(args.id)
    output_dir = package_dir_for(site_id, args.package_dir)
    validation = validate_package(site_id, output_dir)
    if not validation["ok"]:
        return {"ok": False, "validation": validation}

    ensure_sqlite_sources()
    deleted = delete_site_data(site_id) if args.replace else {}
    imports = {}
    for name, importer in IMPORT_ORDER:
        path = output_dir / CSV_SPECS[name]["filename"]
        imports[name] = importer(path)

    return {
        "ok": True,
        "site_id": site_id,
        "package_dir": str(output_dir),
        "deleted": deleted,
        "imports": imports,
        "db_counts": db_counts(site_id),
        "warnings": validation["warnings"],
    }


def print_json(payload: dict[str, Any]) -> None:
    print(json.dumps(payload, ensure_ascii=False, indent=2))


def add_package_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--id", required=True, help="ID interno/fuente, por ejemplo caleta_vitor"
    )
    parser.add_argument("--package-dir", help="Carpeta alternativa del paquete CSV")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Crear, validar e importar paquetes CSV de nuevos sitios."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    create = subparsers.add_parser(
        "create", help="Crea una carpeta CSV lista para completar o clonar."
    )
    add_package_args(create)
    create.add_argument("--nombre", required=True, help="Nombre visible del sitio")
    create.add_argument("--area", default="", help="Area geografica o coleccion")
    create.add_argument("--descripcion", default="", help="Descripcion breve")
    create.add_argument("--lat", default="", help="Latitud decimal opcional")
    create.add_argument("--lng", default="", help="Longitud decimal opcional")
    create.add_argument(
        "--view",
        default="visualizacion",
        choices=["visualizacion", "clusters", "dashboard"],
    )
    create.add_argument("--estado", default="validado")
    create.add_argument(
        "--referencia",
        default="",
        help="Referencia bibliografica para individuos clonados",
    )
    create.add_argument(
        "--clone-from",
        help="Fuente existente a copiar, por ejemplo morro1 o prueba_test",
    )
    create.add_argument("--prefix", help="Prefijo para id_documento cuando se clona")
    create.add_argument(
        "--overwrite",
        action="store_true",
        help="Reemplaza CSV existentes en la carpeta",
    )
    create.add_argument(
        "--import-now",
        action="store_true",
        help="Importa el paquete despues de generarlo",
    )
    create.add_argument(
        "--replace",
        action="store_true",
        help="Con --import-now, borra antes datos existentes del mismo sitio",
    )

    validate = subparsers.add_parser(
        "validate", help="Revisa columnas, ids y referencias internas."
    )
    add_package_args(validate)

    import_cmd = subparsers.add_parser("import", help="Carga el paquete CSV a SQLite.")
    add_package_args(import_cmd)
    import_cmd.add_argument(
        "--replace",
        action="store_true",
        help="Borra antes datos existentes del mismo sitio",
    )

    status = subparsers.add_parser(
        "status", help="Muestra conteos actuales del sitio en SQLite."
    )
    status.add_argument("--id", required=True, help="ID interno/fuente del sitio")

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        site_id = normalize_site_id(args.id)
        if args.command == "create":
            payload = create_package(args)
            if args.import_now:
                payload["import"] = import_package(args)
            print_json(payload)
            return 0
        if args.command == "validate":
            result = validate_package(
                site_id, package_dir_for(site_id, args.package_dir)
            )
            print_json(result)
            return 0 if result["ok"] else 1
        if args.command == "import":
            result = import_package(args)
            print_json(result)
            return 0 if result["ok"] else 1
        if args.command == "status":
            ensure_sqlite_sources()
            print_json({"site_id": site_id, "db_counts": db_counts(site_id)})
            return 0
    except Exception as exc:
        print_json({"ok": False, "error": str(exc)})
        return 1
    parser.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
