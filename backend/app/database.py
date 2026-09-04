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
    """
    Establece una conexión a la base de datos SQLite con row_factory = sqlite3.Row.

    Returns:
        sqlite3.Connection: Conexión con PRAGMA foreign_keys activado.
    """

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def rows_to_dicts(rows: list[sqlite3.Row]) -> list[dict[str, Any]]:
    return [dict(row) for row in rows]


def init_db() -> None:
    """
    Crea todas las tablas e índices si no existen.

    Incluye:
        - Tablas principales: sitios, individuos, mediciones_quimicas,
          paleopatologias, dataciones, imagenes.
        - Modelo analítico: matrices, matrices_aliases, muestras,
          referencias_analiticas, analisis_quimicos.
        - Índices para acelerar filtros por fuente, elemento, individuo.
        - Columnas de compatibilidad (fuente, id_analisis, etc.)
        - Migración de imágenes legacy.

    Returns:
        None
    """
    
    with get_connection() as conn:
        conn.executescript("""
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
            fuente TEXT,
            estado TEXT NOT NULL DEFAULT 'borrador',
            notas TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sitios (
            id_sitio TEXT PRIMARY KEY,
            nombre TEXT NOT NULL UNIQUE,
            area TEXT,
            descripcion TEXT,
            lat REAL,
            lng REAL,
            view TEXT,
            estado TEXT NOT NULL DEFAULT 'validado',
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
            fuente TEXT,
            estado TEXT NOT NULL DEFAULT 'borrador',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (id_individuo) REFERENCES individuos(id_individuo)
                ON UPDATE CASCADE
                ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_mediciones_individuo ON mediciones_quimicas(id_individuo);
        CREATE INDEX IF NOT EXISTS idx_mediciones_elemento ON mediciones_quimicas(elemento);
        CREATE INDEX IF NOT EXISTS idx_individuos_sitio ON individuos(sitio);

        CREATE TABLE IF NOT EXISTS matrices (
            id_matriz TEXT PRIMARY KEY,
            codigo TEXT NOT NULL UNIQUE,
            nombre TEXT NOT NULL,
            categoria TEXT,
            descripcion TEXT,
            estado TEXT NOT NULL DEFAULT 'validado',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS matrices_aliases (
            alias_normalizado TEXT PRIMARY KEY,
            alias_original TEXT NOT NULL,
            id_matriz TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (id_matriz) REFERENCES matrices(id_matriz)
                ON UPDATE CASCADE
                ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_matrices_aliases_matriz ON matrices_aliases(id_matriz);

        CREATE TABLE IF NOT EXISTS muestras (
            id_muestra TEXT PRIMARY KEY,
            id_individuo TEXT NOT NULL,
            id_matriz TEXT NOT NULL,
            codigo_muestra TEXT NOT NULL UNIQUE,
            tipo_muestra_original TEXT,
            elemento_anatomico TEXT,
            lateralidad TEXT,
            ubicacion_anatomica TEXT,
            fecha_muestreo TEXT,
            estado_conservacion TEXT,
            observaciones TEXT,
            es_inferida INTEGER NOT NULL DEFAULT 0,
            fuente TEXT,
            estado TEXT NOT NULL DEFAULT 'validado',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (id_individuo) REFERENCES individuos(id_individuo)
                ON UPDATE CASCADE
                ON DELETE CASCADE,
            FOREIGN KEY (id_matriz) REFERENCES matrices(id_matriz)
                ON UPDATE CASCADE
                ON DELETE RESTRICT
        );

        CREATE INDEX IF NOT EXISTS idx_muestras_individuo ON muestras(id_individuo);
        CREATE INDEX IF NOT EXISTS idx_muestras_matriz ON muestras(id_matriz);
        CREATE INDEX IF NOT EXISTS idx_muestras_fuente ON muestras(fuente);

        CREATE TABLE IF NOT EXISTS referencias_analiticas (
            id_referencia TEXT PRIMARY KEY,
            clave TEXT NOT NULL UNIQUE,
            titulo TEXT NOT NULL,
            cita TEXT,
            doi TEXT,
            url TEXT,
            laboratorio TEXT,
            metodo TEXT,
            fecha TEXT,
            dataset_origen TEXT,
            fuente TEXT,
            estado TEXT NOT NULL DEFAULT 'validado',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_referencias_fuente ON referencias_analiticas(fuente);

        CREATE TABLE IF NOT EXISTS analisis_quimicos (
            id_analisis TEXT PRIMARY KEY,
            id_muestra TEXT NOT NULL,
            id_referencia TEXT,
            codigo_analisis TEXT NOT NULL UNIQUE,
            dataset_origen TEXT,
            metodo TEXT,
            laboratorio TEXT,
            fecha TEXT,
            lote TEXT,
            unidad_declarada TEXT,
            observaciones TEXT,
            es_inferido INTEGER NOT NULL DEFAULT 0,
            fuente TEXT,
            estado TEXT NOT NULL DEFAULT 'validado',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (id_muestra) REFERENCES muestras(id_muestra)
                ON UPDATE CASCADE
                ON DELETE CASCADE,
            FOREIGN KEY (id_referencia) REFERENCES referencias_analiticas(id_referencia)
                ON UPDATE CASCADE
                ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_analisis_muestra ON analisis_quimicos(id_muestra);
        CREATE INDEX IF NOT EXISTS idx_analisis_referencia ON analisis_quimicos(id_referencia);
        CREATE INDEX IF NOT EXISTS idx_analisis_fuente ON analisis_quimicos(fuente);

        CREATE TABLE IF NOT EXISTS paleopatologias (
            id_paleopatologia TEXT PRIMARY KEY,
            id_individuo TEXT NOT NULL,
            patologia TEXT NOT NULL,
            valor TEXT,
            presente INTEGER NOT NULL DEFAULT 1,
            fuente TEXT,
            estado TEXT NOT NULL DEFAULT 'validado',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (id_individuo) REFERENCES individuos(id_individuo)
                ON UPDATE CASCADE
                ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_paleopatologias_individuo ON paleopatologias(id_individuo);
        CREATE INDEX IF NOT EXISTS idx_paleopatologias_patologia ON paleopatologias(patologia);

        CREATE TABLE IF NOT EXISTS dataciones (
            id_datacion TEXT PRIMARY KEY,
            id_individuo TEXT NOT NULL,
            muestra TEXT,
            fecha_bp TEXT,
            fecha_1sigma_ad TEXT,
            interceptos_ad TEXT,
            rango_calibrado_min INTEGER,
            rango_calibrado_max INTEGER,
            referencia_datos TEXT,
            fuente TEXT,
            estado TEXT NOT NULL DEFAULT 'validado',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (id_individuo) REFERENCES individuos(id_individuo)
                ON UPDATE CASCADE
                ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_dataciones_individuo ON dataciones(id_individuo);

        CREATE TABLE IF NOT EXISTS imagenes (
            id_imagen TEXT PRIMARY KEY,
            id_individuo TEXT NOT NULL,
            filename_original TEXT NOT NULL,
            filename_saved TEXT NOT NULL,
            relative_path TEXT NOT NULL,
            content_type TEXT,
            label TEXT,
            descripcion TEXT,
            fuente TEXT,
            estado TEXT NOT NULL DEFAULT 'borrador',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (id_individuo) REFERENCES individuos(id_individuo)
                ON UPDATE CASCADE
                ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_imagenes_individuo ON imagenes(id_individuo);
        """)
        _ensure_source_columns(conn)
        _ensure_analytical_columns(conn)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_individuos_fuente ON individuos(fuente)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_mediciones_fuente ON mediciones_quimicas(fuente)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_imagenes_fuente ON imagenes(fuente)"
        )
        _migrate_imagenes_table(conn)


