from pathlib import Path
import json

# Directorio base del proyecto (raíz del repositorio)
BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"

# --- Archivos de referencia (JSON de casos) ---
AZAPA_REFERENCE_PATH = DATA_DIR / "azapa140_referencia.json"
MORRO1_REFERENCE_PATH = DATA_DIR / "morro1_referencia.json"
PALEOPATOLOGIA_PATH = DATA_DIR / "morro1_paleopatologia.json"
CATALOGO_MOMIAS_PATH = DATA_DIR / "catalogo_momias.json"

# --- Archivos de análisis químico para AZAPA ---
AZAPA_ANALYSIS_PATHS = [
    DATA_DIR / "azapa140_analisis_quimicos_As_cabello.json",
    DATA_DIR / "azapa140_analisis_quimicos_As_B_Li_costilla.json",
    DATA_DIR / "azapa140_analisis_quimicos_Li_S_B_Pb_As_cabello_ref_dulasiri.json",
    DATA_DIR / "azapa140_analisis_quimicos_Mn_costilla.json",
]

# --- Archivos de paleopatología (patologías) ---
MORRO1_PALEOPATOLOGIA_PATHS = [
    DATA_DIR / "morro1_paleopatologia.json",
    # Aquí puedes añadir más archivos, por ejemplo:
    DATA_DIR / "morro1_paleopatologia_extra_fake.json",
]

# --- Archivos de análisis químico para MORRO1 ---
MORRO1_ANALYSIS_PATHS = [
    DATA_DIR / "morro1_analisis_quimicos_Mn_costilla.json",
    DATA_DIR / "morro1_analisis_quimicos_B_As_Li_costilla.json",
    DATA_DIR / "morro1_analisis_quimicos_Zn_costilla_fake.json",
]

# --- Otros archivos auxiliares (dataciones) ---
AZAPA_DATACIONES_PATH = DATA_DIR / "azapa140_dataciones_radiocarbono_Cassman_1997.json"


# =====================================================================
# Registro dinámico de archivos subidos desde el frontend
# ---------------------------------------------------------------------
# Permite que cualquier persona suba un JSON nuevo (análisis químico o
# paleopatología) sin tener que tocar este archivo a mano. El archivo
# físico se guarda en DATA_DIR y su nombre se anota en un "manifiesto"
# (uploads_manifest.json) para que, al reiniciar el servidor, se vuelva
# a agregar automáticamente a la lista correspondiente.
# =====================================================================

UPLOADS_MANIFEST_PATH = DATA_DIR / "uploads_manifest.json"

# Tipos de import soportados -> lista de config a la que se agregan.
UPLOAD_TARGETS = {
    "morro1_analisis_quimico": MORRO1_ANALYSIS_PATHS,
    "morro1_paleopatologia": MORRO1_PALEOPATOLOGIA_PATHS,
    "azapa_analisis_quimico": AZAPA_ANALYSIS_PATHS,
}


def _read_manifest() -> dict:
    if not UPLOADS_MANIFEST_PATH.exists():
        return {}
    try:
        return json.loads(UPLOADS_MANIFEST_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def _write_manifest(manifest: dict) -> None:
    UPLOADS_MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def _apply_manifest() -> None:
    """Vuelve a agregar, al arrancar la app, los archivos ya subidos antes."""
    manifest = _read_manifest()
    for tipo, filenames in manifest.items():
        target_list = UPLOAD_TARGETS.get(tipo)
        if target_list is None:
            continue
        for filename in filenames:
            path = DATA_DIR / filename
            if path not in target_list:
                target_list.append(path)


def register_uploaded_file(tipo: str, filename: str) -> Path:
    """Registra un archivo JSON ya guardado en DATA_DIR bajo `filename`
    como parte del tipo indicado (ver UPLOAD_TARGETS), tanto en memoria
    (para que el import se use ya mismo) como en el manifiesto en disco
    (para que sobreviva a un reinicio del servidor).
    """
    if tipo not in UPLOAD_TARGETS:
        raise ValueError(f"Tipo de import no soportado: {tipo}")

    path = DATA_DIR / filename
    target_list = UPLOAD_TARGETS[tipo]
    if path not in target_list:
        target_list.append(path)

    manifest = _read_manifest()
    entries = manifest.setdefault(tipo, [])
    if filename not in entries:
        entries.append(filename)
    _write_manifest(manifest)

    return path


# Al importar este módulo, restauramos cualquier archivo subido en sesiones anteriores.
_apply_manifest()