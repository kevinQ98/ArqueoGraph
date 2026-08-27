-- Esquema SQLite principal de ArqueoGraph.
-- Archivo de referencia para IA/frontend. El backend real lo inicializa en backend/app/database.py.

PRAGMA foreign_keys = ON;

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

CREATE INDEX IF NOT EXISTS idx_individuos_sitio ON individuos(sitio);
CREATE INDEX IF NOT EXISTS idx_individuos_fuente ON individuos(fuente);
CREATE INDEX IF NOT EXISTS idx_mediciones_individuo ON mediciones_quimicas(id_individuo);
CREATE INDEX IF NOT EXISTS idx_mediciones_elemento ON mediciones_quimicas(elemento);
CREATE INDEX IF NOT EXISTS idx_mediciones_fuente ON mediciones_quimicas(fuente);
CREATE INDEX IF NOT EXISTS idx_paleopatologias_individuo ON paleopatologias(id_individuo);
CREATE INDEX IF NOT EXISTS idx_paleopatologias_patologia ON paleopatologias(patologia);
CREATE INDEX IF NOT EXISTS idx_dataciones_individuo ON dataciones(id_individuo);
CREATE INDEX IF NOT EXISTS idx_imagenes_individuo ON imagenes(id_individuo);
CREATE INDEX IF NOT EXISTS idx_imagenes_fuente ON imagenes(fuente);
