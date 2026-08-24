from __future__ import annotations

import csv
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent))

try:
    from backend.app.database import get_connection  # noqa: E402
except ModuleNotFoundError:
    sys.path.insert(0, str(ROOT))
    from app.database import get_connection  # noqa: E402


OUT_DIR = ROOT / "sample_data" / "prueba_test"
SOURCE_SITE = "morro1"
TARGET_SITE_ID = "prueba_test"
TARGET_SITE_NAME = "prueba. test"


def _target_id(source_id: str) -> str:
    if source_id.lower().startswith("morro1_"):
        return "prueba_test_" + source_id.split("_", 1)[1]
    return f"prueba_test_{source_id}"


def _write_csv(path: Path, fieldnames: list[str], rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with get_connection() as conn:
        source_individuals = [
            dict(row)
            for row in conn.execute(
                """
                SELECT *
                FROM individuos
                WHERE lower(COALESCE(fuente, '')) = ?
                ORDER BY id_individuo
                """,
                (SOURCE_SITE,),
            ).fetchall()
        ]
        source_ids = {row["id_individuo"] for row in source_individuals}
        id_map = {source_id: _target_id(source_id) for source_id in source_ids}

        measurements = [
            dict(row)
            for row in conn.execute(
                """
                SELECT *
                FROM mediciones_quimicas
                WHERE id_individuo IN (
                    SELECT id_individuo FROM individuos WHERE lower(COALESCE(fuente, '')) = ?
                )
                ORDER BY id_medicion
                """,
                (SOURCE_SITE,),
            ).fetchall()
        ]
        pathologies = [
            dict(row)
            for row in conn.execute(
                """
                SELECT *
                FROM paleopatologias
                WHERE id_individuo IN (
                    SELECT id_individuo FROM individuos WHERE lower(COALESCE(fuente, '')) = ?
                )
                ORDER BY id_paleopatologia
                """,
                (SOURCE_SITE,),
            ).fetchall()
        ]
        datations = [
            dict(row)
            for row in conn.execute(
                """
                SELECT *
                FROM dataciones
                WHERE id_individuo IN (
                    SELECT id_individuo FROM individuos WHERE lower(COALESCE(fuente, '')) = ?
                )
                ORDER BY id_datacion
                """,
                (SOURCE_SITE,),
            ).fetchall()
        ]
        images = [
            dict(row)
            for row in conn.execute(
                """
                SELECT *
                FROM imagenes
                WHERE id_individuo IN (
                    SELECT id_individuo FROM individuos WHERE lower(COALESCE(fuente, '')) = ?
                )
                ORDER BY id_imagen
                """,
                (SOURCE_SITE,),
            ).fetchall()
        ]

    _write_csv(
        OUT_DIR / "sitios.csv",
        ["id_sitio", "nombre", "area", "descripcion", "lat", "lng", "view", "estado"],
        [{
            "id_sitio": TARGET_SITE_ID,
            "nombre": TARGET_SITE_NAME,
            "area": "Area de prueba",
            "descripcion": "Clon de Morro 1 para validar carga CSV de nuevos sitios",
            "lat": -18.6123,
            "lng": -70.2145,
            "view": "visualizacion",
            "estado": "validado",
        }],
    )

    _write_csv(
        OUT_DIR / "individuos.csv",
        [
            "id_individuo", "id_documento", "numero_cuerpo", "sexo", "edad", "sitio",
            "cementerio", "cronologia", "estilo_momificacion", "referencia_bibliografica",
            "fuente", "estado", "notas",
        ],
        [{
            "id_individuo": id_map[row["id_individuo"]],
            "id_documento": f"PT-{row['id_documento'] or row['id_individuo']}",
            "numero_cuerpo": row.get("numero_cuerpo"),
            "sexo": row.get("sexo"),
            "edad": row.get("edad"),
            "sitio": TARGET_SITE_NAME,
            "cementerio": TARGET_SITE_NAME,
            "cronologia": row.get("cronologia"),
            "estilo_momificacion": row.get("estilo_momificacion"),
            "referencia_bibliografica": "Clon demo de Morro 1",
            "fuente": TARGET_SITE_ID,
            "estado": "validado",
            "notas": "Registro clonado desde Morro 1 para pruebas CSV",
        } for row in source_individuals],
    )

    _write_csv(
        OUT_DIR / "mediciones_quimicas.csv",
        [
            "id_medicion", "id_individuo", "tipo_muestra", "elemento", "concentracion",
            "unidad", "metodo", "laboratorio", "fecha", "observaciones", "fuente", "estado",
        ],
        [{
            "id_medicion": f"prueba_test_{row['id_medicion']}",
            "id_individuo": id_map[row["id_individuo"]],
            "tipo_muestra": row.get("tipo_muestra"),
            "elemento": row.get("elemento"),
            "concentracion": row.get("concentracion"),
            "unidad": row.get("unidad") or "ppm",
            "metodo": row.get("metodo"),
            "laboratorio": row.get("laboratorio"),
            "fecha": row.get("fecha"),
            "observaciones": "Medicion clonada desde Morro 1 para pruebas CSV",
            "fuente": TARGET_SITE_ID,
            "estado": "validado",
        } for row in measurements if row["id_individuo"] in id_map],
    )

    _write_csv(
        OUT_DIR / "paleopatologias.csv",
        ["id_paleopatologia", "id_individuo", "patologia", "valor", "presente", "fuente", "estado"],
        [{
            "id_paleopatologia": f"prueba_test_{row['id_paleopatologia']}",
            "id_individuo": id_map[row["id_individuo"]],
            "patologia": row.get("patologia"),
            "valor": row.get("valor"),
            "presente": row.get("presente"),
            "fuente": TARGET_SITE_ID,
            "estado": "validado",
        } for row in pathologies if row["id_individuo"] in id_map],
    )

    _write_csv(
        OUT_DIR / "dataciones.csv",
        [
            "id_datacion", "id_individuo", "muestra", "fecha_bp", "fecha_1sigma_ad",
            "interceptos_ad", "rango_calibrado_min", "rango_calibrado_max",
            "referencia_datos", "fuente", "estado",
        ],
        [{
            "id_datacion": f"prueba_test_{row['id_datacion']}",
            "id_individuo": id_map[row["id_individuo"]],
            "muestra": row.get("muestra"),
            "fecha_bp": row.get("fecha_bp"),
            "fecha_1sigma_ad": row.get("fecha_1sigma_ad"),
            "interceptos_ad": row.get("interceptos_ad"),
            "rango_calibrado_min": row.get("rango_calibrado_min"),
            "rango_calibrado_max": row.get("rango_calibrado_max"),
            "referencia_datos": row.get("referencia_datos"),
            "fuente": TARGET_SITE_ID,
            "estado": "validado",
        } for row in datations if row["id_individuo"] in id_map],
    )

    _write_csv(
        OUT_DIR / "imagenes.csv",
        [
            "id_imagen", "id_individuo", "filename_original", "filename_saved",
            "relative_path", "content_type", "label", "descripcion", "fuente", "estado",
        ],
        [{
            "id_imagen": f"prueba_test_{row['id_imagen']}",
            "id_individuo": id_map[row["id_individuo"]],
            "filename_original": row.get("filename_original"),
            "filename_saved": row.get("filename_saved"),
            "relative_path": row.get("relative_path"),
            "content_type": row.get("content_type"),
            "label": row.get("label"),
            "descripcion": "Imagen referenciada desde clon de Morro 1 para pruebas CSV",
            "fuente": TARGET_SITE_ID,
            "estado": "validado",
        } for row in images if row["id_individuo"] in id_map],
    )

    print(f"CSV de {TARGET_SITE_NAME} generados en {OUT_DIR}")
    print(f"individuos={len(source_individuals)} mediciones={len(measurements)} paleopatologias={len(pathologies)} dataciones={len(datations)} imagenes={len(images)}")


if __name__ == "__main__":
    main()
