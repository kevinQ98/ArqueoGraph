import json
from pathlib import Path

from app import database
from app.importer import import_azapa_master_data


def write_text(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")


def test_import_azapa_master_data_creates_individuals_and_measurements(tmp_path, monkeypatch):
    db_path = tmp_path / "test.sqlite"
    monkeypatch.setattr(database, "DB_PATH", db_path)
    database.init_db()

    reference_path = tmp_path / "azapa140_referencia.json"
    write_text(reference_path, json.dumps({
        "azapa_140": {
            "area": "AZAPA",
            "casos": [{
                "id": "azapa140_001",
                "tumba": "T1",
                "cultura": "SAN MIGUEL",
                "individuo": {
                    "sexo": "indeterminado",
                    "edad": "INFANTE",
                    "grupo_edad": "sub adulto",
                    "conservacion": "COMPLETO"
                }
            }]
        }
    }))

    dataciones_path = tmp_path / "azapa140_dataciones_radiocarbono_Cassman_1997.json"
    write_text(dataciones_path, json.dumps({
        "azapa140_dataciones_radiocarbono_Cassman_1997": {
            "area": "AZAPA",
            "casos": [{
                "id": "azapa140_001",
                "datacion_radiocarbono": {
                    "referencia_datos": "Cassman 1997",
                    "muestra": "hueso",
                    "fechado_1sigma_AD": "1000",
                    "interceptos_AD": "1000",
                    "rango_calibrado_AD": {"min": 1000, "max": 1100},
                    "afiliacion": {"original": None, "normalizada": None, "nota": None},
                }
            }]
        }
    }))

    hair_path = tmp_path / "azapa140_analisis_quimicos_As_cabello.json"
    write_text(hair_path, json.dumps({
        "azapa140_analisis_quimicos_As_cabello": {
            "area": "AZAPA",
            "casos": [{
                "id": "azapa140_001",
                "analisis_quimicos": {
                    "matriz": "cabello",
                    "elementos": {
                        "As": {"valor": 1.8, "unidad": "µg/g"}
                    }
                }
            }]
        }
    }))

    bone_path = tmp_path / "azapa140_analisis_quimicos_As_B_Li_costilla.json"
    write_text(bone_path, json.dumps({
        "azapa140_analisis_quimicos_As_B_Li": {
            "area": "AZAPA",
            "casos": [{
                "id": "azapa140_001",
                "analisis_quimicos": {
                    "matriz": "costillas",
                    "elementos": {
                        "As": {"valor": 3.2, "unidad": "ppm"},
                        "B": {"valor": 4.1, "unidad": "ppm"},
                        "Li": {"valor": 2.7, "unidad": "ppm"},
                    }
                }
            }]
        }
    }))

    result = import_azapa_master_data(
        reference_path,
        dataciones_path=dataciones_path,
        analisis_as_cabello_path=hair_path,
        analisis_as_b_li_costilla_path=bone_path,
    )

    assert result["inserted"] >= 1
    with database.get_connection() as conn:
        individuo = conn.execute(
            "SELECT id_individuo, id_documento, numero_cuerpo, sitio FROM individuos WHERE id_individuo = ?",
            ("azapa140_001",),
        ).fetchone()
        as_hair = conn.execute(
            "SELECT id_medicion, id_individuo, elemento, concentracion, tipo_muestra FROM mediciones_quimicas WHERE id_individuo = ? AND elemento = ?",
            ("azapa140_001", "As"),
        ).fetchone()
        b_bone = conn.execute(
            "SELECT id_medicion, id_individuo, elemento, concentracion, tipo_muestra FROM mediciones_quimicas WHERE id_individuo = ? AND elemento = ?",
            ("azapa140_001", "B"),
        ).fetchone()

    assert individuo is not None
    assert individuo["id_documento"] == "azapa140_001"
    assert individuo["numero_cuerpo"] == "T1"
    assert as_hair is not None
    assert as_hair["tipo_muestra"] == "cabello"
    assert b_bone is not None
    assert b_bone["tipo_muestra"] == "costillas"