def _ensure_analytical_columns(conn: sqlite3.Connection) -> None:
    columns = {
        row["name"]
        for row in conn.execute("PRAGMA table_info(mediciones_quimicas)").fetchall()
    }
    if "id_analisis" not in columns:
        conn.execute("ALTER TABLE mediciones_quimicas ADD COLUMN id_analisis TEXT")
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_mediciones_analisis ON mediciones_quimicas(id_analisis)"
    )


def _ensure_source_columns(conn: sqlite3.Connection) -> None:
    for table, column in [
        ("individuos", "fuente"),
        ("mediciones_quimicas", "fuente"),
        ("imagenes", "fuente"),
    ]:
        cols = {
            row["name"]
            for row in conn.execute(f"PRAGMA table_info({table})").fetchall()
        }
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
        row["name"] for row in conn.execute("PRAGMA table_info(imagenes)").fetchall()
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
        row["name"] for row in conn.execute("PRAGMA table_info(imagenes)").fetchall()
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
    """
    Elimina y recrea todas las tablas.

    Útil para pruebas o para empezar desde cero.
    CUIDADO: borra todos los datos.
    """

    with get_connection() as conn:
        conn.executescript("""
        DROP TABLE IF EXISTS imagenes;
        DROP TABLE IF EXISTS dataciones;
        DROP TABLE IF EXISTS paleopatologias;
        DROP TABLE IF EXISTS mediciones_quimicas;
        DROP TABLE IF EXISTS analisis_quimicos;
        DROP TABLE IF EXISTS referencias_analiticas;
        DROP TABLE IF EXISTS muestras;
        DROP TABLE IF EXISTS matrices_aliases;
        DROP TABLE IF EXISTS matrices;
        DROP TABLE IF EXISTS individuos;
        DROP TABLE IF EXISTS sitios;
        """)
    init_db()
