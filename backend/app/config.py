from pathlib import Path

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