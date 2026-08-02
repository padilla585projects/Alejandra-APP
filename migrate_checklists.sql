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
-- Paso 1 de 5 del ciclo de ADR-0011 (declarar). NO aplicada todavia: el paso
-- 2 (aplicar y verificar columna por columna contra D1 real) exige
-- autorizacion explicita del Director conforme a ADR-0007 -- una migracion D1
-- no es una accion reversible sin ella, aunque el SQL en si sea aditivo. El
-- DDL en runtime de este vertical (worker.js:14196-14221, 18122-18152) se
-- deja intacto hasta que el paso 2 y el paso 4 (verificar en produccion sin
-- el DDL en caliente) esten completos.

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
