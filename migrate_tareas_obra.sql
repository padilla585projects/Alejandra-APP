-- ARC-011 fase 3 (ADR-0011) -- vertical "tareas_obra", cuarto vertical migrado
--
-- Declara, con el esquema EXACTO que hoy tiene D1 (leido con PRAGMA table_info,
-- no el que el codigo "deberia" crear), la tabla de tareas de obra (gestionar_tarea).
-- Es una de las 105 tablas que solo existen porque worker.js la crea en caliente;
-- ninguna migracion versionada la declaraba hasta ahora (ver
-- docs/architecture/07-INVENTARIO-DDL-RUNTIME.md).
--
-- Fuente de cada columna:
--   id..updated_at (15 columnas) -> worker.js, ensureTareasObraTable(), CREATE TABLE
--   departamento                 -> worker.js, ensureTareasObraTable(), ALTER TABLE
--                                    (DEPT-01, aislamiento por departamento)
--
-- Verificado columna por columna contra D1 real (solo lectura, PRAGMA
-- table_info, autorizado por el Director 2026-08-03, misma ronda de lectura
-- que confirmo ARC-013 sin bugs nuevos): las 16 columnas coinciden exactamente,
-- incluida `departamento`.
--
-- `departamento` se incorpora aqui directamente al CREATE (no como ALTER
-- separado), mismo motivo que migrate_rfis.sql/migrate_calidad.sql: D1 ya la
-- tiene (DEPT-01), y un ALTER TABLE ADD COLUMN normal fallaria por columna
-- duplicada -- SQLite no admite "ADD COLUMN IF NOT EXISTS". CREATE TABLE IF
-- NOT EXISTS con el esquema completo es aditivo de verdad: si la tabla ya
-- existe (caso esperado en produccion) la sentencia no hace nada.
--
-- Riesgo: bajo. CREATE TABLE IF NOT EXISTS, aditivo, sin tocar ninguna fila
-- existente de ninguna tabla.
--
-- Paso 1 de 5 del ciclo de ADR-0011 (declarar). NO aplicada todavia: el paso 2
-- (aplicar y verificar contra D1 real) exige autorizacion explicita del
-- Director conforme a ADR-0007. El DDL en runtime de este vertical (worker.js,
-- ensureTareasObraTable()) se deja intacto hasta que el paso 2 y el paso 4
-- (verificar en produccion sin el DDL en caliente) esten completos.

CREATE TABLE IF NOT EXISTS tareas_obra (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  obra_id      INTEGER,
  empresa_id   INTEGER NOT NULL,
  titulo       TEXT NOT NULL,
  descripcion  TEXT,
  asignado_a   TEXT,
  fase_id      INTEGER,
  estado       TEXT DEFAULT 'pendiente',
  prioridad    TEXT DEFAULT 'normal',
  fecha_limite TEXT,
  ubicacion    TEXT,
  notas        TEXT,
  created_by   TEXT,
  created_at   TEXT DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now')),
  departamento TEXT
);
