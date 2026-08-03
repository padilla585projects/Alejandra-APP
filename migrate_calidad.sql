-- ARC-011 fase 3 (ADR-0011) -- vertical "calidad", tercer vertical migrado
--
-- Declara, con el esquema EXACTO que hoy tiene D1 (leido con PRAGMA table_info,
-- no el que el codigo "deberia" crear), las dos tablas del dominio de control de
-- calidad de obra: control_calidad (NEW-37) y punch_list (NEW-44). Ambas son de
-- las 105 tablas que solo existen porque worker.js las crea en caliente; ninguna
-- migracion versionada las declaraba hasta ahora (ver
-- docs/architecture/07-INVENTARIO-DDL-RUNTIME.md).
--
-- Fuente de cada columna:
--   control_calidad: id..created_at (16 columnas) -> worker.js, ensureCalidadTable(),
--                     CREATE TABLE; departamento -> mismo, ALTER TABLE (DEPT-01)
--   punch_list:       id..created_at (16 columnas) -> worker.js, ensurePunchListTable(),
--                     CREATE TABLE; departamento -> mismo, ALTER TABLE (DEPT-01)
--
-- Verificado columna por columna contra D1 real (solo lectura, PRAGMA table_info,
-- autorizado por el Director 2026-08-03): las 17 columnas de cada tabla coinciden
-- exactamente, incluida `departamento`. Misma ronda de verificacion que confirmo
-- ARC-013 (docs/architecture/07-INVENTARIO-DDL-RUNTIME.md, "Segunda ronda").
--
-- `departamento` se incorpora aqui directamente al CREATE (no como ALTER
-- separado), mismo motivo que migrate_rfis.sql: D1 ya la tiene (DEPT-01), y un
-- ALTER TABLE ADD COLUMN normal fallaria por columna duplicada -- SQLite no
-- admite "ADD COLUMN IF NOT EXISTS". CREATE TABLE IF NOT EXISTS con el esquema
-- completo es aditivo de verdad: si la tabla ya existe (caso esperado en
-- produccion) la sentencia no hace nada.
--
-- Riesgo: bajo. Dos CREATE TABLE IF NOT EXISTS, aditivos, sin tocar ninguna fila
-- existente de ninguna tabla.
--
-- Paso 1 de 5 del ciclo de ADR-0011 (declarar). NO aplicada todavia: el paso 2
-- (aplicar y verificar contra D1 real) exige autorizacion explicita del Director
-- conforme a ADR-0007 -- una migracion D1 no es una accion reversible sin ella,
-- aunque el SQL en si sea aditivo. El DDL en runtime de este vertical (worker.js,
-- ensureCalidadTable()/ensurePunchListTable()) se deja intacto hasta que el paso 2
-- y el paso 4 (verificar en produccion sin el DDL en caliente) esten completos.

CREATE TABLE IF NOT EXISTS control_calidad (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id           INTEGER,
  empresa_id        INTEGER NOT NULL,
  numero            TEXT,
  titulo            TEXT NOT NULL,
  descripcion       TEXT,
  ubicacion         TEXT,
  categoria         TEXT DEFAULT 'otro',
  prioridad         TEXT DEFAULT 'normal',
  estado            TEXT DEFAULT 'abierto',
  responsable       TEXT,
  fecha_limite      TEXT,
  fecha_resolucion  TEXT,
  resuelto_por      TEXT,
  notas_resolucion  TEXT,
  created_at        TEXT DEFAULT (datetime('now')),
  departamento      TEXT
);

CREATE TABLE IF NOT EXISTS punch_list (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id        INTEGER NOT NULL,
  obra_id           INTEGER,
  numero            TEXT,
  descripcion       TEXT NOT NULL,
  categoria         TEXT DEFAULT 'acabados',
  ubicacion         TEXT,
  responsable       TEXT,
  prioridad         TEXT DEFAULT 'media',
  estado            TEXT DEFAULT 'abierto',
  fecha_limite      TEXT,
  fecha_cierre      TEXT,
  notas_resolucion  TEXT,
  foto_key          TEXT,
  creado_por        TEXT,
  created_at        TEXT DEFAULT (datetime('now')),
  departamento      TEXT
);
