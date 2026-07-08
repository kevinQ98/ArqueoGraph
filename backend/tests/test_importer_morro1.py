import json
from pathlib import Path

from app import database
from app.importer import import_morro1_master_data


def write_text(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")


def test_import_morro1_master_data_creates_individuals_and_measurements(tmp_path, monkeypatch):
    db_path = tmp_path / "test.sqlite"
    monkeypatch.setattr(database, "DB_PATH", db_path)
    database.init_db()

    reference_path = tmp_path / "morro1_referencia.json"
    write_text(reference_path, json.dumps({
        "morro_1": {
            "area": "ARICA",
            "sitio": "morro1",
            "casos": [{
                "id": "Morro1_001",
                "referencia": "morro1 T1C1",
                "tumba": "T1C1",
                "individuo": {
                    "sexo": "femenino",
                    "edad": "ADULTO",
                    "grupo_edad": "adulto",
                    "conservacion": "INCOMPLETO"
                }
            }]
        }
    }))

    paleopatologia_path = tmp_path / "morro1_paleopatologia.json"
    write_text(paleopatologia_path, json.dumps({
        "morro1_paleopatologia": {
            "area": "ARICA",
            "sitio": "morro1",
            "casos": [{
                "id": "Morro1_001",
                "referencia": "morro1 T1C1",
                "referencia_normalizada": "M1T1C1",
                "tumba": "T1C1",
                "individuo": {
                    "sexo": "femenino",
                    "edad": "ADULTO",
                    "grupo_edad": "adulto",
                    "conservacion": "INCOMPLETO"
                },
                "contexto_funerario": {
                    "tipo_inhumacion": null,
                    "tipo_momificacion": null,
                    "posicion": null
                },
                "paleopatologia": {
                    "periostitis": null,
                    "trauma_fractura": null,
                    "patologia_degenerativa": null,
                    "osteoporosis": null,
                    "patologia_dental": null,
                    "espina_bifida": null,
                    "columna_vertebral_espondilosis_espondiloartrosis": null,
                    "exostosis_osteoma_auditivo": null
                }
            }]
        }
    }))

    catalog_path = tmp_path / "catalogo.csv"
    write_text(catalog_path, "id_key,id_individuo_catalogo,descripcion_sintetica,publicaciones\nMorro1_001,Morro1_001,Desc breve,Pub 1\n")

    analisis_path = tmp_path / "morro1_analisis_quimicos_Mn_costilla.json"
    write_text(analisis_path, json.dumps({
        "morro1_analisis_quimicos_Mn": {
            "area": "ARICA",
            "sitio": "morro1",
            "casos": [{
                "id": "Morro1_001",
                "referencia": "morro1 T1C1",
                "tumba": "T1C1",
                "individuo": {
                    "sexo": "femenino",
                    "edad": "ADULTO",
                    "grupo_edad": "adulto",
                    "conservacion": "INCOMPLETO"
                },
                "analisis_quimicos": {
                    "matriz": "costilla",
                    "elementos": {
                        "Mn": {
                            "valor": 64.3,
                            "unidad": "ppm"
                        }
                    }
                }
            }]
        }
    }))

    mediciones_path = tmp_path / "mediciones.csv"
    write_text(mediciones_path, "id_medicion,id_individuo,elemento,concentracion,unidad\nm1,Morro1_001,As,10.5,ppm\n")

    result = import_morro1_master_data(
        reference_path,
        paleopatologia_path=paleopatologia_path,
        catalog_path=catalog_path,
        analisis_path=analisis_path,
        mediciones_path=mediciones_path,
    )

    assert result["inserted"] >= 1
    with database.get_connection() as conn:
        individuo = conn.execute(
            "SELECT id_individuo, id_documento, numero_cuerpo, sexo, edad FROM individuos WHERE id_individuo = ?",
            ("Morro1_001",),
        ).fetchone()
        medicion = conn.execute(
            "SELECT id_medicion, id_individuo, elemento, concentracion FROM mediciones_quimicas WHERE id_medicion = ?",
            ("m1",),
        ).fetchone()

    assert individuo is not None
    assert individuo["id_documento"] == "morro1 T1C1"
    assert individuo["numero_cuerpo"] == "T1C1"
    assert individuo["sexo"] == "femenino"
    assert individuo["edad"] == "adulto"
    assert medicion is not None
    assert medicion["elemento"] == "As"

    mn_medicion = conn.execute(
        "SELECT id_medicion, id_individuo, elemento, concentracion FROM mediciones_quimicas WHERE id_individuo = ? AND elemento = ?",
        ("Morro1_001", "Mn"),
    ).fetchone()
    assert mn_medicion is not None
    assert mn_medicion["concentracion"] == 64.3
