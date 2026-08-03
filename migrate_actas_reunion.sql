-- ARC-011 fase 3 (ADR-0011) -- vertical "actas_reunion", quinto vertical migrado
--
-- Declara, con el esquema EXACTO que hoy tiene D1 (leido con PRAGMA table_info,
-- no el que el codigo "deberia" crear), la tabla de actas de reunion de obra
-- (gestionar_acta, NEW-49). Es una de las 105 tablas que solo existen porque
-- worker.js la crea en caliente; ninguna migracion versionada la declaraba
-- hasta ahora (ver docs/architecture/07-INVENTARIO-DDL-RUNTIME.md).
--
-- Fuente de cada columna:
--   id..created_at (14 columnas)     -> worker.js, ensureActasTable(), CREATE TABLE
--   hora..departamento (9 columnas)  -> worker.js, ensureActasTable(), bucle de
--                                        ALTER TABLE (NEW-49 enhancements + DEPT-01)
--
-- Verificado columna por columna contra D1 real (solo lectura, PRAGMA
-- table_info, autorizado por el Director 2026-08-03, misma ronda de lectura
-- que confirmo ARC-013 sin bugs nuevos): las 23 columnas coinciden exactamente,
-- incluida `departamento`. `updated_at` no lleva DEFAULT ni en el codigo
-- (ALTER TABLE ... ADD COLUMN updated_at TEXT, sin DEFAULT) ni en D1 -- a
-- diferencia de `created_at`, que si lo tiene desde el CREATE original.
--
-- Las 9 columnas ALTER se incorporan aqui directamente al CREATE (no como
-- ALTER separados), mismo motivo que el resto de verticales de ARC-011: D1 ya
-- las tiene, y un ALTER TABLE ADD COLUMN normal fallaria por columna duplicada
-- -- SQLite no admite "ADD COLUMN IF NOT EXISTS". CREATE TABLE IF NOT EXISTS
-- con el esquema completo es aditivo de verdad: si la tabla ya existe (caso
-- esperado en produccion) la sentencia no hace nada.
--
-- Riesgo: bajo. CREATE TABLE IF NOT EXISTS, aditivo, sin tocar ninguna fila
-- existente de ninguna tabla.
--
-- Paso 1 de 5 del ciclo de ADR-0011 (declarar). NO aplicada todavia: el paso 2
-- (aplicar y verificar contra D1 real) exige autorizacion explicita del
-- Director conforme a ADR-0007. El DDL en runtime de este vertical (worker.js,
-- ensureActasTable()) se deja intacto hasta que el paso 2 y el paso 4
-- (verificar en produccion sin el DDL en caliente) esten completos.

CREATE TABLE IF NOT EXISTS actas_reunion (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id         INTEGER,
  empresa_id      INTEGER NOT NULL,
  numero          TEXT,
  titulo          TEXT NOT NULL,
  tipo            TEXT DEFAULT 'progreso',
  fecha           TEXT,
  convocante      TEXT,
  asistentes      TEXT,
  resumen         TEXT,
  acuerdos        TEXT,
  proxima_reunion TEXT,
  estado          TEXT DEFAULT 'borrador',
  created_at      TEXT DEFAULT (datetime('now')),
  hora            TEXT,
  lugar           TEXT,
  convocados      TEXT,
  orden_dia       TEXT,
  puntos_tratados TEXT,
  pendientes      TEXT,
  redactor        TEXT,
  updated_at      TEXT,
  departamento    TEXT
);
