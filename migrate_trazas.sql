-- ARC-008-TRAZAS-MIGRACION -- Tabla de trazas (ADR-0014, seccion 1)
-- Compartida por alejandra-app-api y alejandra-agente (comparten alejandra-db).
-- No integra escritura real en ningun Worker todavia -- eso es trabajo aparte.

CREATE TABLE IF NOT EXISTS alejandra_trazas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  worker TEXT NOT NULL,              -- 'api' | 'agente'
  tipo TEXT NOT NULL,                -- 'decision' | 'ddl_error' | ... (extensible)
  empresa_id TEXT,                   -- aislamiento por tenant; NULL si no aplica (p.ej. DDL)
  usuario_id TEXT,
  resumen TEXT NOT NULL,             -- una linea legible, para listar sin parsear el JSON
  detalle_json TEXT NOT NULL         -- JSON con los campos especificos del tipo, minimizado/redactado
);

CREATE INDEX IF NOT EXISTS idx_trazas_ts   ON alejandra_trazas(ts);
CREATE INDEX IF NOT EXISTS idx_trazas_tipo ON alejandra_trazas(tipo, ts);
