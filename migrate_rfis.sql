-- ARC-011 fase 3 (ADR-0011) -- vertical "rfis", segundo vertical migrado
--
-- Declara, con el esquema EXACTO que hoy tiene D1 (leido con PRAGMA table_info,
-- no el que el codigo "deberia" crear), la tabla de RFIs (consultas tecnicas de
-- obra, NEW-34). Es una de las 105 tablas que solo existen porque worker.js la
-- crea en caliente; ninguna migracion versionada la declaraba hasta ahora (ver
-- docs/architecture/07-INVENTARIO-DDL-RUNTIME.md).
--
-- Fuente de cada columna:
--   id..created_at (18 columnas) -> worker.js, ensureRfisTable(), CREATE TABLE
--   departamento                 -> worker.js, ensureRfisTable(), ALTER TABLE
--                                    (DEPT-01, aislamiento por departamento)
--
-- Verificado columna por columna contra D1 real (solo lectura, PRAGMA
-- table_info): las 19 columnas coinciden exactamente, incluida `departamento`.
--
-- `departamento` se incorpora aqui directamente al CREATE (no como ALTER
-- separado): D1 ya la tiene (se anadio en runtime, DEPT-01), y un ALTER TABLE
-- ADD COLUMN normal fallaria por columna duplicada -- SQLite no admite
-- "ADD COLUMN IF NOT EXISTS". Declarar el esquema completo en un unico
-- CREATE TABLE IF NOT EXISTS es aditivo de verdad: si la tabla ya existe (caso
-- esperado en produccion) la sentencia no hace nada; solo crearia la columna
-- si la tabla se creara de cero en un entorno nuevo.
--
-- Riesgo: bajo. CREATE TABLE IF NOT EXISTS, aditivo, sin tocar ninguna fila
-- existente de ninguna tabla.
--
-- Paso 1 de 5 del ciclo de ADR-0011 (declarar). NO aplicada todavia: el paso 2
-- (aplicar y verificar contra D1 real) exige autorizacion explicita del
-- Director conforme a ADR-0007 -- una migracion D1 no es una accion reversible
-- sin ella, aunque el SQL en si sea aditivo. El DDL en runtime de este
-- vertical (worker.js, ensureRfisTable()) se deja intacto hasta que el paso 2
-- y el paso 4 (verificar en produccion sin el DDL en caliente) esten
-- completos.

CREATE TABLE IF NOT EXISTS rfis (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id         INTEGER,
  empresa_id      INTEGER NOT NULL,
  numero          TEXT,
  titulo          TEXT NOT NULL,
  categoria       TEXT DEFAULT 'otro',
  descripcion     TEXT,
  estado          TEXT DEFAULT 'abierta',
  prioridad       TEXT DEFAULT 'normal',
  creado_por      TEXT,
  asignado_a      TEXT,
  respuesta       TEXT,
  respondido_por  TEXT,
  fecha_respuesta TEXT,
  fecha_limite    TEXT,
  impacto_plazo   INTEGER DEFAULT 0,
  impacto_coste   INTEGER DEFAULT 0,
  created_at      TEXT DEFAULT (datetime('now')),
  departamento    TEXT
);
