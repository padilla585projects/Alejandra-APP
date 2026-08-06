-- ADR-0021: Tabla de telemetría de fuentes Nexo
-- Almacena cada consulta a una fuente externa para métricas por fuente/empresa.

CREATE TABLE IF NOT EXISTS nexo_fuentes_telemetria (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  fuente_id     TEXT NOT NULL,
  empresa_id    TEXT,
  usuario_id    TEXT,
  consulta      TEXT,
  resultados    INTEGER DEFAULT 0,
  latencia_ms   INTEGER DEFAULT 0,
  cache_hit     INTEGER DEFAULT 0,
  created_at    TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_nexo_telemetria_fuente ON nexo_fuentes_telemetria(fuente_id);
CREATE INDEX IF NOT EXISTS idx_nexo_telemetria_empresa ON nexo_fuentes_telemetria(empresa_id);
