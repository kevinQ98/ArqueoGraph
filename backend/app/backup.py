from __future__ import annotations

import secrets
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any

from .config import (
    AZAPA_ANALYSIS_PATHS,
    AZAPA_REFERENCE_PATH,
    DATA_DIR,
    MORRO1_ANALYSIS_PATHS,
    MORRO1_PALEOPATOLOGIA_PATHS,
    MORRO1_REFERENCE_PATH,
)
from .dashboard_service import _load_cases


def _create_schema(conn: sqlite3.Connection) -> None:
    conn.executescript('''
    CREATE TABLE individuos (
        id_individuo TEXT PRIMARY KEY,
        sitio TEXT,
        referencia TEXT,
        tumba TEXT,
        sexo TEXT,
        edad TEXT,
        grupo_edad TEXT,
        cultura TEXT,
        conservacion TEXT
    );

    CREATE TABLE mediciones_quimicas (
        id_medicion INTEGER PRIMARY KEY AUTOINCREMENT,
        id_individuo TEXT NOT NULL,
        sitio TEXT,
        elemento TEXT NOT NULL,
        concentracion REAL,
        unidad TEXT,
        matriz TEXT,
        referencia_datos TEXT
    );

    CREATE TABLE paleopatologia (
        id_registro INTEGER PRIMARY KEY AUTOINCREMENT,
        id_individuo TEXT NOT NULL,
        patologia TEXT NOT NULL,
        valor TEXT
    );

    CREATE INDEX idx_med_individuo ON mediciones_quimicas(id_individuo);
    CREATE INDEX idx_pat_individuo ON paleopatologia(id_individuo);
    ''')


def _numeric(value: Any) -> float | None:
    if isinstance(value, dict):
        value = value.get("valor")
    try:
        return float(str(value).replace(",", "."))
    except (TypeError, ValueError):
        return None


def _fill_individuos(conn: sqlite3.Connection, site: str, reference_path: Path) -> None:
    rows = []
    for case in _load_cases(reference_path):
        case_id = str(case.get("id") or "").strip()
        if not case_id:
            continue
        individual = case.get("individuo") or {}
        rows.append((
            case_id,
            site,
            case.get("referencia"),
            case.get("tumba"),
            individual.get("sexo"),
            individual.get("edad"),
            individual.get("grupo_edad"),
            case.get("cultura"),
            individual.get("conservacion"),
        ))
    conn.executemany(
        "INSERT OR REPLACE INTO individuos "
        "(id_individuo, sitio, referencia, tumba, sexo, edad, grupo_edad, cultura, conservacion) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        rows,
    )


def _fill_mediciones(conn: sqlite3.Connection, site: str, analysis_paths: list[Path]) -> None:
    rows = []
    for path in analysis_paths:
        for case in _load_cases(path):
            case_id = str(case.get("id") or "").strip()
            if not case_id:
                continue
            analisis = case.get("analisis_quimicos") or {}
            elementos = analisis.get("elementos") or {}
            if not isinstance(elementos, dict):
                continue
            for elemento, raw_value in elementos.items():
                valor = _numeric(raw_value)
                unidad = raw_value.get("unidad") if isinstance(raw_value, dict) else None
                rows.append((
                    case_id,
                    site,
                    str(elemento),
                    valor,
                    unidad or "ppm",
                    analisis.get("matriz"),
                    analisis.get("referencia_datos"),
                ))
    conn.executemany(
        "INSERT INTO mediciones_quimicas "
        "(id_individuo, sitio, elemento, concentracion, unidad, matriz, referencia_datos) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        rows,
    )


def _fill_paleopatologia(conn: sqlite3.Connection, paleopatologia_paths: list[Path]) -> None:
    rows = []
    for path in paleopatologia_paths:
        for case in _load_cases(path):
            case_id = str(case.get("id") or "").strip()
            if not case_id:
                continue
            for patologia, valor in (case.get("paleopatologia") or {}).items():
                rows.append((case_id, str(patologia), str(valor)))
    conn.executemany(
        "INSERT INTO paleopatologia (id_individuo, patologia, valor) VALUES (?, ?, ?)",
        rows,
    )


def create_backup() -> Path:
    """Genera un archivo .sqlite con una foto completa de todos los JSON
    actuales (referencia, análisis químico y paleopatología, de MORRO1 y
    AZAPA), incluyendo cualquier archivo subido desde el frontend. Se
    guarda en DATA_DIR con un nombre único: respaldo_YYYYMMDD_HHMMSS_xxxx.sqlite
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    random_suffix = secrets.token_hex(3)
    backup_path = DATA_DIR / f"respaldo_{timestamp}_{random_suffix}.sqlite"

    conn = sqlite3.connect(backup_path)
    try:
        _create_schema(conn)
        _fill_individuos(conn, "Morro 1", MORRO1_REFERENCE_PATH)
        _fill_individuos(conn, "Azapa 140", AZAPA_REFERENCE_PATH)
        _fill_mediciones(conn, "Morro 1", list(MORRO1_ANALYSIS_PATHS))
        _fill_mediciones(conn, "Azapa 140", list(AZAPA_ANALYSIS_PATHS))
        _fill_paleopatologia(conn, list(MORRO1_PALEOPATOLOGIA_PATHS))
        conn.commit()
    finally:
        conn.close()

    return backup_path