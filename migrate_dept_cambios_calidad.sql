-- Aislamiento por departamento (DEPT-01) -- auditoria de Alejandra Office (10/08/2026)
-- Grupo "Cambios y calidad": ordenes de cambio, no conformidades y riesgos.
--
-- ordenes_cambio YA esta declarada (migrate_ordenes_cambio.sql, aplicada:true,
-- comentario propio confirma "este vertical no tiene columna departamento") --
-- se le anade con ALTER. ncrs_obra y riesgos_obra nunca se declararon (100%
-- DDL en runtime) -- se declaran aqui por primera vez, esquema EXACTO
-- verbatim contra worker.js (ncrs_obra l.18850, riesgos_obra l.19429), con
-- `departamento` incluido en el CREATE.
--
-- Riesgo: bajo, mismo patron aditivo que el resto de este lote.
--
-- Paso 1 de 5 del ciclo de ADR-0011 (declarar). NO aplicada todavia.

ALTER TABLE ordenes_cambio ADD COLUMN departamento TEXT;

CREATE TABLE IF NOT EXISTS ncrs_obra (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id        INTEGER NOT NULL,
  obra_id           INTEGER,
  ejecucion_id      INTEGER,
  numero            TEXT,
  descripcion       TEXT NOT NULL,
  gravedad          TEXT DEFAULT 'moderado',
  estado            TEXT DEFAULT 'abierta',
  responsable       TEXT,
  fecha_limite      TEXT,
  accion_correctiva TEXT,
  notas             TEXT,
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now')),
  cerrada_at        TEXT,
  departamento      TEXT
);

CREATE TABLE IF NOT EXISTS riesgos_obra (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id      INTEGER NOT NULL,
  obra_id         INTEGER,
  numero          TEXT,
  titulo          TEXT NOT NULL,
  descripcion     TEXT,
  categoria       TEXT DEFAULT 'general',
  probabilidad    TEXT DEFAULT 'media',
  impacto         TEXT DEFAULT 'medio',
  score           INTEGER DEFAULT 0,
  estado          TEXT DEFAULT 'activo',
  propietario     TEXT,
  plan_mitigacion TEXT,
  plan_contingencia TEXT,
  fecha_identificacion TEXT,
  fecha_revision  TEXT,
  coste_estimado  REAL DEFAULT 0,
  dias_impacto    INTEGER DEFAULT 0,
  notas           TEXT,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now')),
  departamento    TEXT
);
