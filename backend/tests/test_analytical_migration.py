from backend.app import database
from backend.app.analytical_migration import migrate_analytical_model


def _seed_measurements(tmp_path, monkeypatch, units=("ppm", "ppm")):
    db_path = tmp_path / "analytical.sqlite"
    monkeypatch.setattr(database, "DB_PATH", db_path)
    database.init_db()
    with database.get_connection() as conn:
        conn.execute(
            "INSERT INTO sitios (id_sitio, nombre) VALUES ('sitio_test', 'Sitio Test')"
        )
        conn.execute(
            """
            INSERT INTO individuos (
                id_individuo, id_documento, numero_cuerpo, sitio, fuente, estado
            ) VALUES ('sitio_test_001', 'DOC-001', 'C1', 'Sitio Test', 'sitio_test', 'validado')
            """
        )
        for index, (matrix, unit) in enumerate(zip(("costilla", "costillas"), units), start=1):
            conn.execute(
                """
                INSERT INTO mediciones_quimicas (
                    id_medicion, id_individuo, tipo_muestra, elemento,
                    concentracion, unidad, fuente, estado
                ) VALUES (?, 'sitio_test_001', ?, 'As', ?, ?, 'sitio_test', 'validado')
                """,
                (f"med_{index}", matrix, float(index), unit),
            )


def test_analytical_migration_is_idempotent_and_normalizes_aliases(tmp_path, monkeypatch):
    _seed_measurements(tmp_path, monkeypatch)

    first = migrate_analytical_model()
    second = migrate_analytical_model()

    assert first["linked_measurements"] == 2
    assert first["audit"]["ok"] is True
    assert second["linked_measurements"] == 0
    with database.get_connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM matrices").fetchone()[0] == 1
        assert conn.execute("SELECT COUNT(*) FROM matrices_aliases").fetchone()[0] == 2
        assert conn.execute("SELECT COUNT(*) FROM muestras").fetchone()[0] == 1
        assert conn.execute("SELECT COUNT(*) FROM analisis_quimicos").fetchone()[0] == 1
        assert conn.execute(
            "SELECT COUNT(*) FROM mediciones_quimicas WHERE id_analisis IS NOT NULL"
        ).fetchone()[0] == 2


def test_analytical_migration_keeps_mixed_units_in_separate_analyses(tmp_path, monkeypatch):
    _seed_measurements(tmp_path, monkeypatch, units=("ppm", "mg/g"))

    result = migrate_analytical_model()

    assert result["audit"]["sample_element_unit_conflicts"] == 1
    with database.get_connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM analisis_quimicos").fetchone()[0] == 2
        units = {
            row["unidad_declarada"]
            for row in conn.execute("SELECT unidad_declarada FROM analisis_quimicos").fetchall()
        }
        assert units == {"ppm", "mg/g"}
