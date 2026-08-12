-- Migración: Cuadros de campo (switches de carril DIN en exterior, suben por fibra a un IDF)
-- Fecha: 2026-08-12
-- Aplicar con: npx wrangler d1 execute alejandra-db --file=migrate_telecom_cuadros_campo.sql
-- NOTA: requiere aprobación humana antes de ejecutar contra D1 remoto (CLAUDE.md).

CREATE TABLE IF NOT EXISTS telecom_cuadros_campo (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id     INTEGER NOT NULL,
  obra_id        INTEGER NOT NULL,
  nombre         TEXT    NOT NULL,
  ubicacion      TEXT,
  marca          TEXT,
  modelo         TEXT,
  num_puertos    INTEGER NOT NULL DEFAULT 8,
  idf_destino_id INTEGER,
  notas          TEXT,
  creado_por     TEXT,
  creado_en      TEXT DEFAULT (datetime('now')),
  actualizado_en TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS telecom_cuadros_campo_puertos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  cuadro_id       INTEGER NOT NULL,
  empresa_id      INTEGER NOT NULL,
  numero          INTEGER NOT NULL,
  estado          TEXT DEFAULT 'libre',
  destino         TEXT,
  cable_label     TEXT,
  categoria       TEXT,
  notas           TEXT,
  actualizado_por TEXT,
  updated_at      TEXT DEFAULT (datetime('now')),
  UNIQUE(cuadro_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_telecom_cuadros_obra    ON telecom_cuadros_campo(obra_id, empresa_id);
CREATE INDEX IF NOT EXISTS idx_telecom_cuadros_puertos ON telecom_cuadros_campo_puertos(cuadro_id);
