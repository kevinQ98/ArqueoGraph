from __future__ import annotations

import secrets
import shutil
from datetime import datetime
from pathlib import Path

from .config import DATA_DIR
from .database import DB_PATH
from .sqlite_migration import ensure_sqlite_sources


def create_backup() -> Path:
    """
    Crea una copia de seguridad de la base de datos SQLite actual.

    Genera un nombre con timestamp y sufijo aleatorio, y guarda el archivo
    en el directorio data/.

    Returns:
        Path: Ruta al archivo de respaldo.
    """
    ensure_sqlite_sources()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    random_suffix = secrets.token_hex(3)
    backup_path = DATA_DIR / f"respaldo_{timestamp}_{random_suffix}.sqlite"
    shutil.copy2(DB_PATH, backup_path)
    return backup_path
