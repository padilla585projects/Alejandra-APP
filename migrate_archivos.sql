-- Migración: tabla de metadatos de archivos R2 (NEW-03 + MEJ-13)
-- Aplicar en: alejandra-db (cuenta nueva, app nueva)

CREATE TABLE IF NOT EXISTS archivos (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id     INTEGER NOT NULL,
  herramienta_id INTEGER,           -- NULL = archivo de empresa; valor = archivo de herramienta
  r2_key         TEXT NOT NULL,     -- clave única en R2 (e{empresa_id}/herr/{hid}/ts_name o e{empresa_id}/docs/ts_name)
  nombre         TEXT NOT NULL,     -- nombre original del archivo
  mime           TEXT,              -- MIME type (image/jpeg, application/pdf, etc.)
  tamano         INTEGER,           -- tamaño en bytes
  subido_por     TEXT,              -- nombre del usuario que subió
  created_at     TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_archivos_empresa     ON archivos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_archivos_herramienta ON archivos(empresa_id, herramienta_id);
