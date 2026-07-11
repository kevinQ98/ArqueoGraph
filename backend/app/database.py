from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "arqueograph.sqlite"
IMAGES_DIR = DATA_DIR / "imagenes"
IMAGES_DIR.mkdir(parents=True, exist_ok=True)


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def rows_to_dicts(rows: list[sqlite3.Row]) -> list[dict[str, Any]]:
    return [dict(row) for row in rows]


def init_db() -> None:
    with get_connection() as conn:
        conn.executescript('''
        CREATE TABLE IF NOT EXISTS individuos (
            id_individuo TEXT PRIMARY KEY,
            id_documento TEXT NOT NULL,
            numero_cuerpo TEXT,
            sexo TEXT,
            edad TEXT,
            sitio TEXT,
            cementerio TEXT,
            cronologia TEXT,
            estilo_momificacion TEXT,
            referencia_bibliografica TEXT,
            estado TEXT NOT NULL DEFAULT 'borrador',
            notas TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS mediciones_quimicas (
            id_medicion TEXT PRIMARY KEY,
            id_individuo TEXT NOT NULL,
            tipo_muestra TEXT,
            elemento TEXT NOT NULL,
            concentracion REAL,
            unidad TEXT NOT NULL DEFAULT 'ppm',
            metodo TEXT,
            laboratorio TEXT,
            fecha TEXT,
            observaciones TEXT,
            estado TEXT NOT NULL DEFAULT 'borrador',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (id_individuo) REFERENCES individuos(id_individuo)
                ON UPDATE CASCADE
                ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_mediciones_individuo ON mediciones_quimicas(id_individuo);
        CREATE INDEX IF NOT EXISTS idx_mediciones_elemento ON mediciones_quimicas(elemento);

        CREATE TABLE IF NOT EXISTS imagenes (
            id_imagen TEXT PRIMARY KEY,
            id_individuo TEXT NOT NULL,
            filename_original TEXT NOT NULL,
            filename_saved TEXT NOT NULL,
            relative_path TEXT NOT NULL,
            content_type TEXT,
            label TEXT,
            descripcion TEXT,
            estado TEXT NOT NULL DEFAULT 'borrador',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (id_individuo) REFERENCES individuos(id_individuo)
                ON UPDATE CASCADE
                ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_imagenes_individuo ON imagenes(id_individuo);
        ''')
        _ensure_source_columns(conn)
        _migrate_imagenes_table(conn)


def _ensure_source_columns(conn: sqlite3.Connection) -> None:
    for table, column in [
        ("individuos", "fuente"),
        ("mediciones_quimicas", "fuente"),
        ("imagenes", "fuente"),
    ]:
        cols = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}
        if column not in cols:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} TEXT")

    conn.execute("""
        UPDATE individuos
        SET fuente = COALESCE(
            fuente,
            CASE
                WHEN lower(COALESCE(id_individuo, '')) LIKE 'azapa%' THEN 'azapa'
                WHEN lower(COALESCE(id_documento, '')) LIKE 'azapa%' THEN 'azapa'
                WHEN lower(COALESCE(numero_cuerpo, '')) LIKE 't%' AND lower(COALESCE(id_individuo, '')) LIKE 'azapa140_%' THEN 'azapa'
                ELSE 'morro1'
            END
        )
        WHERE fuente IS NULL OR fuente = ''
    """)
    conn.execute("""
        UPDATE mediciones_quimicas
        SET fuente = COALESCE(
            fuente,
            (SELECT COALESCE(i.fuente, 'morro1') FROM individuos i WHERE i.id_individuo = mediciones_quimicas.id_individuo)
        )
        WHERE fuente IS NULL OR fuente = ''
    """)
    conn.execute("""
        UPDATE imagenes
        SET fuente = COALESCE(
            fuente,
            (SELECT COALESCE(i.fuente, 'morro1') FROM individuos i WHERE i.id_individuo = imagenes.id_individuo)
        )
        WHERE fuente IS NULL OR fuente = ''
    """)


def _migrate_imagenes_table(conn: sqlite3.Connection) -> None:
    """
    Compatibilidad entre variantes de esquema de fase 5.
    Algunos builds usan columnas como filename_saved/content_type/label y
    otros filename_guardado/mime_type/titulo/tipo_imagen/fecha_imagen.
    """
    cols = {
        row["name"]
        for row in conn.execute("PRAGMA table_info(imagenes)").fetchall()
    }

    if "filename_guardado" not in cols:
        conn.execute("ALTER TABLE imagenes ADD COLUMN filename_guardado TEXT")
    if "mime_type" not in cols:
        conn.execute("ALTER TABLE imagenes ADD COLUMN mime_type TEXT")
    if "titulo" not in cols:
        conn.execute("ALTER TABLE imagenes ADD COLUMN titulo TEXT")
    if "tipo_imagen" not in cols:
        conn.execute("ALTER TABLE imagenes ADD COLUMN tipo_imagen TEXT")
    if "fecha_imagen" not in cols:
        conn.execute("ALTER TABLE imagenes ADD COLUMN fecha_imagen TEXT")

    # Rellena columnas nuevas desde columnas antiguas si existen.
    cols = {
        row["name"]
        for row in conn.execute("PRAGMA table_info(imagenes)").fetchall()
    }
    if "filename_saved" in cols:
        conn.execute("""
            UPDATE imagenes
            SET filename_guardado = COALESCE(filename_guardado, filename_saved)
            WHERE filename_guardado IS NULL
        """)
    if "content_type" in cols:
        conn.execute("""
            UPDATE imagenes
            SET mime_type = COALESCE(mime_type, content_type)
            WHERE mime_type IS NULL
        """)
    if "label" in cols:
        conn.execute("""
            UPDATE imagenes
            SET titulo = COALESCE(titulo, label)
            WHERE titulo IS NULL
        """)


def reset_db() -> None:
    with get_connection() as conn:
        conn.executescript('''
        DROP TABLE IF EXISTS imagenes;
        DROP TABLE IF EXISTS mediciones_quimicas;
        DROP TABLE IF EXISTS individuos;
        ''')
    init_db()
