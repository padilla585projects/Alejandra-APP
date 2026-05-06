-- Tabla config para almacenar configuraciones clave-valor (filtros notificaciones, etc.)
CREATE TABLE IF NOT EXISTS config (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);
