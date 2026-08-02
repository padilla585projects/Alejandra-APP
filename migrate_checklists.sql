-- ARC-011 fase 3 (ADR-0011) — vertical "checklists", primer vertical migrado
--
-- Declara, con el esquema EXACTO que hoy crea el codigo (no el que "deberia"
-- tener), las cuatro tablas del vertical de checklists. Las cuatro son de las
-- 105 tablas que solo existen porque worker.js las crea en caliente; ninguna
-- migracion versionada las declaraba hasta ahora (ver
-- docs/architecture/07-INVENTARIO-DDL-RUNTIME.md).
--
-- checklist_plantillas y checklists_plantillas son tablas DISTINTAS, no una
-- errata (confirmado en ARC-015): la primera son preguntas de checklist por
-- tipo de equipo (worker.js:14196), la segunda son plantillas de checklist de
-- obra con items en JSON (worker.js:18122, NEW-55 QA/QC).
--
-- Fuente de cada CREATE, columna por columna:
--   checklist_plantillas   -> worker.js:14196
--   checklist_registros    -> worker.js:14207
--   checklists_plantillas  -> worker.js:18122
--   checklist_ejecuciones  -> worker.js:18134
--
-- Riesgo: bajo. Los cuatro CREATE usan IF NOT EXISTS: aplicar esta migracion
-- contra D1 es aditivo y no toca ninguna fila existente si las tablas ya
-- estan creadas por el runtime, que es el caso esperado en produccion.
--
-- Paso 1 de 5 del ciclo de ADR-0011 (declarar).
-- Paso 2 (aplicar contra D1) -- COMPLETADO 2026-08-02, run 30758297243,
-- autorizado por el Director en chat. Las 4 tablas ya existian, verificadas
-- columna por columna antes y despues; no-op confirmado (0 rows_written).
-- Paso 3 (retirar el DDL en runtime de este vertical) -- COMPLETADO 2026-08-02:
-- ver worker.js, funciones runMigrations() y ensureQATablas() (el CREATE queda
-- comentado, no borrado, con referencia a esta migracion).
-- Paso 4 (verificar el vertical en produccion sin el DDL en caliente) --
-- pendiente del proximo despliegue de worker.js.

CREATE TABLE IF NOT EXISTS checklist_plantillas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id  INTEGER NOT NULL,
  tipo_equipo TEXT NOT NULL,
  pregunta    TEXT NOT NULL,
  orden       INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS checklist_registros (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id    INTEGER NOT NULL,
  obra_id       INTEGER,
  tipo_equipo   TEXT NOT NULL,
  equipo_id     INTEGER NOT NULL,
  equipo_mat    TEXT,
  resultado     TEXT NOT NULL,
  respuestas    TEXT NOT NULL,
  comentario    TEXT,
  realizado_por TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS checklists_plantillas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id  INTEGER NOT NULL,
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  categoria   TEXT DEFAULT 'general',
  items       TEXT DEFAULT '[]',
  activa      INTEGER DEFAULT 1,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS checklist_ejecuciones (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id             INTEGER NOT NULL,
  obra_id                INTEGER,
  plantilla_id           INTEGER,
  plantilla_nombre       TEXT,
  titulo                 TEXT NOT NULL,
  fecha                  TEXT,
  inspector              TEXT,
  estado                 TEXT DEFAULT 'en_curso',
  resultados             TEXT DEFAULT '[]',
  notas_generales        TEXT,
  num_ok                 INTEGER DEFAULT 0,
  num_nok                INTEGER DEFAULT 0,
  num_na                 INTEGER DEFAULT 0,
  porcentaje_conformidad REAL DEFAULT 0,
  created_at             TEXT DEFAULT (datetime('now')),
  updated_at             TEXT DEFAULT (datetime('now'))
);
