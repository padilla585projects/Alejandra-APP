-- Migración: Módulo de Planos Técnicos
-- Fecha: 2026-07-05
-- Aplicar con: npx wrangler d1 execute alejandra-db --file=migrate_planos.sql

CREATE TABLE IF NOT EXISTS planos (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id     INTEGER NOT NULL,
  usuario_id     INTEGER,
  tipo           TEXT    NOT NULL CHECK(tipo IN ('planta','electrico','mecanico','gantt')),
  titulo         TEXT    NOT NULL,
  descripcion    TEXT,
  svg_data       TEXT    NOT NULL,
  metadatos      TEXT,
  creado_en      TEXT    DEFAULT (datetime('now')),
  actualizado_en TEXT    DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_planos_empresa ON planos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_planos_tipo    ON planos(empresa_id, tipo);
