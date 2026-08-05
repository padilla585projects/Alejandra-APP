-- Migración: Sondas CPD (temperatura/humedad/presión diferencial)
-- Fecha: 2026-08-05
-- Aplicar con: npx wrangler d1 execute alejandra-db --file=migrate_cpd_sondas.sql
-- NOTA: requiere aprobación humana antes de ejecutar contra D1 remoto (CLAUDE.md).

CREATE TABLE IF NOT EXISTS cpd_planos (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id     INTEGER NOT NULL,
  obra_id        INTEGER NOT NULL,
  titulo         TEXT    NOT NULL,
  r2_key         TEXT    NOT NULL,
  zonas_json     TEXT,
  creado_por     TEXT,
  creado_en      TEXT DEFAULT (datetime('now')),
  actualizado_en TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cpd_sondas (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  plano_id       INTEGER NOT NULL,
  empresa_id     INTEGER NOT NULL,
  nombre         TEXT    NOT NULL,
  numero_serie   TEXT,
  zona           TEXT,
  pos_x          REAL    NOT NULL,
  pos_y          REAL    NOT NULL,
  creado_en      TEXT DEFAULT (datetime('now')),
  actualizado_en TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cpd_lecturas (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  sonda_id              INTEGER NOT NULL,
  temperatura           REAL,
  humedad               REAL,
  presion_diferencial   REAL,
  fecha                 TEXT NOT NULL DEFAULT (datetime('now')),
  usuario               TEXT
);

CREATE INDEX IF NOT EXISTS idx_cpd_planos_obra        ON cpd_planos(obra_id);
CREATE INDEX IF NOT EXISTS idx_cpd_sondas_plano        ON cpd_sondas(plano_id);
CREATE INDEX IF NOT EXISTS idx_cpd_lecturas_sonda_fecha ON cpd_lecturas(sonda_id, fecha);
