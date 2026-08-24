import pytest

from backend.app import database
from backend.app.analytical_migration import migrate_analytical_model
from backend.app.analytical_service import (
    build_analysis_context,
    get_sample_detail,
    list_samples,
)
from backend.app.main import _build_source_pca, _build_source_table_rows


def _seed_site(tmp_path, monkeypatch):
    db_path = tmp_path / "analytical_api.sqlite"
    monkeypatch.setattr(database, "DB_PATH", db_path)
    database.init_db()
    with database.get_connection() as conn:
        conn.execute(
            "INSERT INTO sitios (id_sitio, nombre) VALUES ('sitio_test', 'Sitio Test')"
        )
        for person_index in range(1, 5):
            person_id = f"sitio_test_{person_index:03d}"
            conn.execute(
                """
                INSERT INTO individuos (
                    id_individuo, id_documento, numero_cuerpo, sitio, sexo,
                    edad, fuente, estado
                ) VALUES (?, ?, ?, 'Sitio Test', ?, 'Adulto', 'sitio_test', 'validado')
                """,
                (
                    person_id,
                    f"DOC-{person_index:03d}",
                    f"C{person_index}",
                    "Femenino" if person_index % 2 else "Masculino",
                ),
            )
            for element_index, element in enumerate(("As", "B", "Li"), start=1):
                conn.execute(
                    """
                    INSERT INTO mediciones_quimicas (
                        id_medicion, id_individuo, tipo_muestra, elemento,
                        concentracion, unidad, metodo, laboratorio, fuente, estado
                    ) VALUES (?, ?, 'costilla', ?, ?, 'ppm', 'ICP-MS',
                              'Laboratorio Test', 'sitio_test', 'validado')
                    """,
                    (
                        f"costilla_{person_index}_{element}",
                        person_id,
                        element,
                        float(person_index * element_index),
                    ),
                )
        for element_index, element in enumerate(("As", "B", "Li"), start=1):
            conn.execute(
                """
                INSERT INTO mediciones_quimicas (
                    id_medicion, id_individuo, tipo_muestra, elemento,
                    concentracion, unidad, metodo, laboratorio, fuente, estado
                ) VALUES (?, 'sitio_test_001', 'diente', ?, ?, 'ppm', 'ICP-MS',
                          'Laboratorio Test', 'sitio_test', 'validado')
                """,
                (f"diente_1_{element}", element, float(element_index + 10)),
            )
    migrate_analytical_model()


def test_context_and_samples_expose_normalized_analytical_provenance(tmp_path, monkeypatch):
    _seed_site(tmp_path, monkeypatch)

    context = build_analysis_context("sitio_test")
    assert context["summary"] == {
        "muestras": 5,
        "individuos": 4,
        "analisis": 5,
        "mediciones": 15,
        "elementos": 3,
    }
    assert {item["codigo"] for item in context["matrices"]} == {"costilla", "diente"}
    assert len(context["referencias"]) == 1

    samples = list_samples("sitio_test", matriz="costilla")
    assert samples["total"] == 4
    assert all(item["matriz"]["codigo"] == "costilla" for item in samples["items"])
    assert all(item["referencias"][0]["titulo"] for item in samples["items"])

    detail = get_sample_detail("sitio_test", samples["items"][0]["id_muestra"])
    assert detail is not None
    assert detail["codigo_muestra"]
    assert detail["analisis_detalle"][0]["referencia_titulo"]
    assert len(detail["analisis_detalle"][0]["mediciones"]) == 3


def test_table_and_pca_apply_matrix_context_without_cross_matrix_averages(tmp_path, monkeypatch):
    _seed_site(tmp_path, monkeypatch)

    rows = _build_source_table_rows("sitio_test", matriz="costilla")
    assert len(rows) == 12
    assert all(row["matriz"] == "costilla" for row in rows)
    assert all(row["id_muestra"] and row["id_analisis"] and row["id_referencia"] for row in rows)

    with pytest.raises(ValueError, match="Selecciona una matriz biologica"):
        _build_source_pca(["As", "B", "Li"], fuente="sitio_test")

    pca = _build_source_pca(
        ["As", "B", "Li"],
        fuente="sitio_test",
        matriz="costilla",
    )
    assert pca["summary"]["complete_cases"] == 4
    assert pca["analysis_context"]["matriz"]["codigo"] == "costilla"
    assert pca["analysis_context"]["unidades"] == {"As": "ppm", "B": "ppm", "Li": "ppm"}
    assert all(point["type"] == "muestra" for point in pca["points"])
